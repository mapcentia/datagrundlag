// Let modul, der indlæses på alle sider: afgør om bucketen kan læses fra browseren.
// DuckDB-WASM kræver, at bucketens CORS tillader HEAD og eksponerer Content-Range.
// Indtil det er på plads, forbliver alle live-funktioner skjulte.

export const DATA_BASE: string =
  import.meta.env.PUBLIC_DATA_BASE ?? 'https://gc2-parquet.s3.amazonaws.com/centia-io/dk';

const KEY = `dg-live:${DATA_BASE}`;

export async function liveAvailable(): Promise<boolean> {
  try {
    const cached = sessionStorage.getItem(KEY);
    if (cached) return cached === '1';
  } catch {
    /* ingen sessionStorage */
  }
  let ok = false;
  try {
    const url = `${DATA_BASE}/catalog.json`;
    const head = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    const range = await fetch(url, { headers: { Range: 'bytes=0-0' }, cache: 'no-store' });
    ok = head.ok && range.status === 206 && range.headers.get('content-range') != null;
  } catch {
    ok = false;
  }
  try {
    sessionStorage.setItem(KEY, ok ? '1' : '0');
  } catch {
    /* ignorer */
  }
  return ok;
}
