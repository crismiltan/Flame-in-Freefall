// Validación cruzada "dejando una fuera": cada prueba se predice con el resto. Uso: node pipeline/eval/validacion_cruzada.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const src = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8').replace(/\ninit\(\);\s*$/, '\n');
const ctx = { console, document: { getElementById: () => null }, window: {}, Math, JSON };
vm.createContext(ctx);
vm.runInContext(src + '\nthis.api = { knn, pool, cls, FUELS, set: (t) => { TESTS = t; } };', ctx);
const api = ctx.api;
const TESTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'tests.json'), 'utf8'));
TESTS.forEach((t) => { const m = /d0=([\d.]+)/.exec(t.notes || ''); t._d0 = m ? +m[1] : null; });
api.set(TESTS);
let rows = [];
for (const f of api.FUELS) {
  const P = api.pool(f);
  P.tests.forEach((t, i) => {
    if (t.o2_pct == null || !api.cls(t.outcome)) return;
    const rest = P.tests.filter((_, j) => j !== i);
    const s = { fuel: f, o2: t.o2_pct, p: t.pressure_kpa || 101.3, flow: t.flow_cm_s || 0, flowEff: t.flow_cm_s || 0, g: 0, d0: f.state === 'liquido' ? t._d0 : undefined };
    const r = api.knn(rest, s);
    const y = api.cls(t.outcome) === 'burn' ? 1 : 0;
    rows.push({ f: f.id, own: P.own, key: t.experiment + '|' + t.test_id, y, p: r.burn });
  });
}
// dedupe tests counted under several fuels (shared pools): keep first by key
const seen = new Set(); rows = rows.filter(r => !seen.has(r.key) && seen.add(r.key));
const n = rows.length, acc = rows.filter(r => (r.p >= 0.5) === (r.y === 1)).length / n;
const brier = rows.reduce((s, r) => s + (r.p - r.y) ** 2, 0) / n;
const base = rows.filter(r => r.y).length / n;
const baseAcc = Math.max(base, 1 - base), baseBrier = rows.reduce((s, r) => s + (base - r.y) ** 2, 0) / n;
console.log({ n, acc: acc.toFixed(3), brier: brier.toFixed(3), base: base.toFixed(3), baseAcc: baseAcc.toFixed(3), baseBrier: baseBrier.toFixed(3) });
const by = {}; rows.forEach(r => { (by[r.f] ||= []).push(r); });
for (const [k, v] of Object.entries(by)) console.log(k, v.length, (v.filter(r => (r.p >= 0.5) === (r.y === 1)).length / v.length).toFixed(2), 'burn%', (v.filter(r=>r.y).length/v.length).toFixed(2));
