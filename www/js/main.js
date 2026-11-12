// Arranque, pestañas y paneles. Las reglas están en state.js, la sala en room.js y el combate en battle.js.

import * as S from './state.js';
import { MOODS, moodSheet, STAGES, ROSTER, MAPS, speciesOf, ELEMENT_COLOR, EGG_ORDER, ICON_ORDER, powersOf, effectOf, matchup, strongAgainst, weakAgainst, POWER_ICON_SHEETS, VFX_ORDER, slug } from './roster.js';
import { loadMoods, loadGrid, loadImage, scaled, despill, tinted } from './sprites.js';
import { Battle, W } from './battle.js';
import { Room } from './room.js';
import { MINI_INFO } from './minigames.js';
import { sfx, isMuted, setMuted } from './sfx.js';
import { music } from './music.js';
import * as RK from './ranking.js';
import { playEvolution } from './evolution.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = list => list[Math.floor(Math.random() * list.length)];
const TRAIN_ICON = { pot: 'roca', pun: 'diana', agu: 'escudo', agi: 'rayo' };

let sprites, maps, icons = {}, powerIcons = {}, vfx = {}, decorArt = {}, roomArt = {}, room;
let game = null, battle = null, rival = null, tab = 'care', startPick = 0;

const spriteOf = (species, stage, mood = 0) => sprites[species][stage][mood] || sprites[species][stage][0];   // mood: índice de MOODS
// Cada individuo tiene su propio color: el mismo dibujo con el tono girado.
const petSprite = (pet, mood = 0) => tinted(spriteOf(pet.species, pet.stage, mood), pet.hue || 0);
const hueStyle = pet => (pet.hue ? ` style="filter:hue-rotate(${pet.hue}deg)"` : '');
const eggClass = species => 'egg-' + EGG_ORDER.indexOf(speciesOf(species).element);
const elColor = species => ELEMENT_COLOR[speciesOf(species).element];
const gradeInfo = id => S.GRADES.find(x => x.id === id) || S.GRADES[0];

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
    const [species, stage, hue] = cv.dataset.sprite.split(':');
    paintSprite(cv, tinted(spriteOf(species, +stage), +hue || 0));
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
  for (const [name, cv] of Object.entries(decorArt)) css += `.dc-${name}{background-image:url(${url(cv, 110)})}`;
  for (const [name, cv] of Object.entries(powerIcons)) css += `.pi-${slug(name)}{background-image:url(${url(cv, 96)})}`;
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

function commit() { S.save(game); renderCare(); flushNews(); }

// Enseña de uno en uno los avisos pendientes (misión cumplida, deseo cumplido…).
let newsBusy = false;
function flushNews() {
  if (newsBusy || !game?.news?.length || !$('modal').hidden || !$('evo').hidden) return;
  newsBusy = true;
  toast(game.news.shift());
  sfx.coin();
  $('coins').textContent = game.coins;
  setTimeout(() => { newsBusy = false; flushNews(); }, 2300);
}
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

function birthModal(pet, grade = null) {
  const sp = speciesOf(pet.species);
  modal({
    title: `¡Ha nacido ${pet.name}!`,
    body: `<div class="hatch"><i class="egg-img ${eggClass(sp.id)}"></i><canvas data-sprite="${sp.id}:0:${pet.hue || 0}"></canvas></div>
      <p>Del huevo salió un <b>${esc(sp.name)}</b>, de elemento ${esc(sp.element)}. Lo suyo: ${esc(sp.role.toLowerCase())}.</p>
      ${grade ? `<p>Por cómo cuidaste el huevo nació con categoría <b style="color:${grade.color}">${grade.name}</b>. ${grade.desc}</p>` : ''}
      <p>Frótalo para acariciarlo, arrastra la comida hasta él y lánzale la pelota. Según cómo lo trates crecerá con un carácter u otro.</p>`,
    actions: [{ label: 'Vamos', cls: 'primary' }],
  });
  setTimeout(() => sfx.hatch(), 1150);                 // suena cuando se rompe el cascarón
}

// ---------- Ranking ----------
// De momento no hay servidor: la tabla enseña tu fila y, en modo prueba, unas filas de muestra marcadas como ejemplo.
let rankSort = 'level', rankOthers = [];
function renderRanking() {
  const prof = game.profile, me = { ...RK.myStats(game), name: prof.name || 'Tú (sin usuario)', country: prof.country, me: true };
  if (document.activeElement !== $('rk-name')) $('rk-name').value = prof.name;
  if (!$('rk-country').options.length) $('rk-country').innerHTML = '<option value="">Elige tu país…</option>' + RK.COUNTRIES.map(([code, name]) => `<option value="${code}">${RK.flag(code)} ${name}</option>`).join('');
  if (document.activeElement !== $('rk-country')) $('rk-country').value = prof.country;
  setHTML($('rk-me'), `<span>Nivel <b>${me.level}</b></span><span>Oro <b>${me.coins}</b></span><span>Ganadas <b>${me.wins}</b></span><span>Perdidas <b>${me.losses}</b></span>`);
  const demo = !rankOthers.length && game.testMode, rows = RK.buildBoard([me, ...(demo ? RK.EXAMPLES : rankOthers)], rankSort);
  $('rk-note').textContent = rankOthers.length ? '' : demo
    ? 'Vista previa: todavía no hay servidor ni cuentas. Las filas marcadas «ejemplo» son de muestra para ver cómo quedará; los jugadores reales aparecerán cuando activemos el registro.'
    : 'El ranking mundial todavía no está conectado: de momento solo apareces tú. Se activará con el registro.';
  setHTML($('rk-sorts'), Object.entries(RK.SORTS).map(([k, label]) => `<button class="${k === rankSort ? 'on' : ''}" data-sort="${k}">Por ${label.toLowerCase()}</button>`).join(''));
  const cell = (r, k) => `<span class="num${k === rankSort ? ' key' : ''}">${r[k]}</span>`;
  setHTML($('rk-table'), `<div class="rk-row head"><span>#</span><span>Jugador</span><span class="num">Nivel</span><span class="num">Oro</span><span class="num">Ganadas</span><span class="num">Perdidas</span></div>`
    + rows.map(r => `<div class="rk-row${r.me ? ' me' : ''}${r.demo ? ' demo' : ''}"><span class="pos">${r.rank}</span>
      <span class="who"><i class="flag" title="${esc(RK.countryName(r.country))}">${RK.flag(r.country)}</i><b>${esc(r.name)}</b>${r.me ? '<em>tú</em>' : r.demo ? '<em>ejemplo</em>' : ''}</span>
      ${cell(r, 'level')}${cell(r, 'coins')}${cell(r, 'wins')}<span class="num">${r.losses}</span></div>`).join(''));
}
$('rk-sorts').onclick = e => { const b = e.target.closest('[data-sort]'); if (b) { rankSort = b.dataset.sort; sfx.tap(); renderRanking(); } };
$('rk-save').onclick = () => {
  const name = $('rk-name').value.trim(), country = $('rk-country').value;
  if (!RK.validName(name)) { sfx.error(); return toast('El usuario debe tener de 3 a 16 letras, números o guion bajo, sin espacios.'); }
  if (!country) { sfx.error(); return toast('Elige tu país.'); }
  game.profile = { name, country };
  S.save(game);
  sfx.good();
  toast(`Ficha guardada: ${RK.flag(country)} ${name}`);
  renderRanking();
};

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
  for (const t of ['care', 'battle', 'collection', 'shop', 'ranking', 'settings']) $('tab-' + t).hidden = t !== name;
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
  if (tab === 'shop') renderShop();
  if (tab === 'ranking') renderRanking();
  if (tab === 'settings') {
    $('btn-test').textContent = game.testMode ? 'Desactivar' : 'Activar';
    $('btn-sound').textContent = isMuted() ? 'Activar' : 'Silenciar';
    $('btn-music').textContent = music.isOn() ? 'Apagar' : 'Encender';
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
  const nap = S.sleepLeft(game);
  setHTML($('btn-sleep'), `<i class="ic ic-luna"></i> ${nap ? `Durmiendo… ${duration(nap)}` : p.asleep ? 'Despertar' : 'Acostar a dormir'}`);
  $('btn-sleep').disabled = nap > 0;
  $('sleep-note').textContent = nap ? 'Acaba de dormirse: aún no se la puede despertar.' : p.asleep ? 'Durmiendo: recobra energía y se recupera el doble de rápido.' : '';
  $('sleep-note').hidden = !p.asleep;
  $('btn-sleep').title = p.asleep ? '' : 'Dormida se recupera antes, pero no podrás jugar ni pelear con ella.';
  $('mood-line').textContent = p.asleep ? 'Está durmiendo' : p.hunger < 25 ? 'Tiene hambre' : p.mood < 25 ? 'Está triste' : p.energy < 20 ? 'Está agotado'
    : p.bond < 30 ? 'Aún no confía en ti' : p.mood > 75 && p.hunger > 60 ? '¡Está feliz!' : 'Está bien';

  // Deseo: lo que pide ahora mismo y cuánto queda para cumplirlo
  const wish = p.wish;
  $('wish-line').hidden = !wish;
  if (wish) setHTML($('wish-line'), `<i class="ic ic-${S.WISHES[wish.type].icon}"></i><span>${S.WISHES[wish.type].text}${wish.type === 'pet' ? ` (${wish.got} de 5)` : ''} · ${duration(wish.until - Date.now())}</span>`);

  // Personalidad: la actual y hacia dónde va con el trato de ahora
  const trend = S.trendOf(p), c = p.char && S.CHARS[p.char];
  setHTML($('persona'), (c
    ? `<b class="big" style="--c:${c.color}">${c.name}</b><p>${c.desc}</p>`
    : `<b class="big">Sin definir</b><p>Se decide al evolucionar a Teen, según cómo la trates.</p>`)
    + (trend ? `<p>Con el trato de ahora va camino de ser <span class="tag" style="--c:${S.CHARS[trend].color}">${S.CHARS[trend].name}</span></p>` : '')
    + `<p><b style="color:var(--ink)">Rasgo: ${S.QUIRKS[p.quirk].name}.</b> ${S.QUIRKS[p.quirk].desc}</p>`
    + ((p.grade && p.grade !== 'comun') || S.isRare(p) ? `<p>${p.grade && p.grade !== 'comun' ? `<span class="tag" style="--c:${gradeInfo(p.grade).color}" title="${gradeInfo(p.grade).desc}">Categoría ${gradeInfo(p.grade).name}</span> ` : ''}${S.isRare(p) ? '<span class="tag" style="--c:var(--gold)">Color raro</span>' : ''}</p>` : ''));

  const taste = (label, id, known) => known
    ? `<div class="taste"><i class="ic ic-${id}"></i><span>${S.FOODS[id].name}<small>${label}</small></span></div>`
    : `<div class="taste unknown"><i class="ic ic-estrella"></i><span>¿…?<small>${label}: sin descubrir</small></span></div>`;
  setHTML($('tastes'), taste('Favorita', p.fav, p.favKnown) + taste('La odia', p.hate, p.hateKnown));

  renderTray();

  // Momento de crianza
  if (!eventOpen && Date.now() - lastInput >= idleNeed && !game.pet.asleep) eventOpen = !!S.currentEvent(game);
  const ev = eventOpen ? S.currentEvent(game) : null, card = $('event-card');
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
  $('btn-evolve').hidden = !evo?.ready || !!room.mini || room.editing;
  $('btn-decor').hidden = !game.decor.length || !!room.mini;
  $('btn-decor').textContent = room.editing ? 'Listo' : 'Decorar';
  $('btn-decor').classList.toggle('on', room.editing);
  const evoText = !evo ? 'Ya está en su forma Final.'
    : evo.ready ? `¡${p.name} puede evolucionar! Pulsa el botón dorado de la sala.`
    : `Siguiente forma: ${STAGES[p.stage + 1]}, con nivel ${evo.req.level}` + (game.testMode ? '.' : ` y ${evo.req.days} días de vida${evo.okTime ? '' : ` (faltan ${evo.daysLeft})`}.`);

  const tags = list => (list.length ? list.map(e => `<span class="tag" style="--c:${ELEMENT_COLOR[e]}">${e}</span>`).join(' ') : '—');
  setHTML($('species-info'), `<p><b>${sp.name}</b> <span class="tag" style="--c:${ELEMENT_COLOR[sp.element]}">${sp.element}</span></p>
    <p>${sp.role}.</p>
    <p class="match"><span>Fuerte contra</span>${tags(strongAgainst(sp.element))}</p>
    <p class="match"><span>Débil contra</span>${tags(weakAgainst(sp.element))}</p>
    ${p.mastery ? `<p><b>${S.MASTERY[p.mastery].name}.</b> ${S.MASTERY[p.mastery].desc}</p>` : ''}
    <p class="evo-next">${evoText}</p>`);

  // Poderes: tres de su elemento (por nivel) y el propio de la especie (forma Final)
  const prof = S.profile(p), rest = S.restLeft(p);
  $('mp-max').textContent = `· ${prof.maxMp} MP`;
  setHTML($('powers-info'), powersOf(sp, p).map(pw => `<div class="${pw.unlocked ? '' : 'locked'}" title="${esc(pw.desc)}"><i class="pi pi-${slug(pw.name)}"></i><span><b>${pw.name}</b>
    <small><i>${effectOf(pw)}</i> · ${pw.unlocked ? `${pw.mp} MP` : pw.need}</small></span></div>`).join(''));

  setHTML($('battle-prev'), `<div class="prev-map" style="background-image:url(${maps[0].bg})"><i class="sp sp-${p.species}-${p.stage}"${hueStyle(p)}></i></div>
    <span>Vida <b>${prof.maxHp}</b> · MP <b>${prof.maxMp}</b> · Daño <b>${Math.round(prof.dmg)}</b></span>
    <span>${rest ? `<b class="resting">Recuperándose: ${duration(rest)}</b>` : prof.disobey > 0 ? 'Con tan poco vínculo puede no obedecerte.' : prof.clutch ? 'Aguantará un golpe mortal por ti.' : `${game.wins} ganados · ${game.losses} perdidos`}</span>`);
  renderHeal();

  setHTML($('team'), game.pets.map((m, i) => `<button class="mate${i === game.active ? ' on' : ''}" data-pet="${i}"><i class="sp sp-${m.species}-${m.stage}"${hueStyle(m)}></i>${esc(m.name)}</button>`).join(''));
  setHTML($('missions'), S.dailyMissions(game).map(m => `<div class="mission${m.done ? ' done' : ''}"><span>${m.text}</span>
      <small>${m.done ? 'Cumplida' : `${m.got} de ${m.goal}`} · ${m.coins}<i class="ic ic-moneda"></i></small></div>`).join('')
    + `<p class="muted">${game.missionsBonus ? '¡Las tres cumplidas! Mañana habrá nuevas.' : `Cumple las tres y ganas ${S.MISSION_BONUS} monedas más.`}</p>`);
  renderEggs();

  $('tip').textContent = p.asleep ? `${p.name} está durmiendo. Se despierta sola cuando esté recuperada, o puedes despertarla tú.`
    : rest ? `${p.name} se está recuperando del combate. Si la acuestas a dormir tarda la mitad.`
    : !p.favKnown ? 'Prueba comidas distintas: una es su favorita y otra la odia.'
    : p.bond < 30 ? 'Con el vínculo bajo puede no obedecerte en combate. Acaríciala y juega con ella.'
    : evo?.ready ? `${p.name} está lista para evolucionar: pulsa el botón dorado.`
    : 'Cuanto mejor cuidada y más unida a ti, más MP tiene para sus poderes.';
}

// Botón de curar: aparece mientras la criatura se recupera de un combate.
function renderHeal() {
  const rest = S.restLeft(game.pet);
  for (const b of document.querySelectorAll('.heal-btn')) {
    b.hidden = !rest;
    if (rest) setHTML(b, `<i class="ic ic-botiquin"></i> Curar ahora · ${S.healCost(game)}<i class="ic ic-moneda"></i>`);
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

// Zona de incubación: el huevo elegido, su temperatura, su limpieza y cómo va de cuidado.
let eggPick = 0;
function renderEggs() {
  if (!game) return;
  S.tickEggs(game);
  const n = game.eggs.length, box = $('incubator');
  $('eggs-count').textContent = n ? `${n}/${S.MAX_EGGS}` : '';
  const buy = `<button class="btn buy-egg" data-buy-egg="1"><i class="ic ic-huevomas"></i> Huevo misterioso · ${S.eggPrice(game)}<i class="ic ic-moneda"></i></button>`;
  if (!n) {
    return setHTML(box, `<div class="incu-empty"><div class="incu-dome empty"><i></i></div>
      <div><p><b>No hay huevos incubando.</b></p><p class="muted">Compra uno, o derrota ${S.DEFEATS_FOR_EGG} veces a una especie que no tengas. Tardan ${S.EGG_DAYS} días y hay que cuidarlos.</p>${buy}</div></div>`);
  }
  eggPick = Math.min(eggPick, n - 1);
  const e = game.eggs[eggPick], st = S.eggStatus(game, e), T = S.EGG_TEMP, pos = v => ((v - T.min) / (T.max - T.min)) * 100;
  const glow = st.cold ? '#6fb8ff' : st.hot ? '#ff8a3d' : elColor(e.species);
  const state = st.ready ? '¡Listo para abrir!' : st.ok ? 'Todo correcto' : [st.cold ? 'Tiene frío' : st.hot ? 'Tiene calor' : '', st.dirty ? 'Está sucio' : ''].filter(Boolean).join(' · ');
  const tabs = n > 1 ? `<div class="incu-tabs">${game.eggs.map((x, i) => { const s2 = S.eggStatus(game, x); return `<button class="${i === eggPick ? 'on' : ''}${s2.ready ? ' ready' : s2.ok ? '' : ' warn'}" data-egg-tab="${i}"><i class="egg-img ${eggClass(x.species)}"></i></button>`; }).join('')}</div>` : '';
  setHTML(box, `${tabs}<div class="incu">
    <div class="incu-dome${st.ready ? ' ready' : ''}" data-rub="1" style="--c:${glow}" title="Frota el huevo para limpiarlo"><i class="egg-img ${eggClass(e.species)}"></i><span class="grime" style="opacity:${Math.min(1, e.dirt / 85)}"></span></div>
    <div class="incu-info">
      <p><b>Huevo de ${esc(speciesOf(e.species).element)}</b> <span class="tag" style="--c:${st.ready ? 'var(--gold)' : st.ok ? 'var(--green)' : '#ff7a7a'}">${state}</span></p>
      <div class="incu-row"><span>${st.ready ? 'Incubación completa' : `Día ${st.day} de ${S.EGG_DAYS} · se abre en ${duration(st.left)}`}</span><div class="bar"><i style="width:${Math.min(100, st.progress * 100)}%;background:var(--gold)"></i></div></div>
      <div class="incu-row"><span>Temperatura <b>${e.temp.toFixed(1)} °C</b></span>
        <div class="thermo"><button data-warm="-0.5" ${st.ready ? 'disabled' : ''} aria-label="Enfriar">−</button>
          <div class="gauge"><i class="band" style="left:${pos(T.ideal - T.ok)}%;width:${pos(T.ideal + T.ok) - pos(T.ideal - T.ok)}%"></i><i class="mark" style="left:${pos(e.temp)}%"></i></div>
          <button data-warm="0.5" ${st.ready ? 'disabled' : ''} aria-label="Calentar">+</button></div></div>
      <div class="incu-row"><span>Limpieza${st.dirty ? ' · <b>frota el huevo</b>' : ''}</span><div class="bar"><i style="width:${100 - e.dirt}%;background:${st.dirty ? '#ff7a7a' : 'var(--blue)'}"></i></div></div>
      <p class="incu-care">Bien cuidado el <b>${Math.round(st.care * 100)} %</b> del tiempo · categoría <b style="color:${st.grade.color}" title="${st.grade.desc}">${st.grade.name}</b></p>
      ${st.ready ? '<button class="btn primary" data-hatch="1">¡Abrir el huevo!</button>' : ''}
    </div></div>${n < S.MAX_EGGS ? buy : ''}`);
}

function buyEggNow() {
  const res = S.buyEgg(game);
  if (res.error) { toast(res.error); return sfx.error(); }
  sfx.coin();
  eggPick = game.eggs.length - 1;
  commit();
  toast(`Compraste un huevo de ${speciesOf(res.species).element}. Cuídalo ${S.EGG_DAYS} días: temperatura y limpieza.`);
}
function hatchNow(i) {
  const egg = game.eggs[i];
  if (!egg || !S.eggReady(game, egg)) return toast('Ese huevo aún se está incubando.');
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
      birthModal(game.pet, res.grade);
    } }, closeBtn('Luego')],
  });
}
$('incubator').onclick = e => {
  const t = e.target;
  if (t.closest('[data-buy-egg]')) return buyEggNow();
  if (t.closest('[data-hatch]')) return hatchNow(eggPick);
  const tab = t.closest('[data-egg-tab]');
  if (tab) { eggPick = +tab.dataset.eggTab; sfx.tap(); return renderEggs(); }
  const warm = t.closest('[data-warm]');
  if (warm && S.warmEgg(game, eggPick, +warm.dataset.warm)) { sfx.tap(); S.save(game); renderEggs(); }
};
// Frotar el huevo lo limpia.
let rub = null;
$('incubator').addEventListener('pointerdown', e => { if (e.target.closest('[data-rub]')) { rub = { x: e.clientX, y: e.clientY, d: 0 }; e.preventDefault(); } });
window.addEventListener('pointermove', e => {
  if (!rub) return;
  rub.d += Math.hypot(e.clientX - rub.x, e.clientY - rub.y); rub.x = e.clientX; rub.y = e.clientY;
  if (rub.d < 24) return;
  if (S.cleanEgg(game, eggPick, rub.d * 0.12)) { renderEggs(); if (game.eggs[eggPick].dirt <= 0) { sfx.good(); S.save(game); } }
  rub.d = 0;
});
for (const ev of ['pointerup', 'pointercancel']) window.addEventListener(ev, () => { if (rub) { rub = null; S.save(game); } });

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
  if (!res) return;
  eventOpen = false; idleNeed = idleGap();
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
  if (res.error) { toast(res.error); return sfx.error(); }
  sfx.tap();
  commit();
  if (res.asleep) room.say('Aaah… qué sueño', 2.4);
  else { room.cheer(); room.say('¡Buenos días!'); }
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

// Despensa: la comida que tienes. Se abre con el botón «Comida»; se arrastra hasta la criatura (o se toca para dársela).
let trayOpen = false;
// Momentos de crianza: solo salen cuando llevas un buen rato (10-15 min) con el juego abierto sin tocar nada.
const idleGap = () => (10 + Math.random() * 5) * 60e3;
let lastInput = Date.now(), idleNeed = idleGap(), eventOpen = false;
for (const ev of ['pointerdown', 'keydown', 'wheel']) window.addEventListener(ev, () => { lastInput = Date.now(); }, { capture: true, passive: true });
function renderTray() {
  const owned = Object.keys(S.FOODS).filter(id => game.foods[id] > 0);
  setHTML($('tray'), owned.map(id => `<div class="slot" title="${S.FOODS[id].name}: ${S.FOODS[id].desc}"><i class="ic ic-${id}" data-food="${id}"></i><b>${game.foods[id]}</b></div>`).join('')
    + '<button class="slot more" data-shop="1">+<small>Tienda</small></button>');
  $('food-count').textContent = owned.reduce((n, id) => n + game.foods[id], 0);
  $('btn-food').classList.toggle('on', trayOpen);
}
function buildTray() {
  const ghost = $('ghost');
  let drag = null;
  $('btn-food').onclick = () => { trayOpen = !trayOpen; sfx.tap(); $('btn-food').classList.toggle('on', trayOpen); };
  $('tray').addEventListener('pointerdown', e => {
    if (e.target.closest('[data-shop]')) return switchTab('shop');
    const food = e.target.closest('[data-food]')?.dataset.food;
    if (!food || room.mini) return;
    if (!(game.foods[food] > 0)) return toast(`No te queda ${S.FOODS[food].name.toLowerCase()}.`);
    e.preventDefault();
    drag = { food, sx: e.clientX, sy: e.clientY, moved: false };
    ghost.className = `ic drag-ghost ic-${food}`;
  });
  window.addEventListener('pointermove', e => {
    if (!drag) return;
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 10) drag.moved = true;
    ghost.hidden = !drag.moved;
    $('tray').classList.toggle('dragging', drag.moved);     // se aparta para que veas a la criatura
    ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px';
    room.hover(e);
  });
  const end = e => {
    if (!drag) return;
    const d = drag;
    drag = null; ghost.hidden = true; room.hover(null);
    $('tray').classList.remove('dragging');
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

// Evolución: se guarda cómo estaba, se evoluciona y se reproduce la secuencia con lo que ha cambiado.
function doEvolve() {
  if (!S.evolveStatus(game)?.ready || room.mini) return;
  const p = game.pet, sp = speciesOf(p.species);
  const stats0 = { ...p.stats }, prof0 = S.profile(p);
  const res = S.evolve(game);
  S.save(game);
  const prof1 = S.profile(p), c = S.CHARS[res.char];
  const redeemed = res.prevChar === 'resentido' && res.char !== 'resentido';
  const extras = [];
  if (p.stage === 2) {                                // en la forma Final llega su poder propio y su maestría
    extras.push(`<div class="evo-new"><i class="pi pi-${slug(sp.special.name)}"></i><span><b>Nuevo poder: ${esc(sp.special.name)}</b>${esc(sp.special.desc)}</span></div>`);
    if (res.mastery) extras.push(`<div class="evo-new"><i class="ic ic-trofeo" style="width:40px;height:40px"></i><span><b>${S.MASTERY[res.mastery].name}</b>${S.MASTERY[res.mastery].desc}</span></div>`);
  }
  $('btn-evolve').hidden = true;
  playEvolution({
    name: p.name, stage: STAGES[p.stage], color: ELEMENT_COLOR[sp.element], burst: vfx.destello,
    before: tinted(spriteOf(p.species, p.stage - 1), p.hue || 0), after: petSprite(p),
    stats: [
      ...Object.keys(S.STAT_NAMES).map(k => ({ label: S.STAT_NAMES[k], before: stats0[k], after: p.stats[k] })),
      { label: 'Vida', before: prof0.maxHp, after: prof1.maxHp },
      { label: 'MP', before: prof0.maxMp, after: prof1.maxMp },
    ],
    char: { name: c.name, color: c.color, why: (redeemed ? 'Dejó atrás el rencor. ' : '') + c.why, desc: c.desc },
    extras,
    onDone: () => { renderAll(); room.cheer(); },
  });
}
$('btn-evolve').onclick = doEvolve;
$('btn-decor').onclick = () => {
  room.editing = !room.editing;
  sfx.tap();
  renderCare();
  if (room.editing) toast('Arrastra los muebles para colocarlos. Pulsa «Listo» al terminar.');
};

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
    if (!res.error) commit();
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
  wish: () => (game.pet.wish ? S.WISHES[game.pet.wish.type].icon : null),
  decor: () => game.decor.map(id => ({ ...S.decorAt(game, id), img: decorArt[id] })).filter(d => d.img),
  bedX: () => (game.decor.includes('cama') ? S.decorAt(game, 'cama').x : 0),
  bg: () => roomArt[game.room] || roomArt.sala,
  onMoveDecor: (id, x, y) => S.moveDecor(game, id, x, y),
  onDropDecor: () => S.save(game),
  onUse: id => { if (S.useDecor(game, id)) S.save(game); },
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
  setHTML($('lobby-info'), `<i class="sp sp-${p.species}-${p.stage}"${hueStyle(p)}></i><div><b>${esc(p.name)}</b> · ${sp.name} ${STAGES[p.stage]} · Nivel ${p.level}<br>
    Vida <b>${prof.maxHp}</b> · MP <b>${prof.maxMp}</b> · Daño <b>${Math.round(prof.dmg)}</b><br>
    ${rest ? `<b class="resting">Recuperándose: ${duration(rest)}</b>` : 'Lista para pelear.'}<br>
    Arrastra hacia atrás y suelta para disparar. Con las flechas ◀ ▶ das pasos cortos.</div>`);
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
    body: `<div class="sprites"><figure><canvas data-sprite="${p.species}:${p.stage}:${p.hue || 0}"></canvas>${esc(p.name)} · Nv ${p.level}</figure><span class="versus">VS</span><figure><canvas class="flip" data-sprite="${rival.species}:${rival.stage}:${rival.hue || 0}"></canvas>${esc(rival.name)} · Nv ${rival.level}</figure></div>
      <p>Te enfrentas a <b>${esc(rival.name)}</b>, un ${esc(rsp.name)} de ${esc(rsp.element)}${rival.char ? ` con carácter ${S.CHARS[rival.char].name.toLowerCase()}` : ''}.</p>
      ${out > 1 ? `<p class="adv up">▲ Tu ${sp.element} es eficaz contra ${rsp.element}: le harás más daño.</p>` : out < 1 ? `<p class="adv down">▽ Tu ${sp.element} es poco eficaz contra ${rsp.element}: le harás menos daño.</p>` : ''}
      ${back > 1 ? `<p class="adv down">▼ Su ${rsp.element} es eficaz contra ${sp.element}: te hará más daño.</p>` : back < 1 ? `<p class="adv up">△ Su ${rsp.element} es poco eficaz contra ti.</p>` : ''}
      <p class="muted">${map.effect}</p>`,
    actions: [{ label: '¡A luchar!', cls: 'primary', fn: () => startBattle(map) }, closeBtn('Mejor no')],
  });
}
$('btn-find').onclick = () => challenge();
$('rivals').onclick = e => { const b = e.target.closest('[data-rival]'); if (b && !b.disabled) challenge(b.dataset.rival); };

let powerButtons = [], itemButtons = [], moveButtons = [], hoverItem = '';
// Vista del combate: lejos (se ve todo el campo) o cerca. Se recuerda entre partidas.
let viewFar = true;
try { viewFar = localStorage.getItem('petbound-view') !== 'near'; } catch { /* sin almacenamiento */ }
function setView(far) {
  viewFar = far;
  try { localStorage.setItem('petbound-view', far ? 'far' : 'near'); } catch { /* sin almacenamiento */ }
  battle?.setView(far);
}
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
    return { pet, prof: S.profile(pet), species: sp, sprite: petSprite(pet), sprites: MOODS.map((_, m) => petSprite(pet, m)), powers: powersOf(sp, pet).filter(pw => pw.unlocked) };
  };
  const mine = side(p), VH = Math.round((W * h) / w);
  $('b-powers').innerHTML = mine.powers.map((pw, i) => `<button class="pw" data-power="${i}"><i class="pi pi-${slug(pw.name)}"></i><span class="pw-t"><b>${esc(pw.name)}</b><em>${effectOf(pw)}</em><small>${pw.mp} MP</small></span><span></span></button>`).join('')
    || '<p class="pw-none">Aún sin poderes: el primero llega al nivel 2.</p>';
  powerButtons = [...document.querySelectorAll('#b-powers .pw')];
  $('b-items').innerHTML = Object.entries(S.ITEMS).map(([id, it]) => `<button class="item" data-item="${id}"><i class="ic ic-${it.icon}"></i><b></b></button>`).join('');
  itemButtons = [...$('b-items').children];
  // Lo que tapan los botones de abajo: el suelo del campo se levanta para quedar por encima.
  const box = $('field').getBoundingClientRect(), tops = [$('b-powers'), $('b-items')].map(el => el.getBoundingClientRect()).filter(r => r.height).map(r => r.top);
  const pad = tops.length ? Math.max(0, ((box.bottom - Math.min(...tops)) / box.height) * VH) : 0;
  battle = new Battle($('field'), mine, side(rival), map, { onEnd: endBattle }, VH, w < 520 ? 1.4 : 1, { vfx, icon: name => powerIcons[name] }, pad);
  battle.setView(viewFar, true);
  music.play(map.id);                                 // cada mapa tiene su tema
  moveButtons = [...document.querySelectorAll('#b-move .mv')];
  const tag = f => ` <span class="tag" style="--c:${f.color}">${f.species.element}</span>`;
  $('b-name1').innerHTML = esc(p.name) + tag(battle.player);
  $('b-name2').innerHTML = tag(battle.rival) + ' ' + esc(rival.name);
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
  const mine = battle.canAct(), left = Math.ceil(battle.clock);
  $('b-clock').textContent = mine ? left : '–';
  $('b-clock-box').classList.toggle('hurry', mine && left <= 5);
  $('b-clock-box').classList.toggle('off', !mine);
  powerButtons.forEach((btn, i) => {
    const armed = battle.armed === i;
    btn.disabled = !armed && !battle.canUse(a, i);
    btn.classList.toggle('armed', armed);
    btn.lastElementChild.textContent = a.cds[i] > 0 ? a.cds[i] : '';
  });
  itemButtons.forEach(btn => {
    const n = game.items[btn.dataset.item] || 0;
    btn.lastElementChild.textContent = n;
    btn.disabled = !n || !mine || battle.itemUsed;
  });
  music.tension(battle.phase !== 'over' && (a.hp < a.maxHp * 0.3 || b.hp < b.maxHp * 0.3));   // con alguien al límite, la música aprieta
  moveButtons.forEach(btn => { btn.disabled = !mine || a.fuel <= 0; });
  $('b-view').textContent = viewFar ? 'Ver de cerca' : 'Ver todo el mapa';
  const pw = a.powers[hoverPower >= 0 ? hoverPower : battle.armed];
  $('b-hint').textContent = hoverItem ? `${S.ITEMS[hoverItem].name}: ${S.ITEMS[hoverItem].desc} Uno por turno; no gasta el disparo.`
    : pw && hoverPower >= 0 ? `${pw.name} (${pw.mp} MP): ${pw.desc}`
    : !battle.canAct() ? battle.map.effect
    : pw ? `${pw.name}: ${pw.desc} Si falla, tarda un turno más en volver.`
    : a.frozen ? 'Congelado: este turno no puedes moverte ni ver la guía.'
    : a.blind ? 'Cegado: este turno no ves la guía de tiro.'
    : a.rooted ? 'Inmóvil: este turno no puedes moverte.'
    : a.fuel <= 0 ? 'Arrastra hacia atrás y suelta para disparar. Ya no te quedan pasos este turno.'
    : `Arrastra hacia atrás y suelta para disparar · Pasos cortos: flechas ◀ ▶ o toca a un lado (te quedan ${battle.stepsLeft()})${viewFar ? '' : ' · Toca el minimapa para mirar'}`;
}

function endBattle(win) {
  const p = game.pet, rsp = speciesOf(rival.species);
  const r = S.finishBattle(game, win, rival, battle.player.hp / battle.player.maxHp, battle.stats);
  S.save(game);
  music.stop();
  if (win) sfx.win(); else sfx.lose();
  const hunt = r.egg ? `<p><b>¡Décima victoria contra ${esc(rsp.name)}!</b> Te ganaste su huevo: ya está en tu incubadora.</p>`
    : win && !S.owns(game, rival.species) ? `<p class="muted">Victorias contra ${esc(rsp.name)}: ${Math.min(r.defeats, S.DEFEATS_FOR_EGG)} de ${S.DEFEATS_FOR_EGG} para ganar su huevo.</p>` : '';
  const lines = win
    ? `<p>Le ganaste a <b>${esc(rival.name)}</b> y te quedaste con su botín.</p><p>+${r.exp} EXP · +${r.coins} monedas · sube el vínculo</p>${hunt}`
    : `<p><b>${esc(rival.name)}</b> ganó esta vez${r.stolen ? ` y te robó ${r.stolen} monedas` : ''}.</p><p>+${r.exp} EXP por intentarlo</p>`;
  const up = r.up.levels ? `<p><b>¡${esc(p.name)} subió al nivel ${p.level}!</b> ${r.up.gains.map(k => '+' + S.STAT_NAMES[k]).join(' ')}</p>` : '';
  const rest = `<p>${esc(p.name)} necesita recuperarse: <b>${duration(r.rest)}</b>.</p><p class="muted">Dianas: ${battle.stats.dianas} · Poderes acertados: ${battle.stats.powerHits}</p>`;
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
  return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * battle.VH];   // coordenadas de pantalla; el combate las pasa al campo
};
field.addEventListener('pointerdown', e => { if (battle) { field.setPointerCapture(e.pointerId); battle.pullStart(...toWorld(e)); } });
field.addEventListener('pointermove', e => { if (battle) battle.pullMove(...toWorld(e)); });
field.addEventListener('pointerup', () => battle?.pullEnd());
field.addEventListener('pointercancel', () => { if (battle) { battle.pull = null; battle.pan = false; } });
field.addEventListener('wheel', e => { if (battle) { e.preventDefault(); setView(e.deltaY > 0); } }, { passive: false });   // rueda: alejar o acercar
$('b-view').onclick = () => { setView(!viewFar); sfx.tap(); };
// Pasos: un toque da un paso corto; mantener pulsado sigue andando. También con las flechas del teclado.
$('b-move').addEventListener('pointerdown', e => {
  const b = e.target.closest('[data-move]');
  if (!b || !battle) return;
  e.preventDefault();
  battle.nudge(+b.dataset.move, true);
});
for (const ev of ['pointerup', 'pointercancel', 'blur']) window.addEventListener(ev, () => battle?.release());
window.addEventListener('keydown', e => {
  if (!battle || tab !== 'battle' || e.target.closest?.('input, textarea')) return;
  const dir = e.key === 'ArrowLeft' || e.key === 'a' ? -1 : e.key === 'ArrowRight' || e.key === 'd' ? 1 : 0;
  if (dir) { e.preventDefault(); if (!e.repeat) battle.nudge(dir, true); }
  else if (e.key === 'v' && !e.repeat) setView(!viewFar);
});
window.addEventListener('keyup', e => { if (['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(e.key)) battle?.release(); });
$('b-items').addEventListener('pointerover', e => { hoverItem = e.target.closest('[data-item]')?.dataset.item || ''; });
$('b-items').addEventListener('pointerleave', () => { hoverItem = ''; });
$('b-items').onclick = e => {
  const id = e.target.closest('[data-item]')?.dataset.item;
  if (!id || !battle || !(game.items[id] > 0)) return;
  if (battle.useItem(id)) { S.spendItem(game, id); S.save(game); }
  else toast(battle.itemUsed ? 'Solo un objeto por turno.' : 'Ahora mismo no hace falta.');
};

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

// ---------- Tienda ----------

function renderShop() {
  const good = (icon, name, desc, have, attr, price) => `<div class="good"><i class="ic ic-${icon}"></i><span><b>${name}</b><small>${desc}</small>${have}</span>
    <button class="btn" ${attr}>${price}<i class="ic ic-moneda"></i></button></div>`;
  setHTML($('shop-food'), Object.entries(S.FOODS).map(([id, f]) => good(id, f.name, f.desc, `<small>Llena ${f.hunger} · Tienes ${game.foods[id] || 0}</small>`, `data-buy-food="${id}"`, f.price)).join(''));
  setHTML($('shop-items'), Object.entries(S.ITEMS).map(([id, it]) => good(it.icon, it.name, it.desc, `<small>Tienes ${game.items[id] || 0}</small>`, `data-buy-item="${id}"`, it.price)).join(''));
  setHTML($('shop-rooms'), Object.entries(S.ROOMS).map(([id, r]) => {
    const mine = game.rooms.includes(id), on = game.room === id;
    return `<div class="room-card${on ? ' on' : ''}"><img src="${r.bg}" alt="">${r.name}
      ${on ? '<span class="tag" style="--c:var(--gold)">En uso</span>' : mine ? `<button class="btn" data-use-room="${id}">Usar</button>` : `<button class="btn" data-buy-room="${id}">${r.price}<i class="ic ic-moneda"></i></button>`}</div>`;
  }).join(''));
  setHTML($('shop-decor'), Object.entries(S.DECOR).map(([id, d]) => {
    const owned = game.decor.includes(id);
    return `<div class="good${owned ? ' owned' : ''}"><i class="dc dc-${id}"></i><span><b>${d.name}</b><small>${d.desc}</small><small>${owned ? 'Ya está en tu sala' : ''}</small></span>
      ${owned ? '' : `<button class="btn" data-buy-decor="${id}">${d.price}<i class="ic ic-moneda"></i></button>`}</div>`;
  }).join(''));
  setHTML($('shop-egg'), good('huevomas', 'Huevo misterioso', `Una especie que aún no tienes. Se incuba ${S.EGG_DAYS} días y hay que cuidarlo.`, `<small>Incubando: ${game.eggs.length}</small>`, 'data-buy-egg="1"', S.eggPrice(game)));
}
$('tab-shop').onclick = e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.useRoom) { S.setRoom(game, b.dataset.useRoom); sfx.tap(); S.save(game); return renderAll(); }
  const res = b.dataset.buyRoom ? S.buyRoom(game, b.dataset.buyRoom) : b.dataset.buyFood ? S.buyFood(game, b.dataset.buyFood) : b.dataset.buyItem ? S.buyItem(game, b.dataset.buyItem)
    : b.dataset.buyDecor ? S.buyDecor(game, b.dataset.buyDecor) : b.dataset.buyEgg ? S.buyEgg(game) : null;
  if (!res) return;
  if (res.error) { toast(res.error); return sfx.error(); }
  sfx.coin();
  S.save(game);
  renderAll();
  if (res.species) toast(`Compraste un huevo de ${speciesOf(res.species).element}.`);
  if (b.dataset.buyDecor) toast(`${S.DECOR[b.dataset.buyDecor].name}: ya está en tu sala.`);
};

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
$('btn-music').onclick = () => { music.setOn(!music.isOn()); renderAll(); sfx.tap(); };
document.addEventListener('visibilitychange', () => music.pause(document.hidden));
$('btn-reset').onclick = () => modal({
  title: '¿Empezar de cero?',
  body: '<p>Perderás todas tus criaturas, huevos y monedas. No se puede deshacer.</p>',
  actions: [{ label: 'Sí, borrar todo', cls: 'primary', fn: () => { S.reset(); music.stop(); battle = null; $('arena').hidden = true; $('lobby').hidden = false; showStart(); } }, closeBtn('Cancelar')],
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
      const hideTray = busy || room.editing;
      if ($('btn-food').hidden !== hideTray) $('btn-food').hidden = hideTray;
      if ($('tray').hidden !== (hideTray || !trayOpen)) $('tray').hidden = hideTray || !trayOpen;
      if ($('plate').hidden !== busy) { $('plate').hidden = busy; if (busy) { $('btn-evolve').hidden = true; room.editing = false; } }
    }
    else if (tab === 'battle' && battle) { battle.update(dt); battle.draw(); renderBattle(); }
  }
  requestAnimationFrame(frame);
}

let seconds = 0;
setInterval(() => {
  if (!game?.pet || $('game').hidden) return;
  if (tab === 'battle' && !battle) renderLobby();      // cuenta atrás de la recuperación
  flushNews();
  if (++seconds % 5 === 0) { S.tick(game); S.save(game); }
  if (tab !== 'care') return;
  renderCare();
  const p = game.pet;                                 // de vez en cuando avisa de lo que le falta
  if (seconds % 20 === 0 && !room.mini && !room.bubble && (p.hunger < 25 || p.mood < 25)) room.say(p.hunger < 25 ? 'Tengo hambre…' : 'Estoy triste…', 3);
}, 1000);

try {
  // Barra de carga: avanza con cada imagen que llega.
  let loaded = 0, total = 0;
  const one = promise => { total++; return promise.then(value => { const pct = Math.round((++loaded / total) * 100); $('load-fill').style.width = pct + '%'; $('load-text').textContent = pct + ' %'; $('load-bar').setAttribute('aria-valuenow', pct); return value; }); };
  const tips = ['Lo que come tu criatura decide qué estadística le sube al ganar nivel.', 'Un huevo bien cuidado nace con mejor categoría: vigila su temperatura y límpialo.', 'En combate, tu tiro anterior queda dibujado: corrige sobre él.', 'Cada elemento pega más a unos y menos a otros. Míralo antes de elegir rival.', 'Acariciar, jugar y cumplir deseos sube el vínculo, y con él el MP.'];
  $('load-tip').textContent = tips[Math.floor(Math.random() * tips.length)];
  const [sheetGrids, mapImgs, roomBg, iconGrid, eggGrid, powerGrids, vfxGrid, decorGrid, foodGrid, roomImgs] = await Promise.all([
    Promise.all(ROSTER.map(sp => one(loadMoods(moodSheet(sp.id)).then(grid => [sp.id, grid])))),
    Promise.all(MAPS.map(m => one(loadImage(m.bg).then(img => ({ ...m, img }))))),
    one(loadImage('assets/ui/sala.png')),
    one(loadGrid('assets/ui/objetos.png', 4, 4)),
    one(loadGrid('assets/ui/huevos.png', 4, 4)),
    Promise.all(POWER_ICON_SHEETS.map((_, i) => one(loadGrid(`assets/ui/poderes-${i + 1}.png`, 4, 4, true)))),
    one(loadGrid('assets/ui/efectos.png', 4, 4, 'glow')),
    one(loadGrid('assets/ui/decoracion.png', 4, 4, true)),
    one(loadGrid('assets/ui/comida.png', 4, 4, true)),
    Promise.all(Object.entries(S.ROOMS).map(([id, r]) => one(loadImage(r.bg).then(img => [id, img])))),
  ]);
  sprites = Object.fromEntries(sheetGrids); maps = mapImgs;
  iconGrid.flat().forEach((cv, i) => { icons[ICON_ORDER[i]] = cv; });
  POWER_ICON_SHEETS.forEach((names, s) => powerGrids[s].flat().forEach((cv, i) => {
    if (names[i].startsWith('@')) icons[names[i].slice(1)] = cv; else powerIcons[names[i]] = cv;   // @ = icono suelto de la interfaz
  }));
  vfxGrid.flat().forEach((cv, i) => { vfx[VFX_ORDER[i]] = cv; });
  decorGrid.flat().forEach((cv, i) => { decorArt[S.DECOR_ORDER[i]] = cv; });
  foodGrid.flat().forEach((cv, i) => { icons[S.FOOD_SHEET[i]] = cv; });
  Object.assign(roomArt, Object.fromEntries(roomImgs));
  despill(vfx.destello);                             // el estallido de luz debe quedar blanco y dorado, sin rosa
  injectArt(eggGrid.flat().slice(0, EGG_ORDER.length));
  room = new Room($('room'), { bg: roomBg, icons, sprite: petSprite }, roomHooks);
  buildTray();
  window.petbound = { get game() { return game; }, get room() { return room; }, get battle() { return battle; }, vfx }; // para depurar desde la consola
  game = S.load();
  if (game?.pet) { S.tick(game); enterGame(); } else showStart();
  requestAnimationFrame(frame);
} catch (err) {
  console.error(err);
  $('load-bar').classList.add('failed');
  $('load-text').textContent = 'No se pudo cargar';
  $('load-tip').textContent = 'Alguna imagen no llegó. Revisa tu conexión y recarga la página.';
}
