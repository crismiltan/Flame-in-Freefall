# VESTA 

**VESTA** (*Vigilance for Extraterrestrial Safety and Thermal Alerts*) is a web monitor and simulator to **prevent**, **detect** and **extinguish** fires in space habitats (ISS, exploration capsules, the Moon and Mars), based on 857 real microgravity combustion tests from [NASA Physical Science Informatics](https://psi.nasa.gov/).

Project for the *Flame in Freefall* challenge of the NASA Space Apps Challenge 2026.

## Latest version

This version turns the demo into a complete, presentation-ready app:

- **New introduction screen.** A full-screen landing page with the VESTA name, a short pitch, the key figures (857 real tests, 11 experiments) and a microgravity flame photo over a star field.
- **Simpler navigation.** No sidebar: each section has previous/next buttons at the bottom, and the VESTA name at the top right returns to the introduction.
- **Fully in English,** with a cleaner look: blue theme, subtle star background on wide screens, neutral zones when everything is normal (orange for warning, red for alarm).
- **Monitor:** 8 simulated incidents (5 new: short circuit, galley grease fire, smoldering storage, slow pressure leak, O₂ regulator failure), pressure-drop alerts, and a material check per zone based on NASA's high-oxygen flammability thresholds.
- **Experiments:** filter by prevention, detection or extinction, plus a table of which cabin materials self-extinguish at each habitat's O₂.
- **Simulator:** the chart zooms to the tests used for the chosen material and widens only when the scenario falls outside them.
- **Engine accuracy:** 81% in leave-one-out validation, now using droplet size for liquid fuels (see below).

## What it does

The app opens on a full-screen introduction with buttons into its three sections. Inside each section, buttons at the bottom move to the previous or next one (Experiments → Simulator → Monitor), and the VESTA name at the top right goes back to the introduction.

### Habitat monitor

A control panel that watches every zone of the habitat (command module, laboratory, crew quarters, galley, storage, life support and airlock) with O₂, pressure, ventilation, temperature, CO and smoke sensors.

- Each zone shows its **sustained combustion risk** if something ignites, computed at every reading from the real PSI tests closest to its conditions and its main material.
- Alerts are grouped into the three pillars: **prevent** (O₂ off its setpoint, rising risk, pressure drop), **detect** (early CO, smoke or heat signal; stopped ventilation, which in microgravity keeps smoke from reaching the detectors) and **extinguish** (shut off ventilation, dilute O₂ to the threshold given by the data, recommended agent).
- Habitats: lunar base (8.2 psi, 34% O₂, 0.17 g), pressurized lunar rover (10.2 psi, 30% O₂), space station (air, 0 g) and Mars base.
- 8 simulated incidents: suit O₂ leak in the airlock, ventilation failure in crew quarters, overheated cable in life support, short circuit in a command module screen, overheated grease in the galley, smoldering combustion in storage, slow pressure leak in the laboratory and O₂ regulator failure across the whole habitat.

Sensor readings are **simulated** (PSI has no real sensor data). The risk and the recommendations come from the real data.

### Experiments

- Relevance ranking for habitats, with a one-line summary and the safety equipment each investigation informs, filterable by prevention, detection or extinction.
- Quick comparison of conditions, what varied and sensors.
- Which cabin materials self-extinguish at each habitat's O₂ (NASA ground test, see below).
- Investigations that share hardware (CIR/ACME, CIR/MDCA, MSG/SPICE tunnel, Saffire, SAME) and other PSI candidates.
- Download of the unified catalog (CSV and JSON) for predictive modeling, and applications on Earth.

### Scenario simulator

1. Pick an environment and a material (cotton fabric, PMMA, Nomex, silicone, liquid fuels or gases), or set O₂, pressure, ventilation and gravity by hand.
2. The tool finds the 15 closest tests in the catalog and computes the total probability of a sustained fire: P(ignites) × P(keeps burning if ignited).
3. It gives recommendations in three pillars: **prevent** (O₂ threshold, materials), **detect** (sensors, smoke in microgravity, CO) and **extinguish** (ventilation, O₂, CO₂ versus helium).
4. It shows where the scenario falls within the data and the tests the result is based on.

## Data

| Experiment | PSI | Tests | Pillar |
|---|---|---|---|
| Saffire I–III | PSI-98, 99, 100 | 13 | Prevention |
| BASS-II | PSI-25 | 129 | Prevention and extinction |
| BASS | PSI-26 | 121 | Prevention |
| FLEX | PSI-69 | 274 | Extinction |
| SAME-R | PSI-101 | 109 | Detection |
| CFI-G | PSI-159 | 179 | Prevention |
| ACME E-FIELD | PSI-22 | 32 | Partial-gravity analog |

The original tables are in `pipeline/raw/`. `python pipeline/build_catalog.py` rebuilds the unified catalog (`tests.csv`, `tests.json`, `experiments.json`). The cleaning decisions are documented in `pipeline/README.md`.

### Materials at high O₂ (ground test)

`data/materials_moc.csv` holds Table 2 of Hirsch et al., *Oxygen Concentration Flammability Thresholds of Selected Aerospace Materials Considered for the Constellation Program* (NASA WSTF, [NTRS 20070018178](https://ntrs.nasa.gov/citations/20070018178)). It gives the maximum O₂ at which 24 cabin materials self-extinguish, measured at 70.1 kPa with the NASA-STD-6001 Test 1. The Experiments section shows it against each habitat's O₂, and the Monitor uses it to flag each zone's material and suggest alternatives.

It is not part of the risk engine, for three reasons: it is a 1 g test without airflow, the materials differ from the PSI ones, and it gives only one threshold per material, not individual tests.

## Engine accuracy

Leave-one-out cross-validation over the 592 tests with a known outcome: each test is predicted from all the others (`node pipeline/eval/validacion_cruzada.js`).

| Method | Accuracy | Probability error (Brier, lower is better) |
| --- | --- | --- |
| Engine with droplet size (current) | 81% | 0.120 |
| Engine without droplet size (previous version) | 80% | 0.131 |
| Logistic regression (comparison) | 80% | 0.143 |
| Always predict "does not keep burning" | 60% | 0.241 |

Tests from the same campaign are very similar to each other. With a stricter validation that leaves out every test from the same day, the current engine is right 81% of the time (the previous one, 78%). BRE, FLEX-2, SPICE and CFI are shown as context: their PSI tables do not say whether each fire was sustained.

## Run locally

```bash
python -m http.server 8000
# open http://localhost:8000
```

It is a static website with no external dependencies, published with GitHub Pages.

## Limitations

There is no combustion data in lunar or Martian gravity: the buoyant flow is estimated (v ≈ √(g·L)) and a warning is shown on screen. Solids were only tested up to ~22% O₂. This is not a certified safety tool.
