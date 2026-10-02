-- title: Hvilke lokalplaner er vedtaget den seneste uge?
-- datasets: plandatadk.pdk_lokalplan_vedtaget_v
-- lead: Det samme datasæt læst på to tidspunkter: i dag og for en uge siden. Planer i det nyeste snapshot, som ikke fandtes for en uge siden, er kommet til i løbet af ugen. Ret 7 DAY til fx 30 DAY for at se en anden periode.
-- kind: historik
SELECT ny.kommunenavn                                    AS kommune,
       ny.plannavn                                       AS lokalplan,
       strptime(ny.datovedt::VARCHAR, '%Y%m%d')::DATE    AS vedtaget
FROM dk('plandatadk', 'pdk_lokalplan_vedtaget_v') ny
ANTI JOIN dk_at('plandatadk', 'pdk_lokalplan_vedtaget_v', current_date - INTERVAL 7 DAY) gammel
  USING (planid)
ORDER BY vedtaget DESC, kommune;
