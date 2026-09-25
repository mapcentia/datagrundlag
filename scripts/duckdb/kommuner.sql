CREATE TEMP TABLE adr AS
  SELECT h.id_lokalid AS id, h.kommuneinddeling, p.the_geom
  FROM dk('dar','husnummer') h
  JOIN dk('dar','adressepunkt') p ON p.id_lokalid = h.adgangspunkt
  WHERE h.status = '3';
CREATE TEMP TABLE k AS SELECT id_lokalid, kommunekode, navn, the_geom FROM dk('dagi','kommuneinddeling');

CREATE TEMP TABLE byg AS
  SELECT kommunekode, median(try_cast(byg026opførelsesår AS INT)) AS median_aar, count(*) AS bygninger
  FROM dk('bbr','bygning')
  WHERE status = '6' AND try_cast(byg026opførelsesår AS INT) BETWEEN 1000 AND 2030
  GROUP BY ALL;

CREATE TEMP TABLE ladning AS
  SELECT k.kommunekode, sum(l.antal_ladepunkter)::INT AS ladepunkter
  FROM dk('geofa','t_5607_ladefacilitet') l JOIN k ON ST_Intersects(l.the_geom, k.the_geom)
  WHERE l.statuskode = 3 GROUP BY ALL;

CREATE TEMP TABLE v2 AS
  SELECT a.kommuneinddeling, count(DISTINCT a.id) AS adresser_v2
  FROM adr a JOIN dk('dkjord','dkjord_v2') v ON ST_Intersects(a.the_geom, v.the_geom)
  GROUP BY ALL;

CREATE TEMP TABLE nadr AS SELECT kommuneinddeling, count(*) AS adresser FROM adr GROUP BY ALL;

COPY (
  SELECT k.kommunekode, k.navn, n.adresser, b.bygninger, b.median_aar,
         coalesce(v2.adresser_v2,0) AS adresser_v2,
         coalesce(l.ladepunkter,0) AS ladepunkter,
         round(1000.0*coalesce(l.ladepunkter,0)/n.adresser,1) AS ladepunkter_pr_1000,
         round(100.0*coalesce(v2.adresser_v2,0)/n.adresser,2) AS pct_v2,
         ST_AsText(ST_ReducePrecision(ST_SimplifyPreserveTopology(k.the_geom, 400), 10)) AS wkt
  FROM k
  LEFT JOIN nadr n ON n.kommuneinddeling = k.id_lokalid
  LEFT JOIN byg b ON b.kommunekode = k.kommunekode
  LEFT JOIN ladning l ON l.kommunekode = k.kommunekode
  LEFT JOIN v2 ON v2.kommuneinddeling = k.id_lokalid
  ORDER BY k.kommunekode
) TO '{{OUT}}' (FORMAT json, ARRAY true);
