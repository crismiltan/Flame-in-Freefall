/* Zone-by-zone risk monitor. SIMULATED readings; risk is computed with the app.js engine (similar PSI tests). */
"use strict";

const HABITATS = {
  moon: { label: "Lunar base (8.2 psi, 34% O₂)", o2: 34, p: 56.5, g: 0.165 },
  iss: { label: "Space station (air, 0 g)", o2: 21, p: 101.3, g: 0 },
  rover: { label: "Pressurized lunar rover (10.2 psi, 30% O₂)", o2: 30, p: 70.3, g: 0.165 },
  mars: { label: "Mars habitat (10.2 psi, 26.5% O₂)", o2: 26.5, p: 70.3, g: 0.38 },
};

// O2 thresholds of cabin materials (NASA WSTF, Hirsch et al., NTRS 20070018178, Table 2).
// NASA-STD-6001 Test 1 ground test (1 g, quiescent air) at 70.1 kPa. moc: maximum O2 (%) for self-extinguishment.
// lt: "< value" (burned at 30%), gt: "> value" (did not burn at 40%).
const MATERIALS = [
  ["Lexan 6006", "Rigid plastic", 30, "lt"], ["Lexan F-6000", "Rigid plastic", 39], ["Kydex 100", "Rigid plastic", 33],
  ["Ultem 1668", "Rigid plastic", 39], ["Ultem 2300", "Rigid plastic", 42], ["Ultem 2310", "Rigid plastic", 44],
  ["Ultem CRS5301", "Rigid plastic", 44], ["SYGEF (PVDF)", "Rigid plastic", 34], ["Torlon 4203", "Rigid plastic", 40, "gt"],
  ["P1700 (polysulfone)", "Rigid plastic", 29], ["Ryton R-4-06", "Rigid plastic", 40, "gt"],
  ["Nomex HT90-40, 1 layer", "Fabric", 30, "lt"], ["Nomex HT90-40, 2 layers (15°)", "Fabric", 36], ["Armalon TG4060", "Fabric", 40, "gt"],
  ["Graphite/epoxy HMF 5-322", "Composite", 99.5, "gt"], ["Bismaleimide/graphite", "Composite", 99.5, "gt"], ["Glass-filled PEEK", "Composite", 45],
  ["Polyimide/glass FL 74-24", "Composite", 99.5, "gt"], ["Copper-clad laminate 307404", "Composite", 40, "gt"],
  ["Graphite/epoxy CTD-528", "Composite", 30, "lt"], ["Graphite/epoxy CTD-112P", "Composite", 30, "lt"], ["Melamine/glass G-9", "Composite", 36],
  ["Zotek F30 (foam)", "Foam", 45], ["Solimide AC-530 (foam)", "Foam", 33],
].map(([name, type, moc, q]) => ({ name, type, moc, q }));
const mocText = (m) => (m.q === "lt" ? "< " : m.q === "gt" ? "> " : "") + m.moc + "%";
// "ok" self-extinguishes, "burn" burns, "?" no data at that O2
const matAt = (m, o2) => m.q === "lt" ? (o2 >= m.moc ? "burn" : "?") : m.q === "gt" ? (o2 <= m.moc ? "ok" : "?") : (o2 <= m.moc ? "ok" : "burn");
// Test material matching each zone and an alternative that withstands more O2
const ZONE_MAT = {
  esclusa: { now: "Nomex HT90-40, 1 layer", alt: ["Armalon TG4060"] },
  mando: { alt: ["Lexan F-6000", "Ultem 1668"] }, lab: { alt: ["Lexan F-6000", "Ultem 1668"] },
};
function matLine(zid, o2) {
  const zm = ZONE_MAT[zid]; if (!zm) return "";
  const get = (n) => MATERIALS.find((m) => m.name === n);
  const alts = zm.alt.map(get).filter((m) => matAt(m, o2) === "ok").map((m) => `${m.name} (${mocText(m)})`);
  let t = "";
  if (zm.now) { const m = get(zm.now), st = matAt(m, o2);
    t = st === "burn" ? `<b>${m.name} burns at ${fmt(o2, 1)}% O₂</b> in the ground test (${m.q === "lt" ? `it already burned at ${m.moc}%` : `it self-extinguishes up to ${mocText(m)}`}).` :
        st === "ok" ? `${m.name} self-extinguishes at this O₂ in the ground test.` : `${m.name}: not tested at this O₂.`; }
  else t = "PMMA is not in the high-O₂ materials test.";
  if (alts.length) t += ` Self-extinguishing alternatives: ${alts.join(", ")}.`;
  return `<p class="hint matline">Material (NASA WSTF, 1 g): ${t}</p>`;
}

const ZONES = [
  { id: "mando", name: "Command module", fuel: "pmma", what: "PMMA panels and screens", flow: 8, x: 20, y: 20, w: 230, h: 150 },
  { id: "lab", name: "Laboratory", fuel: "pmma", what: "PMMA equipment and housings", flow: 10, x: 270, y: 20, w: 230, h: 150 },
  { id: "dorm", name: "Crew quarters", fuel: "sibal", what: "sleeping bags and cotton clothing", flow: 5, x: 520, y: 20, w: 260, h: 150 },
  { id: "cocina", name: "Galley", fuel: "cera", what: "grease and waxed packaging", flow: 12, x: 20, y: 250, w: 230, h: 150 },
  { id: "almacen", name: "Storage", fuel: "sibal", what: "cloth bags and packaging", flow: 4, x: 270, y: 250, w: 230, h: 150 },
  { id: "soporte", name: "Life support", fuel: "silicona", what: "wiring and silicone seals", flow: 10, x: 520, y: 250, w: 130, h: 150 },
  { id: "esclusa", name: "Airlock", fuel: "nomex", what: "Nomex suits and fabrics", flow: 6, x: 660, y: 250, w: 120, h: 150 },
];

// apply: changes the sensor setpoints. fire: heat source that grows over time (s since it started).
const INCIDENTS = [
  { id: "o2leak", zone: "esclusa", label: "Suit O₂ leak in the airlock", apply: (T, H) => { T.o2 = Math.min(40, H.o2 + 6); } },
  { id: "ventfail", zone: "dorm", label: "Ventilation failure in crew quarters", apply: (T) => { T.flow = 0; } },
  { id: "overheat", zone: "soporte", label: "Overheated cable in life support", fire: { t: 1.6, tMax: 95, co: 0.08, coMax: 400, sm: 0.25, smMax: 900 } },
  { id: "short", zone: "mando", label: "Short circuit in a command module screen", fire: { t: 2.2, tMax: 110, co: 0.1, coMax: 450, sm: 0.35, smMax: 1000 } },
  { id: "galley", zone: "cocina", label: "Overheated grease in the galley", fire: { t: 3, tMax: 140, co: 0.05, coMax: 300, sm: 0.6, smMax: 1200 } },
  { id: "smolder", zone: "almacen", label: "Smoldering combustion in storage", fire: { t: 0.15, tMax: 35, co: 0.02, coMax: 120, sm: 0.012, smMax: 70 } },
  // With a leak, the controller adds O2 to hold its partial pressure: pressure drops and O2 % rises.
  { id: "depress", zone: "lab", label: "Slow pressure leak in the laboratory", apply: (T, H) => { T.p = H.p * 0.82; T.o2 = Math.min(40, H.o2 / 0.82); } },
  { id: "o2reg", zone: "all", label: "O₂ regulator failure (whole habitat)", apply: (T, H) => { T.o2 = H.o2 + 2.5; } },
];
const incZone = (inc) => inc.zone === "all" ? "Whole habitat" : ZONES.find((z) => z.id === inc.zone).name;

// Demo thresholds (configurable). Median CO in BASS-II tests with a flame was ~45 ppm.
const TH = { coWarn: 15, coAlarm: 50, smokeWarn: 35, smokeAlarm: 150, tWarn: 45, tAlarm: 70, o2Dev: 1.5, riskJump: 0.15 };
const SENSORS = [
  { k: "o2", label: "O₂", unit: "%", d: 1 }, { k: "p", label: "Pressure", unit: "kPa", d: 1 },
  { k: "flow", label: "Ventilation", unit: "cm/s", d: 1 }, { k: "temp", label: "Temperature", unit: "°C", d: 1 },
  { k: "co", label: "CO", unit: "ppm", d: 0 }, { k: "smoke", label: "Smoke", unit: "µg/m³", d: 0 },
];

const M = { hab: "moon", t: 0, sel: "soporte", zones: {}, active: new Set(), log: [], cache: new Map(), timer: null };
const rnd = (a) => (Math.random() - 0.5) * 2 * a;
const approach = (v, target, rate) => v + (target - v) * rate;

function zoneRisk(z, s) {
  const H = HABITATS[M.hab];
  const fuel = FUELS.find((f) => f.id === z.fuel);
  const key = `${M.hab}|${z.fuel}|${s.o2.toFixed(1)}|${s.p.toFixed(0)}|${Math.round(s.flow)}`;
  if (!M.cache.has(key)) {
    const sc = { fuel, o2: s.o2, p: s.p, flow: s.flow, g: H.g, flowEff: s.flow + buoyantFlow(H.g) };
    M.cache.set(key, evaluate(sc));
  }
  return M.cache.get(key);
}

function resetZones() {
  const H = HABITATS[M.hab];
  M.zones = {}; M.active.clear(); M.log = []; M.t = 0; M.cache.clear();
  ZONES.forEach((z) => {
    const s = { o2: H.o2, p: H.p, flow: z.flow, temp: 22, co: 1, smoke: 5 };
    const E = zoneRisk(z, s);
    M.zones[z.id] = { s, hist: [], base: E.risk, risk: E.risk, E, level: "ok", msgs: [] };
  });
  document.querySelectorAll(".incident").forEach((b) => b.classList.remove("on"));
  log("info", "—", `Monitor started: ${H.label}.`);
}

function step() {
  const H = HABITATS[M.hab];
  M.t += 1;
  ZONES.forEach((z) => {
    const Z = M.zones[z.id], s = Z.s;
    const T = { o2: H.o2, p: H.p, flow: z.flow, temp: 22, co: 1, smoke: 5 };
    const incs = INCIDENTS.filter((i) => M.active.has(i.id) && (i.zone === z.id || i.zone === "all"));
    incs.forEach((i) => i.apply && i.apply(T, H));
    const f = incs.find((i) => i.fire)?.fire;
    if (f) {
      const h = Z.heat = (Z.heat || 0) + 1;
      T.temp = Math.min(f.tMax, 22 + h * f.t); T.co = Math.min(f.coMax, 1 + h * h * f.co); T.smoke = Math.min(f.smMax, 5 + h * h * f.sm);
    } else Z.heat = 0;
    let o2T = T.o2, flowT = T.flow, tT = T.temp, coT = T.co, smokeT = T.smoke;
    s.o2 = Math.max(0, approach(s.o2, o2T, 0.12) + rnd(0.05));
    s.p = approach(s.p, T.p, 0.2) + rnd(0.1);
    s.flow = Math.max(0, approach(s.flow, flowT, 0.3) + rnd(0.2));
    s.temp = approach(s.temp, tT, 0.25) + rnd(0.15);
    s.co = Math.max(0, approach(s.co, coT, 0.3) + rnd(0.3));
    // Without ventilation smoke barely reaches the detector (in microgravity it does not rise).
    const reach = s.flow < 1 && H.g === 0 ? 0.2 : 1;
    s.smoke = Math.max(0, approach(s.smoke, smokeT * reach, 0.3) + rnd(1));
    Z.hist.push({ ...s }); if (Z.hist.length > 90) Z.hist.shift();
    classify(z, Z);
  });
  renderMonitor();
}

function classify(z, Z) {
  const s = Z.s, H = HABITATS[M.hab], E = zoneRisk(z, s);
  Z.risk = E.risk; Z.E = E;
  const msgs = [];
  if (s.co >= TH.coAlarm || s.smoke >= TH.smokeAlarm || s.temp >= TH.tAlarm)
    msgs.push({ lvl: "alarm", pillar: "Extinguish", text: `Possible fire: CO ${fmt(s.co, 0)} ppm, smoke ${fmt(s.smoke, 0)} µg/m³, ${fmt(s.temp)} °C.`,
      act: `Shut off ventilation in the ${z.name.toLowerCase()} and isolate the module (16 of 19 BASS-II extinctions came from reducing the flow). ${E.threshold !== null ? `Lower O₂ with N₂ to ~${fmt(E.threshold)}%.` : "Lower O₂ with N₂."} Agent: CO₂ or helium (FLEX).${H.o2 > 25 ? " Caution: at this O₂, cutting the airflow is not enough; flames persist without flow (BRE)." : ""}` });
  else if (s.co >= TH.coWarn || s.smoke >= TH.smokeWarn || s.temp >= TH.tWarn)
    msgs.push({ lvl: "warn", pillar: "Detect", text: `Early warning: CO ${fmt(s.co, 0)} ppm, smoke ${fmt(s.smoke, 0)} µg/m³, ${fmt(s.temp)} °C.`,
      act: "Possible smoldering or overheating. Cut power to the equipment and send a crew member with a handheld sensor." });
  if (s.o2 > H.o2 + TH.o2Dev)
    msgs.push({ lvl: "warn", pillar: "Prevent", text: `O₂ at ${fmt(s.o2)}%, above the setpoint (${fmt(H.o2)}%).`,
      act: `Close the module's O₂ supply and dilute with N₂. Sustained combustion risk: ${pct(Z.base)} at setpoint, ${pct(E.risk)} now.` });
  if (s.p < H.p - 5)
    msgs.push({ lvl: "warn", pillar: "Prevent", text: `Pressure dropping: ${fmt(s.p)} kPa (setpoint ${fmt(H.p)} kPa).`,
      act: "Possible leak. Close the module hatch. If the system adds O₂ to hold the partial pressure, the O₂ % rises and so does the fire risk." });
  if (z.flow > 2 && s.flow < 1)
    msgs.push({ lvl: "warn", pillar: "Detect", text: `Ventilation stopped (${fmt(s.flow)} cm/s).`,
      act: H.g === 0 ? "In microgravity smoke will not reach the detectors. Check the zone with a handheld sensor. Without flow, flames tend to go out (BASS-II), but CO builds up." : "With gravity, buoyancy keeps some flow going. Restore ventilation and check the zone." });
  if (!msgs.length && E.risk - Z.base >= TH.riskJump)
    msgs.push({ lvl: "warn", pillar: "Prevent", text: `Risk has risen to ${pct(E.risk)} (normal ${pct(Z.base)}).`, act: "Check the zone's O₂, pressure and ventilation." });
  const lvl = msgs.some((m) => m.lvl === "alarm") ? "alarm" : msgs.length ? "warn" : "ok";
  if (lvl !== Z.level) log(lvl, z.name, lvl === "ok" ? "Back to normal." : msgs[0].text);
  Z.level = lvl; Z.msgs = msgs;
}

function log(lvl, zone, text) {
  const mm = String(Math.floor(M.t / 60)).padStart(2, "0"), ss = String(M.t % 60).padStart(2, "0");
  M.log.unshift({ time: `${mm}:${ss}`, lvl, zone, text }); M.log = M.log.slice(0, 40);
}

const LVL = { ok: ["Normal", "ok"], warn: ["Warning", "mid"], alarm: ["Alarm", "high"], info: ["Info", "noign"] };

function spark(hist, k) {
  if (hist.length < 2) return "";
  const v = hist.map((h) => h[k]), lo = Math.min(...v), hi = Math.max(...v), span = hi - lo || 1;
  const pts = v.map((x, i) => `${(i / (v.length - 1)) * 120},${28 - ((x - lo) / span) * 24}`).join(" ");
  return `<svg viewBox="0 0 120 30" class="spark" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
}

function renderMonitor() {
  const mm = String(Math.floor(M.t / 60)).padStart(2, "0"), ss = String(M.t % 60).padStart(2, "0");
  $("mClock").textContent = `T+${mm}:${ss}`;
  const counts = { ok: 0, warn: 0, alarm: 0 };
  ZONES.forEach((z) => counts[M.zones[z.id].level]++);
  $("mSummary").innerHTML = `<span class="chip lvl-ok">${counts.ok} normal</span><span class="chip lvl-mid">${counts.warn} warning</span><span class="chip lvl-high">${counts.alarm} alarm</span>`;
  // Map
  let svg = `<rect x="20" y="180" width="760" height="60" rx="8" class="corridor"/><text x="400" y="216" text-anchor="middle" class="zlabel muted">Corridor</text>`;
  ZONES.forEach((z) => {
    const Z = M.zones[z.id], [lt, lc] = LVL[Z.level];
    svg += `<g class="zone ${z.id === M.sel ? "sel" : ""}" data-z="${z.id}" tabindex="0" role="button" aria-label="${z.name}: ${lt}">
      <rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="10" style="fill:var(--${lc}-bg);stroke:var(--${lc})"/>
      <text x="${z.x + 14}" y="${z.y + 30}" class="zlabel">${z.name}</text>
      <text x="${z.x + 14}" y="${z.y + 62}" class="zrisk" style="fill:var(--${Z.level === "ok" ? "ink" : lc})">${pct(Z.risk)}</text>
      <text x="${z.x + 14}" y="${z.y + 86}" class="zsub">fire probability</text>
      <text x="${z.x + 14}" y="${z.y + z.h - 16}" class="zstate" style="fill:var(--${lc})">● ${lt}</text></g>`;
  });
  $("mMap").innerHTML = `<svg viewBox="0 0 800 420" role="img" aria-label="Habitat map">${svg}</svg>`;
  $("mMap").querySelectorAll(".zone").forEach((g) => {
    const pick = () => { M.sel = g.dataset.z; renderMonitor(); };
    g.addEventListener("click", pick); g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") pick(); });
  });
  // Detail
  const z = ZONES.find((x) => x.id === M.sel), Z = M.zones[z.id], [lt, lc] = LVL[Z.level];
  $("mDetail").innerHTML = `<div class="dhead"><div><h3>${z.name}</h3><p class="hint">Main fuel: ${z.what}.</p></div>
    <span class="chip lvl-${lc}">${lt}</span></div>
    <div class="tiles">${SENSORS.map((S) => `<div class="tile"><span class="tl">${S.label}</span><b>${fmt(Z.s[S.k], S.d)}</b> <span class="tu">${S.unit}</span>${spark(Z.hist, S.k)}</div>`).join("")}</div>
    <p class="riskline">Sustained fire probability (ignites and keeps burning): <b>${pct(Z.risk)}</b> (normal ${pct(Z.base)}), based on the ${Z.E.r.near.length} closest PSI tests.</p>
    ${matLine(z.id, HABITATS[M.hab].o2)}
    ${Z.msgs.length ? Z.msgs.map((m) => `<div class="action lvl-${LVL[m.lvl][1]}"><p><b>${m.pillar}:</b> ${m.text}</p><p>${m.act}</p></div>`).join("") : `<div class="action lvl-ok"><p><b>No issues.</b> All readings are within limits.</p></div>`}`;
  // Log
  $("mLog").innerHTML = M.log.map((l) => `<tr><td>${l.time}</td><td><span class="dot" style="background:var(--${LVL[l.lvl][1]})"></span>${LVL[l.lvl][0]}</td><td>${l.zone}</td><td>${l.text}</td></tr>`).join("");
}

function initMonitor() {
  $("mHab").innerHTML = Object.entries(HABITATS).map(([k, h]) => `<option value="${k}">${h.label}</option>`).join("");
  $("mHab").addEventListener("change", () => { M.hab = $("mHab").value; resetZones(); renderMonitor(); });
  $("mIncidents").innerHTML = INCIDENTS.map((i) => `<button type="button" class="incident" data-i="${i.id}">${i.label}</button>`).join("") +
    `<button type="button" class="incident reset" data-i="reset">Reset</button>`;
  $("mIncidents").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
    const id = b.dataset.i;
    if (id === "reset") { $("mIncidents").querySelectorAll(".on").forEach((x) => x.classList.remove("on")); resetZones(); renderMonitor(); return; }
    const inc = INCIDENTS.find((i) => i.id === id);
    if (M.active.has(id)) { M.active.delete(id); b.classList.remove("on"); log("info", incZone(inc), `Simulated incident ended: ${inc.label}.`); }
    else { M.active.add(id); b.classList.add("on"); if (inc.zone !== "all") M.sel = inc.zone; log("info", incZone(inc), `Simulated incident: ${inc.label}.`); }
    renderMonitor();
  }));
  resetZones();
  for (let i = 0; i < 5; i++) step();
  M.timer = setInterval(step, 1000);
  window.__monitorStep = (n) => { for (let i = 0; i < n; i++) step(); };
}
