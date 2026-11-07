'use strict';
// Motor del juego: sin DOM, para poder probarlo en node.
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const hooks = { change() {}, end() {} };
let SLEEP = (ms) => new Promise((r) => setTimeout(r, ms));
const S = {};

function startLevel(idx, squad) {
  const m = MAPS[idx];
  S.idx = idx; S.W = m.rows[0].length; S.H = m.rows.length;
  S.grid = []; S.starts = []; S.foes = []; S.units = [];
  m.rows.forEach((r, y) => {
    const row = [];
    [...r].forEach((ch, x) => {
      if (ch === 'P') { S.starts.push([x, y]); ch = ','; }
      if (ch === 'm' || ch === 'e' || ch === 'b') {
        const e = ENEMIES[ch];
        S.foes.push({ team: 'f', kind: ch, name: e.name, hp: e.hp, max: e.hp, dmg: e.dmg, rng: e.rng, acc: e.acc, mov: e.mov, x, y, alert: false, stun: 0, alive: true });
        ch = '.';
      }
      row.push(ch);
    });
    S.grid.push(row);
  });
  squad.forEach((key, i) => {
    const c = CLASSES[key]; const [x, y] = S.starts[i];
    S.units.push({ team: 'p', key, name: c.name, hp: c.hp, max: c.hp, mov: c.mov, rng: c.rng, dmg: c.dmg, acc: c.acc, ap: 2, x, y, alive: true, uses: c.uses, shield: false });
  });
  S.explored = Array.from({ length: S.H }, () => Array(S.W).fill(false));
  S.vis = Array.from({ length: S.H }, () => Array(S.W).fill(false));
  S.turn = 1; S.phase = 'player'; S.sel = 0; S.mode = null; S.tgt = null; S.actor = null;
  S.deaths = 0; S.fx = []; S.result = null; S.stars = 0;
  S.info = 'Toca un operador y luego una casilla azul para moverlo. Toca una puerta pegada a él para abrirla.';
  computeVis();
}

const inb = (x, y) => x >= 0 && y >= 0 && x < S.W && y < S.H;
const tileAt = (x, y) => (inb(x, y) ? S.grid[y][x] : '#');
const opaque = (x, y) => { const t = tileAt(x, y); return t === '#' || t === 'D'; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function unitAt(x, y) {
  return S.units.find((u) => u.alive && u.x === x && u.y === y) || S.foes.find((f) => f.alive && f.x === x && f.y === y) || null;
}
const walk = (x, y) => inb(x, y) && '.,d'.includes(S.grid[y][x]) && !unitAt(x, y);

function line(x0, y0, x1, y1) {
  const pts = []; let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx - dy, x = x0, y = y0;
  for (;;) {
    pts.push([x, y]);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
  return pts;
}
function los(x0, y0, x1, y1) {
  const p = line(x0, y0, x1, y1);
  for (let i = 1; i < p.length - 1; i++) if (opaque(p[i][0], p[i][1])) return false;
  return true;
}
function hasCover(x0, y0, x1, y1) {
  const p = line(x0, y0, x1, y1);
  for (let i = 1; i < p.length - 1; i++) if (tileAt(p[i][0], p[i][1]) === 'c') return true;
  return false;
}

function computeVis() {
  for (let y = 0; y < S.H; y++) S.vis[y].fill(false);
  for (const u of S.units) {
    if (!u.alive) continue;
    for (let y = Math.max(0, u.y - 9); y <= Math.min(S.H - 1, u.y + 9); y++) {
      for (let x = Math.max(0, u.x - 9); x <= Math.min(S.W - 1, u.x + 9); x++) {
        if (Math.hypot(x - u.x, y - u.y) <= 9.5 && los(u.x, u.y, x, y)) { S.vis[y][x] = true; S.explored[y][x] = true; }
      }
    }
  }
}

function reach(u) {
  const k = (x, y) => y * S.W + x; const d = new Map([[k(u.x, u.y), 0]]); const q = [[u.x, u.y]];
  while (q.length) {
    const [x, y] = q.shift(); const c = d.get(k(x, y)); if (c >= u.mov) continue;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (d.has(k(nx, ny)) || !walk(nx, ny)) continue;
      d.set(k(nx, ny), c + 1); q.push([nx, ny]);
    }
  }
  d.delete(k(u.x, u.y));
  return d;
}

const inRange = (a, b) => dist(a, b) <= a.rng + 0.5 && los(a.x, a.y, b.x, b.y);
function hitChance(a, b, perfect) {
  if (perfect) return 100;
  let c = a.acc - Math.max(0, Math.round(dist(a, b)) - 3) * 4;
  if (hasCover(a.x, a.y, b.x, b.y)) c -= 25;
  return Math.max(8, Math.min(95, c));
}

const setInfo = (t) => { S.info = t; };
function fx(x, y, text, color) { S.fx.push({ x, y, text, color, t: Date.now() }); }

function applyDamage(t, d) {
  if (t.team === 'p') {
    if (t.key === 'escudo') d = Math.max(1, d - 1);
    if (t.shield) d = Math.max(1, d - 3);
  }
  t.hp -= d; fx(t.x, t.y, '-' + d, t.team === 'p' ? 'hostile' : 'friend');
  if (t.hp <= 0) { t.hp = 0; t.alive = false; if (t.team === 'p') S.deaths++; fx(t.x, t.y, 'ABATIDO', 'amber'); }
  return d;
}

function noise(x, y, r) {
  for (const f of S.foes) if (f.alive && !f.alert && Math.abs(f.x - x) + Math.abs(f.y - y) <= r) f.alert = true;
}
function checkSpot() {
  for (const f of S.foes) {
    if (!f.alive || f.alert) continue;
    if (S.units.some((u) => u.alive && dist(u, f) <= 8 && los(u.x, u.y, f.x, f.y))) {
      f.alert = true;
      if (S.vis[f.y][f.x]) { fx(f.x, f.y, '¡TE VIERON!', 'hostile'); setInfo('¡Te vieron! El enemigo se pone en alerta.'); }
    }
  }
}

function checkEnd() {
  if (S.phase === 'over') return true;
  if (!S.foes.some((f) => f.alive)) {
    S.phase = 'over'; S.result = 'win';
    S.stars = 1 + (S.deaths === 0 ? 1 : 0) + (S.deaths === 0 && S.turn <= MAPS[S.idx].par ? 1 : 0);
    hooks.end(); return true;
  }
  if (!S.units.some((u) => u.alive)) { S.phase = 'over'; S.result = 'lose'; hooks.end(); return true; }
  return false;
}

function selectNext() {
  const n = S.units.length;
  for (let i = 1; i <= n; i++) {
    const j = (S.sel + i) % n; const u = S.units[j];
    if (u.alive && u.ap > 0) { S.sel = j; return true; }
  }
  const f = S.units.findIndex((u) => u.alive); if (f >= 0) S.sel = f;
  return false;
}

// ---------- Acciones del jugador ----------
function move(u, x, y) {
  u.ap--; u.x = x; u.y = y; S.tgt = null;
  computeVis(); checkSpot();
  if (S.info.startsWith('¡Te vieron') === false) setInfo(u.name + ' se mueve.');
  hooks.change();
}
function openDoor(u, x, y) {
  if (u.key !== 'escudo') u.ap--;
  S.grid[y][x] = 'd'; noise(x, y, 6);
  computeVis(); checkSpot();
  setInfo(u.name + ' abre la puerta.' + (u.key === 'escudo' ? ' (gratis)' : ''));
  hooks.change();
}
function describeTarget() {
  const u = S.units[S.sel], t = S.tgt; if (!t) return;
  if (!u || !u.alive) return;
  if (inRange(u, t)) setInfo(t.name + ' ' + t.hp + '/' + t.max + ' PV · ' + hitChance(u, t) + '% de acierto. Pulsa DISPARAR.');
  else setInfo(t.name + ' ' + t.hp + '/' + t.max + ' PV · fuera de alcance o sin línea de tiro.');
}
function fire() {
  const u = S.units[S.sel], t = S.tgt;
  if (S.phase !== 'player' || !u || !u.alive || u.ap < 1 || !t || !t.alive) return;
  if (!inRange(u, t)) { describeTarget(); hooks.change(); return; }
  u.ap--; const ch = hitChance(u, t); noise(u.x, u.y, 9);
  if (Math.random() * 100 < ch) {
    applyDamage(t, u.dmg); t.alert = true;
    setInfo(u.name + ' acierta a ' + t.name + (t.alive ? '.' : ' y lo elimina.'));
  } else { fx(t.x, t.y, 'FALLA', 'line'); setInfo(u.name + ' falla el disparo.'); t.alert = true; }
  if (!t.alive) S.tgt = null; else describeTarget();
  if (!checkEnd()) hooks.change();
}

function canSpecial(u) {
  if (!u || !u.alive || S.phase !== 'player') return false;
  const c = CLASSES[u.key];
  if (u.ap < c.cost) return false;
  if ((u.key === 'asalto' || u.key === 'medico') && u.uses < 1) return false;
  return true;
}
function special() {
  const u = S.units[S.sel]; if (!canSpecial(u)) return;
  if (S.mode) { S.mode = null; setInfo('Acción cancelada.'); hooks.change(); return; }
  if (u.key === 'escudo') { u.ap--; u.shield = true; fx(u.x, u.y, 'ESCUDO', 'friend'); setInfo('Escudo arriba: recibe 3 menos de daño hasta tu próximo turno.'); }
  else if (u.key === 'asalto') { S.mode = 'flash'; setInfo('Flash: toca una casilla visible a 6 o menos.'); }
  else if (u.key === 'sniper') { S.mode = 'snipe'; setInfo('Tiro certero: toca un enemigo visible (gasta 2 PA).'); }
  else if (u.key === 'medico') { S.mode = 'heal'; setInfo('Botiquín: toca un aliado a 2 casillas o menos.'); }
  hooks.change();
}
function tapMode(x, y) {
  const u = S.units[S.sel]; const mode = S.mode;
  if (!canSpecial(u)) { S.mode = null; hooks.change(); return; }
  if (mode === 'flash') {
    if (!inb(x, y) || !S.vis[y][x] || Math.hypot(x - u.x, y - u.y) > 6.5 || !los(u.x, u.y, x, y) || opaque(x, y)) { setInfo('Casilla fuera de alcance o sin visión. Elige otra.'); hooks.change(); return; }
    u.ap--; u.uses--; S.mode = null; let n = 0;
    for (const f of S.foes) {
      if (f.alive && Math.hypot(f.x - x, f.y - y) <= 2.5 && los(x, y, f.x, f.y)) { f.stun = 1; f.alert = true; n++; fx(f.x, f.y, 'ATURDIDO', 'amber'); }
    }
    fx(x, y, 'FLASH', 'amber'); noise(x, y, 9);
    setInfo(n ? 'Flash: ' + n + ' enemigo(s) aturdido(s) este turno.' : 'El flash no alcanza a nadie, pero hizo ruido.');
  } else if (mode === 'snipe') {
    const t = S.foes.find((f) => f.alive && f.x === x && f.y === y && S.vis[y][x]);
    if (!t) { setInfo('Toca un enemigo visible.'); hooks.change(); return; }
    if (!inRange(u, t)) { setInfo('Fuera de alcance o sin línea de tiro.'); hooks.change(); return; }
    u.ap -= 2; S.mode = null; noise(u.x, u.y, 9); t.alert = true;
    applyDamage(t, 6); setInfo('Tiro certero: ' + t.name + (t.alive ? ' herido.' : ' eliminado.'));
    if (!t.alive) S.tgt = null;
  } else if (mode === 'heal') {
    const a = S.units.find((p) => p.alive && p.x === x && p.y === y);
    if (!a || dist(u, a) > 2.5) { setInfo('Toca un aliado a 2 casillas o menos.'); hooks.change(); return; }
    if (a.hp >= a.max) { setInfo(a.name + ' ya está al máximo.'); hooks.change(); return; }
    u.ap--; u.uses--; S.mode = null; const h = Math.min(5, a.max - a.hp); a.hp += h;
    fx(a.x, a.y, '+' + h, 'ok'); setInfo(u.name + ' cura ' + h + ' a ' + a.name + '.');
  }
  if (!checkEnd()) hooks.change();
}

function tap(x, y) {
  if (S.phase !== 'player') return;
  if (S.mode) { tapMode(x, y); return; }
  const u = S.units[S.sel];
  const own = S.units.find((p) => p.alive && p.x === x && p.y === y);
  if (own) { S.sel = S.units.indexOf(own); S.tgt = null; setInfo(own.name + ' · ' + own.ap + ' PA. ' + CLASSES[own.key].desc); hooks.change(); return; }
  const foe = S.foes.find((f) => f.alive && f.x === x && f.y === y && S.vis[y][x]);
  if (foe) { S.tgt = foe; describeTarget(); hooks.change(); return; }
  if (u && u.alive && u.ap > 0) {
    if (tileAt(x, y) === 'D' && Math.abs(u.x - x) + Math.abs(u.y - y) === 1) { openDoor(u, x, y); return; }
    if (reach(u).has(y * S.W + x)) { move(u, x, y); return; }
  }
  S.tgt = null; hooks.change();
}

// ---------- Turno enemigo ----------
const passableFoe = (x, y) => inb(x, y) && '.,dD'.includes(S.grid[y][x]);
function distFromPlayers() {
  const k = (x, y) => y * S.W + x; const d = new Map(); const q = [];
  for (const u of S.units) if (u.alive) { d.set(k(u.x, u.y), 0); q.push([u.x, u.y]); }
  while (q.length) {
    const [x, y] = q.shift(); const c = d.get(k(x, y));
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (d.has(k(nx, ny)) || !passableFoe(nx, ny)) continue;
      d.set(k(nx, ny), c + 1); q.push([nx, ny]);
    }
  }
  return d;
}
function foeMove(f) {
  const k = (x, y) => y * S.W + x; const dP = distFromPlayers();
  const dd = new Map([[k(f.x, f.y), 0]]); const par = new Map(); const q = [[f.x, f.y]];
  while (q.length) {
    const [x, y] = q.shift(); const c = dd.get(k(x, y)); if (c >= f.mov) continue;
    for (const [ddx, ddy] of DIRS) {
      const nx = x + ddx, ny = y + ddy;
      if (dd.has(k(nx, ny)) || !passableFoe(nx, ny) || unitAt(nx, ny)) continue;
      dd.set(k(nx, ny), c + 1); par.set(k(nx, ny), k(x, y)); q.push([nx, ny]);
    }
  }
  let best = null, bs = 1e9;
  for (const [kk] of dd) { const s = (dP.has(kk) ? dP.get(kk) : 999) + Math.random() * 0.4; if (s < bs) { bs = s; best = kk; } }
  const here = k(f.x, f.y);
  if (best === null || best === here) return false;
  let cur = best;
  while (cur !== here) { const x = cur % S.W, y = (cur / S.W) | 0; if (S.grid[y][x] === 'D') S.grid[y][x] = 'd'; cur = par.get(cur); }
  f.x = best % S.W; f.y = (best / S.W) | 0;
  return true;
}
function pickTarget(f) {
  const ts = S.units.filter((u) => u.alive && inRange(f, u));
  if (!ts.length) return null;
  ts.sort((a, b) => a.hp - b.hp || hitChance(f, b) - hitChance(f, a));
  return ts[0];
}
async function foeTurn(f) {
  let ap = 2, moved = false;
  while (ap > 0 && S.phase !== 'over') {
    const t = pickTarget(f);
    if (t) {
      ap--; const ch = hitChance(f, t);
      if (Math.random() * 100 < ch) { const d = applyDamage(t, f.dmg); setInfo(f.name + ' dispara a ' + t.name + ': -' + d + ' PV.'); }
      else { fx(t.x, t.y, 'FALLA', 'line'); setInfo(f.name + ' dispara a ' + t.name + ' y falla.'); }
      computeVis(); hooks.change();
      if (checkEnd()) return;
      await SLEEP(500);
    } else if (!moved) {
      moved = true;
      if (foeMove(f)) { ap--; computeVis(); checkSpot(); hooks.change(); await SLEEP(350); } else break;
    } else break;
  }
}
async function endTurn() {
  if (S.phase !== 'player') return;
  S.phase = 'enemy'; S.mode = null; S.tgt = null; setInfo('Turno enemigo...'); hooks.change();
  for (const f of S.foes) {
    if (!f.alive) continue;
    if (f.stun > 0) { f.stun--; continue; }
    if (!f.alert) { checkSpot(); if (!f.alert) continue; }
    S.actor = f; hooks.change(); await SLEEP(300);
    await foeTurn(f); S.actor = null;
    if (S.phase === 'over') return;
  }
  S.turn++;
  for (const u of S.units) { u.ap = u.alive ? 2 : 0; u.shield = false; }
  S.phase = 'player'; S.sel = Math.max(0, S.units.findIndex((u) => u.alive));
  setInfo('Turno ' + S.turn + '. Tus operadores tienen 2 PA cada uno.'); hooks.change();
}

if (typeof module !== 'undefined') module.exports = { S, startLevel, tap, fire, special, endTurn, selectNext, reach, hooks, canSpecial, setSleep: (f) => { SLEEP = f; } };
