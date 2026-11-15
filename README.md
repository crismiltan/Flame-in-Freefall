# VESTA 

**VESTA** (*Vigilance for Extraterrestrial Safety and Thermal Alerts*) is a web monitor and simulator to **prevent**, **detect** and **extinguish** fires in space habitats (ISS, exploration capsules, the Moon and Mars), based on 857 real microgravity combustion tests from [NASA Physical Science Informatics](https://psi.nasa.gov/).

Project for the *Flame in Freefall* challenge of the NASA Space Apps Challenge 2026.

## What it does

The app opens on a full-screen introduction with buttons into its three sections. Inside each section, buttons at the bottom move to the previous or next one (Experiments → Simulator → Monitor), and the VESTA name at the top right goes back to the introduction.

### Habitat monitor

A control panel that watches every zone of the habitat (command module, laboratory, crew quarters, galley, storage, life support and airlock) with O₂, pressure, ventilation, temperature, CO and smoke sensors.

- Each zone shows its **sustained combustion risk** if something ignites, computed at every reading from the real PSI tests closest to its conditions and its main material.
- Alerts are grouped into the three pillars: **prevent** (O₂ off its setpoint, rising risk, pressure drop), **detect** (early CO, smoke or heat signal; stopped ventilation, which in microgravity keeps smoke from reaching the detectors) and **extinguish** (shut off ventilation, dilute O₂ to the threshold given by the data, recommended agent).
- Each zone also shows whether its main material self-extinguishes at the habitat's O₂, from NASA's high-oxygen flammability thresholds, and suggests safer alternatives.
- Habitats: lunar base (8.2 psi, 34% O₂, 0.17 g), pressurized lunar rover (10.2 psi, 30% O₂), space station (air, 0 g) and Mars base.
- 8 simulated incidents: suit O₂ leak in the airlock, ventilation failure in crew quarters, overheated cable in life support, short circuit in a command module screen, overheated grease in the galley, smoldering combustion in storage, slow pressure leak in the laboratory and O₂ regulator failure across the whole habitat.

The sensor readings are **simulated**: the demo generates normal values with some noise and changes them when you trigger an incident, because no real habitat is sending data and PSI has no station sensor logs. What VESTA does with those readings is based on real data: the fire probability is computed from the NASA combustion tests closest to each zone's conditions, and the recommendations come from those experiments. In a real habitat, the simulated sensors would simply be replaced by real ones.

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

## Use of AI (Super Intelligence) tools

In line with the NASA Space Apps rules, we state where SI tools were used:

- **Code:** the web app (`index.html`, `style.css`, `app.js`, `monitor.js`), the local server (`serve.py`) and the data pipeline (`pipeline/`) were written with the help of Claude (Anthropic), an AI assistant, under the team's direction and review.
- **Data:** the raw tables are real NASA PSI and NASA WSTF data, not generated. The cleaning, unification and the risk engine were built with AI assistance; the unified catalog (`data/`) is the output of that AI-assisted pipeline.
- **Text:** the interface text and this README were drafted with AI assistance and edited by the team.
- **Images:** `images/stars.png` and `images/stars-soft.png` (star backgrounds) were produced by AI-written code. `images/flame.jpg` was provided by the team. No NASA logos or branding are used.

## Run locally

```bash
python3 serve.py
# open http://localhost:8000
```

It is a static website with no external dependencies, published with GitHub Pages. `serve.py` works like `python3 -m http.server`, but sends any invalid address back to the home page (on GitHub Pages, `404.html` does the same).

## License

Original code and documentation are released under the [MIT License](LICENSE). That is an OSI-approved license, which NASA Space Apps requires for submitted solutions. Anyone may reuse, modify and share the project (including after the hackathon), provided the copyright notice stays with the code.

NASA Physical Science Informatics tables, NTRS publications and other NASA materials remain the work of the U.S. Government / their original authors. They are **not** covered by this MIT license; cite the sources listed in this README and in the project submission.

## Limitations

There is no combustion data in lunar or Martian gravity: the buoyant flow is estimated (v ≈ √(g·L)) and a warning is shown on screen. Solids were only tested up to ~22% O₂. This is not a certified safety tool.
