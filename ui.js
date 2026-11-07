'use strict';
const $ = (id) => document.getElementById(id);
const KEY = 'swat-entrada-forzada-v1';
let progress = { stars: [] };
try { const raw = localStorage.getItem(KEY); if (raw) progress = JSON.parse(raw); } catch (e) { /* sin almacenamiento */ }
const saveProgress = () => { try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch (e) { /* ignorar */ } };

let squad = ['asalto', 'sniper', 'escudo'];
let curLevel = 0;
let fichaKey = 'asalto';
const cssv = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
let C = {};

function show(id) { ['menu', 'squad', 'game'].forEach((s) => { $(s).hidden = s !== id; }); $('result').hidden = true; }

// ---------- Menú ----------
function renderMenu() {
  const box = $('levels'); box.innerHTML = '';
  MAPS.forEach((m, i) => {
    const open = i === 0 || (progress.stars[i - 1] || 0) > 0;
    const s = progress.stars[i] || 0;
    const b = document.createElement('button');
    b.className = 'lvl'; b.disabled = !open;
    b.innerHTML = '<h3>' + (i + 1) + '. ' + m.name + '</h3><span class="stars" aria-label="' + s + ' de 3 estrellas">' + '★'.repeat(s) + '☆'.repeat(3 - s) + '</span><p>' + m.brief + '</p>';
    b.addEventListener('click', () => openSquad(i));
    box.appendChild(b);
  });
  show('menu');
}

// ---------- Equipo ----------
function openSquad(i) {
  curLevel = i; $('sq-title').textContent = MAPS[i].name; $('sq-brief').textContent = MAPS[i].brief;
  $('sq-par').textContent = 'Enemigos: ' + MAPS[i].rows.join('').replace(/[^meb]/g, '').length + ' · 3 estrellas si terminas sin bajas en ' + MAPS[i].par + ' turnos o menos';
  renderSquad(); show('squad');
}
function renderSquad() {
  const box = $('slots'); box.innerHTML = '';
  squad.forEach((key, i) => {
    const slot = document.createElement('div'); slot.className = 'slot';
    slot.innerHTML = '<span class="kicker">Operador ' + (i + 1) + '</span>';
    const opts = document.createElement('div'); opts.className = 'slot-opts';
    Object.keys(CLASSES).forEach((k) => {
      const b = document.createElement('button'); b.className = 'slot-opt'; b.textContent = CLASSES[k].name; b.setAttribute('aria-pressed', String(squad[i] === k));
      b.addEventListener('click', () => { squad[i] = k; fichaKey = k; renderSquad(); });
      opts.appendChild(b);
    });
    slot.appendChild(opts); box.appendChild(slot);
  });
  const c = CLASSES[fichaKey];
  $('ficha').innerHTML = '<h3>' + c.name + '</h3><dl><div><dt>Vida</dt><dd>' + c.hp + '</dd></div><div><dt>Mov</dt><dd>' + c.mov + '</dd></div><div><dt>Alcance</dt><dd>' + c.rng + '</dd></div><div><dt>Daño</dt><dd>' + c.dmg + '</dd></div></dl><div>' + c.desc + '</div>';
}

// ---------- Juego ----------
const cv = $('cv'); const ctx = cv.getContext('2d');
let T = 30, dpr = 1;
function startGame() {
  startLevel(curLevel, squad.slice());
  $('hud-title').textContent = MAPS[curLevel].name; show('game'); layout(); renderUI();
}
function layout() {
  if (!S.W) return;
  const b = $('board'); const w = b.clientWidth, h = b.clientHeight;
  T = Math.max(16, Math.floor(Math.min(w / S.W, h / S.H)));
  dpr = window.devicePixelRatio || 1;
  cv.style.width = T * S.W + 'px'; cv.style.height = T * S.H + 'px';
  cv.width = Math.round(T * S.W * dpr); cv.height = Math.round(T * S.H * dpr);
}
window.addEventListener('resize', layout);

function renderUI() {
  $('hud-turn').textContent = 'Turno ' + S.turn + ' · Enemigos ' + S.foes.filter((f) => f.alive).length;
  const r = $('roster'); r.innerHTML = '';
  S.units.forEach((u, i) => {
    const b = document.createElement('button'); b.className = 'chip' + (u.alive ? '' : ' dead'); b.setAttribute('aria-pressed', String(i === S.sel && u.alive));
    const ap = '<span class="ap">' + [0, 1].map((n) => '<span class="' + (n < u.ap ? 'on' : '') + '"></span>').join('') + '<em style="font-style:normal">' + u.hp + '/' + u.max + '</em></span>';
    b.innerHTML = '<b>' + u.name + (u.shield ? ' ◈' : '') + '</b><div class="bar"><i style="width:' + Math.round((u.hp / u.max) * 100) + '%"></i></div>' + ap;
    b.addEventListener('click', () => { if (S.phase !== 'player' || !u.alive) return; S.mode = null; S.sel = i; S.tgt = null; hooks.change(); });
    r.appendChild(b);
  });
  $('info').textContent = S.info;
  const u = S.units[S.sel]; const mine = S.phase === 'player';
  const ch = u && S.tgt && S.tgt.alive && inRange(u, S.tgt) ? hitChance(u, S.tgt) : null;
  $('btn-fire').disabled = !(mine && u && u.alive && u.ap > 0 && S.tgt && S.tgt.alive);
  $('btn-fire').textContent = ch ? 'Disparar ' + ch + '%' : 'Disparar';
  const c = u ? CLASSES[u.key] : null;
  $('btn-special').disabled = !(mine && canSpecial(u));
  $('btn-special').textContent = S.mode ? 'Cancelar' : c ? c.special + (c.uses ? ' (' + u.uses + ')' : '') : 'Especial';
  $('btn-next').disabled = !mine;
  $('btn-end').disabled = !mine;
}
hooks.change = renderUI;
hooks.end = () => {
  renderUI();
  const win = S.result === 'win'; const box = $('result');
  box.className = 'overlay ' + (win ? 'win' : 'lose'); box.hidden = false;
  if (win) {
    const prev = progress.stars[curLevel] || 0; if (S.stars > prev) { progress.stars[curLevel] = S.stars; saveProgress(); }
    const last = curLevel >= MAPS.length - 1;
    $('res-body').innerHTML = '<span class="kicker">Misión cumplida</span><h2>Casa despejada</h2><div class="stars" aria-label="' + S.stars + ' de 3 estrellas">' + '★'.repeat(S.stars) + '☆'.repeat(3 - S.stars) + '</div><div class="dim">' + S.turn + ' turnos · ' + S.deaths + ' baja(s)</div>' +
      (last ? '' : '<button class="btn primary" id="res-next">Siguiente misión</button>') + '<button class="btn" id="res-retry">Repetir</button><button class="btn" id="res-menu">Menú</button>';
    const nx = $('res-next'); if (nx) nx.addEventListener('click', () => { openSquad(curLevel + 1); });
  } else {
    $('res-body').innerHTML = '<span class="kicker">Misión fallida</span><h2>Equipo abatido</h2><div class="dim">Prueba otra mezcla de clases o abre las puertas con más cuidado.</div><button class="btn primary" id="res-retry">Reintentar</button><button class="btn" id="res-squad">Elegir equipo</button><button class="btn" id="res-menu">Menú</button>';
    const sq = $('res-squad'); if (sq) sq.addEventListener('click', () => openSquad(curLevel));
  }
  $('res-retry').addEventListener('click', () => { startGame(); });
  $('res-menu').addEventListener('click', renderMenu);
};

cv.addEventListener('pointerdown', (e) => {
  const r = cv.getBoundingClientRect(); const x = Math.floor((e.clientX - r.left) / T), y = Math.floor((e.clientY - r.top) / T);
  if (x < 0 || y < 0 || x >= S.W || y >= S.H) return; tap(x, y);
});

// ---------- Dibujo ----------
function tileColor(ch) { return ch === ',' ? C.yard : C.floor; }
function draw() {
  requestAnimationFrame(draw);
  if (!S.W || $('game').hidden) return;
  const now = Date.now(); const pulse = 0.5 + 0.5 * Math.sin(now / 260);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, S.W * T, S.H * T);
  ctx.fillStyle = C.void; ctx.fillRect(0, 0, S.W * T, S.H * T);
  const u = S.units[S.sel]; const mine = S.phase === 'player';
  const rch = mine && u && u.alive && u.ap > 0 && !S.mode ? reach(u) : null;
  for (let y = 0; y < S.H; y++) for (let x = 0; x < S.W; x++) {
    if (!S.explored[y][x]) continue;
    const ch = S.grid[y][x]; const px = x * T, py = y * T;
    if (ch === '#') { ctx.fillStyle = C.wall; ctx.fillRect(px, py, T, T); ctx.strokeStyle = C.paper; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.moveTo(px, py + T); ctx.lineTo(px + T, py); ctx.stroke(); ctx.globalAlpha = 1; }
    else {
      ctx.fillStyle = tileColor(ch); ctx.fillRect(px, py, T, T);
      ctx.strokeStyle = 'rgba(211,228,246,0.07)'; ctx.lineWidth = 1; ctx.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1);
      if (ch === 'c') { ctx.fillStyle = C.furn; ctx.fillRect(px + 3, py + 3, T - 6, T - 6); ctx.strokeStyle = C.line; ctx.lineWidth = 1.5; ctx.strokeRect(px + 3, py + 3, T - 6, T - 6); ctx.beginPath(); ctx.moveTo(px + 3, py + 3); ctx.lineTo(px + T - 3, py + T - 3); ctx.moveTo(px + T - 3, py + 3); ctx.lineTo(px + 3, py + T - 3); ctx.globalAlpha = 0.4; ctx.stroke(); ctx.globalAlpha = 1; }
      if (ch === 'D') { ctx.fillStyle = C.amber; ctx.fillRect(px + 2, py + T * 0.38, T - 4, T * 0.24); }
      if (ch === 'd') { ctx.strokeStyle = C.amber; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.strokeRect(px + 3, py + 3, T - 6, T - 6); ctx.setLineDash([]); }
    }
    if (!S.vis[y][x]) { ctx.fillStyle = 'rgba(5,18,34,0.58)'; ctx.fillRect(px, py, T, T); }
  }
  if (rch) {
    ctx.fillStyle = 'rgba(90,209,255,0.2)';
    for (const k of rch.keys()) { const x = k % S.W, y = (k / S.W) | 0; ctx.fillRect(x * T, y * T, T, T); ctx.fillStyle = 'rgba(90,209,255,0.55)'; ctx.beginPath(); ctx.arc(x * T + T / 2, y * T + T / 2, T * 0.07, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(90,209,255,0.2)'; }
  }
  if (mine && u && u.alive && u.ap > 0 && !S.mode) {
    ctx.strokeStyle = C.amber; ctx.lineWidth = 2;
    for (const [dx, dy] of DIRS) if (S.grid[u.y + dy] && S.grid[u.y + dy][u.x + dx] === 'D') { ctx.globalAlpha = 0.4 + 0.6 * pulse; ctx.strokeRect((u.x + dx) * T + 1, (u.y + dy) * T + 1, T - 2, T - 2); ctx.globalAlpha = 1; }
  }
  if (S.mode && u) {
    ctx.fillStyle = 'rgba(245,196,78,0.16)';
    for (let y = 0; y < S.H; y++) for (let x = 0; x < S.W; x++) {
      const ok = S.mode === 'flash' ? S.vis[y][x] && S.grid[y][x] !== '#' && Math.hypot(x - u.x, y - u.y) <= 6.5 && los(u.x, u.y, x, y)
        : S.mode === 'heal' ? Math.hypot(x - u.x, y - u.y) <= 2.5 : false;
      if (ok) ctx.fillRect(x * T, y * T, T, T);
    }
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const f of S.foes) {
    if (!f.alive || !S.vis[f.y][f.x]) continue;
    const cx = f.x * T + T / 2, cy = f.y * T + T / 2, r = T * 0.38;
    ctx.fillStyle = C.hostile; ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy + r * 0.8); ctx.lineTo(cx - r, cy + r * 0.8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2b0d05'; ctx.font = '700 ' + Math.round(T * 0.36) + 'px ' + C.fontD; ctx.fillText(f.kind === 'b' ? 'J' : f.kind === 'e' ? 'E' : 'M', cx, cy + r * 0.2);
    hpBar(f, f.x * T, f.y * T - 1);
    if (f.stun > 0) { ctx.fillStyle = C.amber; ctx.fillText('z', cx + r, cy - r); }
    else if (f.alert) { ctx.fillStyle = C.hostile; ctx.font = '700 ' + Math.round(T * 0.4) + 'px ' + C.fontD; ctx.fillText('!', cx + r, cy - r); }
    if (S.actor === f) { ctx.strokeStyle = C.hostile; ctx.lineWidth = 2; ctx.strokeRect(f.x * T + 1, f.y * T + 1, T - 2, T - 2); }
    if (S.tgt === f) {
      ctx.strokeStyle = C.amber; ctx.lineWidth = 2; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(cx, cy, T * 0.5, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  S.units.forEach((p, i) => {
    if (!p.alive) return;
    const cx = p.x * T + T / 2, cy = p.y * T + T / 2, r = T * 0.36;
    ctx.fillStyle = C.friend; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
    ctx.fillStyle = '#04202f'; ctx.font = '700 ' + Math.round(T * 0.4) + 'px ' + C.fontD; ctx.fillText(CLASSES[p.key].letter, cx, cy + 1);
    if (p.shield) { ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, r + 3, 0, 7); ctx.stroke(); }
    if (i === S.sel && mine) { ctx.strokeStyle = C.amber; ctx.lineWidth = 2; ctx.globalAlpha = 0.5 + 0.5 * pulse; ctx.beginPath(); ctx.arc(cx, cy, r + 5, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
    hpBar(p, p.x * T, p.y * T - 1);
  });
  S.fx = S.fx.filter((f) => now - f.t < 1100);
  ctx.font = '700 ' + Math.round(T * 0.4) + 'px ' + C.fontD;
  for (const f of S.fx) {
    const a = 1 - (now - f.t) / 1100; ctx.globalAlpha = Math.max(0, a); ctx.fillStyle = C[f.color] || C.line;
    ctx.strokeStyle = C.paper; ctx.lineWidth = 3; const tx = f.x * T + T / 2, ty = f.y * T - ((now - f.t) / 1100) * T * 0.9 + T * 0.2;
    ctx.strokeText(f.text, tx, ty); ctx.fillText(f.text, tx, ty); ctx.globalAlpha = 1;
  }
}
function hpBar(e, px, py) {
  const w = T * 0.7, x = px + (T - w) / 2;
  ctx.fillStyle = 'rgba(5,18,34,0.8)'; ctx.fillRect(x, py + 1, w, 3);
  ctx.fillStyle = e.team === 'p' ? C.ok : C.hostile; ctx.fillRect(x, py + 1, w * (e.hp / e.max), 3);
}

// ---------- Botones ----------
$('btn-start').addEventListener('click', () => { curLevel = 0; openSquad(0); });
$('sq-back').addEventListener('click', renderMenu);
$('sq-go').addEventListener('click', startGame);
$('btn-menu').addEventListener('click', () => { S.phase = 'over'; renderMenu(); });
$('btn-fire').addEventListener('click', fire);
$('btn-special').addEventListener('click', special);
$('btn-next').addEventListener('click', () => { S.mode = null; selectNext(); S.tgt = null; renderUI(); });
$('btn-end').addEventListener('click', endTurn);

function init() {
  C = { paper: cssv('--paper'), void: cssv('--paper-3'), floor: cssv('--paper-2'), yard: '#0f3a4d', wall: '#bcd3ea', furn: '#1b4a75', line: cssv('--line'), friend: cssv('--friend'), hostile: cssv('--hostile'), amber: cssv('--amber'), ok: cssv('--ok'), fontD: "'Chakra Petch', system-ui, sans-serif" };
  renderMenu(); requestAnimationFrame(draw);
}
(document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(init, init);
