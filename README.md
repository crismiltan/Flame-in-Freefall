# Flame in Freefall

Simulador web para **prevenir, detectar y extinguir** incendios en hábitats espaciales (ISS, cápsulas de exploración, Luna y Marte), basado en 857 pruebas reales de combustión en microgravedad de [NASA Physical Science Informatics](https://psi.nasa.gov/).

Proyecto para el reto *Flame in Freefall* del NASA Space Apps Challenge 2026.

## Qué hace

1. Eliges un entorno y un material (tejido de algodón, PMMA, Nomex, silicona, combustibles líquidos o gases), o ajustas a mano O₂, presión, ventilación y gravedad.
2. La herramienta busca las 15 pruebas más parecidas del catálogo y calcula el riesgo de que el fuego se mantenga.
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
