-- title: Hvor mange adresser ligger på kortlagt forurenet jord?
-- datasets: dar.husnummer, dar.adressepunkt, dkjord.dkjord_v2, dagi.kommuneinddeling
-- lead: Gældende adgangsadresser fra DAR lagt oven på V2-kortlagte arealer fra regionernes jordforureningsregister og fordelt på DAGI-kommuner.
WITH adresser AS (
  SELECT h.id_lokalid AS id, h.kommuneinddeling, p.the_geom
  FROM dk('dar', 'husnummer') h
  JOIN dk('dar', 'adressepunkt') p ON p.id_lokalid = h.adgangspunkt
  WHERE h.status = '3'  -- gældende
)
SELECT k.navn                                     AS kommune,
       count(DISTINCT a.id)                       AS adresser,
       count(DISTINCT a.id) FILTER (v.gid NOTNULL) AS på_v2_jord,
       round(100.0 * på_v2_jord / adresser, 1)    AS procent
FROM adresser a
JOIN dk('dagi', 'kommuneinddeling') k ON k.id_lokalid = a.kommuneinddeling
LEFT JOIN dk('dkjord', 'dkjord_v2') v ON ST_Intersects(a.the_geom, v.the_geom)
GROUP BY ALL
ORDER BY procent DESC
LIMIT 8;
