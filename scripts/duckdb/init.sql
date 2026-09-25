INSTALL spatial; LOAD spatial;
INSTALL httpfs;  LOAD httpfs;
SET s3_region = 'eu-west-1';

-- dk('schema', 'relation') læser det nyeste snapshot af et datasæt
CREATE OR REPLACE MACRO dk(s, r) AS TABLE
  SELECT * FROM read_parquet(
    's3://gc2-parquet/centia-io/dk/schema=' || s || '/relation=' || r || '/*/*.parquet')
  WHERE _gc2_snapshot_date = (
    SELECT max(regexp_extract(file, '_gc2_snapshot_date=([0-9-]+)', 1))::DATE
    FROM glob('s3://gc2-parquet/centia-io/dk/schema=' || s || '/relation=' || r || '/*/*.parquet'));

-- dk_at('schema', 'relation', 'YYYY-MM-DD') læser datasættet, som det så ud på en given dato
CREATE OR REPLACE MACRO dk_at(s, r, dato) AS TABLE
  SELECT * FROM read_parquet(
    's3://gc2-parquet/centia-io/dk/schema=' || s || '/relation=' || r || '/*/*.parquet')
  WHERE _gc2_snapshot_date = (
    SELECT max(regexp_extract(file, '_gc2_snapshot_date=([0-9-]+)', 1))::DATE
    FROM glob('s3://gc2-parquet/centia-io/dk/schema=' || s || '/relation=' || r || '/*/*.parquet')
    WHERE regexp_extract(file, '_gc2_snapshot_date=([0-9-]+)', 1)::DATE <= dato::DATE);

-- dk_alle('schema', 'relation') læser alle snapshots; _gc2_snapshot_date er en kolonne
CREATE OR REPLACE MACRO dk_alle(s, r) AS TABLE
  SELECT * FROM read_parquet(
    's3://gc2-parquet/centia-io/dk/schema=' || s || '/relation=' || r || '/*/*.parquet');
