// Høster STAC-kataloget fra den offentlige S3-bucket og skriver et kompakt
// indeks til src/data/catalog.json, som Astro bruger ved build.
//
//   node scripts/fetch-catalog.mjs
import { writeFile, mkdir } from 'node:fs/promises';

const BUCKET = 'gc2-parquet';
const PREFIX = 'centia-io/dk';
const HTTP_ROOT = `https://${BUCKET}.s3.amazonaws.com/${PREFIX}`;
const S3_ROOT = `s3://${BUCKET}/${PREFIX}`;
const CONCURRENCY = 24;

async function json(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function size(url) {
  const res = await fetch(url, { method: 'HEAD' });
  if (!res.ok) return null;
  const len = res.headers.get('content-length');
  return len ? Number(len) : null;
}

async function pool(items, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (i < items.length) {
        const idx = i++;
        try {
          out[idx] = await fn(items[idx]);
        } catch (err) {
          console.warn(`  ! ${items[idx].href}: ${err.message}`);
          out[idx] = null;
        }
      }
    }),
  );
  return out;
}

const resolve = (base, href) => new URL(href, base).href;

async function harvest(link) {
  const collectionUrl = resolve(`${HTTP_ROOT}/catalog.json`, link.href);
  const dir = collectionUrl.replace(/collection\.json$/, '');
  const m = dir.match(/schema=([^/]+)\/relation=([^/]+)\//);
  const [, schema, relation] = m;

  const [collection, latest] = await Promise.all([
    json(collectionUrl),
    json(`${dir}latest.json`),
  ]);

  const snapshots = collection.links
    .filter((l) => l.rel === 'item')
    .map((l) => l.href.match(/_gc2_snapshot_date=([\d-]+)/)?.[1])
    .filter(Boolean)
    .sort()
    .reverse();

  const itemUrl = resolve(dir, latest.item);
  const item = await json(itemUrl);

  // Rækketal pr. snapshot, så historikken kan vises
  const history = await Promise.all(
    snapshots.map(async (date) => {
      if (date === latest.snapshot_date) return { date, rows: item.properties?.['gc2:row_count'] ?? null };
      const it = await json(`${dir}_gc2_snapshot_date=${date}/item.json`).catch(() => null);
      return { date, rows: it?.properties?.['gc2:row_count'] ?? null };
    }),
  );
  const metaHref = latest.assets.metadata?.href;
  const meta = metaHref ? await json(resolve(dir, metaHref)).catch(() => null) : null;

  const assets = {};
  for (const [key, a] of Object.entries(latest.assets)) {
    if (key === 'metadata') continue;
    const http = resolve(dir, a.href);
    const fmt = a.type.includes('flatgeobuf') ? 'fgb' : 'parquet';
    assets[fmt] = {
      http,
      s3: http.replace(`https://${BUCKET}.s3.amazonaws.com`, `s3://${BUCKET}`),
      size: await size(http),
    };
  }

  const columns = (meta?.schema ?? []).map((c) => ({ name: c.column_name, type: c.data_type }));
  const geomCol = columns.find((c) => c.type.startsWith('geometry'));

  return {
    id: collection.id,
    schema,
    relation,
    title: collection.title ?? collection.id,
    description: collection.description ?? '',
    bbox: collection.extent?.spatial?.bbox?.[0] ?? null,
    srs: item.properties?.['proj:code'] ?? null,
    rows: item.properties?.['gc2:row_count'] ?? meta?.row_count ?? null,
    latest: latest.snapshot_date,
    snapshots,
    history,
    assets,
    columns,
    geometry: geomCol ? { column: geomCol.name, type: geomCol.type.match(/\((\w+)/)?.[1] ?? 'Geometry' } : null,
    s3Prefix: `${S3_ROOT}/schema=${schema}/relation=${relation}/`,
    httpPrefix: `${HTTP_ROOT}/schema=${schema}/relation=${relation}/`,
  };
}

console.log(`Henter ${HTTP_ROOT}/catalog.json`);
const catalog = await json(`${HTTP_ROOT}/catalog.json`);
const children = catalog.links.filter((l) => l.rel === 'child');
console.log(`  ${children.length} collections`);

const datasets = (await pool(children, harvest)).filter(Boolean);
datasets.sort((a, b) => a.id.localeCompare(b.id, 'da'));

await mkdir(new URL('../src/data/', import.meta.url), { recursive: true });
await writeFile(
  new URL('../src/data/catalog.json', import.meta.url),
  JSON.stringify({ generated: new Date().toISOString(), httpRoot: HTTP_ROOT, s3Root: S3_ROOT, datasets }, null, 1),
);
console.log(`Skrev ${datasets.length} datasæt til src/data/catalog.json`);
