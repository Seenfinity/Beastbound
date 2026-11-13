// Idiomas. El juego está escrito en español y se traduce al mostrarse: así las reglas, las partidas guardadas
// y el diario siguen en un solo idioma y cambiar de lengua no rompe nada.
//   · watch() traduce todo lo que aparece en la página (textos y atributos como title o placeholder).
//   · tr(texto) traduce una frase suelta: lo usan los lienzos (sala, combate, evolución), que no son HTML.
// Los textos están en lang/*.js como filas [español, inglés, chino]. En la columna de español:
//   {0} es un hueco que también se traduce (un elemento, una comida…), {!0} uno que se deja tal cual
//   (un nombre propio) y {#0} un número.

export const LANGS = [['es', 'Español'], ['en', 'English'], ['zh', '中文']];
const KEY = 'petbound-lang';
const known = code => LANGS.some(l => l[0] === code);
const inBrowser = typeof document !== 'undefined' && !!document.documentElement && typeof navigator !== 'undefined';

function detect() {
  if (!inBrowser) return 'es';                        // pruebas sin pantalla: siempre el idioma original
  try {
    const asked = new URLSearchParams(location.search).get('lang');
    if (known(asked)) { localStorage.setItem(KEY, asked); return asked; }
    const saved = localStorage.getItem(KEY);
    if (known(saved)) return saved;
  } catch { /* sin almacenamiento */ }
  for (const tag of navigator.languages?.length ? navigator.languages : [navigator.language || '']) {
    const code = String(tag).slice(0, 2).toLowerCase();
    if (known(code)) return code;
  }
  return 'en';
}

export const lang = detect();
export const locale = { es: 'es', en: 'en', zh: 'zh-CN' }[lang];

// Guarda el idioma elegido y recarga la página con él.
export function setLang(code) {
  if (!known(code) || code === lang) return;
  try { localStorage.setItem(KEY, code); } catch { /* sin almacenamiento */ }
  const url = new URL(location.href);
  url.searchParams.delete('lang');
  location.replace(url);
}

// ---------- Diccionario ----------

const LETTER = /\p{L}/u;
const exact = new Map(), patterns = [], cache = new Map(), made = new Set();
export const misses = new Set();                      // lo que se mostró sin traducción (para revisar)

if (lang !== 'es') {
  const col = lang === 'en' ? 1 : 2;
  const packs = await Promise.all(['ui', 'datos', 'portada'].map(name => import(`./lang/${name}.js`)));
  for (const row of packs.flatMap(p => p.default)) {
    const key = row[0], value = row[col];
    if (value === undefined) continue;
    if (!/\{[#!]?\d\}/.test(key)) { exact.set(key, value); continue; }
    const order = [], kinds = [];
    let literal = 0;
    const source = key.split(/(\{[#!]?\d\})/).map(part => {
      const hole = /^\{([#!]?)(\d)\}$/.exec(part);
      if (!hole) { literal += part.length; return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
      order.push(+hole[2]); kinds.push(hole[1]);
      return hole[1] === '#' ? '(-?[\\d.,:]+)' : '(.+?)';
    }).join('');
    patterns.push({ re: new RegExp('^' + source + '$', 's'), order, kinds, value, literal, dotted: key.includes('·') });
  }
  patterns.sort((a, b) => b.literal - a.literal);     // primero las frases más concretas
}

const HARD = /(\s*·\s*|\n)/, PLUS = / (?=\+\S)/;
const AFFIX = /^([^\p{L}¡¿«(]*)(.*?)(\s[\d.,:%/\s]*)?$/su;
const COLON = lang === 'zh' ? '：' : ': ';
const lowerFirst = s => (lang === 'en' ? s[0].toLowerCase() + s.slice(1) : s);
const plain = s => {                                  // tal cual, o con la inicial en mayúscula («soporte y protección»)
  const hit = exact.get(s);
  if (hit !== undefined) return hit;
  const first = s[0];
  if (first === first.toUpperCase()) return undefined;
  const cap = exact.get(first.toUpperCase() + s.slice(1));
  return cap === undefined ? undefined : lowerFirst(cap);
};

function look(s, depth = 0) {
  if (!LETTER.test(s)) return s;
  const hit = plain(s);
  if (hit !== undefined) return hit;
  if (depth > 3) return s;
  const dotted = s.includes('·') || s.includes('\n');
  for (const p of patterns) {
    if (dotted && !p.dotted) continue;                // «A · B» se parte antes, salvo que la frase entera tenga su propia traducción
    const m = p.re.exec(s);
    if (!m) continue;
    const values = [];
    p.order.forEach((n, i) => { values[n] = p.kinds[i] ? m[i + 1] : look(m[i + 1], depth + 1); });
    return p.value.replace(/\{(\d)\}/g, (_, n) => values[n] ?? '');
  }
  if (dotted) return s.split(HARD).map((part, i) => (i % 2 ? part : look(part, depth + 1))).join('');   // «Fuego · Baby»
  const colon = s.indexOf(': ');                      // «Favorita: sin descubrir», «Filete: Llena mucho.»
  if (colon > 0) {
    const head = s.slice(0, colon), tail = s.slice(colon + 2), a = look(head, depth + 1), b = look(tail, depth + 1);
    if (a !== head || b !== tail) return a + (a !== head && b !== tail ? COLON : ': ') + b;
  }
  if (PLUS.test(s)) return s.split(PLUS).map(part => look(part, depth + 1)).join(' ');   // «+Potencia +Aguante»
  const a = AFFIX.exec(s);                            // «+1 Potencia», «Potencia 12», «3 ganados», «🇪🇸 España»
  if (a && a[2] && (a[1] || a[3])) {
    const t = plain(a[2]);
    if (t !== undefined) return (lang === 'zh' && a[1] === '. ' ? '。' : a[1]) + t + (a[3] || '');
  }
  if (s.endsWith('.')) {                              // «Soporte y protección.»
    const t = plain(s.slice(0, -1));
    if (t !== undefined) return t + (lang === 'zh' ? '。' : '.');
  }
  return s;
}

export function tr(s) {
  if (lang === 'es' || typeof s !== 'string' || !s) return s;
  if (made.has(s)) return s;                          // ya es una traducción nuestra
  let out = cache.get(s);
  if (out !== undefined) return out;
  const core = s.trim();
  if (!core) return s;
  const start = s.indexOf(core), done = look(core);
  out = s.slice(0, start) + done + s.slice(start + core.length);
  if (done === core && LETTER.test(core)) misses.add(core);
  if (cache.size > 6000) { cache.clear(); made.clear(); }
  cache.set(s, out);
  if (out !== s) made.add(out);
  return out;
}

// ---------- La página ----------

const ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'NOSCRIPT']);
const OURS_ONLY = '[translate="no"], [id^="privy-"], [id^="headlessui-"]';   // nombres propios y la ventana de Privy: no se tocan
const put = new WeakMap();                            // nodo de texto → lo último que escribimos en él

function textNode(node, checked = false) {
  const data = node.data;
  if (put.get(node) === data) return;
  if (!checked) { const p = node.parentElement; if (!p || SKIP.has(p.tagName) || p.closest(OURS_ONLY)) return; }
  const flat = data.replace(/\s+/g, ' '), out = tr(flat);
  if (out !== flat) { put.set(node, out); node.data = out; }
}
function attrs(el) {
  for (const name of ATTRS) {
    const value = el.getAttribute(name);
    if (!value) continue;
    const out = tr(value);
    if (out !== value) el.setAttribute(name, out);
  }
}
function walk(root) {
  if (root.nodeType === 3) return textNode(root);
  if (root.nodeType !== 1 || SKIP.has(root.tagName) || root.closest(OURS_ONLY)) return;
  attrs(root);
  const it = document.createTreeWalker(root, 5, { acceptNode: n => (n.nodeType === 1 && (SKIP.has(n.tagName) || n.matches(OURS_ONLY)) ? 2 : 1) });
  for (let n = it.nextNode(); n; n = it.nextNode()) { if (n.nodeType === 3) textNode(n, true); else attrs(n); }
}

let watching = false;
export function watch() {
  if (!inBrowser || watching) return;
  watching = true;
  const html = document.documentElement;
  html.lang = { es: 'es', en: 'en', zh: 'zh-Hans' }[lang];
  if (lang !== 'es') {
    for (const meta of document.querySelectorAll('meta[name="description"], meta[property="og:title"], meta[property="og:description"]')) {
      const out = tr(meta.content);
      if (out !== meta.content) meta.content = out;
    }
    walk(html);
    new MutationObserver(list => {
      for (const m of list) {
        if (m.type === 'childList') m.addedNodes.forEach(walk);
        else if (m.type === 'characterData') textNode(m.target);
        else if (m.target.nodeType === 1 && !m.target.closest(OURS_ONLY)) attrs(m.target);
      }
    }).observe(html, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  html.classList.remove('i18n-wait');
  // Botones de idioma: cualquier elemento con data-lang cambia la lengua.
  for (const b of document.querySelectorAll('[data-lang]')) {
    b.classList.toggle('on', b.dataset.lang === lang);
    b.setAttribute('aria-pressed', b.dataset.lang === lang);
    b.addEventListener('click', () => setLang(b.dataset.lang));
  }
  if (typeof window !== 'undefined') window.i18n = { lang, tr, misses };
}
