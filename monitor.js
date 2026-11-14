/* Monitor de riesgo por zonas. Lecturas SIMULADAS; el riesgo se calcula con el motor de app.js (pruebas PSI similares). */
"use strict";

const HABITATS = {
  moon: { label: "Base lunar (8.2 psi, 34 % O₂)", o2: 34, p: 56.5, g: 0.165 },
  iss: { label: "Estación espacial (aire, 0 g)", o2: 21, p: 101.3, g: 0 },
  rover: { label: "Rover presurizado lunar (10.2 psi, 30 % O₂)", o2: 30, p: 70.3, g: 0.165 },
  mars: { label: "Hábitat en Marte (10.2 psi, 26.5 % O₂)", o2: 26.5, p: 70.3, g: 0.38 },
};

// Zonas del plano (viewBox 800×420) con el material combustible dominante y su ventilación nominal.
const ZONES = [
  { id: "mando", name: "Módulo de mando", fuel: "pmma", what: "paneles y pantallas de PMMA", flow: 8, x: 20, y: 20, w: 230, h: 150 },
  { id: "lab", name: "Laboratorio", fuel: "pmma", what: "equipos y carcasas de PMMA", flow: 10, x: 270, y: 20, w: 230, h: 150 },
  { id: "dorm", name: "Dormitorios", fuel: "sibal", what: "sacos de dormir y ropa de algodón", flow: 5, x: 520, y: 20, w: 260, h: 150 },
  { id: "cocina", name: "Cocina", fuel: "cera", what: "grasas y envases encerados", flow: 12, x: 20, y: 250, w: 230, h: 150 },
  { id: "almacen", name: "Almacén", fuel: "sibal", what: "bolsas de tela y embalajes", flow: 4, x: 270, y: 250, w: 230, h: 150 },
  { id: "soporte", name: "Soporte vital", fuel: "silicona", what: "cableado y juntas de silicona", flow: 10, x: 520, y: 250, w: 130, h: 150 },
  { id: "esclusa", name: "Esclusa", fuel: "nomex", what: "trajes y tejidos de Nomex", flow: 6, x: 660, y: 250, w: 120, h: 150 },
];

const INCIDENTS = [
  { id: "o2leak", zone: "esclusa", label: "Fuga de O₂ de un traje en la esclusa" },
  { id: "ventfail", zone: "dorm", label: "Fallo de ventilación en dormitorios" },
  { id: "overheat", zone: "soporte", label: "Cable sobrecalentado en soporte vital" },
];

// Umbrales de la demo (configurables). El CO mediano de las pruebas de BASS-II con llama fue de ~45 ppm.
const TH = { coWarn: 15, coAlarm: 50, smokeWarn: 35, smokeAlarm: 150, tWarn: 45, tAlarm: 70, o2Dev: 1.5, riskJump: 0.15 };
const SENSORS = [
  { k: "o2", label: "O₂", unit: "%", d: 1 }, { k: "p", label: "Presión", unit: "kPa", d: 1 },
  { k: "flow", label: "Ventilación", unit: "cm/s", d: 1 }, { k: "temp", label: "Temperatura", unit: "°C", d: 1 },
  { k: "co", label: "CO", unit: "ppm", d: 0 }, { k: "smoke", label: "Humo", unit: "µg/m³", d: 0 },
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
  log("info", "—", `Monitor iniciado: ${H.label}.`);
}

function step() {
  const H = HABITATS[M.hab];
  M.t += 1;
  ZONES.forEach((z) => {
    const Z = M.zones[z.id], s = Z.s;
    let o2T = H.o2, flowT = z.flow, tT = 22, coT = 1, smokeT = 5;
    if (M.active.has("o2leak") && z.id === "esclusa") o2T = Math.min(40, H.o2 + 6);
    if (M.active.has("ventfail") && z.id === "dorm") flowT = 0;
    if (M.active.has("overheat") && z.id === "soporte") {
      Z.heat = (Z.heat || 0) + 1;
      tT = Math.min(95, 22 + Z.heat * 1.6); coT = Math.min(400, Z.heat * Z.heat * 0.08); smokeT = Math.min(900, 5 + Z.heat * Z.heat * 0.25);
    } else if (z.id === "soporte") Z.heat = 0;
    s.o2 = Math.max(0, approach(s.o2, o2T, 0.12) + rnd(0.05));
    s.p = approach(s.p, H.p, 0.2) + rnd(0.1);
    s.flow = Math.max(0, approach(s.flow, flowT, 0.3) + rnd(0.2));
    s.temp = approach(s.temp, tT, 0.25) + rnd(0.15);
    s.co = Math.max(0, approach(s.co, coT, 0.3) + rnd(0.3));
    // Sin ventilación el humo apenas llega al detector (en microgravedad no sube).
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
    msgs.push({ lvl: "alarm", pillar: "Extinguir", text: `Posible fuego: CO ${fmt(s.co, 0)} ppm, humo ${fmt(s.smoke, 0)} µg/m³, ${fmt(s.temp)} °C.`,
      act: `Cortar la ventilación de ${z.name.toLowerCase()} y aislar el módulo (16 de 19 extinciones de BASS-II llegaron al reducir el flujo). ${E.threshold !== null ? `Bajar el O₂ con N₂ hasta ~${fmt(E.threshold)} %.` : "Bajar el O₂ con N₂."} Agente: CO₂ o helio (FLEX).` });
  else if (s.co >= TH.coWarn || s.smoke >= TH.smokeWarn || s.temp >= TH.tWarn)
    msgs.push({ lvl: "warn", pillar: "Detectar", text: `Señal temprana: CO ${fmt(s.co, 0)} ppm, humo ${fmt(s.smoke, 0)} µg/m³, ${fmt(s.temp)} °C.`,
      act: "Posible combustión latente o sobrecalentamiento. Cortar la alimentación eléctrica del equipo y enviar a un tripulante con sensor portátil." });
  if (s.o2 > H.o2 + TH.o2Dev)
    msgs.push({ lvl: "warn", pillar: "Prevenir", text: `O₂ en ${fmt(s.o2)} %, por encima de la consigna (${fmt(H.o2)} %).`,
      act: `Cerrar el suministro de O₂ del módulo y diluir con N₂. Riesgo de combustión sostenida: ${pct(Z.base)} en consigna, ${pct(E.risk)} ahora.` });
  if (z.flow > 2 && s.flow < 1)
    msgs.push({ lvl: "warn", pillar: "Detectar", text: `Ventilación detenida (${fmt(s.flow)} cm/s).`,
      act: H.g === 0 ? "En microgravedad el humo no llegará a los detectores. Revisar la zona con un sensor portátil. Sin flujo, las llamas tienden a apagarse (BASS-II), pero el CO se acumula." : "Con gravedad la flotación mantiene algo de flujo. Restablecer la ventilación y revisar la zona." });
  if (!msgs.length && E.risk - Z.base >= TH.riskJump)
    msgs.push({ lvl: "warn", pillar: "Prevenir", text: `El riesgo ha subido a ${pct(E.risk)} (normal ${pct(Z.base)}).`, act: "Revisar O₂, presión y ventilación de la zona." });
  const lvl = msgs.some((m) => m.lvl === "alarm") ? "alarm" : msgs.length ? "warn" : "ok";
  if (lvl !== Z.level) log(lvl, z.name, lvl === "ok" ? "Vuelve a la normalidad." : msgs[0].text);
  Z.level = lvl; Z.msgs = msgs;
}

function log(lvl, zone, text) {
  const mm = String(Math.floor(M.t / 60)).padStart(2, "0"), ss = String(M.t % 60).padStart(2, "0");
  M.log.unshift({ time: `${mm}:${ss}`, lvl, zone, text }); M.log = M.log.slice(0, 40);
}

const LVL = { ok: ["Normal", "low"], warn: ["Aviso", "mid"], alarm: ["Alarma", "high"], info: ["Info", "noign"] };

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
  $("mSummary").innerHTML = `<span class="chip lvl-low">${counts.ok} normales</span><span class="chip lvl-mid">${counts.warn} con aviso</span><span class="chip lvl-high">${counts.alarm} en alarma</span>`;
  // Plano
  let svg = `<rect x="20" y="180" width="760" height="60" rx="8" class="corridor"/><text x="400" y="216" text-anchor="middle" class="zlabel muted">Pasillo</text>`;
  ZONES.forEach((z) => {
    const Z = M.zones[z.id], [lt, lc] = LVL[Z.level];
    svg += `<g class="zone ${z.id === M.sel ? "sel" : ""}" data-z="${z.id}" tabindex="0" role="button" aria-label="${z.name}: ${lt}">
      <rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="10" style="fill:var(--${lc}-bg);stroke:var(--${lc})"/>
      <text x="${z.x + 14}" y="${z.y + 30}" class="zlabel">${z.name}</text>
      <text x="${z.x + 14}" y="${z.y + 62}" class="zrisk" style="fill:var(--${lc})">${pct(Z.risk)}</text>
      <text x="${z.x + 14}" y="${z.y + 86}" class="zsub">prob. de incendio</text>
      <text x="${z.x + 14}" y="${z.y + z.h - 16}" class="zstate" style="fill:var(--${lc})">● ${lt}</text></g>`;
  });
  $("mMap").innerHTML = `<svg viewBox="0 0 800 420" role="img" aria-label="Plano del hábitat">${svg}</svg>`;
  $("mMap").querySelectorAll(".zone").forEach((g) => {
    const pick = () => { M.sel = g.dataset.z; renderMonitor(); };
    g.addEventListener("click", pick); g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") pick(); });
  });
  // Detalle
  const z = ZONES.find((x) => x.id === M.sel), Z = M.zones[z.id], [lt, lc] = LVL[Z.level];
  $("mDetail").innerHTML = `<div class="dhead"><div><h3>${z.name}</h3><p class="hint">Combustible principal: ${z.what}.</p></div>
    <span class="chip lvl-${lc}">${lt}</span></div>
    <div class="tiles">${SENSORS.map((S) => `<div class="tile"><span class="tl">${S.label}</span><b>${fmt(Z.s[S.k], S.d)}</b> <span class="tu">${S.unit}</span>${spark(Z.hist, S.k)}</div>`).join("")}</div>
    <p class="riskline">Probabilidad de incendio sostenido (prende y se mantiene): <b>${pct(Z.risk)}</b> (normal ${pct(Z.base)}), según las ${Z.E.r.near.length} pruebas PSI más parecidas.</p>
    ${Z.msgs.length ? Z.msgs.map((m) => `<div class="action lvl-${LVL[m.lvl][1]}"><p><b>${m.pillar}:</b> ${m.text}</p><p>${m.act}</p></div>`).join("") : `<div class="action lvl-low"><p><b>Sin incidencias.</b> Todas las lecturas están dentro de los márgenes.</p></div>`}`;
  // Registro
  $("mLog").innerHTML = M.log.map((l) => `<tr><td>${l.time}</td><td><span class="dot" style="background:var(--${LVL[l.lvl][1]})"></span>${LVL[l.lvl][0]}</td><td>${l.zone}</td><td>${l.text}</td></tr>`).join("");
}

function initMonitor() {
  $("mHab").innerHTML = Object.entries(HABITATS).map(([k, h]) => `<option value="${k}">${h.label}</option>`).join("");
  $("mHab").addEventListener("change", () => { M.hab = $("mHab").value; resetZones(); renderMonitor(); });
  $("mIncidents").innerHTML = INCIDENTS.map((i) => `<button type="button" class="incident" data-i="${i.id}">${i.label}</button>`).join("") +
    `<button type="button" class="incident reset" data-i="reset">Restablecer</button>`;
  $("mIncidents").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
    const id = b.dataset.i;
    if (id === "reset") { $("mIncidents").querySelectorAll(".on").forEach((x) => x.classList.remove("on")); resetZones(); renderMonitor(); return; }
    const inc = INCIDENTS.find((i) => i.id === id);
    if (M.active.has(id)) { M.active.delete(id); b.classList.remove("on"); log("info", ZONES.find((z) => z.id === inc.zone).name, `Fin del incidente simulado: ${inc.label}.`); }
    else { M.active.add(id); b.classList.add("on"); M.sel = inc.zone; log("info", ZONES.find((z) => z.id === inc.zone).name, `Incidente simulado: ${inc.label}.`); }
    renderMonitor();
  }));
  resetZones();
  for (let i = 0; i < 5; i++) step();
  M.timer = setInterval(step, 1000);
  window.__monitorStep = (n) => { for (let i = 0; i < n; i++) step(); };
}
