// WGS84/ETRS89 (lon, lat) → UTM zone 32N (EPSG:25832). Krüger-serie, cm-præcision
// er rigeligt til at tegne et datasæts udstrækning på oversigtskortet.
const a = 6378137;
const f = 1 / 298.257222101;
const k0 = 0.9996;
const lon0 = (9 * Math.PI) / 180;
const n = f / (2 - f);
const A = (a / (1 + n)) * (1 + n ** 2 / 4 + n ** 4 / 64);
const alpha = [n / 2 - (2 * n ** 2) / 3 + (5 * n ** 3) / 16, (13 * n ** 2) / 48 - (3 * n ** 3) / 5, (61 * n ** 3) / 240];
const e = Math.sqrt(f * (2 - f));

export function toUtm32(lon: number, lat: number): [number, number] {
  const phi = (lat * Math.PI) / 180;
  const lambda = (lon * Math.PI) / 180 - lon0;
  const t = Math.sinh(Math.atanh(Math.sin(phi)) - e * Math.atanh(e * Math.sin(phi)));
  const xi = Math.atan2(t, Math.cos(lambda));
  const eta = Math.atanh(Math.sin(lambda) / Math.sqrt(1 + t * t));
  let x = eta;
  let y = xi;
  for (let j = 1; j <= 3; j++) {
    y += alpha[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
    x += alpha[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
  }
  return [500000 + k0 * A * x, k0 * A * y];
}
