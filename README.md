# Flame in Freefall

Monitor y simulador web para **prevenir, detectar y extinguir** incendios en hábitats espaciales (ISS, cápsulas de exploración, Luna y Marte), basado en 857 pruebas reales de combustión en microgravedad de [NASA Physical Science Informatics](https://psi.nasa.gov/).

Proyecto para el reto *Flame in Freefall* del NASA Space Apps Challenge 2026.

## Qué hace

### Monitor del hábitat (pestaña principal)

Un panel de control que vigila cada zona del hábitat (módulo de mando, laboratorio, dormitorios, cocina, almacén, soporte vital y esclusa) con sensores de O₂, presión, ventilación, temperatura, CO y humo.

- Cada zona muestra su **riesgo de combustión sostenida** si algo prende, calculado en cada lectura con las pruebas reales de PSI más parecidas a sus condiciones y a su material principal.
- Las alertas se agrupan en los tres pilares: **prevenir** (O₂ fuera de consigna, subida de riesgo), **detectar** (señal temprana de CO, humo o calor; ventilación detenida, que en microgravedad impide que el humo llegue a los detectores) y **extinguir** (cortar la ventilación, diluir el O₂ hasta el umbral que dan los datos, agente recomendado).
- Hábitats: base lunar (8.2 psi, 34 % O₂, 0.17 g), rover presurizado lunar (10.2 psi, 30 % O₂), estación espacial (aire, 0 g) y base en Marte.
- Botones para simular incidentes: fuga de O₂ de un traje en la esclusa, fallo de ventilación en dormitorios y cable sobrecalentado en soporte vital.

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

## Ejecutar en local

```bash
python -m http.server 8000
# abre http://localhost:8000
```

Es una web estática sin dependencias externas, publicada con GitHub Pages.

## Limitaciones

No hay datos de combustión en gravedad lunar ni marciana: se estima el flujo de flotación (v ≈ √(g·L)) y se avisa en pantalla. Los sólidos solo se ensayaron hasta ~22 % de O₂. No es una herramienta de seguridad certificada.
