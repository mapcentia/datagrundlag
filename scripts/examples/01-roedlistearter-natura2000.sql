-- title: Hvilke Natura 2000-områder rummer flest rødlistede arter?
-- datasets: naturdatabasen.art_roedlistearter, danmarksarealinformation.habitat_omr
-- lead: 278.000 fund af rødlistearter fra Naturdatabasen krydset med Miljøstyrelsens habitatområder. Et punkt-i-polygon-join på tværs af to kilder.
SELECT h.objektnavn                         AS habitatområde,
       count(DISTINCT r.videnskabeligtnavn) AS rødlistearter,
       count(*)                             AS fund
FROM dk('naturdatabasen', 'art_roedlistearter') r
JOIN dk('danmarksarealinformation', 'habitat_omr') h
  ON ST_Intersects(r.the_geom, h.the_geom)
GROUP BY ALL
ORDER BY rødlistearter DESC
LIMIT 8;
