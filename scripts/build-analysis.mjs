// Kører eksempel-forespørgslerne og kommuneanalysen med DuckDB direkte mod
// S3-bucketen og gemmer resultaterne i src/data/, så sitet viser rigtige tal.
//
//   node scripts/build-analysis.mjs          (kræver duckdb-CLI i PATH)
import { execFileSync } from 'node:child_process';
import { readFile, readdir, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = new URL('../', import.meta.url);
const extDir = process.env.DUCKDB_EXTENSION_DIRECTORY;
const init =
  (extDir ? `SET extension_directory = '${extDir}';\n` : '') +
  (await readFile(new URL('scripts/duckdb/init.sql', root), 'utf8'));

function duckdb(sql) {
  const out = execFileSync('duckdb', ['-json'], {
    input: `${init}\n${sql}`,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  return out.trim() ? JSON.parse(out) : [];
}

function parseHeader(sql) {
  const meta = {};
  for (const line of sql.split('\n')) {
    const m = line.match(/^--\s*(\w+):\s*(.*)$/);
    if (!m) break;
    meta[m[1]] = m[2].trim();
  }
  const body = sql.split('\n').filter((l) => !/^--\s*\w+:/.test(l)).join('\n').trim();
  return { ...meta, datasets: meta.datasets?.split(/,\s*/) ?? [], sql: body };
}

// Eksempler
const dir = new URL('scripts/examples/', root);
const examples = [];
for (const file of (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()) {
  const ex = parseHeader(await readFile(new URL(file, dir), 'utf8'));
  process.stdout.write(`  ${file} … `);
  const t0 = performance.now();
  ex.rows = duckdb(ex.sql);
  ex.seconds = Math.round((performance.now() - t0) / 100) / 10;
  ex.slug = file.replace(/^\d+-|\.sql$/g, '');
  console.log(`${ex.rows.length} rækker, ${ex.seconds}s`);
  examples.push(ex);
}
await writeFile(new URL('src/data/examples.json', root), JSON.stringify({ generated: new Date().toISOString(), examples }, null, 1));

// Kommuneanalyse til kortet
process.stdout.write('  kommuner … ');
const tmp = join(await mkdtemp(join(tmpdir(), 'dg-')), 'kommuner.json');
const kommuneSql = (await readFile(new URL('scripts/duckdb/kommuner.sql', root), 'utf8')).replace('{{OUT}}', tmp);
duckdb(kommuneSql);
const kommuner = JSON.parse(await readFile(tmp, 'utf8'));

// WKT (EPSG:25832) → SVG-path. y vendes, så nord er op.
function ringToPath(ring) {
  return 'M' + ring.map(([x, y]) => `${Math.round(x / 100)} ${Math.round(-y / 100)}`).join('L') + 'Z';
}
function wktToPath(wkt) {
  const polys = wkt
    .replace(/^MULTIPOLYGON\s*\(\(\(|^POLYGON\s*\(\(|\)\)\)?$/g, '')
    .split(/\)\)\s*,\s*\(\(/);
  return polys
    .flatMap((p) => p.split(/\)\s*,\s*\(/))
    .map((ring) => ringToPath(ring.split(',').map((pt) => pt.trim().split(/\s+/).map(Number))))
    .join('');
}

let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
for (const k of kommuner) {
  for (const [, x, y] of k.wkt.matchAll(/(-?[\d.]+)\s+(-?[\d.]+)/g)) {
    minX = Math.min(minX, x / 100); maxX = Math.max(maxX, x / 100);
    minY = Math.min(minY, -y / 100); maxY = Math.max(maxY, -y / 100);
  }
  k.path = wktToPath(k.wkt);
  delete k.wkt;
}
const viewBox = [minX, minY, maxX - minX, maxY - minY].map(Math.round).join(' ');

// Grov kontur af Danmark til minikortene på datasæt-siderne
const [{ wkt: outlineWkt }] = duckdb(`
  SELECT ST_AsText(ST_ReducePrecision(ST_SimplifyPreserveTopology(ST_Union_Agg(the_geom), 1500), 100)) AS wkt
  FROM (SELECT unnest(ST_Dump(the_geom)).geom AS the_geom FROM dk('dagi', 'danmark'))
  WHERE ST_Area(the_geom) > 4e6`);
const outline = wktToPath(outlineWkt);

await writeFile(new URL('src/data/kommuner.json', root), JSON.stringify({ generated: new Date().toISOString(), viewBox, outline, kommuner }));
console.log(`${kommuner.length} kommuner`);
