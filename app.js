/* Flame in Freefall: simulador de riesgo basado en pruebas PSI similares (k vecinos más cercanos). */
"use strict";

const ENVS = [
  { id: "iss", label: "Estación Espacial Internacional", o2: 21, p: 101.3, flow: 10, g: 0,
    note: "Aire a presión de nivel del mar. La ventilación de cabina suele estar entre 5 y 20 cm/s." },
  { id: "capsule", label: "Cápsula de exploración (8.2 psi, 34 % O₂)", o2: 34, p: 56.5, flow: 10, g: 0,
    note: "Atmósfera de exploración propuesta por la NASA para acortar la preparación de los paseos espaciales." },
  { id: "moon", label: "Base lunar (8.2 psi, 34 % O₂)", o2: 34, p: 56.5, flow: 5, g: 0.165,
    note: "Misma atmósfera de exploración, con la gravedad de la Luna." },
  { id: "rover", label: "Rover presurizado lunar (10.2 psi, 30 % O₂)", o2: 30, p: 70.3, flow: 5, g: 0.165,
    note: "Rango previsto por la NASA para la base y los rovers lunares: 30 % de O₂ o más, a 10.2 psi o menos, entre el traje (100 % O₂, 4.3 psi) y el aire." },
  { id: "mars", label: "Hábitat en Marte (10.2 psi, 26.5 % O₂)", o2: 26.5, p: 70.3, flow: 5, g: 0.38,
    note: "Atmósfera intermedia propuesta para hábitats de larga duración." },
  { id: "custom", label: "Personalizado", note: "Ajusta los controles libremente." },
];

const FUELS = [
  { id: "sibal", label: "Tejido de algodón (SIBAL)", state: "solido", re: /SIBAL/ },
  { id: "pmma", label: "Plástico PMMA (metacrilato)", state: "solido", re: /PMMA/ },
  { id: "nomex", label: "Nomex (tejido ignífugo)", state: "solido", re: /Nomex/ },
  { id: "silicona", label: "Silicona", state: "solido", re: /Silicon/i },
  { id: "cera", label: "Cera o parafina", state: "solido", re: /Cera/ },
  { id: "metanol", label: "Metanol (líquido)", state: "liquido", re: /Methanol/ },
  { id: "heptano", label: "Heptano (líquido tipo combustible)", state: "liquido", re: /Heptane/ },
  { id: "gas", label: "Gas combustible (etano, propano, butano)", state: "gas", re: /ethane|propane|butane/i },
];

const BURN = ["combustion sostenida", "propagacion completa", "combustion completa", "disrupcion de gota", "flujo cortado", "llama fria"];
const EXT = ["extincion", "blowoff", "sin propagacion", "autoextincion"];
const NOIGN = ["sin ignicion"];
const OUTCOME_ES = {
  "combustion sostenida": "sigue ardiendo", "propagacion completa": "se propaga entera", "combustion completa": "arde hasta consumirse",
  "disrupcion de gota": "arde (la gota estalla)", "flujo cortado": "arde hasta cortar el gas", "llama fria": "llama fría",
  "extincion": "se apaga", "blowoff": "se apaga por soplado", "sin propagacion": "no se propaga",
  "autoextincion": "se apaga sola", "sin ignicion": "no prende",
};
const SUMMARIES = {
  "SAFFIRE": "Los únicos incendios grandes hechos en el espacio, dentro de una nave Cygnus vacía.",
  "BASS-II": "Más de 120 llamas en un túnel de viento en la ISS para hallar cuándo se apagan.",
  "FLEX": "Gotas de combustible ardiendo para medir qué gases las apagan mejor.",
  "SAME": "Cómo es el humo sin gravedad y si los detectores lo ven.",
  "BASS": "Inventario de materiales de cabina quemados en la ISS.",
  "E-FIELD": "Llamas con campo eléctrico: imitan la flotación de la gravedad parcial.",
  "CFI-G": "Llamas frías, casi invisibles, con mucho oxígeno.",
  "BRE": "Imita plásticos ardiendo: con 34 % de O₂ siguieron sin ventilación; con 21 % se apagaron.",
  "FLEX-2": "Gotas de combustibles reales y mezclas, de 17 a 30 % de O₂.",
  "SPICE": "Cuándo una llama de gas empieza a soltar hollín (humo).",
  "CFI": "Gotas con llamas frías de dodecano a varias presiones.",
};

// Ficha por experimento (fuente: metadatos ISA-Tab de PSI y tablas experimentales).
const DETAILS = {
  "SAFFIRE": { varied: "Material, tamaño, flujo", sensors: "Cámaras, termopares, O₂/CO₂", equip: "Selección de materiales" },
  "BASS-II": { varied: "O₂, flujo, forma", sensors: "Vídeo, CO", equip: "Control de ventilación" },
  "BASS": { varied: "Material, forma", sensors: "Vídeo", equip: "Selección de materiales" },
  "FLEX": { varied: "O₂, presión, gas inerte", sensors: "Vídeo, radiómetros", equip: "Extintores sin halones" },
  "SAME": { varied: "Material, temperatura", sensors: "Detectores, contadores de partículas", equip: "Detectores de humo" },
  "CFI-G": { varied: "Gas, O₂, presión", sensors: "Cámaras, radiómetros", equip: "Detección de llamas frías" },
  "E-FIELD": { varied: "Campo eléctrico, caudal", sensors: "Corriente iónica, láser (PLIF)", equip: "Modelos de gravedad parcial" },
  "BRE": { varied: "O₂, presión, gas, quemador", sensors: "Flujo de calor, cámaras", equip: "Extinción con O₂ alto", unit: "llamas" },
  "FLEX-2": { varied: "Combustible, O₂, presión, flujo", sensors: "Cámaras de alta velocidad", equip: "Extintores y modelos", unit: "combustibles" },
  "SPICE": { varied: "Gas, quemador, caudal, aire", sensors: "Cámaras, radiometría", equip: "Detección de humo y hollín", unit: "llamas" },
  "CFI": { varied: "Mezcla, presión, helio", sensors: "Cámaras UV, radiómetros", equip: "Detección de llamas frías", unit: "pruebas" },
};
const HW_GROUPS = [
  ["CIR · ACME", "CFI-G, E-FIELD, BRE", "Resto de ACME"],
  ["CIR · MDCA (gotas)", "FLEX, FLEX-2, CFI", "—"],
  ["MSG · túnel de SPICE", "BASS, BASS-II, SPICE", "SLICE"],
  ["Módulo Saffire (Cygnus)", "SAFFIRE", "Saffire IV–VI"],
  ["Hardware SAME", "SAME", "DAFT, DAFT-2"],
];

let TESTS = [], EXPS = [];
const $ = (id) => document.getElementById(id);
const ACC = { prevencion: "prevención", deteccion: "detección", extincion: "extinción", solido: "sólido", liquido: "líquido", pirolisis: "pirólisis",
  Diseno: "Diseño", Seleccion: "Selección", ventilacion: "ventilación", plasticos: "plásticos", Halon: "halón", hollin: "hollín",
  electricos: "eléctricos", frias: "frías", Modulo: "Módulo", tunel: "túnel", vehiculo: "vehículo", O2: "O₂", CO2: "CO₂" };
const acc = (t) => String(t).replace(/[A-Za-z0-9]+/g, (w) => ACC[w] || w);
const cls = (o) => BURN.includes(o) ? "burn" : EXT.includes(o) ? "ext" : NOIGN.includes(o) ? "noign" : null;
const fmt = (x, d = 1) => (x === null || x === undefined || Number.isNaN(x)) ? "n.d." : Number(x).toFixed(d).replace(".", ",");
const pct = (x) => `${Math.round(x * 100)} %`;
const buoyantFlow = (g) => 31.3 * Math.sqrt(g); // cm/s para una llama de ~1 cm: v ~ sqrt(g·L)

function docLink(group) {
  const e = EXPS.find((x) => x.id === group);
  const doi = e && e.psi_metadata && e.psi_metadata[0] && e.psi_metadata[0].doi;
  return doi ? `https://doi.org/${doi}` : "https://psi.nasa.gov/";
}

function pool(fuel) {
  const base = TESTS.filter((t) => t.fuel_state === fuel.state && t.o2_pct != null && cls(t.outcome)
    && !["SAME", "BASS", "E-FIELD"].includes(t.experiment_group));
  const own = base.filter((t) => fuel.re.test(t.fuel));
  return own.length >= 4 ? { tests: own, own: true } : { tests: base, own: false };
}

function knn(tests, s, k = 15) {
  const solid = s.fuel.state === "solido";
  const scored = tests.map((t) => {
    const d = Math.hypot((t.o2_pct - s.o2) / 2, Math.log((t.pressure_kpa || 101.3) / s.p) / 0.25,
      solid && t.flow_cm_s != null ? (t.flow_cm_s - s.flowEff) / 4 : 0,
      s.d0 && t._d0 ? (t._d0 - s.d0) / 0.5 : 0); // tamaño de gota (FLEX): 0,5 mm pesa como 2 puntos de O₂
    return { t, d };
  }).sort((a, b) => a.d - b.d).slice(0, Math.min(k, tests.length));
  const w = { burn: 0, ext: 0, noign: 0 }; let tot = 0;
  scored.forEach(({ t, d }) => { const wt = 1 / (d + 0.3); w[cls(t.outcome)] += wt; tot += wt; });
  return { near: scored, burn: w.burn / tot, ext: w.ext / tot, noign: w.noign / tot };
}

function range(tests, key) {
  const v = tests.map((t) => t[key]).filter((x) => x != null);
  return [Math.min(...v), Math.max(...v)];
}

function trendAt(o2) {
  const near = TESTS.filter((t) => t.o2_pct != null && cls(t.outcome) && Math.abs(t.o2_pct - o2) <= 3
    && !["SAME", "BASS", "E-FIELD"].includes(t.experiment_group));
  if (near.length < 5) return null;
  return { p: near.filter((t) => cls(t.outcome) === "burn").length / near.length, n: near.length };
}

function evaluate(s) {
  const P = pool(s.fuel);
  const r = knn(P.tests, s);
  const o2r = range(P.tests, "o2_pct"), pr = range(P.tests, "pressure_kpa");
  const flags = [];
  let risk = r.burn, trend = null;
  if (s.o2 > o2r[1] + 1) {
    trend = trendAt(s.o2);
    flags.push(`El O₂ elegido (${fmt(s.o2)} %) supera el máximo ensayado para este material (${fmt(o2r[1])} %).`);
    if (trend) risk = Math.max(risk, trend.p);
  }
  if (s.p < pr[0] * 0.9 || s.p > pr[1] * 1.1) flags.push(`La presión (${fmt(s.p, 0)} kPa) está fuera del rango ensayado (${fmt(pr[0], 0)}–${fmt(pr[1], 0)} kPa).`);
  if (s.g > 0) flags.push(`No hay datos de combustión en ${s.g === 1 ? "gravedad terrestre en este catálogo" : "gravedad parcial"}: se suma un flujo de flotación estimado de ${fmt(buoyantFlow(s.g))} cm/s.`);
  // Umbral de O2: bajar el oxígeno hasta que la probabilidad de seguir ardiendo cae por debajo del 25 %
  let threshold = null;
  for (let o = Math.min(s.o2, o2r[1]); o >= 10; o -= 0.5) {
    if (knn(P.tests, { ...s, o2: o }).burn < 0.25) { threshold = o; break; }
  }
  return { P, r, risk, trend, flags, threshold, o2r };
}

function diluentStats(o2) {
  const f = TESTS.filter((t) => t.experiment_group === "FLEX" && Math.abs(t.o2_pct - o2) <= 3);
  const groups = { "Solo nitrógeno": (t) => t.diluent === "N2", "Con CO₂": (t) => /CO2/.test(t.diluent), "Con helio": (t) => /He/.test(t.diluent) };
  return Object.entries(groups).map(([k, fn]) => {
    const g = f.filter(fn);
    return { k, n: g.length, ext: g.length ? g.filter((t) => t.outcome === "extincion").length / g.length : null };
  }).filter((x) => x.n >= 3);
}

function render() {
  const s = {
    fuel: FUELS.find((f) => f.id === $("fuel").value),
    o2: +$("o2").value, p: +$("p").value, flow: +$("flow").value, g: +$("g").value,
  };
  const liquid = s.fuel.state === "liquido";
  $("d0wrap").hidden = !liquid; $("d0v").textContent = fmt(+$("d0").value);
  if (liquid) s.d0 = +$("d0").value;
  s.flowEff = s.flow + buoyantFlow(s.g);
  $("o2v").textContent = fmt(s.o2); $("pv").textContent = fmt(s.p, 0); $("flowv").textContent = fmt(s.flow);
  $("gNote").textContent = s.g > 0 ? `Flujo efectivo estimado: ${fmt(s.flowEff)} cm/s (ventilación + flotación).` : "";
  const E = evaluate(s);
  let bounds = "";
  if (s.g > 0 && s.g < 1) {
    const r0 = evaluate({ ...s, g: 0, flowEff: s.flow }).risk, r1 = evaluate({ ...s, g: 1, flowEff: s.flow + buoyantFlow(1) }).risk;
    bounds = `<p class="hint">Cotas por gravedad: <b>${pct(r0)}</b> en microgravedad y <b>${pct(r1)}</b> con la flotación de 1 g. A ${fmt(s.g, 2)} g el resultado debería caer entre ambos.</p>`;
  }
  const ppO2 = s.o2 * s.p / 100;
  const lvl = E.risk >= 0.66 ? "high" : E.risk >= 0.33 ? "mid" : "low";
  const lvlTxt = { high: "ALTO", mid: "MEDIO", low: "BAJO" }[lvl];
  // Probabilidad conjunta: P(prende y se mantiene) = P(prende) × P(se mantiene | prende)
  const pIgn = Math.max(1 - E.r.noign, E.risk), pSus = pIgn > 0 ? Math.min(1, E.risk / pIgn) : 0;
  const out = [];
  if (E.flags.some((f) => f.startsWith("El O₂"))) out.push("O₂");
  if (E.flags.some((f) => f.startsWith("La presión"))) out.push("presión");
  if (s.g > 0) out.push("gravedad");

  $("verdict").className = `verdict card lvl-${lvl}`;
  $("verdict").innerHTML = `<div class="big">${pct(E.risk)}</div><div>
    <p><b>Probabilidad total de incendio sostenido · riesgo ${lvlTxt}</b></p>
    <p class="formula">Prende <b>${pct(pIgn)}</b> × se mantiene si prende <b>${pct(pSus)}</b></p>
    <p class="hint">${s.fuel.label} · ${E.r.near.length} pruebas PSI parecidas${E.P.tests.length < 10 ? " · muestra pequeña" : ""}${E.threshold !== null ? ` · seguro por debajo de ${fmt(E.threshold)} % O₂` : ""}</p>
    ${out.length ? `<div class="warn">⚠ Fuera de lo ensayado: ${out.join(", ")}. Resultado orientativo.</div>` : ""}
    <details class="more"><summary>Detalles</summary>
      <p class="hint">Presión parcial de O₂: ${fmt(ppO2)} kPa (aire: 21,2 kPa).</p>
      ${E.flags.map((f) => `<p class="hint">• ${f}</p>`).join("")}
      ${bounds}
      ${E.trend ? `<p class="hint">• Fuera de rango se usa la tendencia de ${E.trend.n} pruebas con O₂ cercano: ${pct(E.trend.p)} siguen ardiendo.</p>` : ""}
    </details>
  </div>`;

  const solid = s.fuel.state === "solido";
  $("prevent").innerHTML = `<h3>🛡️ Prevenir</h3><ul>
    <li>${E.threshold !== null ? `O₂ por debajo de <b>${fmt(E.threshold)} %</b>` : "<b>Bajar el O₂</b>: no hay umbral seguro en los datos"}</li>
    ${solid ? `<li><b>Silicona o Nomex</b> en vez de algodón<span class="tag">Saffire</span></li>` : ""}
    ${s.o2 > 25 ? `<li>Con más del 25 % de O₂ casi nada se apaga solo<span class="tag">FLEX</span></li>` : ""}
  </ul>`;

  const co = E.r.near.map(({ t }) => t.co_final_ppm).filter((x) => x != null && x >= 0).sort((a, b) => a - b);
  const coMed = co.length ? co[Math.floor(co.length / 2)] : null;
  $("detect").innerHTML = `<h3>🔎 Detectar</h3><ul>
    <li>Sensores <b>en la corriente de ventilación</b>: el humo no sube${s.flowEff < 2 ? " (con este flujo, la detección se retrasa)" : ""}</li>
    <li><b>Multisensor</b>: partículas + CO + CO₂<span class="tag">SAME</span></li>
    ${coMed !== null ? `<li>Alerta temprana por CO (~${fmt(coMed, 0)} ppm en pruebas parecidas)<span class="tag">BASS-II</span></li>` : ""}
    ${s.fuel.id === "gas" ? `<li>Ojo con las <b>llamas frías</b>: casi invisibles<span class="tag">CFI-G</span></li>` : ""}
  </ul>`;

  const dil = diluentStats(s.o2);
  const best = dil.filter((d) => d.ext).sort((a, b) => b.ext - a.ext)[0];
  $("extinguish").innerHTML = `<h3>🧯 Extinguir</h3><ul>
    ${solid ? `<li><b>Cortar la ventilación</b>${s.g > 0 ? " (menos eficaz con gravedad)" : ""}<span class="tag">BASS-II</span></li>` : ""}
    ${s.o2 > 25 ? `<li>Con este O₂ <b>no basta con cortar el aire</b>: las llamas siguen sin flujo<span class="tag">BRE</span></li>` : ""}
    <li><b>Diluir con N₂</b>${E.threshold !== null ? ` hasta ~${fmt(E.threshold)} % O₂` : ""}</li>
    ${best ? `<li>Agente: <b>${best.k.replace("Con ", "").replace("Solo ", "")}</b> (${pct(best.ext)} de extinción)<span class="tag">FLEX</span></li>` : ""}
  </ul>`;

  drawChart(E, s);
  $("evidence").innerHTML = `<tr><th>Experimento</th><th>Prueba</th><th>Combustible</th><th>O₂ %</th><th>kPa</th><th>Flujo</th><th>Resultado</th><th>Fuente</th></tr>` +
    E.r.near.slice(0, 10).map(({ t }) => `<tr><td>${t.experiment}</td><td>${t.test_id}</td><td>${t.fuel}</td><td>${fmt(t.o2_pct)}</td>
      <td>${fmt(t.pressure_kpa, 0)}</td><td>${t.flow_cm_s != null ? fmt(t.flow_cm_s) : "—"}</td>
      <td><span class="dot" style="background:var(--${cls(t.outcome)})"></span>${OUTCOME_ES[t.outcome] || t.outcome}</td>
      <td><a href="${docLink(t.experiment_group)}" target="_blank" rel="noopener">PSI</a></td></tr>`).join("");
}

function drawChart(E, s) {
  // Dispersión O2 vs presión en SVG puro (sin dependencias externas)
  const W = 640, H = 280, m = { l: 48, r: 12, t: 12, b: 36 };
  const x = (v) => m.l + (v - 10) / 32 * (W - m.l - m.r), y = (v) => H - m.b - (v - 40) / 280 * (H - m.t - m.b);
  let g = "";
  for (let v = 10; v <= 42; v += 5) g += `<line x1="${x(v)}" x2="${x(v)}" y1="${m.t}" y2="${H - m.b}" class="grid"/><text x="${x(v)}" y="${H - m.b + 16}" class="tick" text-anchor="middle">${v}</text>`;
  for (let v = 50; v <= 320; v += 50) g += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${m.l - 6}" y="${y(v) + 4}" class="tick" text-anchor="end">${v}</text>`;
  const jitter = (i) => ((i * 9301 + 49297) % 233280) / 233280 - 0.5;
  const pts = E.P.tests.map((t, i) => `<circle cx="${x(t.o2_pct) + jitter(i) * 4}" cy="${y(t.pressure_kpa) + jitter(i + 7) * 6}" r="3.2" fill="var(--${cls(t.outcome)})" fill-opacity=".75"><title>${t.experiment} ${t.test_id}: ${OUTCOME_ES[t.outcome]}</title></circle>`).join("");
  const ux = x(Math.min(42, s.o2)), uy = y(Math.min(320, Math.max(40, s.p)));
  const you = `<g class="you"><line x1="${ux - 8}" x2="${ux + 8}" y1="${uy - 8}" y2="${uy + 8}"/><line x1="${ux - 8}" x2="${ux + 8}" y1="${uy + 8}" y2="${uy - 8}"/><circle cx="${ux}" cy="${uy}" r="13" fill="none"/></g>`;
  const labels = `<text x="${(W + m.l) / 2}" y="${H - 4}" class="axis" text-anchor="middle">O₂ (%)</text><text transform="translate(12 ${(H - m.b) / 2}) rotate(-90)" class="axis" text-anchor="middle">Presión (kPa)</text>`;
  $("chart").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Pruebas por O2 y presión">${g}${pts}${you}${labels}</svg>`;
  $("legend").innerHTML = [["burn", "Sigue ardiendo"], ["ext", "Se apaga"], ["noign", "No prende"]].map(([c, l]) => `<span><span class="dot" style="background:var(--${c})"></span>${l}</span>`).join("") + `<span>✕ Tu escenario</span>`;
}

// Enlaces a cada investigación en NASA PSI (DOI de los metadatos; si no hay, portal de PSI con su identificador).
const PSI_NO_DOI = { "BASS": [["PSI-26", "Burning and Suppression of Solids"]], "CFI-G": [["PSI-159", "Cool Flames Investigation with Gases"]] };
function psiLinks(e) {
  const md = e.psi_metadata || [];
  if (md.length) return md.map((m) => ({ url: `https://doi.org/${m.doi}`, label: md.length > 1 ? (m.acronym || m.psi_id) : "Ver en NASA PSI", title: `${m.psi_id} · ${m.title}` }));
  return (PSI_NO_DOI[e.id] || []).map(([id, t]) => ({ url: "https://psi.nasa.gov/", label: `Buscar ${id} en PSI`, title: `${id} · ${t}` }));
}
const rng = (a, b) => Math.round(a) === Math.round(b) ? fmt(a, 0) : `${fmt(a, 0)}–${fmt(b, 0)}`;
function renderExperiments() {
  const counts = {};
  TESTS.forEach((t) => { counts[t.experiment_group] = (counts[t.experiment_group] || 0) + 1; });
  const sorted = [...EXPS].sort((a, b) => b.habitat_relevance - a.habitat_relevance);
  $("ranking").innerHTML = sorted.map((e, i) => {
    const md = e.psi_metadata || [];
    return `<div class="rank"><h3>${i + 1}. ${e.id} <span class="stars" title="Relevancia para hábitats">${"★".repeat(e.habitat_relevance)}${"☆".repeat(5 - e.habitat_relevance)}</span></h3>
      <p>${SUMMARIES[e.id] || e.summary}</p>
      <p class="hint">Sirve para: <b>${DETAILS[e.id]?.equip || acc(e.pillars.join(", "))}</b></p>
      <p class="links">${psiLinks(e).map((l) => `<a class="plink" href="${l.url}" target="_blank" rel="noopener" title="${l.title}">${l.label} ↗</a>`).join("")}</p>
      <p class="src">${counts[e.id] || e.n_tests || 0} ${DETAILS[e.id]?.unit || "pruebas"}${e.per_test === false ? " · contexto, sin resultado por prueba" : ""}</p></div>`;
  }).join("");
  const rows = [["Combustible", (e) => acc(e.fuel_state)], ["Pruebas", (e) => `${counts[e.id] || e.n_tests || 0}${e.per_test === false ? "*" : ""}`],
    ["O₂ (%)", (e) => e.o2_min != null ? rng(e.o2_min, e.o2_max) : "—"],
    ["Presión (kPa)", (e) => e.p_min_kpa != null ? rng(e.p_min_kpa, e.p_max_kpa) : "—"],
    ["Flujo (cm/s)", (e) => e.flow_max ? `≤ ${fmt(e.flow_max, 0)}` : "reposo"],
    ["Qué varía", (e) => DETAILS[e.id]?.varied || ""], ["Sensores", (e) => DETAILS[e.id]?.sensors || ""]];
  $("compare").innerHTML = `<tr><th></th>${sorted.map((e) => `<th>${e.id}</th>`).join("")}</tr>` +
    rows.map(([k, fn]) => `<tr><th>${k}</th>${sorted.map((e) => `<td>${fn(e)}</td>`).join("")}</tr>`).join("");
  $("hwgroups").innerHTML = `<tr><th>Equipo</th><th>En el catálogo</th><th>Otras en PSI</th></tr>` +
    HW_GROUPS.map(([h, a, b]) => `<tr><td>${h}</td><td>${a}</td><td>${b}</td></tr>`).join("");
  const cols = [["ISS", 21], ["Marte", 26.5], ["Rover", 30], ["Luna", 34]];
  const cell = (st) => st === "ok" ? `<td class="mok">se apaga</td>` : st === "burn" ? `<td class="mburn">arde</td>` : `<td class="hint">sin dato</td>`;
  $("materials").innerHTML = `<tr><th>Material</th><th>Tipo</th><th>Se apaga solo hasta</th>${cols.map(([n, o]) => `<th>${n} ${o} %</th>`).join("")}</tr>` +
    MATERIALS.map((m) => `<tr><td>${m.name}</td><td>${m.type}</td><td>${mocText(m)}</td>${cols.map(([, o]) => cell(matAt(m, o))).join("")}</tr>`).join("");
}


function applyEnv() {
  const e = ENVS.find((x) => x.id === $("env").value);
  $("envNote").textContent = e.note;
  if (e.id !== "custom") { $("o2").value = e.o2; $("p").value = e.p; $("flow").value = e.flow; $("g").value = String(e.g); }
  render();
}

async function init() {
  [TESTS, EXPS] = await Promise.all([fetch("data/tests.json").then((r) => r.json()), fetch("data/experiments.json").then((r) => r.json())]);
  TESTS.forEach((t) => { const m = /d0=([\d.]+)/.exec(t.notes || ""); t._d0 = m ? +m[1] : null; });
  $("env").innerHTML = ENVS.map((e) => `<option value="${e.id}">${e.label}</option>`).join("");
  $("fuel").innerHTML = FUELS.map((f) => `<option value="${f.id}">${f.label}</option>`).join("");
  $("env").addEventListener("change", applyEnv);
  ["fuel", "o2", "p", "flow", "g", "d0"].forEach((id) => $(id).addEventListener("input", () => {
    if (id !== "fuel" && id !== "d0") $("env").value = "custom", $("envNote").textContent = ENVS.at(-1).note;
    render();
  }));
  document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === b));
    document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === b.dataset.tab));
  }));
  renderExperiments(); applyEnv();
  if (window.initMonitor) initMonitor();
}
init();
