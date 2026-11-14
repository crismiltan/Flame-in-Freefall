"""Unifica las tablas experimentales de PSI en un catalogo comun.

Uso: python build_catalog.py  (lee raw/, escribe tests.csv, tests.json, experiments.json)
"""
import json
import re
from pathlib import Path

import pandas as pd

HERE = Path(__file__).parent
RAW = HERE / "raw"
ATM_KPA = 101.325

COLS = ["experiment", "test_id", "date", "fuel", "fuel_state", "geometry",
        "o2_pct", "pressure_kpa", "flow_cm_s", "flow_direction", "diluent",
        "outcome", "burn_time_s", "metric_name", "metric_value", "metric_unit",
        "co_final_ppm", "notes"]


def read(name, **kw):
    df = pd.read_csv(RAW / name, encoding="latin-1", dtype=str, **kw).fillna("")
    df.columns = [c.replace("\u00ef\u00bb\u00bf", "") for c in df.columns]  # BOM UTF-8
    return df


def num(s):
    """Primer numero de un texto ('~ 21.5', '20 cm/s', '0.37 mm') o None."""
    m = re.search(r"-?\d+(?:\.\d+)?", str(s).replace(",", "."))
    return float(m.group()) if m else None


def solid_geom(m):
    m = m.lower()
    if "sphere" in m or "spherical" in m:
        return "esfera"
    if "rod" in m:
        return "cilindro"
    if "candle" in m:
        return "vela"
    if "slab" in m:
        return "placa"
    if "film" in m or "micron" in m:
        return "pelicula"
    return "lamina/tejido"


def norm_material(m):
    l = m.lower()
    if "sibal" in l or "cotton" in l:
        return "SIBAL (algodon-fibra de vidrio)"
    if "nomex" in l:
        return "Nomex"
    if "ultem" in l:
        return "Ultem"
    if "wax" in l or "candle" in l or "paraffin" in l or "parrafin" in l:
        return "Cera/parafina"
    if "silicone" in l:
        return "Silicona"
    if "pmma" in l or "rod" in l or "sphere" in l or "film" in l or "slab" in l:
        return "PMMA"
    return m.strip() or "n.d."


def row(**kw):
    r = {c: None for c in COLS}
    r.update(kw)
    return r


def bass2():
    out = []
    for _, d in read("PSI-25_Experimental_table_BASS-II.csv").iterrows():
        mat = d["Fuel Sample Material"]
        flow_txt = d["Air display"].lower()
        outcome = ("blowoff" if "blowoff" in flow_txt else
                   "extincion" if "ext" in flow_txt or "ext" in d["Fan display"].lower() else
                   "sin ignicion" if "no ign" in flow_txt else "combustion sostenida")
        co = num(d["Final CO (ppm)"])
        out.append(row(
            experiment="BASS-II", test_id=d["Test #"], date=d["Date"],
            fuel=norm_material(mat), fuel_state="solido", geometry=solid_geom(mat),
            o2_pct=num(d["Calibrated  initial O2 % by vol "]), pressure_kpa=ATM_KPA,
            flow_cm_s=(lambda v: v if v is not None and v <= 40 else None)(num(d["Air display"])), diluent="N2 (aire)", outcome=outcome,
            metric_name="CO final", metric_value=co, metric_unit="ppm", co_final_ppm=co,
            notes=f"{mat.strip()} | PI {d['PI']} | secuencia de flujo: {d['Air display'].strip()}"))
    return out


def bass():
    out = []
    for _, d in read("PSI-26_Experimental_table_BASS.csv").iterrows():
        mat = d["Fuel Sample Material"]
        if "cleaning" in mat.lower():
            continue
        direction = "opuesto" if "oppos" in mat.lower() else None
        out.append(row(
            experiment="BASS", test_id=d["Test #"], date=d["Date"],
            fuel=norm_material(mat), fuel_state="solido", geometry=solid_geom(mat),
            pressure_kpa=ATM_KPA, flow_direction=direction, diluent="N2 (aire)",
            notes=mat.strip() + " | la tabla PSI no incluye O2 ni flujo por prueba"))
    return out


def flex():
    out = []
    outcomes = {"Extinction": "extincion", "Disruption": "disrupcion de gota",
                "Completion": "combustion completa"}
    for _, d in read("PSI-69_Experimental_table_FLEX.csv").iterrows():
        o2 = num(d["O initial ambient composition; mole fraction"])
        co2 = num(d["CO initial ambient composition; mole fraction"]) or 0
        he = num(d["He initial ambient composition; mole fraction"]) or 0
        dil = "CO2" if co2 > 0 else "He" if he > 0 else "N2"
        p = num(d["Ambient pressure; mmHg"])
        out.append(row(
            experiment="FLEX", test_id=d["FLEX Identifier"], date=d["Test Date"],
            fuel=d["Fuel"], fuel_state="liquido", geometry="gota",
            o2_pct=o2 * 100 if o2 is not None else None,
            pressure_kpa=round(p * 0.133322, 1) if p else None, flow_cm_s=0,
            diluent=f"{dil} ({max(co2, he) * 100:.0f}%)" if dil != "N2" else "N2",
            outcome=outcomes.get(d["Test end"], d["Test end"]),
            burn_time_s=num(d["Burn time; s"]),
            metric_name="diametro de extincion", metric_value=num(d["Visible flame extinction diameter; mm"]),
            metric_unit="mm",
            notes=f"d0={d['Droplet initial diameter; mm']} mm | burning rate={d['Burning rate; mm']} mm2/s"))
    return out


def saffire():
    out = []
    files = {"SAFFIRE-1": "PSI-98_Experimental_table_SAFFIRE-1.csv",
             "SAFFIRE-2": "PSI-99_Experimental_table_SAFFIRE-2.csv",
             "SAFFIRE-3": "PSI-100_Experimental_table_SAFFIRE-3.csv"}
    for exp, f in files.items():
        df = read(f)
        df.columns = [c.strip() for c in df.columns]
        last_mat = ""
        for _, d in df.iterrows():
            sid = d[df.columns[0]].strip()
            if sid.startswith(("F1", "F2", "Note")) or not sid:
                continue
            mat = d["Material"].strip() or last_mat
            last_mat = mat
            direction = (d.get("Flow Direction") or d.get("Direction") or "").strip().lower()
            spread = d.get("?-g Spread Length", "")
            out.append(row(
                experiment=exp, test_id=sid, fuel="PMMA" if "&" in mat else norm_material(mat),  # 2-7: el Nomex no llego a prender
                fuel_state="solido",
                geometry="lamina/tejido", o2_pct=num(d.get("Percent O2", d.get("Percent O2 (Note 1)", ""))),
                pressure_kpa=ATM_KPA, flow_cm_s=num(d.get("Air Flow (cm/s)", d.get("Air Flow", ""))),
                flow_direction="concurrente" if "concur" in direction else "opuesto" if direction else None,
                diluent="N2 (aire)",
                outcome="propagacion completa" if num(d.get("Burn Time (s)", "")) else
                        ("sin propagacion" if "Insignificant" in d.get("Burn Time (s)", "") else "n.d."),
                burn_time_s=num(d.get("Burn Time (s)", "")),
                metric_name="velocidad de propagacion" if num(spread) else None,
                metric_value=num(spread), metric_unit="mm/s" if num(spread) else None,
                notes=f"{mat} | espesor {d.get('Sample Thickness (cm)', d.get('Samle Thickness', d.get('Sample Thickness', '')))} | "
                      "ensayo a gran escala en vehiculo Cygnus"))
    return out


def same():
    out = []
    for _, d in read("PSI-101_Experimental_table_SAME-R.csv").iterrows():
        aged = d["Description"].strip() == "aged"
        out.append(row(
            experiment="SAME", test_id=d["SAME Test #"], date=d["Date"], fuel=d["Sample Type"],
            fuel_state="solido (pirolisis)", geometry="muestra calentada",
            o2_pct=21, pressure_kpa=ATM_KPA, flow_cm_s=num(d["Inlet velocity (cm/s)"]),
            outcome="humo envejecido" if aged else "humo generado",
            metric_name="Rt/R0 (temperatura de calentamiento)", metric_value=num(d["Rt/R0"]), metric_unit="-",
            notes=f"{d['Description'].strip()} | envejecimiento neto {d['Net aging time (sec)']} s"))
    return out


def cfi():
    out = []
    for _, d in read("PSI-159_Experimental_table_CFI-G_Normal_Flames.csv").iterrows():
        se = d["Self-ext or flow term"].strip()
        if d["Hot ignition"].strip() == "No":
            outcome = "sin ignicion"
        elif d["Cool flame?"].lower().startswith("yes"):
            outcome = "llama fria"
        elif se == "SE":
            outcome = "autoextincion"
        else:
            outcome = "flujo cortado"
        p = num(d["approx p (bar)"])
        out.append(row(
            experiment="CFI-G", test_id=d["Test"].strip(), fuel=d["Fuel"], fuel_state="gas",
            geometry="quemador esferico", o2_pct=round(num(d[" XO2 before test"]) * 100, 2),
            pressure_kpa=round(p * 100, 1) if p else None, flow_cm_s=0, diluent="N2",
            outcome=outcome, burn_time_s=num(d["burn time (sec)"]),
            metric_name="Tad", metric_value=num(d["Tad (K)"]), metric_unit="K",
            notes=f"caudal {d['mHC (mg/s)']} mg/s | Xf={d['Xf']} | {d['Comments'].strip()}"))
    return out


def efield():
    out = []
    last = None
    for _, d in read("PSI-22_Experimental_table_ACME_E-FIELD_Flames.csv").iterrows():
        if d["Test Type"].strip():
            last = d
        elif last is None or not d["Fuel Conc"].strip():
            continue
        fuel = "Metano" if "CH4" in last["Fuel Bottle"] else "Etileno"
        burner = "coflujo" if "coflow" in last["Test Type"] else "chorro de gas"
        out.append(row(
            experiment="E-FIELD", test_id=f"{last['Test Day']}-{d['Fuel Conc'].strip()}",
            date=f"{last['Year']}-{int(last['Month']):02d}-{int(last['Date']):02d}",
            fuel=fuel, fuel_state="gas", geometry=f"quemador de {burner}", o2_pct=21,
            pressure_kpa=ATM_KPA, diluent=f"N2 en combustible ({d['Fuel Conc'].strip()} combustible)",
            outcome="llamas encendidas",
            metric_name="llamas encendidas en el dia" if d["Test Type"].strip() else None,
            metric_value=num(last["Flames Ignited"]) if d["Test Type"].strip() else None,
            notes=f"polaridad de malla {last['Mesh Polarity']} | campo electrico para simular fuerzas tipo gravedad | O2 de oxidante no indicado en la tabla"))
    return out


PSI_IDS = {"SAFFIRE": ["PSI-98", "PSI-99", "PSI-100"], "BASS-II": ["PSI-25"], "FLEX": ["PSI-69"],
           "SAME": ["PSI-101"], "E-FIELD": ["PSI-22"], "BASS": ["PSI-26"], "CFI-G": ["PSI-159"],
           "BRE": ["PSI-20"], "CFI": ["PSI-39"], "FLEX-2": ["PSI-68"], "SPICE": ["PSI-107"]}
META_FIELDS = {"Study Title": "title", "Comment[Investigation Acronym]": "acronym",
               "Comment[Approach]": "approach", "Comment[Hypothesis]": "hypothesis",
               "Comment[Objective]": "objective", "Comment[Research Impacts]": "research_impacts",
               "Comment[Experiment Hardware]": "hardware", "Comment[Flight Platform]": "platform",
               "Comment[DOI]": "doi", "Comment[Investigation Start Date]": "start_date",
               "Comment[Investigation End Date]": "end_date", "Comment[Managing NASA Center]": "nasa_center"}


def load_metadata(psi_id):
    """Lee un i_Investigation.txt (ISA-Tab) de PSI. Omite los datos de contacto."""
    import csv
    f = RAW / "metadata" / f"{psi_id}_i_Investigation.txt"
    if not f.exists():
        return None
    rows = {}
    with open(f, encoding="utf-8", errors="replace", newline="") as fh:
        for r in csv.reader(fh, delimiter="\t", quotechar='"'):
            if r:
                rows.setdefault(r[0].strip(), [v.strip() for v in r[1:]])
    m = {"psi_id": psi_id, "psi_url": "https://psi.nasa.gov/"}
    for k, name in META_FIELDS.items():
        vals = [v for v in rows.get(k, []) if v]
        m[name] = " ".join(vals[0].split()) if vals else None
    m["keywords"] = [v for v in rows.get("Study Design Type", []) if v]
    titles = rows.get("Study Publication Title", [])
    links = rows.get("Comment[Study Publication Link]", [])
    m["publications"] = [{"title": t, "link": links[i] if i < len(links) else None}
                         for i, t in enumerate(titles) if t]
    return m


EXPERIMENTS = [
    {"id": "SAFFIRE", "name": "Spacecraft Fire Safety Experiment (Saffire I-III)", "platform": "Cygnus (vehiculo de carga, tras dejar la ISS)",
     "hardware": "Modulo Saffire (tunel de flujo de 1 m)", "fuel_state": "solido", "pillars": ["prevencion", "deteccion"],
     "habitat_relevance": 5, "earth_application": "Normas de inflamabilidad de materiales textiles y de cabina",
     "summary": "Primeros incendios a gran escala en microgravedad. Muestras de SIBAL y silicona de hasta 94 x 40 cm con flujo de 20-30 cm/s."},
    {"id": "BASS-II", "name": "Burning and Suppression of Solids II", "platform": "ISS", "hardware": "Microgravity Science Glovebox (MSG)",
     "fuel_state": "solido", "pillars": ["prevencion", "extincion"], "habitat_relevance": 5,
     "earth_application": "Seleccion de materiales y control de ventilacion para extincion",
     "summary": "Propagacion y extincion de PMMA, SIBAL y Nomex variando flujo de aire (0-10+ cm/s) y O2 (14-22%)."},
    {"id": "BASS", "name": "Burning and Suppression of Solids", "platform": "ISS", "hardware": "Microgravity Science Glovebox (MSG)",
     "fuel_state": "solido", "pillars": ["prevencion"], "habitat_relevance": 4,
     "earth_application": "Ensayos de inflamabilidad de plasticos y tejidos",
     "summary": "Combustion de esferas, placas y laminas de PMMA, SIBAL, Nomex, Ultem y ceras."},
    {"id": "FLEX", "name": "Flame Extinguishment Experiment", "platform": "ISS", "hardware": "Combustion Integrated Rack (CIR)",
     "fuel_state": "liquido", "pillars": ["extincion"], "habitat_relevance": 4,
     "earth_application": "Agentes de extincion sin Halon (CO2, He) y limites de O2",
     "summary": "Gotas de metanol y heptano a 0.7-3 atm con O2 de 12-34% y diluyentes CO2/He."},
    {"id": "SAME", "name": "Smoke Aerosol Measurement Experiment", "platform": "ISS", "hardware": "Microgravity Science Glovebox (MSG)",
     "fuel_state": "solido (pirolisis)", "pillars": ["deteccion"], "habitat_relevance": 5,
     "earth_application": "Diseno de detectores de humo",
     "summary": "Humo de Kapton, silicona, Teflon, Pyrell y mecha de lampara a distintas temperaturas, flujos y tiempos de envejecimiento."},
    {"id": "E-FIELD", "name": "ACME Electric-Field Effects on Laminar Diffusion Flames", "platform": "ISS", "hardware": "Combustion Integrated Rack (CIR) / ACME",
     "fuel_state": "gas", "pillars": ["prevencion", "extincion"], "habitat_relevance": 2,
     "earth_application": "Control de llamas y hollin con campos electricos",
     "summary": "Llamas de metano y etileno diluidos en N2 con campo electrico de polaridad positiva y negativa; el viento ionico puede imitar o cancelar la flotacion, lo que sirve de analogo para acotar la gravedad parcial. Segun PSI, no se diseno para aplicaciones espaciales."},
    {"id": "CFI-G", "name": "Cool Flames Investigation with Gases", "platform": "ISS", "hardware": "Combustion Integrated Rack (CIR) / ACME",
     "fuel_state": "gas", "pillars": ["prevencion"], "habitat_relevance": 3,
     "earth_application": "Seguridad en motores y procesos con llamas frias",
     "summary": "Llamas esfericas de etano, propano y butano con O2 de 18-40% y 0.5-3 bar; deteccion de llamas frias."},
    # Sin resultado por prueba en su tabla de PSI: entran en el ranking y la comparacion, no en el motor de riesgo.
    {"id": "BRE", "name": "ACME Burning Rate Emulator", "platform": "ISS", "hardware": "Combustion Integrated Rack (CIR) / ACME",
     "fuel_state": "gas (emula sólidos)", "pillars": ["prevencion", "extincion"], "habitat_relevance": 4, "per_test": False,
     "earth_application": "Seleccion de materiales con el cono calorimetrico (NASA Test 2)",
     "summary": "Quemador poroso que imita plasticos como PMMA y nylon. Con 34 % de O2 las llamas siguieron ardiendo sin ventilacion; con 21 % se apagaron solas.",
     "n_tests": 194, "o2_min": 21.0, "o2_max": 40.0, "p_min_kpa": None, "p_max_kpa": None, "flow_max": 0.0},
    {"id": "FLEX-2", "name": "Flame Extinguishment Experiment 2", "platform": "ISS", "hardware": "Combustion Integrated Rack (CIR) / MDCA",
     "fuel_state": "liquido", "pillars": ["extincion"], "habitat_relevance": 3, "per_test": False,
     "earth_application": "Modelos de combustion de combustibles reales y mezclas",
     "summary": "Gotas de 8 combustibles y mezclas (octano, heptano, decano, etanol...) con O2 de 17-30 % y 0.5-3 atm.",
     "n_tests": 8, "o2_min": 17.0, "o2_max": 30.0, "p_min_kpa": 50.7, "p_max_kpa": 304.0, "flow_max": 5.0},
    {"id": "SPICE", "name": "Smoke Point In Co-flow Experiment", "platform": "ISS", "hardware": "Microgravity Science Glovebox (MSG)",
     "fuel_state": "gas", "pillars": ["deteccion"], "habitat_relevance": 3, "per_test": False,
     "earth_application": "Formacion de hollin y humo en llamas de gas",
     "summary": "Punto de humo de llamas de etileno, propano, propileno y metano con aire en coflujo de 5 a 65 cm/s.",
     "n_tests": 435, "o2_min": 21.0, "o2_max": 21.0, "p_min_kpa": 101.3, "p_max_kpa": 101.3, "flow_max": 65.0},
    {"id": "CFI", "name": "Cool Flames Investigation", "platform": "ISS", "hardware": "Combustion Integrated Rack (CIR) / MDCA",
     "fuel_state": "liquido", "pillars": ["deteccion"], "habitat_relevance": 2, "per_test": False,
     "earth_application": "Motores mas eficientes y combustibles nuevos",
     "summary": "Gotas de dodecano y mezclas con llamas frias, a 17-21 % de O2 y 0.5-5 atm, con y sin helio.",
     "n_tests": 79, "o2_min": 17.0, "o2_max": 21.0, "p_min_kpa": 50.7, "p_max_kpa": 506.6, "flow_max": 0.0},
]


def main():
    tests = pd.DataFrame(bass2() + bass() + flex() + saffire() + same() + cfi() + efield(), columns=COLS)
    tests["experiment_group"] = tests["experiment"].str.replace(r"-\d$", "", regex=True).str.upper()
    tests.to_csv(HERE / "tests.csv", index=False)
    tests.to_json(HERE / "tests.json", orient="records", force_ascii=False, indent=1)
    stats = tests.groupby("experiment_group").agg(
        n_tests=("test_id", "count"), o2_min=("o2_pct", "min"), o2_max=("o2_pct", "max"),
        p_min_kpa=("pressure_kpa", "min"), p_max_kpa=("pressure_kpa", "max"),
        flow_max=("flow_cm_s", "max")).round(1)
    exps = []
    for e in EXPERIMENTS:
        s = stats.loc[e["id"]].to_dict() if e["id"] in stats.index else {}
        md = [m for m in (load_metadata(i) for i in PSI_IDS.get(e["id"], [])) if m]
        exps.append({**e, **{k: (None if pd.isna(v) else v) for k, v in s.items()}, "psi_metadata": md})
    (HERE / "experiments.json").write_text(json.dumps(exps, ensure_ascii=False, indent=1))
    print(stats.to_string())
    print("\noutcomes:\n", tests.groupby(["experiment_group", "outcome"]).size().to_string())


if __name__ == "__main__":
    main()
