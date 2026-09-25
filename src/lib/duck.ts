// DuckDB-WASM i browseren. Indlæses først, når nogen trykker "Kør", så siderne ikke
// betaler for de ca. 10 MB WASM ved almindelig visning.
import { DATA_BASE } from './live';

const WASM_VERSION = '1.33.1-dev57.0';
const CDN = `https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@${WASM_VERSION}`;

type DuckModule = typeof import('@duckdb/duckdb-wasm');
type Db = import('@duckdb/duckdb-wasm').AsyncDuckDB;

let dbPromise: Promise<{ db: Db; worker: Worker }> | null = null;

async function start() {
  const duckdb: DuckModule = await import(/* @vite-ignore */ `${CDN}/+esm`);
  const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' }),
  );
  const worker = new Worker(workerUrl);
  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(workerUrl);
  // Brug altid range-læsninger (HTTP 206), så kun de nødvendige dele af filerne hentes.
  // Uden dette falder DuckDB-WASM tilbage til at hente hele filer, fx 1,2 GB for bbr.bygning.
  await db.open({
    filesystem: { reliableHeadRequests: true, allowFullHTTPReads: false, forceFullHTTPReads: false },
  });
  const conn = await db.connect();
  await conn.query('LOAD spatial;');
  await conn.close();
  return { db, worker };
}

function getDb() {
  dbPromise ??= start().catch((err) => {
    dbPromise = null;
    throw err;
  });
  return dbPromise;
}

// Ventende forespørgsler, der skal afvises, hvis brugeren trykker Stop
const aborters = new Set<(err: Error) => void>();

/** Stopper en igangværende forespørgsel ved at lukke DuckDB helt ned. */
export async function stop() {
  for (const abort of aborters) abort(new Error('Forespørgslen blev stoppet.'));
  aborters.clear();
  if (!dbPromise) return;
  const p = dbPromise;
  dbPromise = null;
  try {
    const { db, worker } = await p;
    await db.terminate().catch(() => {});
    worker.terminate();
  } catch {
    /* allerede nede */
  }
}

// --- dk(), dk_at() og dk_alle() ------------------------------------------------------
// Over HTTP kan DuckDB ikke liste filer med jokertegn, så makroerne erstattes af en
// eksplicit filliste, som slås op i STAC-filerne ved siden af data.

const jsonCache = new Map<string, Promise<any>>();
function json(url: string) {
  if (!jsonCache.has(url)) {
    jsonCache.set(
      url,
      fetch(url).then((r) => {
        if (!r.ok) throw new Error(`Kunne ikke hente ${url} (${r.status})`);
        return r.json();
      }),
    );
  }
  return jsonCache.get(url)!;
}

const dirOf = (s: string, r: string) => `${DATA_BASE}/schema=${s}/relation=${r}/`;
const abs = (dir: string, href: string) => new URL(href, dir).href;

async function snapshotDates(s: string, r: string): Promise<string[]> {
  const col = await json(`${dirOf(s, r)}collection.json`).catch(() => {
    throw new Error(`Datasættet ${s}.${r} findes ikke.`);
  });
  return col.links
    .filter((l: any) => l.rel === 'item')
    .map((l: any) => l.href.match(/_gc2_snapshot_date=([\d-]+)/)?.[1])
    .filter(Boolean)
    .sort();
}

async function fileFor(s: string, r: string, date: string): Promise<string> {
  const dir = `${dirOf(s, r)}_gc2_snapshot_date=${date}/`;
  const item = await json(`${dir}item.json`);
  return abs(dir, item.assets.data.href);
}

async function filesFor(fn: string, s: string, r: string, date?: string): Promise<string[]> {
  if (fn === 'dk') {
    const latest = await json(`${dirOf(s, r)}latest.json`).catch(() => {
      throw new Error(`Datasættet ${s}.${r} findes ikke.`);
    });
    return [abs(dirOf(s, r), latest.assets.data.href)];
  }
  const dates = await snapshotDates(s, r);
  if (fn === 'dk_alle') return Promise.all(dates.map((d) => fileFor(s, r, d)));
  const hit = dates.filter((d) => d <= date!).at(-1);
  if (!hit) throw new Error(`${s}.${r} har intet snapshot på eller før ${date}. Det første er fra ${dates[0]}.`);
  return [await fileFor(s, r, hit)];
}

const CALL = /\b(dk_alle|dk_at|dk)\s*\(\s*'([^']+)'\s*,\s*'([^']+)'\s*(?:,\s*'([^']+)'\s*)?\)/g;

/** Markerer hvilke tegn der er kode (ikke kommentarer, strenge eller citerede navne). */
function codeMask(sql: string): boolean[] {
  const mask = new Array<boolean>(sql.length).fill(true);
  let i = 0;
  while (i < sql.length) {
    const two = sql.slice(i, i + 2);
    let end = -1;
    if (two === '--') end = sql.indexOf('\n', i) === -1 ? sql.length : sql.indexOf('\n', i);
    else if (two === '/*') end = sql.indexOf('*/', i + 2) === -1 ? sql.length : sql.indexOf('*/', i + 2) + 2;
    else if (sql[i] === "'" || sql[i] === '"') {
      const q = sql[i];
      let j = i + 1;
      while (j < sql.length && !(sql[j] === q && sql[j + 1] !== q)) j += sql[j] === q ? 2 : 1;
      end = j + 1;
    }
    if (end === -1) {
      i++;
      continue;
    }
    for (let k = i; k < end; k++) mask[k] = false;
    i = end;
  }
  return mask;
}

/** Erstatter dk()-kald i koden med read_parquet over de konkrete filer. */
export async function resolveSql(sql: string) {
  const mask = codeMask(sql);
  const calls = [...sql.matchAll(CALL)].filter((m) => mask[m.index!]);
  const files = await Promise.all(calls.map((m) => filesFor(m[1], m[2], m[3], m[4])));
  let resolved = '';
  let pos = 0;
  calls.forEach((m, i) => {
    const list = files[i].map((u) => `'${u.replaceAll("'", "''")}'`).join(', ');
    resolved += sql.slice(pos, m.index) + `(SELECT * FROM read_parquet([${list}], hive_partitioning = true, union_by_name = true))`;
    pos = m.index! + m[0].length;
  });
  resolved += sql.slice(pos);
  return { sql: resolved, files: files.flat() };
}

// init.sql er skrevet til DuckDB-CLI'en. I browseren er udvidelserne indlæst, og makroerne
// erstattes af resolveSql, så de linjer springes over.
function stripCliSetup(sql: string) {
  return sql
    .replace(/^\s*(INSTALL|LOAD)\s+\w+\s*;/gim, '')
    .replace(/^\s*SET\s+s3_region\s*=\s*'[^']*'\s*;/gim, '')
    .replace(/CREATE\s+OR\s+REPLACE\s+MACRO\s+(dk|dk_at|dk_alle)\b[\s\S]*?;\s*$/gim, '');
}

// --- Kørsel og formatering -------------------------------------------------------------

export interface Result {
  columns: string[];
  rows: string[][];
  numeric: boolean[];
  nowrap: boolean[];
  total: number;
  seconds: number;
}

// Samme regel som de statiske tabeller: tusindtalsseparator, undtagen i kolonner med årstal
const isYear = (col: string) => /(år|aar|year)$/i.test(col);

function format(v: unknown, typeName: string, col: string): string {
  if (v == null) return '';
  if (typeof v === 'bigint') return isYear(col) ? v.toString() : v.toLocaleString('da-DK');
  if (typeof v === 'number') {
    if (/^Date/.test(typeName)) return new Date(v).toISOString().slice(0, 10);
    if (/^Timestamp/.test(typeName)) return new Date(v).toISOString().replace('T', ' ').slice(0, 19);
    if (isYear(col)) return String(v);
    return v.toLocaleString('da-DK', { maximumFractionDigits: /^(Int|Uint)/.test(typeName) ? 0 : 6 });
  }
  if (v instanceof Uint8Array) return `‹binær, ${v.length} bytes›`;
  if (typeof v === 'object') return JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? x.toString() : x));
  return String(v);
}

export async function run(sqlText: string, maxRows = 500): Promise<Result> {
  let abort!: (err: Error) => void;
  const aborted = new Promise<never>((_, reject) => (abort = reject));
  aborters.add(abort);
  try {
    return await Promise.race([execute(sqlText, maxRows), aborted]);
  } finally {
    aborters.delete(abort);
  }
}

async function execute(sqlText: string, maxRows: number): Promise<Result> {
  const t0 = performance.now();
  const { sql } = await resolveSql(stripCliSetup(sqlText));
  const { db } = await getDb();
  const conn = await db.connect();
  try {
    const table = await conn.query(sql);
    const fields = table.schema.fields;
    const rows: string[][] = [];
    const n = Math.min(table.numRows, maxRows);
    for (let i = 0; i < n; i++) {
      const row = table.get(i)!;
      rows.push(fields.map((f) => format((row as any)[f.name], String(f.type), f.name)));
    }
    return {
      columns: fields.map((f) => f.name),
      rows,
      numeric: fields.map((f) => /^(Int|Uint|Float|Decimal)/.test(String(f.type))),
      nowrap: fields.map((f) => /^(Date|Timestamp)/.test(String(f.type))),
      total: table.numRows,
      seconds: (performance.now() - t0) / 1000,
    };
  } finally {
    await conn.close().catch(() => {});
  }
}
