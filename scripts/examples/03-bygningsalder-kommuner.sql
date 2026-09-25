-- title: Hvor står landets ældste bygningsmasse?
-- datasets: bbr.bygning, dagi.kommuneinddeling
-- lead: 4,8 millioner opførte bygninger fra BBR grupperet på kommunekode og beriget med kommunenavne fra DAGI. Et almindeligt join, men uden en eneste API-kaldsrunde.
SELECT k.navn                                             AS kommune,
       count(*)                                           AS bygninger,
       median(try_cast(b.byg026opførelsesår AS INT))::INT AS median_opførelsesår,
       count(*) FILTER (try_cast(b.byg026opførelsesår AS INT) < 1900) AS før_1900
FROM dk('bbr', 'bygning') b
JOIN dk('dagi', 'kommuneinddeling') k USING (kommunekode)
WHERE b.status = '6'  -- opført
  AND try_cast(b.byg026opførelsesår AS INT) BETWEEN 1000 AND 2030
GROUP BY ALL
ORDER BY median_opførelsesår
LIMIT 8;
