/* Flame in Freefall: simulador de riesgo basado en pruebas PSI similares (k vecinos más cercanos). */
"use strict";

const ENVS = [
  { id: "iss", label: "Estación Espacial Internacional", o2: 21, p: 101.3, flow: 10, g: 0,
    note: "Aire a presión de nivel del mar. La ventilación de cabina suele estar entre 5 y 20 cm/s." },
  { id: "capsule", label: "Cápsula de exploración (8.2 psi, 34 % O₂)", o2: 34, p: 56.5, flow: 10, g: 0,
    note: "Atmósfera de exploración propuesta por la NASA para acortar la preparación de los paseos espaciales." },
  { id: "moon", label: "Base lunar (8.2 psi, 34 % O₂)", o2: 34, p: 56.5, flow: 5, g: 0.165,
    note: "Misma atmósfera de exploración, con la gravedad de la Luna." },
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
  "SAFFIRE": "Los únicos incendios a gran escala hechos en el espacio: muestras de tejido de casi un metro ardieron dentro de una nave de carga Cygnus vacía, tras desacoplarse de la ISS. Mostraron que el tejido de algodón se propaga por completo con flujos de 20 a 30 cm/s y que la silicona fina apenas arde, lo que pone a prueba los ensayos de materiales que la NASA hace en la Tierra.",
  "BASS-II": "Más de 120 pruebas con varillas, láminas y tejidos dentro de un túnel de viento en la ISS. Variando el flujo y bajando el oxígeno con nitrógeno, encontraron los límites en los que las llamas se apagan: casi siempre al reducir la ventilación hacia cero, y a veces por soplado. Concluyen que con buena ventilación un material puede arder igual o mejor en microgravedad que en la Tierra.",
  "FLEX": "Gotas de metanol y heptano ardiendo sin gravedad para medir el índice límite de oxígeno y la eficacia de supresores como el CO₂ y el helio, a presiones de 0.7 a 3 atm. Es la base cuantitativa para elegir agentes de extinción sin halones.",
  "SAME": "Midió el humo de materiales de cabina (Kapton, silicona, Teflón, Pyrell y algodón) calentados sin llama. La hipótesis era que en microgravedad las partículas de humo crecen más, lo que puede hacer que algunos detectores no suenen. Comparó detectores de ionización, DustTrak y el instrumento M-pass.",
  "BASS": "Primera campaña del túnel de combustión en la Microgravity Science Glovebox: esferas, placas, varillas y velas de PMMA, algodón, Nomex, Ultem y cera. Su tabla pública solo trae el material de cada prueba, así que aquí sirve como inventario de qué materiales se han ensayado.",
  "E-FIELD": "Llamas de metano y etileno controladas con un campo eléctrico de hasta 10 kV. El viento iónico que genera puede imitar o cancelar la flotación, lo que la convierte en un análogo útil para pensar en gravedad parcial. Según PSI, no se diseñó para aplicaciones espaciales.",
  "CFI-G": "Llamas esféricas de etano, propano y butano con hasta un 40 % de oxígeno y entre 0.5 y 3 bar. Detectó llamas frías, que arden a baja temperatura y son difíciles de ver y de detectar. Es el conjunto con más oxígeno del catálogo.",
};

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
      solid && t.flow_cm_s != null ? (t.flow_cm_s - s.flowEff) / 4 : 0);
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
  s.flowEff = s.flow + buoyantFlow(s.g);
  $("o2v").textContent = fmt(s.o2); $("pv").textContent = fmt(s.p, 0); $("flowv").textContent = fmt(s.flow);
  $("gNote").textContent = s.g > 0 ? `Flujo efectivo estimado: ${fmt(s.flowEff)} cm/s (ventilación + flotación).` : "";
  const E = evaluate(s);
  const ppO2 = s.o2 * s.p / 100;
  const lvl = E.risk >= 0.66 ? "high" : E.risk >= 0.33 ? "mid" : "low";
  const lvlTxt = { high: "ALTO", mid: "MEDIO", low: "BAJO" }[lvl];

  $("verdict").className = `verdict card lvl-${lvl}`;
  $("verdict").innerHTML = `<div class="big">${pct(E.risk)}</div><div>
    <p><b>Riesgo ${lvlTxt}</b> de que un fuego de ${s.fuel.label.toLowerCase()} se mantenga encendido.</p>
    <p class="hint">Basado en las ${E.r.near.length} pruebas más parecidas${E.P.own ? " del mismo material" : " del mismo tipo de combustible"}${E.P.tests.length < 10 ? " (muestra muy pequeña: tómalo como orientativo)" : ""}.
    Presión parcial de O₂: ${fmt(ppO2)} kPa (aire a nivel del mar: 21,2 kPa).</p>
    ${E.flags.map((f) => `<div class="warn">⚠ ${f}</div>`).join("")}
    ${E.trend ? `<p class="hint">Fuera de rango se usa la tendencia de ${E.trend.n} pruebas de cualquier combustible con O₂ cercano: ${pct(E.trend.p)} siguen ardiendo.</p>` : ""}
  </div>`;

  // PREVENIR
  const solid = s.fuel.state === "solido";
  $("prevent").innerHTML = `<h3>🛡️ Prevenir</h3><ul>
    <li>Probabilidad de que prenda y se mantenga: <b>${pct(E.r.burn)}</b>; se apaga sola: ${pct(E.r.ext)}; no prende: ${pct(E.r.noign)}.</li>
    <li>${E.threshold !== null ? `Mantener el O₂ por debajo de <b>${fmt(E.threshold)} %</b> reduce la probabilidad de combustión sostenida a menos del 25 %.` : "Dentro de los datos no hay un nivel de O₂ que baje el riesgo por debajo del 25 %."}</li>
    ${s.o2 > 25 ? `<li>Con más del 25 % de O₂, solo el 8 % de las gotas de FLEX se apagaron solas, frente al 94 % por debajo del 15 %.<span class="tag">FLEX</span></li>` : ""}
    ${solid ? `<li>En Saffire, el tejido de algodón ardió por completo a 20–30 cm/s y la silicona fina apenas ardió: <b>elegir materiales tipo silicona o Nomex</b> en lugar de algodón.<span class="tag">Saffire</span></li>` : ""}
    ${solid ? `<li>En BASS-II no hubo ignición con 13,6 % de O₂ y se observaron extinciones a partir de ~21 % al bajar el flujo.<span class="tag">BASS-II</span></li>` : ""}
  </ul>`;

  // DETECTAR
  const co = E.r.near.map(({ t }) => t.co_final_ppm).filter((x) => x != null && x >= 0).sort((a, b) => a - b);
  const coMed = co.length ? co[Math.floor(co.length / 2)] : null;
  $("detect").innerHTML = `<h3>🔎 Detectar</h3><ul>
    <li>En microgravedad el humo no sube: los sensores deben ir en la <b>trayectoria de la ventilación</b>. ${s.flowEff < 2 ? "<b>Con tan poco flujo el humo se queda junto al foco y la detección se retrasa.</b>" : ""}</li>
    <li>SAME-R planteó que en microgravedad las partículas de humo crecen más y son menos numerosas, lo que puede hacer que un detector no salte. Conviene un <b>detector multisensor</b> (partículas + CO + CO₂) en vez de uno solo de ionización.<span class="tag">SAME</span></li>
    ${coMed !== null ? `<li>El CO final mediano en las pruebas parecidas fue de <b>${fmt(coMed, 0)} ppm</b>: el CO es una señal temprana útil.<span class="tag">BASS-II</span></li>` : `<li>Medir CO y CO₂ en continuo, como hicieron Saffire y BASS-II con sensores de estado sólido.</li>`}
    ${s.fuel.id === "gas" ? `<li>CFI-G observó <b>llamas frías</b>, casi invisibles y de baja temperatura: los detectores de llama ópticos pueden no verlas.<span class="tag">CFI-G</span></li>` : ""}
  </ul>`;

  // EXTINGUIR
  const dil = diluentStats(s.o2);
  $("extinguish").innerHTML = `<h3>🧯 Extinguir</h3><ul>
    ${solid ? `<li><b>Cortar la ventilación</b>: en BASS-II, 16 extinciones llegaron al reducir el flujo hacia 0 desde ~5 cm/s, y 3 por soplado al subirlo a 10 cm/s con ~17 % de O₂.<span class="tag">BASS-II</span></li>` : ""}
    ${s.g > 0 ? `<li>Con gravedad, cortar la ventilación no elimina la flotación (~${fmt(buoyantFlow(s.g))} cm/s), así que esta táctica pierde eficacia.</li>` : ""}
    <li>${E.threshold !== null ? `<b>Bajar el O₂</b> con nitrógeno hasta ~${fmt(E.threshold)} % apaga la mayoría de los casos parecidos.` : "Bajar el O₂ con nitrógeno ayuda, pero los datos no muestran un umbral claro para este escenario."}</li>
    ${dil.length ? `<li>Probabilidad de extinción de gotas de FLEX con O₂ cercano según el diluyente: ${dil.map((d) => `${d.k} <b>${pct(d.ext)}</b> (${d.n})`).join(", ")}.<span class="tag">FLEX</span></li>` : ""}
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

function renderExperiments() {
  const counts = {};
  TESTS.forEach((t) => { counts[t.experiment_group] = (counts[t.experiment_group] || 0) + 1; });
  const sorted = [...EXPS].sort((a, b) => b.habitat_relevance - a.habitat_relevance);
  $("ranking").innerHTML = sorted.map((e, i) => {
    const md = e.psi_metadata || [];
    const pubs = md.reduce((n, m) => n + (m.publications || []).length, 0);
    return `<div class="rank"><h3>${i + 1}. ${e.id} <span class="stars">${"★".repeat(e.habitat_relevance)}${"☆".repeat(5 - e.habitat_relevance)}</span></h3>
      <p class="hint">${e.name}</p>
      <p>${SUMMARIES[e.id] || e.summary}</p>
      <p><b>Pilares:</b> ${acc(e.pillars.join(", "))} · <b>Hardware:</b> ${acc(e.hardware)}</p>
      <p><b>En la Tierra:</b> ${acc(e.earth_application)}</p>
      <p class="src">${counts[e.id] || 0} pruebas · ${pubs} publicaciones · ${md.length ? md.map((m) => `<a href="https://doi.org/${m.doi}" target="_blank" rel="noopener">${m.psi_id}</a>`).join(" ") : "sin metadatos PSI cargados"}</p></div>`;
  }).join("");
  const rows = [["Plataforma", (e) => acc(e.platform)], ["Hardware", (e) => acc(e.hardware)], ["Combustible", (e) => acc(e.fuel_state)],
    ["Pruebas", (e) => counts[e.id] || 0], ["O₂ (%)", (e) => e.o2_min != null ? `${fmt(e.o2_min)}–${fmt(e.o2_max)}` : "n.d."],
    ["Presión (kPa)", (e) => e.p_min_kpa != null ? `${fmt(e.p_min_kpa, 0)}–${fmt(e.p_max_kpa, 0)}` : "n.d."],
    ["Flujo máx. (cm/s)", (e) => e.flow_max != null ? fmt(e.flow_max) : "quiescente"], ["Pilares", (e) => acc(e.pillars.join(", "))],
    ["Relevancia hábitat", (e) => `${e.habitat_relevance}/5`]];
  $("compare").innerHTML = `<tr><th></th>${sorted.map((e) => `<th>${e.id}</th>`).join("")}</tr>` +
    rows.map(([k, fn]) => `<tr><th>${k}</th>${sorted.map((e) => `<td>${fn(e)}</td>`).join("")}</tr>`).join("");
}

function renderMethod() {
  $("method").innerHTML = `<h2>Cómo funciona</h2>
  <p>La herramienta une <b>${TESTS.length} pruebas</b> de 7 experimentos de combustión de la NASA (Saffire I–III, BASS, BASS-II, FLEX, SAME-R, CFI-G y ACME E-FIELD) descargadas de Physical Science Informatics, en una tabla común con O₂, presión, flujo, combustible y resultado.</p>
  <ol>
    <li><b>Pruebas parecidas:</b> para tu escenario busca las 15 pruebas más cercanas del mismo material (o del mismo tipo de combustible si hay pocas), midiendo la distancia en O₂, presión y flujo.</li>
    <li><b>Riesgo:</b> es la proporción ponderada de esas pruebas en las que la llama siguió ardiendo.</li>
    <li><b>Umbral de O₂:</b> se baja el O₂ en pasos de 0,5 % hasta que el riesgo cae por debajo del 25 %.</li>
    <li><b>Gravedad parcial:</b> no hay datos de combustión en la Luna ni en Marte. Se estima el flujo de flotación de una llama pequeña como v ≈ √(g·L) con L = 1 cm (≈13 cm/s en la Luna y ≈19 cm/s en Marte) y se suma a la ventilación. Es una cota, no una medida; LUCI y FM2 aportarán datos reales. El mismo enfoque de escalar con la gravedad, separando el régimen dominado por la flotación del dominado por la tensión superficial, lo usa el experimento de ebullición MABE (PSI-81, Raj y Kim).</li>
    <li><b>Fuera de rango:</b> si el O₂ supera lo ensayado para ese material, se usa la tendencia de todas las pruebas con O₂ parecido y se avisa.</li>
  </ol>
  <p><b>IA:</b> los resúmenes de cada experimento y la clasificación por pilares y relevancia los ha generado un modelo de IA (Claude) a partir de los metadatos y las tablas de PSI, y se han revisado.</p>
  <p><b>Limitaciones:</b> la presión de la ISS se asume en 101,3 kPa; algunos resultados de BASS-II se deducen de notas de texto libre; los sólidos solo se han ensayado hasta ~22 % de O₂. No es una herramienta certificada.</p>`;
}

function applyEnv() {
  const e = ENVS.find((x) => x.id === $("env").value);
  $("envNote").textContent = e.note;
  if (e.id !== "custom") { $("o2").value = e.o2; $("p").value = e.p; $("flow").value = e.flow; $("g").value = String(e.g); }
  render();
}

async function init() {
  [TESTS, EXPS] = await Promise.all([fetch("data/tests.json").then((r) => r.json()), fetch("data/experiments.json").then((r) => r.json())]);
  $("env").innerHTML = ENVS.map((e) => `<option value="${e.id}">${e.label}</option>`).join("");
  $("fuel").innerHTML = FUELS.map((f) => `<option value="${f.id}">${f.label}</option>`).join("");
  $("env").addEventListener("change", applyEnv);
  ["fuel", "o2", "p", "flow", "g"].forEach((id) => $(id).addEventListener("input", () => {
    if (id !== "fuel") $("env").value = "custom", $("envNote").textContent = ENVS.at(-1).note;
    render();
  }));
  document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === b));
    document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === b.dataset.tab));
  }));
  renderExperiments(); renderMethod(); applyEnv();
}
init();
