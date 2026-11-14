# Flame in Freefall

Monitor y simulador web para **prevenir**, **detectar** y **extinguir** incendios en hábitats espaciales (ISS, cápsulas de exploración, Luna y Marte), basado en 857 pruebas reales de combustión en microgravedad de [NASA Physical Science Informatics](https://psi.nasa.gov/).

Proyecto para el reto *Flame in Freefall* del NASA Space Apps Challenge 2026.

## ¿Qué hace?

### Monitor del hábitat (pestaña principal)

Un panel de control que vigila cada zona del hábitat (módulo de mando, laboratorio, dormitorios, cocina, almacén, soporte vital y esclusa) con sensores de O₂, presión, ventilación, temperatura, CO y humo.

- Cada zona muestra su **riesgo de combustión sostenida** si algo prende, calculado en cada lectura con las pruebas reales de PSI más parecidas a sus condiciones y a su material principal.
- Las alertas se agrupan en los tres pilares: **prevenir** (O₂ fuera de consigna, subida de riesgo), **detectar** (señal temprana de CO, humo o calor; ventilación detenida, que en microgravedad impide que el humo llegue a los detectores) y **extinguir** (cortar la ventilación, diluir el O₂ hasta el umbral que dan los datos, agente recomendado).
- Hábitats: base lunar (8.2 psi, 34 % O₂, 0.17 g), rover presurizado lunar (10.2 psi, 30 % O₂), estación espacial (aire, 0 g) y base en Marte.
- 8 incidentes simulados: fuga de O₂ de un traje en la esclusa, fallo de ventilación en dormitorios, cable sobrecalentado en soporte vital, cortocircuito en una pantalla del módulo de mando, grasa sobrecalentada en la cocina, combustión latente en el almacén, microfuga de presión en el laboratorio y fallo del regulador de O₂ en todo el hábitat.

Las lecturas de los sensores son **simuladas** (no hay datos de sensores reales en PSI). El riesgo y las recomendaciones salen de los datos reales.

### Experimentos

- Ranking de relevancia para hábitats, con un resumen de una línea y el equipo de seguridad que informa cada investigación.
- Comparación rápida de condiciones, qué variaba y sensores.
- Investigaciones que comparten hardware (CIR/ACME, CIR/MDCA, MSG/túnel de SPICE, Saffire, SAME) y otras de PSI candidatas.
- Descarga del catálogo unificado (CSV y JSON) para modelado predictivo, y aplicaciones en la Tierra.

### Simulador de escenarios

1. Eliges un entorno y un material (tejido de algodón, PMMA, Nomex, silicona, combustibles líquidos o gases), o ajustas a mano O₂, presión, ventilación y gravedad.
2. La herramienta busca las 15 pruebas más parecidas del catálogo y calcula la probabilidad total de incendio sostenido: P(prende) × P(se mantiene si prende).
3. Da recomendaciones en tres pilares: **prevenir** (umbral de O₂, materiales), **detectar** (sensores, humo en microgravedad, CO) y **extinguir** (ventilación, O₂, CO₂ frente a helio).
4. Muestra las pruebas en las que se basa, un ranking de relevancia de los experimentos y una comparación entre ellos.

## Datos

| Experimento | PSI | Pruebas | Pilar |
|---|---|---|---|
| Saffire I–III | PSI-98, 99, 100 | 13 | Prevención |
| BASS-II | PSI-25 | 129 | Prevención y extinción |
| BASS | PSI-26 | 121 | Prevención |
| FLEX | PSI-69 | 274 | Extinción |
| SAME-R | PSI-101 | 109 | Detección |
| CFI-G | PSI-159 | 179 | Prevención |
| ACME E-FIELD | PSI-22 | 32 | Análogo de gravedad parcial |

Las tablas originales están en `pipeline/raw/`. `python pipeline/build_catalog.py` regenera el catálogo unificado (`tests.csv`, `tests.json`, `experiments.json`). Las decisiones de limpieza están en `pipeline/README.md`.

### Materiales a O₂ alto (ensayo en tierra)

`data/materials_moc.csv` recoge la Tabla 2 de Hirsch et al., *Oxygen Concentration Flammability Thresholds of Selected Aerospace Materials Considered for the Constellation Program* (NASA WSTF, [NTRS 20070018178](https://ntrs.nasa.gov/citations/20070018178)). Da el O₂ máximo al que se apagan solos 24 materiales de cabina, medido a 70,1 kPa con el ensayo NASA-STD-6001 Test 1. La pestaña Experimentos lo muestra frente al O₂ de cada hábitat, y el Monitor lo usa para avisar del material de cada zona y proponer alternativas.

No entra en el motor de riesgo, por tres motivos: es un ensayo en 1 g sin flujo, son materiales distintos a los de PSI y solo da un umbral por material, no pruebas individuales.

## Precisión del motor

Validación cruzada "dejando una fuera" sobre las 592 pruebas con resultado conocido: cada prueba se predice con las demás (`node pipeline/eval/validacion_cruzada.js`).

| Método | Aciertos | Error de probabilidad (Brier, menor es mejor) |
| --- | --- | --- |
| Motor con tamaño de gota (actual) | 81 % | 0,120 |
| Motor sin tamaño de gota (versión anterior) | 80 % | 0,131 |
| Regresión logística (comparación) | 80 % | 0,143 |
| Decir siempre "no se mantiene" | 60 % | 0,241 |

Las pruebas de una misma campaña se parecen mucho entre sí. Con una validación más estricta, que deja fuera todas las pruebas del mismo día, el motor actual acierta el 81 % (el anterior, el 78 %). BRE, FLEX-2, SPICE y CFI se muestran como contexto: sus tablas de PSI no indican si cada fuego se mantuvo.

## Ejecutar en local

```bash
python -m http.server 8000
# abre http://localhost:8000
```

Es una web estática sin dependencias externas, publicada con GitHub Pages.

## Limitaciones

No hay datos de combustión en gravedad lunar ni marciana: se estima el flujo de flotación (v ≈ √(g·L)) y se avisa en pantalla. Los sólidos solo se ensayaron hasta ~22 % de O₂. No es una herramienta de seguridad certificada.
