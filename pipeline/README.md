# Catálogo de datos (paso 1)

Generado con `python build_catalog.py` a partir de las tablas experimentales de PSI en `raw/`.

| Fichero | Contenido |
|---|---|
| `tests.csv` / `tests.json` | 857 pruebas en un esquema común (una fila por prueba) |
| `experiments.json` | 7 experimentos con hardware, pilar, relevancia para hábitats (1-5), aplicación en la Tierra, rangos de O₂, presión y flujo, y `psi_metadata` (objetivo, hipótesis, enfoque, impacto, DOI y publicaciones) de los ficheros `raw/metadata/` |

## Columnas de `tests`

`experiment`, `test_id`, `date`, `fuel`, `fuel_state` (sólido, líquido o gas), `geometry`, `o2_pct`, `pressure_kpa`, `flow_cm_s`, `flow_direction`, `diluent`, `outcome`, `burn_time_s`, `metric_name`, `metric_value`, `metric_unit`, `co_final_ppm`, `notes`, `experiment_group`.

## Cobertura

| Experimento | Pruebas | O₂ (%) | Presión (kPa) | Pilar |
|---|---|---|---|---|
| FLEX | 274 | 12–34 | 70–309 | Extinción |
| CFI-G | 179 | 18–40 | 51–304 | Prevención |
| BASS-II | 129 | 13.6–22.2 | ~101 | Prevención y extinción |
| BASS | 121 | n.d. | ~101 | Prevención |
| SAME | 109 | 21 | ~101 | Detección |
| E-FIELD (ACME) | 32 | 21 | ~101 | Prevención y extinción |
| Saffire I–III | 13 | 21.5–22.1 | ~101 | Prevención |

## Decisiones y limitaciones

- La presión de los ensayos en la ISS y en Cygnus se fija en 101.3 kPa (presión de cabina), porque las tablas no la dan.
- En BASS-II, `flow_cm_s` es el primer valor de la secuencia de flujo de cada prueba; se descartan los valores mayores de 40 cm/s (el máximo del túnel según los metadatos), que son lecturas del potenciómetro del ventilador. La secuencia completa está en `notes`.
- En BASS-II, `outcome` se deduce del texto libre ("ext", "blowoff", "no ign"), así que es aproximado.
- La tabla de BASS solo trae el material, sin O₂ ni flujo por prueba.
- En SAME no hay llama: se mide el humo de pirólisis. `Rt/R0` indica la temperatura de calentamiento.
- En E-FIELD, cada fila es un día de ensayo y una concentración de combustible; la tabla no da el O₂ del oxidante, así que se asume 21 %.
- Según sus metadatos, E-FIELD no se diseñó para aplicaciones espaciales: se usa solo como análogo de gravedad parcial (relevancia 2/5).
- Faltan Saffire IV–VI (con O₂ elevado) y MIST.

## Primer hallazgo

En FLEX, la llama de gota se extingue sola en el 94 % de las pruebas con O₂ ≤ 15 %, pero solo en el 8 % de las pruebas con O₂ > 25 %. Es la atmósfera prevista para los hábitats lunares (≥ 30 %).
