-- title: Hvor er der flest ladepunkter pr. adresse?
-- datasets: geofa.t_5607_ladefacilitet, dar.husnummer, dagi.kommuneinddeling
-- lead: Kommunernes registrering af ladestandere i GeoFA placeret rumligt i DAGI-kommuner og sat i forhold til antallet af gældende adresser i DAR.
WITH lade AS (
  SELECT k.id_lokalid, sum(l.antal_ladepunkter)::INT AS ladepunkter
  FROM dk('geofa', 't_5607_ladefacilitet') l
  JOIN dk('dagi', 'kommuneinddeling') k ON ST_Intersects(l.the_geom, k.the_geom)
  WHERE l.statuskode = 3
  GROUP BY ALL
), adr AS (
  SELECT kommuneinddeling AS id_lokalid, count(*) AS adresser
  FROM dk('dar', 'husnummer') WHERE status = '3' GROUP BY ALL
)
SELECT k.navn                                           AS kommune,
       lade.ladepunkter,
       adr.adresser,
       round(1000.0 * lade.ladepunkter / adr.adresser, 1) AS pr_1000_adresser
FROM dk('dagi', 'kommuneinddeling') k
JOIN lade USING (id_lokalid)
JOIN adr  USING (id_lokalid)
ORDER BY pr_1000_adresser DESC
LIMIT 8;
