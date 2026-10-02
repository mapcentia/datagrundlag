import raw from '../data/catalog.json';

export interface Asset {
  http: string;
  s3: string;
  size: number | null;
}

export interface Dataset {
  id: string;
  schema: string;
  relation: string;
  title: string;
  description: string;
  bbox: [number, number, number, number] | null;
  srs: string | null;
  rows: number | null;
  latest: string;
  snapshots: string[];
  history: { date: string; rows: number | null }[];
  assets: { parquet?: Asset; fgb?: Asset };
  columns: { name: string; type: string }[];
  geometry: { column: string; type: string } | null;
  s3Prefix: string;
  httpPrefix: string;
}

export type Domain = 'ejendom' | 'natur' | 'kyst' | 'kort';

export const domains: Record<Domain, { name: string; blurb: string }> = {
  ejendom: {
    name: 'Adresser, ejendomme og virksomheder',
    blurb: 'Grunddataregistrene: hvem, hvad og hvor i det danske samfund.',
  },
  natur: {
    name: 'Natur, vand og miljø',
    blurb: 'Beskyttet natur, artsfund, grundvand og forurenet jord.',
  },
  kyst: {
    name: 'Kyst og landbrug',
    blurb: 'Erosion, redningsveje ved strandene og landbrugets arealer.',
  },
  kort: {
    name: 'Kort, planer og kulturarv',
    blurb: 'Topografi, lokalplaner, kommunale fagdata og fredede bygninger.',
  },
};

export interface Source {
  name: string;
  full: string;
  owner: string;
  domain: Domain;
}

export const sources: Record<string, Source> = {
  dar: { name: 'DAR', full: 'Danmarks Adresseregister', owner: 'Klimadatastyrelsen', domain: 'ejendom' },
  bbr: { name: 'BBR', full: 'Bygnings- og Boligregistret', owner: 'Vurderingsstyrelsen', domain: 'ejendom' },
  matrikel: { name: 'Matriklen', full: 'Matrikulære data og ejendomme', owner: 'Klimadatastyrelsen', domain: 'ejendom' },
  cvr: { name: 'CVR', full: 'Det Centrale Virksomhedsregister', owner: 'Erhvervsstyrelsen', domain: 'ejendom' },
  dagi: { name: 'DAGI', full: 'Danmarks Administrative Geografiske Inddeling', owner: 'Klimadatastyrelsen', domain: 'ejendom' },
  danmarksarealinformation: { name: 'Danmarks Arealinformation', full: 'Beskyttet natur, Natura 2000 og byggelinjer', owner: 'Miljøstyrelsen', domain: 'natur' },
  naturdatabasen: { name: 'Naturdatabasen', full: 'Artsfund, naturtyper og overvågning', owner: 'Danmarks Miljøportal', domain: 'natur' },
  dkjord: { name: 'DKjord', full: 'Kortlagt jordforurening', owner: 'Regionerne', domain: 'natur' },
  grukos: { name: 'GRUKOS', full: 'Grundvandskortlægning', owner: 'Miljøstyrelsen', domain: 'natur' },
  geus: { name: 'Jupiter', full: 'Boringer og vandindvinding', owner: 'GEUS', domain: 'natur' },
  puls: { name: 'PULS', full: 'Badevand, renseanlæg og akvakultur', owner: 'Danmarks Miljøportal', domain: 'natur' },
  kystatlas: { name: 'Kystatlas', full: 'Erosion og kystlinjer', owner: 'Kystdirektoratet', domain: 'kyst' },
  redningsnumre: { name: 'Redningsnumre', full: 'Strandnumre og redningsveje', owner: 'Kystdirektoratet', domain: 'kyst' },
  landbrugsdrift: { name: 'Landbrugsdrift', full: 'Jordtyper, lavbund og hældning', owner: 'Landbrugsstyrelsen', domain: 'kyst' },
  jordbrugsanalyser: { name: 'Jordbrugsanalyser', full: 'Husdyr og markblokke pr. sogn', owner: 'Aarhus Universitet', domain: 'kyst' },
  geodanmark: { name: 'GeoDanmark', full: 'Det fælles topografiske grundkort', owner: 'Klimadatastyrelsen og kommunerne', domain: 'kort' },
  plandatadk: { name: 'Plandata.dk', full: 'Lokalplaner, kommuneplanrammer og zoner', owner: 'Plan- og Landdistriktsstyrelsen', domain: 'kort' },
  geofa: { name: 'GeoFA', full: 'Kommunale fagdata', owner: 'Kommunerne (FKG)', domain: 'kort' },
  kulturarvsstyrelsen: { name: 'Kulturarv', full: 'Fredede bygninger og fortidsminder', owner: 'Slots- og Kulturstyrelsen', domain: 'kort' },
  stednavne: { name: 'Stednavne', full: 'Danske Stednavne', owner: 'Klimadatastyrelsen', domain: 'ejendom' },
};

export const catalog = raw as unknown as {
  generated: string;
  httpRoot: string;
  s3Root: string;
  datasets: Dataset[];
};

export const datasets = catalog.datasets;

// Kilder, der endnu ikke er beskrevet ovenfor, vises med et pænt navn ud fra schemaet
export function sourceOf(schema: string): Source {
  if (sources[schema]) return sources[schema];
  const name = schema.charAt(0).toUpperCase() + schema.slice(1);
  return { name, full: name, owner: '', domain: 'kort' };
}

/** Titler som "DAR – Adresser" → "Adresser", når kilden allerede står ved siden af. */
export function shortTitle(d: Dataset): string {
  const parts = d.title.split(' – ');
  return parts.length > 1 ? parts.slice(1).join(' – ') : d.title;
}

export function bySchema() {
  const groups = new Map<string, Dataset[]>();
  for (const d of datasets) {
    if (!groups.has(d.schema)) groups.set(d.schema, []);
    groups.get(d.schema)!.push(d);
  }
  return [...groups.entries()]
    .map(([schema, list]) => ({
      schema,
      source: sourceOf(schema),
      datasets: list,
      rows: list.reduce((s, d) => s + (d.rows ?? 0), 0),
      bytes: list.reduce((s, d) => s + (d.assets.parquet?.size ?? 0), 0),
    }))
    .sort((a, b) => b.rows - a.rows);
}

export const totals = {
  datasets: datasets.length,
  sources: new Set(datasets.map((d) => d.schema)).size,
  rows: datasets.reduce((s, d) => s + (d.rows ?? 0), 0),
  bytes: datasets.reduce((s, d) => s + (d.assets.parquet?.size ?? 0), 0),
  spatial: datasets.filter((d) => d.geometry).length,
  latest: datasets.map((d) => d.latest).sort().at(-1)!,
  first: datasets.flatMap((d) => d.snapshots).sort()[0],
  snapshots: datasets.reduce((s, d) => s + d.snapshots.length, 0),
  withHistory: datasets.filter((d) => d.snapshots.length > 1).length,
};

/** Har rækketallet ændret sig mellem to snapshots? */
export const hasChanged = (d: Dataset) => new Set(d.history.map((h) => h.rows)).size > 1;
export const changedCount = datasets.filter(hasChanged).length;

const nf = new Intl.NumberFormat('da-DK');
export const fmtInt = (n: number | null | undefined) => (n == null ? '–' : nf.format(n));

export function fmtCompact(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toLocaleString('da-DK', { maximumFractionDigits: 1 })} mia.`;
  if (n >= 1e6) return `${(n / 1e6).toLocaleString('da-DK', { maximumFractionDigits: 1 })} mio.`;
  if (n >= 1e3) return `${(n / 1e3).toLocaleString('da-DK', { maximumFractionDigits: 0 })} t.`;
  return nf.format(n);
}

export function fmtBytes(b: number | null | undefined): string {
  if (b == null) return '–';
  const units = ['B', 'kB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = b;
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i++;
  }
  return `${v.toLocaleString('da-DK', { maximumFractionDigits: v < 10 && i > 0 ? 1 : 0 })} ${units[i]}`;
}

export function fmtDate(iso: string): string {
  return new Date(iso + (iso.length === 10 ? 'T12:00:00Z' : '')).toLocaleDateString('da-DK', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export const geomNames: Record<string, string> = {
  Point: 'Punkter',
  MultiPoint: 'Punkter',
  LineString: 'Linjer',
  MultiLineString: 'Linjer',
  Polygon: 'Flader',
  MultiPolygon: 'Flader',
  Geometry: 'Blandet geometri',
};

export const datasetUrl = (d: Pick<Dataset, 'schema' | 'relation'>) => `/data/${d.schema}/${d.relation}/`;

/**
 * Den meningsfulde beskrivelse fra collection.json, eller null hvis feltet er tomt eller
 * stadig indeholder Centias standardtekst ("Snapshots of schema.relation").
 */
export function descriptionOf(d: Dataset): string | null {
  const text = d.description?.trim();
  if (!text || text === `Snapshots of ${d.id}` || text === d.title) return null;
  return text;
}

// --- Historik for den seneste uge ---------------------------------------------------------

/** Antal dage i historik-strimlen: seneste snapshot-dato og en uge tilbage. */
export const WINDOW_DAYS = 8;

/** Datoerne i vinduet, ældste først, der slutter ved det seneste snapshot i bucketen. */
export const windowDays: string[] = (() => {
  const end = new Date(`${totals.latest}T12:00:00Z`).getTime();
  return Array.from({ length: WINDOW_DAYS }, (_, i) =>
    new Date(end - (WINDOW_DAYS - 1 - i) * 864e5).toISOString().slice(0, 10),
  );
})();

export type HistoryCell =
  | { day: string; kind: 'none' }
  | { day: string; kind: 'first' | 'same' | 'change'; rows: number | null; delta: number };

/**
 * Snapshots i vinduet. Det første snapshot i vinduet sammenlignes med det seneste
 * snapshot før vinduet, så en ændring på vinduets første dag også bliver markeret.
 */
export function windowHistory(d: Dataset) {
  const hs = [...d.history].sort((a, b) => a.date.localeCompare(b.date));
  const before = hs.filter((h) => h.date < windowDays[0]).at(-1);
  const byDate = new Map(hs.map((h) => [h.date, h.rows]));
  let prev: number | null = before?.rows ?? null;
  let changes = 0;
  let maxJump = 0;
  const cells: HistoryCell[] = windowDays.map((day) => {
    if (!byDate.has(day)) return { day, kind: 'none' };
    const rows = byDate.get(day) ?? null;
    const delta = prev != null && rows != null ? rows - prev : 0;
    const kind = prev == null ? 'first' : delta !== 0 ? 'change' : 'same';
    if (kind === 'change') {
      changes++;
      maxJump = Math.max(maxJump, Math.abs(delta) / Math.max(prev ?? 1, 1));
    }
    prev = rows;
    return { day, kind, rows, delta };
  });
  const inWindow = hs.filter((h) => h.date >= windowDays[0] && h.date <= windowDays.at(-1)!);
  const baseline = before?.rows ?? inWindow[0]?.rows ?? 0;
  const net = (inWindow.at(-1)?.rows ?? baseline) - (baseline ?? 0);
  return { cells, net, snapshots: inWindow.length, changes, maxJump };
}

/**
 * Et udsnit af datasæt, der har ændret sig i vinduet: ét pr. kilde, flest ændringsdage først.
 * Spring over datasæt med spring på over 50 %, som typisk skyldes en afbrudt høstning.
 */
export function recentlyChanged(limit = 8): Dataset[] {
  const best = new Map<string, { d: Dataset; changes: number; net: number }>();
  for (const d of datasets) {
    const w = windowHistory(d);
    if (!w.changes || w.maxJump > 0.5) continue;
    const cur = best.get(d.schema);
    if (!cur || w.changes > cur.changes || (w.changes === cur.changes && Math.abs(w.net) > Math.abs(cur.net))) {
      best.set(d.schema, { d, changes: w.changes, net: w.net });
    }
  }
  return [...best.values()]
    .sort((a, b) => b.changes - a.changes || Math.abs(b.net) - Math.abs(a.net))
    .slice(0, limit)
    .map((x) => x.d);
}
