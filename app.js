/* Flame in Freefall: risk simulator based on similar PSI tests (k nearest neighbors). */
"use strict";

const ENVS = [
  { id: "iss", label: "International Space Station", o2: 21, p: 101.3, flow: 10, g: 0,
    note: "Air at sea-level pressure. Cabin ventilation is usually between 5 and 20 cm/s." },
  { id: "capsule", label: "Exploration capsule (8.2 psi, 34% O₂)", o2: 34, p: 56.5, flow: 10, g: 0,
    note: "Exploration atmosphere proposed by NASA to shorten spacewalk preparation." },
  { id: "moon", label: "Lunar base (8.2 psi, 34% O₂)", o2: 34, p: 56.5, flow: 5, g: 0.165,
    note: "Same exploration atmosphere, with lunar gravity." },
  { id: "rover", label: "Pressurized lunar rover (10.2 psi, 30% O₂)", o2: 30, p: 70.3, flow: 5, g: 0.165,
    note: "Range planned by NASA for the lunar base and rovers: 30% O₂ or more, at 10.2 psi or less, between the suit (100% O₂, 4.3 psi) and air." },
  { id: "mars", label: "Mars habitat (10.2 psi, 26.5% O₂)", o2: 26.5, p: 70.3, flow: 5, g: 0.38,
    note: "Intermediate atmosphere proposed for long-duration habitats." },
  { id: "custom", label: "Custom", note: "Adjust the controls freely." },
];

const FUELS = [
  { id: "sibal", label: "Cotton fabric (SIBAL)", state: "solido", re: /SIBAL/ },
  { id: "pmma", label: "PMMA plastic (acrylic)", state: "solido", re: /PMMA/ },
  { id: "nomex", label: "Nomex (fire-resistant fabric)", state: "solido", re: /Nomex/ },
  { id: "silicona", label: "Silicone", state: "solido", re: /Silicon/i },
  { id: "cera", label: "Wax or paraffin", state: "solido", re: /Cera/ },
  { id: "metanol", label: "Methanol (liquid)", state: "liquido", re: /Methanol/ },
  { id: "heptano", label: "Heptane (fuel-like liquid)", state: "liquido", re: /Heptane/ },
  { id: "gas", label: "Fuel gas (ethane, propane, butane)", state: "gas", re: /ethane|propane|butane/i },
];

const BURN = ["combustion sostenida", "propagacion completa", "combustion completa", "disrupcion de gota", "flujo cortado", "llama fria"];
const EXT = ["extincion", "blowoff", "sin propagacion", "autoextincion"];
const NOIGN = ["sin ignicion"];
const OUTCOME_TXT = {
  "combustion sostenida": "keeps burning", "propagacion completa": "spreads fully", "combustion completa": "burns out",
  "disrupcion de gota": "burns (droplet bursts)", "flujo cortado": "burns until gas is cut", "llama fria": "cool flame",
  "extincion": "goes out", "blowoff": "blown out", "sin propagacion": "does not spread",
  "autoextincion": "self-extinguishes", "sin ignicion": "does not ignite",
};
// Spanish fuel names in the PSI catalog, shown in English
const FUEL_TXT = { "Cera/parafina": "Wax/paraffin", "Etileno": "Ethylene", "Metano": "Methane", "SIBAL (algodon-fibra de vidrio)": "SIBAL (cotton-fiberglass)", "Silicona": "Silicone" };
const fuelTxt = (f) => FUEL_TXT[f] || f;
const SUMMARIES = {
  "SAFFIRE": "The only large fires ever set in space, inside an empty Cygnus spacecraft.",
  "BASS-II": "Over 120 flames in a wind tunnel on the ISS to find when they go out.",
  "FLEX": "Burning fuel droplets to measure which gases put them out best.",
  "SAME": "What smoke looks like without gravity and whether detectors see it.",
  "BASS": "Survey of cabin materials burned on the ISS.",
  "E-FIELD": "Flames in an electric field: they mimic the buoyancy of partial gravity.",
  "CFI-G": "Cool flames, almost invisible, with lots of oxygen.",
  "BRE": "Mimics burning plastics: at 34% O₂ flames kept going without ventilation; at 21% they went out.",
  "FLEX-2": "Droplets of real fuels and blends, from 17 to 30% O₂.",
  "SPICE": "When a gas flame starts to release soot (smoke).",
  "CFI": "Dodecane droplets with cool flames at several pressures.",
};

// Per-experiment sheet (source: PSI ISA-Tab metadata and experimental tables).
const DETAILS = {
  "SAFFIRE": { varied: "Material, size, flow", sensors: "Cameras, thermocouples, O₂/CO₂", equip: "Material selection" },
  "BASS-II": { varied: "O₂, flow, shape", sensors: "Video, CO", equip: "Ventilation control" },
  "BASS": { varied: "Material, shape", sensors: "Video", equip: "Material selection" },
  "FLEX": { varied: "O₂, pressure, inert gas", sensors: "Video, radiometers", equip: "Halon-free extinguishers" },
  "SAME": { varied: "Material, temperature", sensors: "Detectors, particle counters", equip: "Smoke detectors" },
  "CFI-G": { varied: "Gas, O₂, pressure", sensors: "Cameras, radiometers", equip: "Cool flame detection" },
  "E-FIELD": { varied: "Electric field, flow rate", sensors: "Ion current, laser (PLIF)", equip: "Partial gravity models" },
  "BRE": { varied: "O₂, pressure, gas, burner", sensors: "Heat flux, cameras", equip: "Extinction at high O₂", unit: "flames" },
  "FLEX-2": { varied: "Fuel, O₂, pressure, flow", sensors: "High-speed cameras", equip: "Extinguishers and models", unit: "fuels" },
  "SPICE": { varied: "Gas, burner, flow rate, air", sensors: "Cameras, radiometry", equip: "Smoke and soot detection", unit: "flames" },
  "CFI": { varied: "Mixture, pressure, helium", sensors: "UV cameras, radiometers", equip: "Cool flame detection", unit: "tests" },
};
const HW_GROUPS = [
  ["CIR · ACME", "CFI-G, E-FIELD, BRE", "Rest of ACME"],
  ["CIR · MDCA (droplets)", "FLEX, FLEX-2, CFI", "—"],
  ["MSG · SPICE tunnel", "BASS, BASS-II, SPICE", "SLICE"],
  ["Saffire module (Cygnus)", "SAFFIRE", "Saffire IV–VI"],
  ["SAME hardware", "SAME", "DAFT, DAFT-2"],
];

let TESTS = [], EXPS = [];
const $ = (id) => document.getElementById(id);
const ACC = { prevencion: "prevention", deteccion: "detection", extincion: "extinction", O2: "O₂", CO2: "CO₂" };
const acc = (t) => String(t).replace(/[A-Za-z0-9]+/g, (w) => ACC[w] || w);
const FSTATE = { solido: "solid", liquido: "liquid", gas: "gas", "solido (pirolisis)": "solid (pyrolysis)", "gas (emula sólidos)": "gas (emulates solids)" };
const cls = (o) => BURN.includes(o) ? "burn" : EXT.includes(o) ? "ext" : NOIGN.includes(o) ? "noign" : null;
const fmt = (x, d = 1) => (x === null || x === undefined || Number.isNaN(x)) ? "n/a" : Number(x).toFixed(d);
const pct = (x) => `${Math.round(x * 100)}%`;
const buoyantFlow = (g) => 31.3 * Math.sqrt(g); // cm/s for a ~1 cm flame: v ~ sqrt(g·L)

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
      s.d0 && t._d0 ? (t._d0 - s.d0) / 0.5 : 0); // droplet size (FLEX): 0.5 mm weighs like 2 points of O₂
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
    flags.push(`The chosen O₂ (${fmt(s.o2)}%) exceeds the maximum tested for this material (${fmt(o2r[1])}%).`);
    if (trend) risk = Math.max(risk, trend.p);
  }
  if (s.p < pr[0] * 0.9 || s.p > pr[1] * 1.1) flags.push(`The pressure (${fmt(s.p, 0)} kPa) is outside the tested range (${fmt(pr[0], 0)}–${fmt(pr[1], 0)} kPa).`);
  if (s.g > 0) flags.push(`There is no combustion data in ${s.g === 1 ? "Earth gravity in this catalog" : "partial gravity"}: an estimated buoyant flow of ${fmt(buoyantFlow(s.g))} cm/s is added.`);
  // O2 threshold: lower oxygen until the probability of continued burning drops below 25%
  let threshold = null;
  for (let o = Math.min(s.o2, o2r[1]); o >= 10; o -= 0.5) {
    if (knn(P.tests, { ...s, o2: o }).burn < 0.25) { threshold = o; break; }
  }
  return { P, r, risk, trend, flags, threshold, o2r };
}

function diluentStats(o2) {
  const f = TESTS.filter((t) => t.experiment_group === "FLEX" && Math.abs(t.o2_pct - o2) <= 3);
  const groups = { "Nitrogen only": (t) => t.diluent === "N2", "With CO₂": (t) => /CO2/.test(t.diluent), "With helium": (t) => /He/.test(t.diluent) };
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
  $("gNote").textContent = s.g > 0 ? `Estimated effective flow: ${fmt(s.flowEff)} cm/s (ventilation + buoyancy).` : "";
  const E = evaluate(s);
  let bounds = "";
  if (s.g > 0 && s.g < 1) {
    const r0 = evaluate({ ...s, g: 0, flowEff: s.flow }).risk, r1 = evaluate({ ...s, g: 1, flowEff: s.flow + buoyantFlow(1) }).risk;
    bounds = `<p class="hint">Gravity bounds: <b>${pct(r0)}</b> in microgravity and <b>${pct(r1)}</b> with 1 g buoyancy. At ${fmt(s.g, 2)} g the result should fall between the two.</p>`;
  }
  const ppO2 = s.o2 * s.p / 100;
  const lvl = E.risk >= 0.66 ? "high" : E.risk >= 0.33 ? "mid" : "low";
  const lvlTxt = { high: "HIGH", mid: "MEDIUM", low: "LOW" }[lvl];
  // Joint probability: P(ignites and keeps burning) = P(ignites) × P(keeps burning | ignites)
  const pIgn = Math.max(1 - E.r.noign, E.risk), pSus = pIgn > 0 ? Math.min(1, E.risk / pIgn) : 0;
  const out = [];
  if (E.flags.some((f) => f.startsWith("The chosen O₂"))) out.push("O₂");
  if (E.flags.some((f) => f.startsWith("The pressure"))) out.push("pressure");
  if (s.g > 0) out.push("gravity");

  $("verdict").className = `verdict card lvl-${lvl}`;
  $("verdict").innerHTML = `<div class="big">${pct(E.risk)}</div><div>
    <p><b>Total sustained fire probability · ${lvlTxt} risk</b></p>
    <p class="formula">Ignites <b>${pct(pIgn)}</b> × keeps burning if ignited <b>${pct(pSus)}</b></p>
    <p class="hint">${s.fuel.label} · ${E.r.near.length} similar PSI tests${E.P.tests.length < 10 ? " · small sample" : ""}${E.threshold !== null ? ` · safe below ${fmt(E.threshold)}% O₂` : ""}</p>
    ${out.length ? `<div class="warn">⚠ Outside tested conditions: ${out.join(", ")}. Indicative result.</div>` : ""}
    <details class="more"><summary>Details</summary>
      <p class="hint">O₂ partial pressure: ${fmt(ppO2)} kPa (air: 21.2 kPa).</p>
      ${E.flags.map((f) => `<p class="hint">• ${f}</p>`).join("")}
      ${bounds}
      ${E.trend ? `<p class="hint">• Out of range, the trend from ${E.trend.n} tests with similar O₂ is used: ${pct(E.trend.p)} keep burning.</p>` : ""}
    </details>
  </div>`;

  const solid = s.fuel.state === "solido";
  $("prevent").innerHTML = `<h3>🛡️ Prevent</h3><ul>
    <li>${E.threshold !== null ? `O₂ below <b>${fmt(E.threshold)}%</b>` : "<b>Lower the O₂</b>: no safe threshold in the data"}</li>
    ${solid ? `<li><b>Silicone or Nomex</b> instead of cotton<span class="tag">Saffire</span></li>` : ""}
    ${s.o2 > 25 ? `<li>Above 25% O₂ almost nothing self-extinguishes<span class="tag">FLEX</span></li>` : ""}
  </ul>`;

  const co = E.r.near.map(({ t }) => t.co_final_ppm).filter((x) => x != null && x >= 0).sort((a, b) => a - b);
  const coMed = co.length ? co[Math.floor(co.length / 2)] : null;
  $("detect").innerHTML = `<h3>🔎 Detect</h3><ul>
    <li>Sensors <b>in the ventilation stream</b>: smoke does not rise${s.flowEff < 2 ? " (with this flow, detection is delayed)" : ""}</li>
    <li><b>Multisensor</b>: particles + CO + CO₂<span class="tag">SAME</span></li>
    ${coMed !== null ? `<li>Early CO warning (~${fmt(coMed, 0)} ppm in similar tests)<span class="tag">BASS-II</span></li>` : ""}
    ${s.fuel.id === "gas" ? `<li>Watch out for <b>cool flames</b>: almost invisible<span class="tag">CFI-G</span></li>` : ""}
  </ul>`;

  const dil = diluentStats(s.o2);
  const best = dil.filter((d) => d.ext).sort((a, b) => b.ext - a.ext)[0];
  $("extinguish").innerHTML = `<h3>🧯 Extinguish</h3><ul>
    ${solid ? `<li><b>Shut off ventilation</b>${s.g > 0 ? " (less effective with gravity)" : ""}<span class="tag">BASS-II</span></li>` : ""}
    ${s.o2 > 25 ? `<li>At this O₂ <b>cutting the airflow is not enough</b>: flames persist without flow<span class="tag">BRE</span></li>` : ""}
    <li><b>Dilute with N₂</b>${E.threshold !== null ? ` to ~${fmt(E.threshold)}% O₂` : ""}</li>
    ${best ? `<li>Agent: <b>${best.k.replace("With ", "").replace(" only", "")}</b> (${pct(best.ext)} extinction)<span class="tag">FLEX</span></li>` : ""}
  </ul>`;

  drawChart(E, s);
  $("evidence").innerHTML = `<tr><th>Experiment</th><th>Test</th><th>Fuel</th><th>O₂ %</th><th>kPa</th><th>Flow</th><th>Outcome</th><th>Source</th></tr>` +
    E.r.near.slice(0, 10).map(({ t }) => `<tr><td>${t.experiment}</td><td>${t.test_id}</td><td>${fuelTxt(t.fuel)}</td><td>${fmt(t.o2_pct)}</td>
      <td>${fmt(t.pressure_kpa, 0)}</td><td>${t.flow_cm_s != null ? fmt(t.flow_cm_s) : "—"}</td>
      <td><span class="dot" style="background:var(--${cls(t.outcome)})"></span>${OUTCOME_TXT[t.outcome] || t.outcome}</td>
      <td><a href="${docLink(t.experiment_group)}" target="_blank" rel="noopener">PSI</a></td></tr>`).join("");
}

function drawChart(E, s) {
  // O2 vs pressure scatter in plain SVG (no external dependencies)
  const W = 640, H = 280, m = { l: 48, r: 12, t: 12, b: 36 };
  const x = (v) => m.l + (v - 10) / 32 * (W - m.l - m.r), y = (v) => H - m.b - (v - 40) / 280 * (H - m.t - m.b);
  let g = "";
  for (let v = 10; v <= 42; v += 5) g += `<line x1="${x(v)}" x2="${x(v)}" y1="${m.t}" y2="${H - m.b}" class="grid"/><text x="${x(v)}" y="${H - m.b + 16}" class="tick" text-anchor="middle">${v}</text>`;
  for (let v = 50; v <= 320; v += 50) g += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${m.l - 6}" y="${y(v) + 4}" class="tick" text-anchor="end">${v}</text>`;
  const jitter = (i) => ((i * 9301 + 49297) % 233280) / 233280 - 0.5;
  const pts = E.P.tests.map((t, i) => `<circle cx="${x(t.o2_pct) + jitter(i) * 4}" cy="${y(t.pressure_kpa) + jitter(i + 7) * 6}" r="3.2" fill="var(--${cls(t.outcome)})" fill-opacity=".75"><title>${t.experiment} ${t.test_id}: ${OUTCOME_TXT[t.outcome]}</title></circle>`).join("");
  const ux = x(Math.min(42, s.o2)), uy = y(Math.min(320, Math.max(40, s.p)));
  const you = `<g class="you"><line x1="${ux - 8}" x2="${ux + 8}" y1="${uy - 8}" y2="${uy + 8}"/><line x1="${ux - 8}" x2="${ux + 8}" y1="${uy + 8}" y2="${uy - 8}"/><circle cx="${ux}" cy="${uy}" r="13" fill="none"/></g>`;
  const labels = `<text x="${(W + m.l) / 2}" y="${H - 4}" class="axis" text-anchor="middle">O₂ (%)</text><text transform="translate(12 ${(H - m.b) / 2}) rotate(-90)" class="axis" text-anchor="middle">Pressure (kPa)</text>`;
  $("chart").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Tests by O2 and pressure">${g}${pts}${you}${labels}</svg>`;
  $("legend").innerHTML = [["burn", "Keeps burning"], ["ext", "Goes out"], ["noign", "Does not ignite"]].map(([c, l]) => `<span><span class="dot" style="background:var(--${c})"></span>${l}</span>`).join("") + `<span>✕ Your scenario</span>`;
}

// Links to each investigation in NASA PSI (DOI from the metadata; otherwise the PSI portal with its identifier).
const PSI_NO_DOI = { "BASS": [["PSI-26", "Burning and Suppression of Solids"]], "CFI-G": [["PSI-159", "Cool Flames Investigation with Gases"]] };
function psiLinks(e) {
  const md = e.psi_metadata || [];
  if (md.length) return md.map((m) => ({ url: `https://doi.org/${m.doi}`, label: md.length > 1 ? (m.acronym || m.psi_id) : "View on NASA PSI", title: `${m.psi_id} · ${m.title}` }));
  return (PSI_NO_DOI[e.id] || []).map(([id, t]) => ({ url: "https://psi.nasa.gov/", label: `Search ${id} on PSI`, title: `${id} · ${t}` }));
}
const rng = (a, b) => Math.round(a) === Math.round(b) ? fmt(a, 0) : `${fmt(a, 0)}–${fmt(b, 0)}`;
let EXP_FILTER = "";
function renderExperiments() {
  const counts = {};
  TESTS.forEach((t) => { counts[t.experiment_group] = (counts[t.experiment_group] || 0) + 1; });
  const all = [...EXPS].sort((a, b) => b.habitat_relevance - a.habitat_relevance);
  const sorted = EXP_FILTER ? all.filter((e) => e.pillars.includes(EXP_FILTER)) : all;
  $("ranking").innerHTML = sorted.map((e) => { const i = all.indexOf(e);
    const md = e.psi_metadata || [];
    return `<div class="rank"><h3>${i + 1}. ${e.id} <span class="stars" title="Relevance for habitats">${"★".repeat(e.habitat_relevance)}${"☆".repeat(5 - e.habitat_relevance)}</span></h3>
      <p>${SUMMARIES[e.id] || e.summary}</p>
      <p class="hint">Useful for: <b>${DETAILS[e.id]?.equip || acc(e.pillars.join(", "))}</b></p>
      <p class="links">${psiLinks(e).map((l) => `<a class="plink" href="${l.url}" target="_blank" rel="noopener" title="${l.title}">${l.label} ↗</a>`).join("")}</p>
      <p class="src">${counts[e.id] || e.n_tests || 0} ${DETAILS[e.id]?.unit || "tests"}${e.per_test === false ? " · context, no per-test outcome" : ""}</p></div>`;
  }).join("");
  const rows = [["Fuel", (e) => FSTATE[e.fuel_state] || e.fuel_state], ["Tests", (e) => `${counts[e.id] || e.n_tests || 0}${e.per_test === false ? "*" : ""}`],
    ["O₂ (%)", (e) => e.o2_min != null ? rng(e.o2_min, e.o2_max) : "—"],
    ["Pressure (kPa)", (e) => e.p_min_kpa != null ? rng(e.p_min_kpa, e.p_max_kpa) : "—"],
    ["Flow (cm/s)", (e) => e.flow_max ? `≤ ${fmt(e.flow_max, 0)}` : "quiescent"],
    ["What varies", (e) => DETAILS[e.id]?.varied || ""], ["Sensors", (e) => DETAILS[e.id]?.sensors || ""]];
  $("compare").innerHTML = `<tr><th></th>${sorted.map((e) => `<th>${e.id}</th>`).join("")}</tr>` +
    rows.map(([k, fn]) => `<tr><th>${k}</th>${sorted.map((e) => `<td>${fn(e)}</td>`).join("")}</tr>`).join("");
  $("hwgroups").innerHTML = `<tr><th>Hardware</th><th>In the catalog</th><th>Others in PSI</th></tr>` +
    HW_GROUPS.map(([h, a, b]) => `<tr><td>${h}</td><td>${a}</td><td>${b}</td></tr>`).join("");
  const cols = [["ISS", 21], ["Mars", 26.5], ["Rover", 30], ["Moon", 34]];
  const cell = (st) => st === "ok" ? `<td class="mok">goes out</td>` : st === "burn" ? `<td class="mburn">burns</td>` : `<td class="hint">no data</td>`;
  $("materials").innerHTML = `<tr><th>Material</th><th>Type</th><th>Self-extinguishes up to</th>${cols.map(([n, o]) => `<th>${n} ${o}%</th>`).join("")}</tr>` +
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
  document.querySelectorAll("#expFilter .fbtn").forEach((b) => b.addEventListener("click", () => {
    EXP_FILTER = b.dataset.f;
    document.querySelectorAll("#expFilter .fbtn").forEach((x) => x.classList.toggle("on", x === b));
    renderExperiments();
  }));
  renderExperiments(); applyEnv();
  if (window.initMonitor) initMonitor();
}
init();
