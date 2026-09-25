# datagrundlag.dk

Front til Centia-databasen `dk`, der høster danske grunddata og publicerer snapshots som GeoParquet og
FlatGeobuf i den offentlige bucket `s3://gc2-parquet/centia-io/dk/` (eu-west-1, anonym adgang).

Sitet er statisk og bygget med [Astro](https://astro.build). Alt indhold genereres ud fra bucketen:

| Fil | Kilde | Script |
|---|---|---|
| `src/data/catalog.json` | STAC-kataloget i bucketen (`catalog.json`, `collection.json`, `latest.json`, `item.json` pr. snapshot, metadata) | `npm run data` |
| `src/data/examples.json` | Kører `scripts/examples/*.sql` med DuckDB mod bucketen | `npm run analysis` |
| `src/data/kommuner.json` | Kommuneanalysen til forsidekortet (`scripts/duckdb/kommuner.sql`) | `npm run analysis` |

## Kommandoer

```sh
npm install
npm run dev        # udviklingsserver
npm run data       # hent kataloget igen (ca. 10 s)
npm run analysis   # kør eksempler og kortanalyse (kræver duckdb-CLI i PATH, ca. 1 min)
npm run refresh    # alt ovenstående + astro build
npm run build      # byg til dist/
```

## Netlify og natlig opdatering

Sitet er statisk, så tal og lister opdateres kun, når det bygges. På Netlify sker det automatisk hver nat:

- `netlify.toml` kører `scripts/netlify-build.sh`, der henter kataloget, installerer DuckDB-CLI'en,
  kører analyserne og bygger sitet. Fejler DuckDB-delen, bygges sitet med analyseresultaterne fra repoet.
  Fejler kataloghøstningen, fejler buildet, og det forrige deploy bliver stående.
- `netlify/functions/nightly-rebuild.mjs` er en planlagt funktion (04:30 UTC), der kalder en build-hook.

Opsætning (én gang):

1. Læg projektet i et Git-repo og forbind det til et nyt Netlify-site.
2. Opret en build-hook under *Site configuration › Build & deploy › Continuous deployment › Build hooks*.
3. Gem hookens URL i miljøvariablen `BUILD_HOOK_URL` under *Site configuration › Environment variables*.
4. Deploy igen, så den planlagte funktion bliver aktiv. Den kan testes med *Functions › nightly-rebuild › Run now*.

Commit gerne `src/data/*.json` jævnligt. Det er dem, sitet falder tilbage på, hvis analyserne fejler.

## Tilføj et eksempel

Læg en `.sql`-fil i `scripts/examples/` med en header:

```sql
-- title: Spørgsmålet, eksemplet besvarer
-- datasets: kilde.datasæt, kilde.datasæt
-- lead: En-to sætninger om, hvad der krydses.
SELECT …
```

Forespørgslen kan bruge makroerne fra `scripts/duckdb/init.sql`: `dk(schema, relation)` (nyeste snapshot),
`dk_at(schema, relation, dato)` (som datasættet så ud på en dato) og `dk_alle(schema, relation)` (alle snapshots).
Sæt `-- kind: historik` i headeren, hvis eksemplet sammenligner snapshots. Kør
`npm run analysis`, så dukker eksemplet op på /eksempler/ med det faktiske resultat.

## Struktur

- `src/pages/` – forside, katalog (`/data/`), en side pr. datasæt (`/data/[schema]/[relation]/`), eksempler, vejledning, om
- `src/lib/catalog.ts` – typer, kildebeskrivelser (myndighed, domæne) og formattering
- `src/components/KommuneMap.astro` – det interaktive Danmarkskort på forsiden
- `scripts/` – høstning af katalog og DuckDB-analyser
