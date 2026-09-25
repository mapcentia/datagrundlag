-- title: Hvilke lokalplaner er vedtaget siden 17. september?
-- datasets: plandatadk.pdk_lokalplan_vedtaget_v
-- lead: Det samme datasæt læst på to datoer. Planer i det nyeste snapshot, som ikke fandtes i snapshottet fra 17. september, er kommet til siden. Skift datoen for at se en anden periode.
-- kind: historik
SELECT ny.kommunenavn                                    AS kommune,
       ny.plannavn                                       AS lokalplan,
       strptime(ny.datovedt::VARCHAR, '%Y%m%d')::DATE    AS vedtaget
FROM dk('plandatadk', 'pdk_lokalplan_vedtaget_v') ny
ANTI JOIN dk_at('plandatadk', 'pdk_lokalplan_vedtaget_v', '2026-09-17') gammel
  USING (planid)
ORDER BY vedtaget DESC, kommune;
