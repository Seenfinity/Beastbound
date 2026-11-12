// Arranque, pestañas y paneles. Las reglas están en state.js, la sala en room.js y el combate en battle.js.

import * as S from './state.js';
import { SHEETS, STAGES, ROSTER, MAPS, speciesOf, ELEMENT_COLOR, EGG_ORDER, ICON_ORDER, powersOf, effectOf, matchup, strongAgainst, weakAgainst } from './roster.js';
import { loadSprites, loadGrid, loadImage, scaled } from './sprites.js';
import { Battle, W } from './battle.js';
import { Room } from './room.js';
import { MINI_INFO } from './minigames.js';
import { sfx, isMuted, setMuted } from './sfx.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = list => list[Math.floor(Math.random() * list.length)];
const TRAIN_ICON = { pot: 'roca', pun: 'diana', agu: 'escudo', agi: 'rayo' };

let sprites, maps, icons = {}, room;
let game = null, battle = null, rival = null, tab = 'care', startPick = 0;

const spriteOf = (species, stage) => { const sp = speciesOf(species); return sprites[sp.sheet][sp.row][stage]; };
const eggClass = species => 'egg-' + EGG_ORDER.indexOf(speciesOf(species).element);
const elColor = species => ELEMENT_COLOR[speciesOf(species).element];

// Solo toca el DOM si el contenido cambió (así no se pierden pulsaciones ni animaciones).
function setHTML(el, html) {
  if (el._html !== html) { el._html = html; el.innerHTML = html; }
}

let toastTimer;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = true; void el.offsetWidth; el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

function modal({ title, body = '', actions = [] }) {
  $('modal-title').textContent = title;
  $('modal-body').innerHTML = body;
  for (const cv of $('modal-body').querySelectorAll('canvas[data-sprite]')) {
    const [species, stage] = cv.dataset.sprite.split(':');
    paintSprite(cv, spriteOf(species, +stage));
  }
  const bar = $('modal-actions');
  bar.replaceChildren();
  for (const a of actions) {
    const b = document.createElement('button');
    b.className = 'btn ' + (a.cls || '');
    b.textContent = a.label;
    b.onclick = () => { $('modal').hidden = true; a.fn?.(); };
    bar.append(b);
  }
  $('modal').hidden = false;
  $('modal-body').querySelector('input')?.focus();
}
const closeBtn = (label = 'Cerrar') => ({ label, cls: 'ghost' });

function paintSprite(cv, sp, size = 240) {
  cv.width = cv.height = size;
  const c = cv.getContext('2d');
  const k = Math.min((size - 8) / sp.width, (size - 14) / sp.height, 1);
  c.imageSmoothingQuality = 'high';
  c.fillStyle = 'rgba(0,0,0,.35)';
  c.beginPath(); c.ellipse(size / 2, size - 9, sp.width * k * 0.4, 7, 0, 0, Math.PI * 2); c.fill();
  c.drawImage(sp, (size - sp.width * k) / 2, size - 10 - sp.height * k, sp.width * k, sp.height * k);
}

// Convierte los recortes en clases CSS (.ic-…, .egg-…, .sp-…) para usarlos en los paneles.
function injectArt(eggList) {
  const url = (cv, h) => scaled(cv, Math.min(h, cv.height)).toDataURL();
  let css = '';
  for (const [name, cv] of Object.entries(icons)) css += `.ic-${name}{background-image:url(${url(cv, 96)})}`;
  eggList.forEach((cv, i) => { css += `.egg-${i}{background-image:url(${url(cv, 150)})}`; });
  for (const sp of ROSTER) for (let st = 0; st < 3; st++) css += `.sp-${sp.id}-${st}{background-image:url(${url(spriteOf(sp.id, st), 150)})}`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
}

function duration(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s >= 86400) return `${Math.floor(s / 86400)} d ${Math.floor((s % 86400) / 3600)} h`;
  if (s >= 3600) return `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`;
  if (s >= 60) return `${Math.floor(s / 60)} min ${s % 60} s`;
  return `${s} s`;
}

function commit() { S.save(game); renderCare(); }
function celebrate(up) {
  if (!up || !up.levels) return;
  toast(`¡Nivel ${game.pet.level}! ${up.gains.map(k => '+' + S.STAT_NAMES[k]).join(' ')}`);
  room.cheer();
  sfx.level();
}

// ---------- Primer huevo ----------

function showStart() {
  game = S.newGame();
  startPick = 0;
  $('game').hidden = true;
  $('screen-loading').hidden = true;
  $('screen-start').hidden = false;
  $('start-name').value = '';
  renderStart();
}
function renderStart() {
  $('start-eggs').innerHTML = game.offer.map((id, i) => `
    <button class="capsule${i === startPick ? ' on' : ''}" data-i="${i}" style="--c:${elColor(id)}">
      <div class="dome"><i class="egg-img ${eggClass(id)}"></i></div><div class="base"></div>
      Huevo de ${esc(speciesOf(id).element)}
    </button>`).join('');
}
$('start-eggs').onclick = e => {
  const b = e.target.closest('[data-i]');
  if (b) { startPick = +b.dataset.i; renderStart(); }
};
$('btn-start').onclick = () => {
  const name = $('start-name').value.trim().slice(0, 12);
  if (!name) return toast('Ponle un nombre antes de abrir el huevo.');
  S.startWith(game, startPick, name);
  S.save(game);
  enterGame();
  birthModal(game.pet);
};

function birthModal(pet) {
  const sp = speciesOf(pet.species);
  modal({
    title: `¡Ha nacido ${pet.name}!`,
    body: `<div class="hatch"><i class="egg-img ${eggClass(sp.id)}"></i><canvas data-sprite="${sp.id}:0"></canvas></div>
      <p>Del huevo salió un <b>${esc(sp.name)}</b>, de elemento ${esc(sp.element)}. Lo suyo: ${esc(sp.role.toLowerCase())}.</p>
      <p>Frótalo para acariciarlo, arrastra la comida hasta él y lánzale la pelota. Según cómo lo trates crecerá con un carácter u otro.</p>`,
    actions: [{ label: 'Vamos', cls: 'primary' }],
  });
  setTimeout(() => sfx.hatch(), 1150);                 // suena cuando se rompe el cascarón
}

// ---------- Pestañas ----------

function enterGame() {
  $('screen-loading').hidden = true;
  $('screen-start').hidden = true;
  $('game').hidden = false;
  room.setPet(game.pet);
  switchTab('care');
  const gift = S.claimDaily(game);
  if (gift) { S.save(game); toast(`Regalo diario: +${gift.coins} monedas · ${gift.streak} día${gift.streak === 1 ? '' : 's'} seguido${gift.streak === 1 ? '' : 's'}`); }
}

function switchTab(name) {
  tab = name;
  for (const t of ['care', 'battle', 'collection', 'settings']) $('tab-' + t).hidden = t !== name;
  for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('on', b.dataset.tab === name);
  renderAll();
  window.scrollTo(0, 0);
}
$('tabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) switchTab(b.dataset.tab); };
$('btn-go-battle').onclick = () => switchTab('battle');

function renderAll() {
  if (!game?.pet) return;
  $('coins').textContent = game.coins;
  $('chip-test').hidden = !game.testMode;
  if (tab === 'care') renderCare();
  if (tab === 'battle') renderLobby();
  if (tab === 'collection') renderDex();
  if (tab === 'settings') {
    $('btn-test').textContent = game.testMode ? 'Desactivar' : 'Activar';
    $('btn-sound').textContent = isMuted() ? 'Activar' : 'Silenciar';
  }
}

// ---------- Cuidar ----------

function setMeter(id, value) {
  const el = $(id);
  el.querySelector('.bar i').style.width = Math.round(value) + '%';
  el.classList.toggle('low', value < 25);
}

function renderCare() {
  if (!game?.pet) return;
  const p = game.pet, sp = speciesOf(p.species);
  $('coins').textContent = game.coins;
  $('pet-name').textContent = p.name;
  $('pet-sub').textContent = `${sp.name} · ${sp.element} · ${STAGES[p.stage]}`;
  const need = S.expNeeded(p.level);
  $('pet-level').textContent = `Nivel ${p.level}`;
  $('exp-fill').style.width = (p.exp / need) * 100 + '%';
  $('exp-text').textContent = `${Math.floor(p.exp)} / ${need}`;
  setMeter('m-hunger', p.hunger); setMeter('m-energy', p.energy); setMeter('m-mood', p.mood); setMeter('m-bond', p.bond);
  $('btn-sleep').textContent = p.asleep ? 'Despertar' : 'Acostar a dormir';
  $('sleep-note').textContent = p.asleep ? 'Durmiendo: recobra energía y se recupera el doble de rápido.' : 'Dormida se recupera antes, pero no podrás jugar ni pelear con ella.';
  $('mood-line').textContent = p.asleep ? 'Está durmiendo' : p.hunger < 25 ? 'Tiene hambre' : p.mood < 25 ? 'Está triste' : p.energy < 20 ? 'Está agotado'
    : p.bond < 30 ? 'Aún no confía en ti' : p.mood > 75 && p.hunger > 60 ? '¡Está feliz!' : 'Está bien';

  // Personalidad: la actual y hacia dónde va con el trato de ahora
  const trend = S.trendOf(p), c = p.char && S.CHARS[p.char];
  setHTML($('persona'), (c
    ? `<b class="big" style="--c:${c.color}">${c.name}</b><p>${c.desc}</p>`
    : `<b class="big">Sin definir</b><p>Se decide al evolucionar a Teen, según cómo la trates.</p>`)
    + (trend ? `<p>Con el trato de ahora va camino de ser <span class="tag" style="--c:${S.CHARS[trend].color}">${S.CHARS[trend].name}</span></p>` : ''));

  const taste = (label, id, known) => known
    ? `<div class="taste"><i class="ic ic-${id}"></i><span>${S.FOODS[id].name}<small>${label}</small></span></div>`
    : `<div class="taste unknown"><i class="ic ic-estrella"></i><span>¿…?<small>${label}: sin descubrir</small></span></div>`;
  setHTML($('tastes'), taste('Favorita', p.fav, p.favKnown) + taste('La odia', p.hate, p.hateKnown));

  // Bandeja de comida
  for (const id of Object.keys(S.FOODS)) {
    const slot = $('slot-' + id);
    slot.classList.toggle('empty', game.foods[id] <= 0);
    slot.querySelector('b').textContent = game.foods[id];
  }

  // Momento de crianza
  const ev = S.currentEvent(game), card = $('event-card');
  card.hidden = !ev || !!room.mini;
  if (ev && card.dataset.id !== ev.id) {
    card.dataset.id = ev.id;
    $('event-text').textContent = ev.text;
    $('event-choices').innerHTML = ev.choices.map((label, i) => `<button data-choice="${i}">${esc(label)}</button>`).join('');
  }

  // Entrenar
  const left = S.trainsLeft(game);
  $('train-note').textContent = left === Infinity ? 'Cada estadística tiene su minijuego.' : `Sesiones que quedan hoy: ${left}`;
  setHTML($('train-list'), Object.keys(S.STAT_NAMES).map(k =>
    `<button data-train="${k}"><i class="ic ic-${TRAIN_ICON[k]}"></i><span>${S.STAT_NAMES[k]} ${p.stats[k]}<small>${MINI_INFO[k].title}</small></span></button>`).join(''));
  const lt = game.lastTrain;
  $('train-result').textContent = lt
    ? `Último: ${{ perfecto: '¡Perfecto!', bien: 'Bien', flojo: 'Flojo' }[lt.grade]} · ${lt.gained ? `+1 ${S.STAT_NAMES[lt.stat]}` : 'no mejoró'}`
    : 'Según lo bien que te salga el minijuego, gana o no el punto.';

  // Evolución
  const evo = S.evolveStatus(game);
  room.evolveReady = !!evo?.ready;
  setHTML($('evo-line'), STAGES.map((name, i) =>
    `<div class="step ${i < p.stage ? 'past' : i === p.stage ? 'now' : 'future'}"><i class="sp sp-${p.species}-${i}"></i>${name}</div>`).join('<span class="arrow">›</span>'));
  $('evo-text').textContent = !evo ? 'Ya está en su forma Final.'
    : evo.ready ? `¡Lista! Mantén pulsado sobre ${p.name} para que evolucione.`
    : `Siguiente: ${STAGES[p.stage + 1]} con nivel ${evo.req.level}` + (game.testMode ? '.' : ` y ${evo.req.days} días de vida${evo.okTime ? '' : ` (faltan ${evo.daysLeft})`}.`);

  const tags = list => (list.length ? list.map(e => `<span class="tag" style="--c:${ELEMENT_COLOR[e]}">${e}</span>`).join(' ') : '—');
  setHTML($('species-info'), `<p><b>${sp.name}</b> <span class="tag" style="--c:${ELEMENT_COLOR[sp.element]}">${sp.element}</span></p>
    <p>${sp.role}.</p>
    <p class="match"><span>Fuerte contra</span>${tags(strongAgainst(sp.element))}</p>
    <p class="match"><span>Débil contra</span>${tags(weakAgainst(sp.element))}</p>
    ${p.mastery ? `<p><b>${S.MASTERY[p.mastery].name}.</b> ${S.MASTERY[p.mastery].desc}</p>` : ''}`);

  // Poderes: tres de su elemento (por nivel) y el propio de la especie (forma Final)
  const prof = S.profile(p), rest = S.restLeft(p);
  $('mp-max').textContent = `· ${prof.maxMp} MP`;
  setHTML($('powers-info'), powersOf(sp, p).map(pw => `<div class="${pw.unlocked ? '' : 'locked'}"><b>${pw.name}</b>
    <small><i>${effectOf(pw)}</i> · ${pw.unlocked ? `${pw.mp} MP` : pw.need} · ${pw.desc}</small></div>`).join(''));

  setHTML($('battle-prev'), `<div class="prev-map" style="background-image:url(${maps[0].bg})"><i class="sp sp-${p.species}-${p.stage}"></i></div>
    <span>Vida <b>${prof.maxHp}</b> · MP <b>${prof.maxMp}</b> · Daño <b>${Math.round(prof.dmg)}</b></span>
    <span>${rest ? `<b class="resting">Recuperándose: ${duration(rest)}</b>` : prof.disobey > 0 ? 'Con tan poco vínculo puede no obedecerte.' : prof.clutch ? 'Aguantará un golpe mortal por ti.' : `${game.wins} ganados · ${game.losses} perdidos`}</span>`);
  renderHeal();

  setHTML($('team'), game.pets.map((m, i) => `<button class="mate${i === game.active ? ' on' : ''}" data-pet="${i}"><i class="sp sp-${m.species}-${m.stage}"></i>${esc(m.name)}</button>`).join(''));
  renderEggs();

  $('tip').textContent = p.asleep ? `${p.name} está durmiendo. Se despierta sola cuando esté recuperada, o puedes despertarla tú.`
    : rest ? `${p.name} se está recuperando del combate. Si la acuestas a dormir tarda la mitad.`
    : !p.favKnown ? 'Prueba las tres comidas: una es su favorita y otra la odia.'
    : p.bond < 30 ? 'Con el vínculo bajo puede no obedecerte en combate. Acaríciala y juega con ella.'
    : evo?.ready ? `Mantén el dedo sobre ${p.name} para que evolucione.`
    : 'Cuanto mejor cuidada y más unida a ti, más MP tiene para sus poderes.';
}

// Botón de curar: aparece mientras la criatura se recupera de un combate.
function renderHeal() {
  const rest = S.restLeft(game.pet);
  for (const b of document.querySelectorAll('.heal-btn')) {
    b.hidden = !rest;
    if (rest) setHTML(b, `Curar ahora · ${S.healCost(game)}<i class="ic ic-moneda"></i>`);
  }
}
for (const b of document.querySelectorAll('.heal-btn')) {
  b.onclick = () => {
    const res = S.heal(game);
    if (res.error) { toast(res.error); return sfx.error(); }
    sfx.heart();
    S.save(game);
    renderAll();
    toast(`${game.pet.name} está como nueva.`);
  };
}

function renderEggs() {
  if (!game) return;
  $('eggs-count').textContent = `(${game.eggs.length})`;
  setHTML($('eggs-list'), game.eggs.length ? game.eggs.map((e, i) => {
    const ready = S.eggReady(game, e);
    return `<button class="egg-card${ready ? ' ready' : ''}" data-egg="${i}" style="--c:${elColor(e.species)}">
      <i class="egg-img ${eggClass(e.species)}"></i>
      <span><b>${esc(speciesOf(e.species).element)}</b>${ready ? '¡Listo! Toca para abrirlo' : 'Se abre en ' + duration(S.eggReadyAt(game, e) - Date.now())}</span></button>`;
  }).join('') : `<p class="muted">Sin huevos. Compra uno, o derrota ${S.DEFEATS_FOR_EGG} veces a una especie que no tengas.</p>`);
  setHTML($('btn-buy-egg'), `Huevo misterioso · ${S.eggPrice(game)}<i class="ic ic-moneda"></i>`);
}

$('btn-buy-egg').onclick = () => {
  const res = S.buyEgg(game);
  if (res.error) { toast(res.error); return sfx.error(); }
  sfx.coin();
  commit();
  toast(`Compraste un huevo de ${speciesOf(res.species).element}. Nunca sale una especie que ya tengas.`);
};

$('eggs-list').onclick = e => {
  const b = e.target.closest('[data-egg]');
  if (!b) return;
  const i = +b.dataset.egg, egg = game.eggs[i];
  if (!S.eggReady(game, egg)) return toast('Ese huevo aún se está incubando.');
  modal({
    title: `Huevo de ${speciesOf(egg.species).element}`,
    body: '<p>Está a punto de abrirse. ¿Cómo se va a llamar?</p><input id="egg-name" maxlength="12" autocomplete="off">',
    actions: [{ label: 'Abrirlo', cls: 'primary', fn: () => {
      const name = $('egg-name').value.trim().slice(0, 12);
      if (!name) return toast('Necesita un nombre.');
      const res = S.hatchEgg(game, i, name);
      if (res.error) return toast(res.error);
      S.setActive(game, res.pet);
      room.setPet(game.pet);
      commit();
      birthModal(game.pet);
    } }, closeBtn('Luego')],
  });
};

$('team').onclick = e => {
  const b = e.target.closest('[data-pet]');
  if (!b || +b.dataset.pet === game.active) return;
  S.setActive(game, +b.dataset.pet);
  room.setPet(game.pet);
  commit();
};

$('event-choices').onclick = e => {
  const b = e.target.closest('[data-choice]');
  if (!b) return;
  const res = S.resolveEvent(game, +b.dataset.choice);
  $('event-card').dataset.id = '';
  commit();
  room.say(res.text, 3.5);
  celebrate(res.up);
};

$('train-list').onclick = e => {
  const b = e.target.closest('[data-train]');
  if (!b || room.mini) return;
  const err = S.canTrain(game);
  if (err) return room.say(err);
  room.startMini(b.dataset.train);
  $('event-card').hidden = true;
  $('room').scrollIntoView({ block: 'center', behavior: 'smooth' });
};

$('btn-sleep').onclick = () => {
  if (room.mini) return;
  const res = S.toggleSleep(game);
  sfx.tap();
  commit();
  if (!res.asleep) room.say('¡Buenos días!');
};

$('plate').onclick = () => {
  const p = game.pet;
  const when = t => new Date(t).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  modal({
    title: `Diario de ${p.name}`,
    body: `<p class="muted">${Math.floor(S.ageDays(p))} días de vida · ${Object.keys(S.STAT_NAMES).map(k => `${S.STAT_NAMES[k]} ${p.stats[k]}`).join(' · ')}</p>
      <ul class="diary">${p.diary.map(d => `<li><time>${when(d.t)}</time>${esc(d.text)}</li>`).join('')}</ul>`,
    actions: [closeBtn()],
  });
};

// Bandeja: se arrastra la comida hasta la criatura (o se toca para dársela).
function buildTray() {
  $('tray').innerHTML = Object.entries(S.FOODS).map(([id, f]) =>
    `<div class="slot" id="slot-${id}" title="${f.name}: ${f.desc}"><i class="ic ic-${id}" data-food="${id}"></i><b>0</b>
      <button data-buy="${id}" aria-label="Comprar ${f.name}">+ ${f.price}<i class="ic ic-moneda"></i></button></div>`).join('');
  const ghost = $('ghost');
  let drag = null;
  $('tray').addEventListener('pointerdown', e => {
    const buy = e.target.closest('[data-buy]');
    if (buy) {
      const res = S.buyFood(game, buy.dataset.buy);
      if (res.error) { toast(res.error); sfx.error(); } else { commit(); sfx.coin(); }
      return;
    }
    const food = e.target.closest('[data-food]')?.dataset.food;
    if (!food || room.mini) return;
    if (game.foods[food] <= 0) return toast(`No te queda ${S.FOODS[food].name.toLowerCase()}. Cómpralo con el botón de abajo.`);
    e.preventDefault();
    drag = { food, sx: e.clientX, sy: e.clientY, moved: false };
    ghost.className = `ic ghost ic-${food}`;
  });
  window.addEventListener('pointermove', e => {
    if (!drag) return;
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 10) drag.moved = true;
    ghost.hidden = !drag.moved;
    ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px';
    room.hover(e);
  });
  const end = e => {
    if (!drag) return;
    const d = drag;
    drag = null; ghost.hidden = true; room.hover(null);
    if (e.type === 'pointercancel' || (d.moved && !room.canDrop(e))) return;
    const res = S.feed(game, d.food);
    if (res.error) return room.say(res.error);
    room.eat(d.food, res.reaction, res.loved, res.hated);
    commit();
    celebrate(res.up);
  };
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
}

function doEvolve() {
  const p = game.pet;
  const res = S.evolve(game);
  commit();
  sfx.evolve();
  const c = S.CHARS[res.char], sp = speciesOf(p.species);
  const redeemed = res.prevChar === 'resentido' && res.char !== 'resentido';
  setTimeout(() => modal({
    title: `¡${p.name} evolucionó a ${STAGES[p.stage]}!`,
    body: `<div class="sprites"><figure><canvas data-sprite="${p.species}:${p.stage - 1}"></canvas>Antes</figure><span class="versus">→</span><figure><canvas data-sprite="${p.species}:${p.stage}"></canvas>Ahora</figure></div>
      <p>Carácter: <span class="tag" style="--c:${c.color}">${c.name}</span></p>
      <p>${redeemed ? 'Dejó atrás el rencor. ' : ''}${c.why} <b>En combate:</b> ${c.desc}</p>
      ${p.stage === 1 ? `<p>Ya puede usar su especial: <b>${esc(sp.special.name)}</b>. ${esc(sp.special.desc)}</p>` : ''}
      ${res.mastery && p.stage === 2 ? `<p><b>${S.MASTERY[res.mastery].name}.</b> ${S.MASTERY[res.mastery].desc}</p>` : ''}
      <p class="muted">+1 en todas las estadísticas.</p>`,
    actions: [{ label: 'Seguir', cls: 'primary', fn: () => room.cheer() }],
  }), 550);
}

const roomHooks = {
  onStroke() { S.stroke(game); renderCare(); },
  onTap() {
    const p = game.pet;
    if (p.asleep) return 'Zzz…';
    return p.hunger < 25 ? 'Tengo hambre…' : p.mood < 25 ? 'Estoy triste…' : p.energy < 20 ? 'Estoy cansado…'
      : p.bond < 30 ? 'Aún no me fío de ti.' : pick(['¡Hola!', '¿Jugamos?', 'Lánzame la pelota', '¡Aquí estoy!', 'Ráscame']);
  },
  onPlay() {
    const res = S.play(game);
    if (!res.error) { commit(); celebrate(res.up); }
    return res;
  },
  onEvolve: doEvolve,
  onTrainDone(kind, score) {
    const res = S.train(game, kind, score);
    commit();
    if (res.up.levels) toast(`¡Nivel ${game.pet.level}! ${res.up.gains.map(k => '+' + S.STAT_NAMES[k]).join(' ')}`);
    if (res.grade === 'flojo') sfx.bad(); else sfx.level();
    return `${{ perfecto: '¡Perfecto!', bien: 'Bien', flojo: 'Flojo…' }[res.grade]}\n${res.gained ? '+1 ' + S.STAT_NAMES[kind] : 'Esta vez no mejora'}`;
  },
  charColor: () => (game.pet.char ? S.CHARS[game.pet.char].color : ''),
};

// ---------- Combate ----------

// Cómo queda un elemento frente a otro, en palabras.
function advantage(mine, theirs) {
  const out = matchup(mine, theirs), back = matchup(theirs, mine);
  return (out > 1 ? '<span class="adv up">▲ Pegas más</span>' : out < 1 ? '<span class="adv down">▽ Pegas menos</span>' : '')
    + (back > 1 ? '<span class="adv down">▼ Te pega más</span>' : back < 1 ? '<span class="adv up">△ Te pega menos</span>' : '');
}

function renderLobby() {
  if (battle) return;
  const p = game.pet, sp = speciesOf(p.species), prof = S.profile(p), rest = S.restLeft(p);
  setHTML($('lobby-info'), `<i class="sp sp-${p.species}-${p.stage}"></i><div><b>${esc(p.name)}</b> · ${sp.name} ${STAGES[p.stage]} · Nivel ${p.level}<br>
    Vida <b>${prof.maxHp}</b> · MP <b>${prof.maxMp}</b> · Daño <b>${Math.round(prof.dmg)}</b><br>
    ${rest ? `<b class="resting">Recuperándose: ${duration(rest)}</b>` : 'Lista para pelear.'}<br>
    Arrastra hacia atrás y suelta para disparar. Toca el suelo para moverte.</div>`);
  $('btn-find').disabled = !!rest;
  renderHeal();
  setHTML($('lobby-maps'), maps.map(m => `<div><img src="${m.bg}" alt="">${m.name}<small>${m.effect}</small></div>`).join(''));
  setHTML($('rivals'), ROSTER.filter(r => r.id !== p.species).map(r => {
    const seen = game.seen.includes(r.id), n = game.defeats[r.id] || 0;
    const progress = S.owns(game, r.id) ? 'Ya la tienes' : n >= S.DEFEATS_FOR_EGG ? 'Huevo pendiente: haz sitio' : `Derrotas: ${n} de ${S.DEFEATS_FOR_EGG}`;
    return `<button class="rival${seen ? '' : ' unseen'}" data-rival="${r.id}"${rest ? ' disabled' : ''}>
      <i class="sp sp-${r.id}-${p.stage}"></i><b>${seen ? r.name : '¿…?'}</b>
      <span class="tag" style="--c:${ELEMENT_COLOR[r.element]}">${r.element}</span>${advantage(sp.element, r.element)}<small>${progress}</small></button>`;
  }).join(''));
}

function challenge(species = '') {
  S.tick(game);
  const p = game.pet, sp = speciesOf(p.species);
  if (p.asleep) return toast(`${p.name} está durmiendo. Despiértala para pelear.`);
  if (S.restLeft(p)) return toast(`${p.name} aún se está recuperando.`);
  if (p.energy < S.FIGHT_ENERGY) return toast(`${p.name} está agotado. Déjalo descansar.`);
  rival = S.makeRival(p, species);
  const rsp = speciesOf(rival.species), map = pick(maps);
  const out = matchup(sp.element, rsp.element), back = matchup(rsp.element, sp.element);
  modal({
    title: map.name,
    body: `<div class="sprites"><figure><canvas data-sprite="${p.species}:${p.stage}"></canvas>${esc(p.name)} · Nv ${p.level}</figure><span class="versus">VS</span><figure><canvas class="flip" data-sprite="${rival.species}:${rival.stage}"></canvas>${esc(rival.name)} · Nv ${rival.level}</figure></div>
      <p>Te enfrentas a <b>${esc(rival.name)}</b>, un ${esc(rsp.name)} de ${esc(rsp.element)}${rival.char ? ` con carácter ${S.CHARS[rival.char].name.toLowerCase()}` : ''}.</p>
      ${out > 1 ? `<p class="adv up">▲ Tu ${sp.element} es eficaz contra ${rsp.element}: le harás más daño.</p>` : out < 1 ? `<p class="adv down">▽ Tu ${sp.element} es poco eficaz contra ${rsp.element}: le harás menos daño.</p>` : ''}
      ${back > 1 ? `<p class="adv down">▼ Su ${rsp.element} es eficaz contra ${sp.element}: te hará más daño.</p>` : back < 1 ? `<p class="adv up">△ Su ${rsp.element} es poco eficaz contra ti.</p>` : ''}
      <p class="muted">${map.effect}</p>`,
    actions: [{ label: '¡A luchar!', cls: 'primary', fn: () => startBattle(map) }, closeBtn('Mejor no')],
  });
}
$('btn-find').onclick = () => challenge();
$('rivals').onclick = e => { const b = e.target.closest('[data-rival]'); if (b && !b.disabled) challenge(b.dataset.rival); };

let powerButtons = [];
function startBattle(map) {
  const p = game.pet;
  p.energy -= S.FIGHT_ENERGY;
  S.save(game);
  $('lobby').hidden = true;
  $('arena').hidden = false;
  // El campo ocupa lo que quepa: más alto en vertical, panorámico en horizontal.
  const wrap = document.querySelector('.field-wrap');
  wrap.style.width = wrap.style.height = '';
  const maxW = Math.min($('tab-battle').clientWidth, 1100);
  const maxH = Math.max(240, window.innerHeight - wrap.getBoundingClientRect().top - 16);
  const w = Math.min(maxW, maxH / 0.5625), h = clamp(maxH, w * 0.5625, w * 1.35);
  wrap.style.width = w + 'px'; wrap.style.height = h + 'px';
  const side = pet => {
    const sp = speciesOf(pet.species);
    return { pet, prof: S.profile(pet), species: sp, sprite: spriteOf(pet.species, pet.stage), powers: powersOf(sp, pet).filter(pw => pw.unlocked) };
  };
  battle = new Battle($('field'), side(p), side(rival), map, { onEnd: endBattle }, Math.round((W * h) / w), w < 520 ? 1.4 : 1);
  const tag = f => ` <span class="tag" style="--c:${f.color}">${f.species.element}</span>`;
  $('b-name1').innerHTML = esc(p.name) + tag(battle.player);
  $('b-name2').innerHTML = tag(battle.rival) + ' ' + esc(rival.name);
  $('b-powers').innerHTML = battle.player.powers.map((pw, i) => `<button class="pw" data-power="${i}"><b>${esc(pw.name)}</b><em>${effectOf(pw)}</em><small>${pw.mp} MP</small><span></span></button>`).join('')
    || '<p class="pw-none">Aún sin poderes: el primero llega al nivel 2.</p>';
  powerButtons = [...document.querySelectorAll('#b-powers .pw')];
}

function statusOf(f) {
  return [f.frozen || f.frozenNext ? 'Congelado' : '', f.burn ? 'Quemadura' : '', f.poison ? 'Veneno' : '', f.blind || f.blindNext ? 'Cegado' : '',
    f.rooted || f.rootNext ? 'Inmóvil' : '', f.exposed > 0 ? 'Vulnerable' : '', f.shield > 0 ? 'Escudo' : '', f.counter > 0 ? 'Contraataque' : ''].filter(Boolean).join(' · ');
}
function renderBattle() {
  const a = battle.player, b = battle.rival;
  $('b-hp1').style.width = (a.hp / a.maxHp) * 100 + '%';
  $('b-hp2').style.width = (b.hp / b.maxHp) * 100 + '%';
  $('b-mp1').style.width = (a.mp / a.maxMp) * 100 + '%';
  $('b-mp2').style.width = (b.mp / b.maxMp) * 100 + '%';
  $('b-st1').textContent = `${Math.ceil(a.hp)} / ${a.maxHp} · ${a.mp} MP  ${statusOf(a)}`;
  $('b-st2').textContent = `${statusOf(b)}  ${b.mp} MP · ${Math.ceil(b.hp)} / ${b.maxHp}`;
  const wnd = Math.round(battle.windNow());
  $('b-wind').textContent = wnd === 0 ? 'calma' : (wnd < 0 ? '← ' : '') + Math.abs(wnd) + (wnd > 0 ? ' →' : '');
  powerButtons.forEach((btn, i) => {
    const armed = battle.armed === i;
    btn.disabled = !armed && !battle.canUse(a, i);
    btn.classList.toggle('armed', armed);
    btn.lastElementChild.textContent = a.cds[i] > 0 ? a.cds[i] : '';
  });
  const pw = a.powers[hoverPower >= 0 ? hoverPower : battle.armed];
  $('b-hint').textContent = pw && hoverPower >= 0 ? `${pw.name} (${pw.mp} MP): ${pw.desc}`
    : !battle.canAct() ? battle.map.effect
    : pw ? `${pw.name}: ${pw.desc} Si falla, tarda más en volver.`
    : a.frozen ? 'Congelado: este turno no puedes moverte ni ver la guía.'
    : a.blind ? 'Cegado: este turno no ves la guía de tiro.'
    : a.rooted ? 'Inmóvil: este turno no puedes moverte.'
    : 'Arrastra hacia atrás y suelta para disparar · Toca el suelo para moverte';
}

function endBattle(win) {
  const p = game.pet, rsp = speciesOf(rival.species);
  const r = S.finishBattle(game, win, rival, battle.player.hp / battle.player.maxHp);
  S.save(game);
  if (win) sfx.win(); else sfx.lose();
  const hunt = r.egg ? `<p><b>¡Décima victoria contra ${esc(rsp.name)}!</b> Te ganaste su huevo: ya está en tu incubadora.</p>`
    : win && !S.owns(game, rival.species) ? `<p class="muted">Victorias contra ${esc(rsp.name)}: ${Math.min(r.defeats, S.DEFEATS_FOR_EGG)} de ${S.DEFEATS_FOR_EGG} para ganar su huevo.</p>` : '';
  const lines = win
    ? `<p>Le ganaste a <b>${esc(rival.name)}</b> y te quedaste con su botín.</p><p>+${r.exp} EXP · +${r.coins} monedas · sube el vínculo</p>${hunt}`
    : `<p><b>${esc(rival.name)}</b> ganó esta vez${r.stolen ? ` y te robó ${r.stolen} monedas` : ''}.</p><p>+${r.exp} EXP por intentarlo</p>`;
  const up = r.up.levels ? `<p><b>¡${esc(p.name)} subió al nivel ${p.level}!</b> ${r.up.gains.map(k => '+' + S.STAT_NAMES[k]).join(' ')}</p>` : '';
  const rest = `<p>${esc(p.name)} necesita recuperarse: <b>${duration(r.rest)}</b>.</p>`;
  modal({ title: win ? '¡Victoria!' : 'Derrota', body: lines + up + rest, actions: [{ label: 'Volver a casa', cls: 'primary', fn: () => {
    battle = null;
    $('arena').hidden = true; $('lobby').hidden = false;
    switchTab('care');
    if (win) room.cheer();
  } }] });
}

const field = $('field');
const toWorld = e => {
  const r = field.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * battle.H];
};
field.addEventListener('pointerdown', e => { if (battle) { field.setPointerCapture(e.pointerId); battle.pullStart(...toWorld(e)); } });
field.addEventListener('pointermove', e => { if (battle) battle.pullMove(...toWorld(e)); });
field.addEventListener('pointerup', () => battle?.pullEnd());
field.addEventListener('pointercancel', () => { if (battle) battle.pull = null; });
// Al pasar por encima de un poder (o mantenerlo pulsado) se lee qué hace.
let hoverPower = -1;
$('b-powers').addEventListener('pointerover', e => { const b = e.target.closest('[data-power]'); hoverPower = b ? +b.dataset.power : -1; });
$('b-powers').addEventListener('pointerleave', () => { hoverPower = -1; });
$('b-powers').onclick = e => { const b = e.target.closest('[data-power]'); if (b && battle) { battle.arm(+b.dataset.power); sfx.tap(); } };
$('b-quit').onclick = () => modal({
  title: '¿Rendirte?',
  body: '<p>Cuenta como derrota.</p>',
  actions: [{ label: 'Sí, me rindo', cls: 'primary', fn: () => battle?.surrender() }, closeBtn('Seguir luchando')],
});

// ---------- Colección y ajustes ----------

function renderDex() {
  $('dex-count').textContent = `${game.seen.length} de ${ROSTER.length} vistas`;
  setHTML($('dex'), ROSTER.map(sp => {
    const seen = game.seen.includes(sp.id), mine = game.pets.some(m => m.species === sp.id), n = game.defeats[sp.id] || 0;
    const hunt = mine ? 'La tienes.' : S.owns(game, sp.id) ? 'Tienes su huevo.' : `Derrotas: ${Math.min(n, S.DEFEATS_FOR_EGG)} de ${S.DEFEATS_FOR_EGG} para su huevo.`;
    return seen
      ? `<div class="entry"><i class="sp sp-${sp.id}-${mine ? 2 : 0}"></i><b>${sp.name}</b><span class="tag" style="--c:${ELEMENT_COLOR[sp.element]}">${sp.element}</span>${sp.role}. ${hunt}</div>`
      : `<div class="entry unseen"><i class="sp sp-${sp.id}-0"></i><b>¿…?</b>Aún no la has visto.</div>`;
  }).join(''));
}

$('btn-test').onclick = () => { game.testMode = !game.testMode; S.save(game); renderAll(); };
$('btn-sound').onclick = () => { setMuted(!isMuted()); renderAll(); sfx.coin(); };
$('btn-reset').onclick = () => modal({
  title: '¿Empezar de cero?',
  body: '<p>Perderás todas tus criaturas, huevos y monedas. No se puede deshacer.</p>',
  actions: [{ label: 'Sí, borrar todo', cls: 'primary', fn: () => { S.reset(); battle = null; $('arena').hidden = true; $('lobby').hidden = false; showStart(); } }, closeBtn('Cancelar')],
});

// ---------- Bucle y arranque ----------

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (game?.pet && !$('game').hidden) {
    if (tab === 'care') {
      room.update(dt); room.draw();
      const busy = !!room.mini;                       // durante un minijuego se despeja la sala
      if ($('tray').hidden !== busy) { $('tray').hidden = busy; $('plate').hidden = busy; }
    }
    else if (tab === 'battle' && battle) { battle.update(dt); battle.draw(); renderBattle(); }
  }
  requestAnimationFrame(frame);
}

let seconds = 0;
setInterval(() => {
  if (!game?.pet || $('game').hidden) return;
  if (tab === 'battle' && !battle) renderLobby();      // cuenta atrás de la recuperación
  if (++seconds % 5 === 0) { S.tick(game); S.save(game); }
  if (tab !== 'care') return;
  renderCare();
  const p = game.pet;                                 // de vez en cuando avisa de lo que le falta
  if (seconds % 20 === 0 && !room.mini && !room.bubble && (p.hunger < 25 || p.mood < 25)) room.say(p.hunger < 25 ? 'Tengo hambre…' : 'Estoy triste…', 3);
}, 1000);

try {
  let loaded = 0;
  const track = promise => promise.then(value => { $('load-text').textContent = `Cargando arte… ${++loaded} de 5`; return value; });
  const [sheetGrids, mapImgs, roomBg, iconGrid, eggGrid] = await Promise.all([
    loadSprites(SHEETS),
    Promise.all(MAPS.map(async m => ({ ...m, img: await loadImage(m.bg) }))),
    loadImage('assets/ui/sala.png'),
    loadGrid('assets/ui/objetos.png', 4, 4),
    loadGrid('assets/ui/huevos.png', 4, 4),
  ].map(track));
  sprites = sheetGrids; maps = mapImgs;
  iconGrid.flat().forEach((cv, i) => { icons[ICON_ORDER[i]] = cv; });
  injectArt(eggGrid.flat().slice(0, EGG_ORDER.length));
  room = new Room($('room'), { bg: roomBg, icons, sprite: pet => spriteOf(pet.species, pet.stage) }, roomHooks);
  buildTray();
  window.petbound = { get game() { return game; }, get room() { return room; }, get battle() { return battle; } }; // para depurar desde la consola
  game = S.load();
  if (game?.pet) { S.tick(game); enterGame(); } else showStart();
  requestAnimationFrame(frame);
} catch (err) {
  console.error(err);
  $('load-text').textContent = 'No se pudieron cargar las imágenes. Abre el juego desde el servidor local.';
}
