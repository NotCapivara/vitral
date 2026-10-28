/* Vitral — nova guia em vidro para Brave e Chrome. Configurações só no navegador e nenhuma
   telemetria; a rede só é usada pelo que você liga (notícias, mercado, tradução, busca de sites),
   e toda chamada passa por net(), sem cookies nem Referer. */
'use strict';

// ---------- Armazenamento (chrome.storage.local, com fallback p/ testes) ----------
const hasChrome = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
// toda chamada de rede passa por aqui: sem cookies (nenhum site reconhece você pela sessão dele)
// e sem cabeçalho Referer (os sites não ficam sabendo que o pedido veio desta extensão)
const net = (url, opts = {}) => fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer', ...opts });

const store = {
  async get(key) {
    if (hasChrome) return (await chrome.storage.local.get(key))[key];
    try { return JSON.parse(localStorage.getItem(key)); } catch { return undefined; }
  },
  async set(key, val) {
    if (hasChrome) return chrome.storage.local.set({ [key]: val });
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }
};

// ---------- Padrões ----------
const BLOCKS = {
  clock: 'Relógio e data',
  greeting: 'Saudação',
  search: 'Barra de busca',
  shortcuts: 'Atalhos',
  quote: 'Frase do dia',
  notes: 'Notas rápidas',
  todo: 'Tarefas',
  links: 'Lista de links',
  countdown: 'Contagem regressiva',
  news: 'Notícias',
  market: 'Mercado'
};

// tamanho de cada bloco: escala (%), largura (px, fora da grade), colunas da grade (1/3, 2/3, inteira) e extras
const SIZE_DEFAULTS = {
  clock: { scale: 100 },
  greeting: { scale: 100 },
  search: { scale: 100, width: 560 },
  shortcuts: { scale: 100 },
  quote: { scale: 100, width: 620 },
  notes: { scale: 100, width: 720, span: '1', height: 150 },
  todo: { scale: 100, width: 720, span: '1' },
  links: { scale: 100, width: 720, span: '1' },
  countdown: { scale: 100, width: 720, span: '1' },
  news: { scale: 100, width: 1100, span: 'full', cols: 0, img: 76 },
  market: { scale: 100, width: 720, span: '1' }
};

const DEFAULTS = {
  sizes: structuredClone(SIZE_DEFAULTS),
  name: '',
  greetingMode: 'auto',
  greetingText: 'Bem-vindo de volta',
  theme: {
    accent: '#f7931a', text: '#f2f2f2', card: '#ffffff', cardOpacity: 12,
    blur: 12, grain: 0, radius: 14, font: 'system-ui, sans-serif', scale: 100,
    align: 'center', maxWidth: 1100, clockSize: 104, scSize: 56, scCols: 8,
    hideLabels: false, iconStyle: 'favicon',
    gridAlign: 'stretch' // blocos lado a lado na grade: top | stretch (mesma altura) | center | end
  },
  bg: {
    type: 'gradient', color: '#0e0f13', g1: '#0c0d11', g2: '#191b22', g3: '', angle: 160,
    imageUrls: '', rotate: 'random', dim: 0, blurPx: 0
  },
  design: 2,
  glassScale: 2, // v2: Opacidade e Granulado mostram 0–100%, mas o máximo real é 50% (ver applyTheme)
  pickWeb: true,
  clock: { h24: true, seconds: false, showDate: true },
  blocks: [
    { id: 'clock', zone: 'top', on: true },
    { id: 'greeting', zone: 'top', on: true },
    { id: 'search', zone: 'center', on: true },
    { id: 'shortcuts', zone: 'center', on: true },
    { id: 'quote', zone: 'center', on: false },
    { id: 'notes', zone: 'widgets', on: false },
    { id: 'todo', zone: 'widgets', on: false },
    { id: 'links', zone: 'widgets', on: false },
    { id: 'countdown', zone: 'widgets', on: false },
    { id: 'news', zone: 'widgets', on: false },
    { id: 'market', zone: 'widgets', on: false }
  ],
  search: {
    // os padrão guardam só id + ligado/desligado; nome e endereço vêm de BUILTIN_ENGINES
    engines: [
      { id: 'ddg', on: true }, { id: 'google', on: true }, { id: 'brave', on: true },
      { id: 'startpage', on: true }, { id: 'wikipedia', on: true }, { id: 'github', on: true }
    ],
    current: 0, autofocus: true, newTab: false, showPicker: true,
    placeholder: 'Buscar ou digitar endereço…'
  },
  shortcuts: [
    { name: 'YouTube', url: 'https://youtube.com', icon: '' },
    { name: 'GitHub', url: 'https://github.com', icon: '' },
    { name: 'Gmail', url: 'https://mail.google.com', icon: '' },
    { name: 'Proton', url: 'https://proton.me', icon: '' },
    { name: 'Mempool', url: 'https://mempool.space', icon: '' },
    { name: 'Wikipedia', url: 'https://pt.wikipedia.org', icon: '' }
  ],
  linksTitle: 'Links',
  links: 'Mises Brasil | https://mises.org.br\nBitcoin whitepaper | https://bitcoin.org/bitcoin.pdf',
  quotes: 'O curioso papel da economia é demonstrar aos homens o quão pouco eles realmente sabem sobre aquilo que imaginam poder planejar. — F. A. Hayek\nO Estado é a grande ficção através da qual todo mundo se esforça para viver às custas de todo mundo. — Frédéric Bastiat\nDon\'t trust, verify.',
  notes: '',
  todos: [],
  countdown: { label: 'Halving', date: '2028-04-15' },
  news: { enabled: {}, custom: [], bias: {}, cat: {}, count: 12, images: true, summary: true, showBias: true, translate: true, clean: true, maxAge: 7, refresh: 30 },
  // ativos acompanhados no bloco Mercado (símbolos do Yahoo Finance)
  market: { symbols: [{ s: 'BRL=X', name: 'Dólar' }, { s: 'EURBRL=X', name: 'Euro' }, { s: 'BTC-BRL', name: 'Bitcoin' }, { s: '^BVSP', name: 'Ibovespa' }], range: '1d', spark: true, refresh: 5 },
  customCss: ''
};

// Mecanismos fixos: não podem ser editados nem excluídos, só ligados/desligados
const BUILTIN_ENGINES = {
  ddg: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s', host: 'duckduckgo.com' },
  google: { name: 'Google', url: 'https://www.google.com/search?q=%s', host: 'google.com' },
  brave: { name: 'Brave Search', url: 'https://search.brave.com/search?q=%s', host: 'brave.com' },
  startpage: { name: 'Startpage', url: 'https://www.startpage.com/do/search?q=%s', host: 'startpage.com' },
  wikipedia: { name: 'Wikipedia', url: 'https://pt.wikipedia.org/w/index.php?search=%s', host: 'wikipedia.org' },
  github: { name: 'GitHub', url: 'https://github.com/search?q=%s', host: 'github.com' }
};
const urlHost = url => { try { return new URL(url).hostname; } catch { return ''; } };
const builtinIdFor = url => { const h = urlHost(url); return Object.keys(BUILTIN_ENGINES).find(k => h === BUILTIN_ENGINES[k].host || h.endsWith('.' + BUILTIN_ENGINES[k].host)); };
// dados completos de um mecanismo (padrão ou personalizado)
const eng = en => en.id && BUILTIN_ENGINES[en.id]
  ? { ...BUILTIN_ENGINES[en.id], id: en.id, builtin: true, on: en.on !== false }
  : { ...en, on: en.on !== false };
const isOn = en => en.on !== false;
// ligado e com endereço válido (os que você adiciona precisam de %s)
const usable = en => { const e = eng(en); return e.on && !!e.url && e.url.includes('%s') && !!urlHost(e.url); };
// mecanismo atual; se não der para usar, o primeiro utilizável; em último caso, o DuckDuckGo
const currentEngine = s => eng([s.engines[+s.current], ...s.engines].find(en => en && usable(en)) || { id: 'ddg' });

// parece um endereço (exemplo.com, localhost:3000, 192.168.0.1) e não uma busca?
const looksLikeAddress = q => !/\s/.test(q) && (
  /^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?(\/\S*)?$/i.test(q) ||
  /^[\w-]+(\.[\w-]+)*\.[a-z][a-z0-9-]+(:\d+)?(\/\S*)?$/i.test(q));
const addressUrl = q => (/^(localhost|\d)/i.test(q) ? 'http://' : 'https://') + q;
// já tem esquema (https://, mailto:, ...)?
const hasScheme = url => /^([a-z][\w+.-]*:\/\/|mailto:|data:|javascript:)/i.test(url);
// número do dia no fuso local (a frase e a imagem "diária" trocam à meia-noite, não às 21h)
const dayIndex = () => { const d = new Date(); return Math.floor((d - d.getTimezoneOffset() * 6e4) / 864e5); };

// Garante que os 6 padrão sempre existam (sem duplicar) e que o padrão escolhido esteja ligado.
// Converte configurações antigas (nome + url) mantendo a ordem e o mecanismo escolhido.
function normalizeEngines(s) {
  const old = Array.isArray(s.engines) ? s.engines : [];
  const chosen = old[+s.current];
  const keyOf = en => en && (en.id && BUILTIN_ENGINES[en.id] ? en.id : builtinIdFor(en.url));
  const chosenKey = keyOf(chosen);
  const out = [];
  let chosenIdx = -1;
  for (const en of old) {
    const id = keyOf(en);
    if (id) {
      if (out.some(o => o.id === id)) continue;
      out.push({ id, on: isOn(en) });
    } else out.push({ name: en.name || '', url: en.url || '', on: isOn(en) });
    if (en === chosen) chosenIdx = out.length - 1;
  }
  for (const id of Object.keys(BUILTIN_ENGINES)) if (!out.some(o => o.id === id)) out.push({ id, on: true });
  if (chosenIdx < 0 && chosenKey) chosenIdx = out.findIndex(o => o.id === chosenKey);
  if (!out.some(isOn)) out[0].on = true;
  if (chosenIdx < 0 || !isOn(out[chosenIdx])) chosenIdx = out.findIndex(isOn);
  s.engines = out;
  s.current = chosenIdx;
}

let cfg;
const $ =(s, el = document) => el.querySelector(s);
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null) el.append(kid.nodeType ? kid : document.createTextNode(kid));
  return el;
};

function merge(base, over) {
  if (Array.isArray(base)) return Array.isArray(over) ? over : base;
  if (base && typeof base === 'object') {
    const out = { ...base };
    for (const k in over || {}) out[k] = k in base ? merge(base[k], over[k]) : over[k];
    return out;
  }
  return over === undefined ? base : over;
}

// salva com um pequeno atraso; "flush" grava na hora (ao fechar a guia, nada se perde)
let saveTimer = null, lastWritten = [];
// o navegador devolve o que foi salvo com as chaves em ordem alfabética: para reconhecer
// a própria gravação, compara sempre na mesma ordem (senão a página inteira redesenhava a cada clique)
const sameOrder = v => Array.isArray(v) ? v.map(sameOrder)
  : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sameOrder(v[k])])) : v;
const snapshot = v => JSON.stringify(sameOrder(v));
function flush() {
  clearTimeout(saveTimer); saveTimer = null;
  // guarda as últimas gravações: cliques rápidos geram várias, e o aviso de cada uma chega depois
  lastWritten = [snapshot(cfg), ...lastWritten].slice(0, 5);
  return store.set('cfg', cfg);
}
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 250);
}

// ---------- Tema e fundo ----------
function hexToRgba(hex, alpha) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${n >> 16 & 255}, ${n >> 8 & 255}, ${n & 255}, ${alpha})`;
}

// granulado do vidro: ruído fino por cima do desfoque (0 = desligado). A intensidade vira
// a opacidade do ruído; ele também desfaz as faixas de cor do desfoque em fundos escuros.
function grainImage(level) {
  const k = Math.max(0, Math.min(100, +level || 0)) / 100;
  if (!k) return 'none';
  const a = (0.04 + k * 0.5).toFixed(3), b = (-(0.01 + k * 0.17)).toFixed(3);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 ${a} ${b}'/></filter><rect width='160' height='160' filter='url(%23n)'/></svg>`;
  return `url("data:image/svg+xml,${svg.replace(/</g, '%3C').replace(/>/g, '%3E')}")`;
}

async function applyTheme() {
  const t = cfg.theme, r = document.documentElement.style;
  r.setProperty('--accent', t.accent);
  r.setProperty('--text', t.text);
  // Opacidade e Granulado: o controle vai de 0 a 100%, que equivale a 0–50% de verdade (ajuste mais fino)
  r.setProperty('--card', hexToRgba(t.card, t.cardOpacity / 200));
  r.setProperty('--card-blur', t.blur + 'px');
  r.setProperty('--grain', grainImage(t.grain / 2));
  r.setProperty('--radius', t.radius + 'px');
  r.setProperty('--font', t.font);
  r.setProperty('--scale', t.scale / 100);
  r.setProperty('--max-width', t.maxWidth + 'px');
  r.setProperty('--clock-size', t.clockSize + 'px');
  r.setProperty('--sc-size', t.scSize + 'px');
  r.setProperty('--sc-cols', t.scCols);
  document.body.classList.toggle('align-center', t.align === 'center');
  document.body.classList.toggle('align-top', t.align === 'top');
  document.body.classList.toggle('hide-labels', t.hideLabels);
  r.setProperty('--grid-align', t.gridAlign === 'top' ? 'start' : t.gridAlign || 'stretch');
  document.body.classList.toggle('grid-stretch', (t.gridAlign || 'stretch') === 'stretch');
  $('#custom-css').textContent = cfg.customCss || '';
  await applyBackground();
}

let bgChosen = null; // mantém a mesma imagem durante a sessão da aba
async function applyBackground() {
  const b = cfg.bg, bg = $('#bg');
  bg.style.background = '';
  bg.style.filter = b.blurPx ? `blur(${b.blurPx}px)` : '';
  $('#dim').style.background = `rgba(0,0,0,${b.dim / 100})`;

  if (b.type === 'solid') bg.style.background = b.color;
  else if (b.type === 'gradient') {
    const stops = [b.g1, b.g2, b.g3].filter(Boolean).join(', ');
    bg.style.background = `linear-gradient(${b.angle}deg, ${stops})`;
  } else if (b.type === 'image') {
    const uploaded = (await store.get('images')) || [];
    const urls = b.imageUrls.split('\n').map(s => s.trim()).filter(Boolean);
    const pool = [...uploaded, ...urls];
    if (!pool.length) { bg.style.background = b.color; return; }
    let idx;
    if (b.rotate === 'first') idx = 0;
    else if (b.rotate === 'daily') idx = dayIndex() % pool.length;
    else idx = bgChosen != null && bgChosen < pool.length ? bgChosen : Math.floor(Math.random() * pool.length);
    bgChosen = idx;
    const src = String(pool[idx]).replace(/["\\\n]/g, c => encodeURIComponent(c));
    bg.style.background = `${b.color} url("${src}") center / cover no-repeat`;
  }
}

// ---------- Blocos ----------
function svgIcon() {
  const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('class', 'ico');
  svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '2');
  svg.innerHTML = '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>';
  return svg;
}

// ícones dos mecanismos guardados dentro da extensão (pasta icons/), sem depender da internet
const ENGINE_ICONS = [
  ['brave.com', 'brave.svg'],
  ['duckduckgo.com', 'duckduckgo.png', true],
  ['google.com', 'google.png'],
  ['startpage.com', 'startpage.png'],
  ['wikipedia.org', 'wikipedia.png', true],
  ['github.com', 'github.svg']
];
function engineIcon(en) {
  let host = '';
  try { host = new URL(en.url).hostname; } catch {}
  const hit = ENGINE_ICONS.find(([d]) => host === d || host.endsWith('.' + d));
  if (!hit) return h('span', { class: 'eng-ic letter' }, (en.name || '?')[0].toUpperCase());
  return h('span', { class: 'eng-ic' + (hit[2] ? ' full' : '') }, h('img', { alt: '', src: 'icons/' + hit[1] }));
}

const renderers = {
  clock() {
    const wrap = h('div', { class: 'block-clock', style: 'text-align:center' });
    const time = h('div', { class: 'clock' });
    const date = h('div', { class: 'date' });
    const tick = () => {
      const d = new Date();
      time.textContent = d.toLocaleTimeString('pt-BR', {
        hour: '2-digit', minute: '2-digit',
        second: cfg.clock.seconds ? '2-digit' : undefined,
        hour12: !cfg.clock.h24
      });
      date.textContent = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    };
    tick();
    clearInterval(renderers._clockTimer);
    renderers._clockTimer = setInterval(tick, 1000);
    wrap.append(time);
    if (cfg.clock.showDate) wrap.append(date);
    return wrap;
  },

  greeting() {
    const compose = () => {
      let text = cfg.greetingText;
      if (cfg.greetingMode === 'auto') {
        const hr = new Date().getHours();
        text = hr < 5 ? 'Boa madrugada' : hr < 12 ? 'Bom dia' : hr < 18 ? 'Boa tarde' : 'Boa noite';
      }
      return cfg.name ? `${text}, ${cfg.name}.` : `${text}.`;
    };
    const el = h('div', { class: 'greeting' }, compose());
    // a guia pode ficar aberta por horas: atualiza "bom dia/boa tarde" sozinha
    clearInterval(renderers._greetTimer);
    renderers._greetTimer = setInterval(() => { const t = compose(); if (el.textContent !== t) el.textContent = t; }, 60000);
    return el;
  },

  search() {
    const s = cfg.search;
    const input = h('input', { type: 'text', placeholder: s.placeholder, autocomplete: 'off', spellcheck: 'false' });
    const form = h('form', { class: 'search', onsubmit: e => {
      e.preventDefault();
      const q = input.value.trim();
      if (!q) return;
      let url;
      if (/^[a-z][\w+.-]*:\/\//i.test(q)) url = q;
      else if (looksLikeAddress(q)) url = addressUrl(q);
      else url = currentEngine(s).url.replace('%s', encodeURIComponent(q));
      if (s.newTab) window.open(url, '_blank'); else location.href = url;
    } }, svgIcon(), input);
    const enabled = s.engines.map((en, i) => [eng(en), i]).filter(([en]) => usable(en));
    if (s.showPicker && enabled.length > 1) {
      // menu próprio de vidro no lugar do <select> nativo; só os mecanismos ligados
      const cur = currentEngine(s);
      const btn = h('button', { type: 'button', class: 'engine-btn', 'aria-haspopup': 'listbox', title: cur.name }, engineIcon(cur), icon('down'));
      const menu = h('div', { class: 'engine-menu', role: 'listbox', hidden: true });
      enabled.forEach(([en, i]) => menu.append(h('button', {
        type: 'button', role: 'option', class: i === +s.current ? 'on' : '', title: en.name, 'aria-label': en.name,
        onclick: e => {
          s.current = i; save();
          btn.firstChild.replaceWith(engineIcon(en)); btn.title = en.name;
          menu.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === e.currentTarget));
          menu.hidden = true; input.focus();
        }
      }, engineIcon(en))));
      btn.addEventListener('click', () => { menu.hidden = !menu.hidden; });
      form.addEventListener('focusout', e => { if (!form.contains(e.relatedTarget)) menu.hidden = true; });
      form.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { e.stopPropagation(); menu.hidden = true; input.focus(); } });
      form.append(btn, menu);
    }
    // só ao abrir a guia; nos re-renders (ex.: digitando nas configurações) não rouba o foco
    if (s.autofocus && !booted) requestAnimationFrame(() => input.focus());
    return form;
  },

  shortcuts() {
    const grid = h('div', { class: 'shortcuts' });
    let dragFrom = null;
    cfg.shortcuts.forEach((sc, i) => {
      const tile = h('div', { class: 'tile' });
      if (sc.icon && /^(https?:|data:)/.test(sc.icon)) tile.append(h('img', { src: sc.icon, alt: '' }));
      else if (sc.icon) tile.textContent = sc.icon;
      else if (cfg.theme.iconStyle === 'favicon' && hasChrome) {
        const img = h('img', { alt: '', src: `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(sc.url)}&size=64` });
        tile.append(img);
      } else tile.textContent = (sc.name || '?')[0].toUpperCase();

      const a = h('a', { class: 'sc', href: sc.url, draggable: 'true' }, tile, h('span', {}, sc.name));
      a.addEventListener('dragstart', () => { dragFrom = i; a.classList.add('dragging'); });
      a.addEventListener('dragend', () => a.classList.remove('dragging'));
      a.addEventListener('dragover', e => e.preventDefault());
      a.addEventListener('drop', e => {
        e.preventDefault();
        if (dragFrom == null || dragFrom === i) return;
        const [moved] = cfg.shortcuts.splice(dragFrom, 1);
        cfg.shortcuts.splice(i, 0, moved);
        save(); render(); syncPanel('atalhos');
      });
      grid.append(a);
    });
    return grid;
  },

  quote() {
    const list = cfg.quotes.split('\n').map(s => s.trim()).filter(Boolean);
    if (!list.length) return null;
    const pick = list[dayIndex() % list.length];
    const [text, author] = pick.split(' — ');
    return h('div', { class: 'quote' }, `“${text}”`, author ? h('small', {}, '— ' + author) : null);
  },

  notes() {
    const ta = h('textarea', { class: 'notes', placeholder: 'Escreva aqui… (salvo localmente)' });
    ta.value = cfg.notes;
    ta.addEventListener('input', () => { cfg.notes = ta.value; save(); });
    return h('div', { class: 'card' }, h('h4', {}, 'Notas'), ta);
  },

  todo() {
    // mexer numa tarefa só mexe nela (antes a página inteira era redesenhada a cada clique)
    const ul = h('ul', { class: 'todo-list' });
    const item = (t, fresh) => {
      const cb = h('input', { type: 'checkbox', checked: t.done, onchange: () => { t.done = cb.checked; li.classList.toggle('done', t.done); save(); } });
      const li = h('li', { class: (t.done ? 'done' : '') + (fresh ? ' fresh' : '') }, cb, h('span', {}, t.text),
        h('button', { title: 'Remover', onclick: () => {
          const i = cfg.todos.indexOf(t);
          if (i >= 0) cfg.todos.splice(i, 1);
          save();
          li.classList.add('leaving');
          setTimeout(() => { li.remove(); fitSoon(); }, calmMotion.matches ? 0 : 260);
        } }, '✕'));
      return li;
    };
    cfg.todos.forEach(t => ul.append(item(t)));
    const add = h('input', { class: 'todo-add', placeholder: '+ nova tarefa (Enter)' });
    add.addEventListener('keydown', e => {
      if (e.key === 'Enter' && add.value.trim()) {
        const t = { text: add.value.trim(), done: false };
        cfg.todos.push(t); save();
        ul.append(item(t, true)); add.value = ''; fitSoon();
      }
    });
    return h('div', { class: 'card' }, h('h4', {}, 'Tarefas'), ul, add);
  },

  links() {
    const items = cfg.links.split('\n').map(l => l.split('|').map(s => s.trim())).filter(p => p[1]);
    return h('div', { class: 'card' }, h('h4', {}, cfg.linksTitle),
      h('div', { class: 'links-list' }, items.map(([n, u]) => h('a', { href: u }, n))));
  },

  countdown() {
    const target = new Date(cfg.countdown.date + 'T00:00:00');
    const days = Math.ceil((target - new Date()) / 864e5);
    const dias = n => n === 1 ? '1 dia' : `${n} dias`;
    const txt = isNaN(days) ? '—' : days > 0 ? dias(days) : days === 0 ? 'Hoje' : `há ${dias(-days)}`;
    return h('div', { class: 'card countdown' }, h('h4', {}, cfg.countdown.label), h('div', { class: 'big' }, txt));
  },

  news() {
    // mostra na hora o que já está guardado e atualiza em segundo plano quando passa do tempo
    const card = h('div', { class: 'card news' });
    fillNews(card);
    return card;
  },

  market() {
    const card = h('div', { class: 'card market' });
    fillMarket(card);
    return card;
  }
};

let booted = false;
function render() {
  for (const z of ['top', 'center', 'widgets']) $('#' + z).replaceChildren();
  let order = 0;
  for (const b of cfg.blocks) {
    if (!b.on || !renderers[b.id]) continue;
    const el = renderers[b.id]();
    if (el) { applyBlockSize(el, b); el.style.setProperty('--i', order++); $('#' + b.zone).append(el); }
  }
  // ao abrir a guia, os blocos entram em sequência (só na primeira vez; ajustes depois não reanimam)
  if (!booted) {
    document.body.classList.add('entering');
    setTimeout(() => document.body.classList.remove('entering'), 1000);
  }
  booted = true;
  fitSoon();
}

// Tudo numa tela só: a página não rola, então tira as notícias mais antigas até o conteúdo caber.
// ("Quantidade" vira o máximo; numa tela menor aparecem menos.)
function fitToScreen() {
  const app = $('#app'), card = $('.card.news'), list = card && card.querySelector('.news-list');
  if (!app) return;
  app.style.setProperty('--fit-zoom', 1);
  // a página inteira encolhe um pouco (até 70%) quando mesmo assim não cabe
  const shrink = () => { for (let z = 95; z >= 70 && app.scrollHeight > app.clientHeight + 1; z -= 5) app.style.setProperty('--fit-zoom', z / 100); };
  // o Mercado também se compacta (linhas mais juntas) antes de a página encolher
  const market = $('.card.market');
  if (market) market.dataset.fit = 0;
  const compactMarket = () => { if (market) for (let lv = 1; lv <= 2 && app.scrollHeight > app.clientHeight + 1; lv++) market.dataset.fit = lv; };
  if (!list) { compactMarket(); return shrink(); }
  const all = [...list.children], spares = all.filter(i => i.hasAttribute('data-spare')), items = all.filter(i => !i.hasAttribute('data-spare'));
  items.forEach(i => { i.hidden = false; });
  spares.forEach(i => { i.hidden = true; });
  // preenche o espaço que sobrar com as notícias de reserva, na ordem, enquanto couberem
  const fill = () => {
    for (const i of spares) {
      const before = height(), fitted = !over();
      i.hidden = false;
      if (height() > before || (fitted && over()) || card.scrollHeight > card.clientHeight + 1) { i.hidden = true; break; }
    }
  };
  card.dataset.fit = 0;
  // altura travada (troca de fonte): o que não couber no bloco sai, como se fosse a tela
  card.style.height = card.dataset.lockH ? card.dataset.lockH + 'px' : '';
  const height = () => app.scrollHeight;
  const over = () => app.scrollHeight > app.clientHeight + 1 || (card.dataset.lockH && card.scrollHeight > card.clientHeight + 1);
  if (!over()) return fill();
  // Cada passo só vale se de fato diminuir a página. Quando quem estica a linha é outro bloco
  // (ex.: um Mercado comprido ao lado), tirar notícias não adianta nada e só deixaria o bloco
  // vazio: nesse caso o passo é desfeito e as notícias ficam.
  const helps = (apply, undo) => {
    const before = height(), lockOver = card.dataset.lockH && card.scrollHeight > card.clientHeight + 1;
    apply();
    const lockNow = card.dataset.lockH && card.scrollHeight > card.clientHeight + 1;
    if (height() < before || (lockOver && !lockNow) || !over()) return true;
    undo(); return false;
  };
  // ordem de saída: maior posição na fonte primeiro (as "extras"); entre iguais, a mais antiga
  const order = items.slice().sort((a, b) => (+b.dataset.rank || 0) - (+a.dataset.rank || 0) || (+a.dataset.date || 0) - (+b.dataset.date || 0));
  const extras = order.filter(i => +i.dataset.rank > 0), firsts = order.filter(i => !(+i.dataset.rank > 0));
  const removed = [];
  const drop = i => helps(() => { i.hidden = true; }, () => { i.hidden = false; }) && removed.push(i);
  // 1) tira as notícias extras (2ª, 3ª… de uma mesma fonte)
  for (const i of extras) { if (!over()) break; drop(i); }
  // 2) compacta: resumo com 3, 2, 1 linha; sem resumo e imagem menor; sem imagem
  for (let level = 1; level <= 5 && over(); level++) {
    const prev = card.dataset.fit;
    if (!helps(() => { card.dataset.fit = level; }, () => { card.dataset.fit = prev; })) break;
  }
  // 3) último recurso: some a notícia mais antiga entre as primeiras de cada fonte
  for (let k = 0; k < firsts.length - 1 && over(); k++) drop(firsts[k]);
  compactMarket();
  shrink();
  // 4) sobrou espaço no bloco (ele ficou da altura do vizinho)? primeiro desfaz a compactação
  // (resumos voltam), depois devolve notícias até preencher
  for (let lv = +card.dataset.fit - 1; lv >= 0; lv--) {
    const before = height(), fitted = !over(), prev = card.dataset.fit;
    card.dataset.fit = lv;
    if (height() > before || (fitted && over()) || card.scrollHeight > card.clientHeight + 1) { card.dataset.fit = prev; break; }
  }
  for (const i of removed.reverse()) {
    const before = height(), fitted = !over();
    i.hidden = false;
    if (height() > before || (fitted && over()) || card.scrollHeight > card.clientHeight + 1) { i.hidden = true; return; }
  }
  if (!removed.length) fill();
  // 5) ainda sobra um vão menor que uma notícia? tenta encaixar mais uma resumindo um pouco mais
  //    (até resumo de 1 linha); se nem assim couber, deixa como estava
  for (const i of [...removed, ...spares].filter(x => x.hidden)) {
    const before = height(), fitted = !over(), prev = +card.dataset.fit;
    i.hidden = false;
    const bad = () => height() > before || (fitted && over()) || card.scrollHeight > card.clientHeight + 1;
    let lv = prev;
    while (bad() && lv < 3) card.dataset.fit = ++lv;
    if (bad()) { i.hidden = true; card.dataset.fit = prev; break; }
  }
  if (over()) shrink(); // o que voltou para preencher não pode fazer a página passar da tela
}let fitTimer;
const fitSoon = () => { cancelAnimationFrame(fitTimer); fitTimer = requestAnimationFrame(fitToScreen); };
addEventListener('resize', () => { const c = $('.card.news'); if (c) delete c.dataset.lockH; fitSoon(); });

// aplica o tamanho escolhido para o bloco (ver SIZE_DEFAULTS)
function applyBlockSize(el, b) {
  const s = cfg.sizes[b.id] || {};
  el.dataset.block = b.id;
  el.style.setProperty('--b-scale', (s.scale || 100) / 100);
  if (b.zone === 'widgets') el.dataset.span = s.span || '1';
  else if (s.width) { el.style.width = `min(100%, ${s.width}px)`; el.style.maxWidth = 'none'; }
  if (b.id === 'shortcuts') el.style.setProperty('--sc-size', cfg.theme.scSize * (s.scale || 100) / 100 + 'px');
  if (s.height) el.style.setProperty('--notes-h', s.height + 'px');
  if (b.id === 'news') {
    el.style.setProperty('--news-img', (s.img || 76) + 'px');
    el.style.setProperty('--news-cols', s.cols || 1);
    el.classList.toggle('fixed-cols', +s.cols > 0);
  }
}

// ---------- Editor de atalhos ----------
// atualiza a aba do painel se ela estiver aberta (as posições da lista mudam ao excluir/mover)
function syncPanel(tab) { if (!$('#panel').hidden && currentTab === tab) refresh(); }

function editShortcut(i) {
  const dlg = $('#sc-dialog'), f = $('#sc-form');
  const sc = i >= 0 ? cfg.shortcuts[i] : { name: '', url: '', icon: '' };
  // ícone guardado (data:) é enorme: não mostra no campo; vazio = mantém o guardado
  const savedIcon = /^data:/.test(sc.icon || '') ? sc.icon : '';
  $('#sc-title').textContent = i >= 0 ? 'Editar atalho' : 'Novo atalho';
  f.name.value = sc.name; f.url.value = sc.url; f.icon.value = savedIcon ? '' : sc.icon || '';
  f.icon.placeholder = savedIcon ? 'Ícone salvo (vazio = manter)' : 'Emoji ou link (opcional)';
  $('#sc-delete').hidden = i < 0;
  $('#sc-delete').onclick = () => { cfg.shortcuts.splice(i, 1); save(); render(); dlg.returnValue = ''; dlg.close(); syncPanel('atalhos'); };
  dlg.onclose = () => {
    if (dlg.returnValue === 'ok') {
      let url = f.url.value.trim();
      if (!hasScheme(url)) url = (looksLikeAddress(url) ? addressUrl(url) : 'https://' + url);
      const item = { name: f.name.value.trim(), url, icon: f.icon.value.trim() || savedIcon };
      if (i >= 0) cfg.shortcuts[i] = item; else cfg.shortcuts.push(item);
      save(); render();
    }
    syncPanel('atalhos');
  };
  dlg.returnValue = '';
  dlg.showModal();
}

// ---------- Adicionar favoritos por busca ----------
// Busca no histórico e nos favoritos do próprio navegador (tudo local) e numa lista fixa de sites conhecidos.
const POPULAR = [
  ['YouTube', 'https://www.youtube.com'], ['Gmail', 'https://mail.google.com'], ['WhatsApp', 'https://web.whatsapp.com'],
  ['Instagram', 'https://www.instagram.com'], ['X', 'https://x.com'], ['Reddit', 'https://www.reddit.com'],
  ['GitHub', 'https://github.com'], ['ChatGPT', 'https://chatgpt.com'], ['Claude', 'https://claude.ai'],
  ['Netflix', 'https://www.netflix.com'], ['Spotify', 'https://open.spotify.com'], ['Twitch', 'https://www.twitch.tv'],
  ['LinkedIn', 'https://www.linkedin.com'], ['Wikipedia', 'https://pt.wikipedia.org'], ['Amazon', 'https://www.amazon.com.br'],
  ['Mercado Livre', 'https://www.mercadolivre.com.br'], ['Proton Mail', 'https://mail.proton.me'], ['Outlook', 'https://outlook.live.com'],
  ['Google Drive', 'https://drive.google.com'], ['Google Agenda', 'https://calendar.google.com'], ['Google Maps', 'https://maps.google.com'],
  ['Google Tradutor', 'https://translate.google.com'], ['Notion', 'https://www.notion.so'], ['Figma', 'https://www.figma.com'],
  ['Discord', 'https://discord.com/app'], ['Telegram', 'https://web.telegram.org'], ['Mempool', 'https://mempool.space'],
  ['TradingView', 'https://www.tradingview.com'], ['Primal', 'https://primal.net'], ['Hacker News', 'https://news.ycombinator.com'],
  ['Stack Overflow', 'https://stackoverflow.com'], ['Canva', 'https://www.canva.com'], ['Pinterest', 'https://www.pinterest.com'],
  ['Facebook', 'https://www.facebook.com'], ['TikTok', 'https://www.tiktok.com'], ['Globo', 'https://www.globo.com'],
  ['UOL', 'https://www.uol.com.br'], ['Mises Brasil', 'https://mises.org.br'], ['Duolingo', 'https://www.duolingo.com'],
  ['Kindle', 'https://read.amazon.com']
];
const bareHost = url => urlHost(url).replace(/^www\./, '');
const normUrl = url => { try { const u = new URL(url); return u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/+$/, ''); } catch { return ''; } };
const prettyHost = url => { const l = bareHost(url).split('.'); const w = l.length > 2 && l[0].length > 3 ? l[0] : l[l.length - 2] || l[0] || ''; return w.charAt(0).toUpperCase() + w.slice(1); };
// nome curto: o da lista conhecida; senão um título curto; senão o nome do domínio
function siteName(url, title = '') {
  const known = POPULAR.find(([, u]) => normUrl(u) === normUrl(url));
  if (known) return known[0];
  const t = title.trim();
  return t && t.length <= 24 && !/ [-|–·] /.test(t) ? t : prettyHost(url);
}

async function pickSearch(raw) {
  const q = raw.trim().toLowerCase(), items = [], seen = new Set();
  const add = (url, title, kind) => {
    const key = normUrl(url);
    if (!key || seen.has(key) || !/^https?:/.test(url)) return;
    seen.add(key); items.push({ url, name: siteName(url, title), kind });
  };
  if (looksLikeAddress(q)) add(addressUrl(q), '', 'typed');
  try {
    if (!q) {
      if (hasChrome && chrome.topSites) for (const t of await chrome.topSites.get()) add(t.url, t.title, 'top');
      POPULAR.forEach(([n, u]) => add(u, n, 'popular'));
      return items;
    }
    if (hasChrome && chrome.bookmarks) (await chrome.bookmarks.search(q)).filter(b => b.url).slice(0, 12).forEach(b => add(b.url, b.title, 'bookmark'));
    if (hasChrome && chrome.history) {
      // agrupa o histórico por site e ordena pelos mais visitados
      const sites = new Map();
      for (const it of await chrome.history.search({ text: q, startTime: 0, maxResults: 300 })) {
        let u; try { u = new URL(it.url); } catch { continue; }
        if (!/^https?:$/.test(u.protocol)) continue;
        const s = sites.get(u.origin) || { visits: 0, title: '' };
        s.visits += it.visitCount || 1;
        if (u.pathname === '/' && it.title) s.title = it.title;
        sites.set(u.origin, s);
      }
      [...sites].sort((a, b) => b[1].visits - a[1].visits).slice(0, 15).forEach(([o, s]) => add(o, s.title, 'history'));
    }
  } catch {}
  POPULAR.filter(([n, u]) => n.toLowerCase().includes(q) || bareHost(u).includes(q)).forEach(([n, u]) => add(u, n, 'popular'));
  return items.slice(0, 40);
}

// Busca na web (opcional): o Wikidata devolve o site oficial a partir do nome digitado
async function webSites(q) {
  const api = 'https://www.wikidata.org/w/api.php?format=json&origin=*&';
  const get = async url => {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 8000);
    try { return await (await net(url, { signal: ctl.signal })).json(); } finally { clearTimeout(t); }
  };
  const s = await get(api + 'action=wbsearchentities&type=item&limit=12&language=pt&uselang=pt&search=' + encodeURIComponent(q));
  const ids = (s.search || []).map(x => x.id);
  if (!ids.length) return [];
  const e = await get(api + 'action=wbgetentities&props=claims|labels&languages=pt|en&ids=' + ids.join('|'));
  return ids.map(id => e.entities && e.entities[id]).filter(Boolean).map(ent => {
    const claims = ((ent.claims && ent.claims.P856) || []).filter(c => c.mainsnak && c.mainsnak.datavalue);
    const best = claims.find(c => c.rank === 'preferred') || claims[0];
    const url = best && best.mainsnak.datavalue.value;
    const name = ent.labels && ((ent.labels.pt || ent.labels.en || {}).value);
    // quanto mais o Wikidata sabe sobre o item, mais conhecido ele costuma ser
    // e o nome idêntico ao digitado vem primeiro
    const exact = name && name.toLowerCase() === q.toLowerCase() ? 1000 : 0;
    const weight = exact + Object.keys(ent.claims || {}).length;
    let origin = '';
    try { origin = /^https?:/.test(url) ? new URL(url).origin : ''; } catch {}
    return origin && name ? { url: origin, name, weight } : null; // só a página inicial do site
  }).filter(Boolean).sort((a, b) => b.weight - a.weight)
    .filter((r, i, all) => all.findIndex(o => o.url === r.url) === i).slice(0, 8);
}
const remoteIcon = url => 'https://icons.duckduckgo.com/ip3/' + urlHost(url) + '.ico';
// baixa o ícone uma vez e guarda dentro do atalho (data:), para nunca mais depender da internet
async function iconData(url) {
  try {
    const r = await net(remoteIcon(url));
    if (!r.ok) return '';
    const b = await r.blob();
    if (b.size < 80) return '';
    return await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); });
  } catch { return ''; }
}

function openPicker() {
  const dlg = $('#pick-dialog'), q = $('#pick-q'), list = $('#pick-list'), caption = $('#pick-caption');
  const isAdded = url => cfg.shortcuts.findIndex(sc => normUrl(sc.url) === normUrl(url));
  const KIND = { bookmark: 'Favorito', history: 'Histórico', typed: 'Endereço digitado', web: 'Web' };
  const fromWeb = it => ['web', 'popular', 'typed'].includes(it.kind);
  let token = 0, timer;

  function paint(items, text, loading) {
    caption.textContent = !text.trim() ? 'Mais visitados e sugestões'
      : loading ? 'Buscando na web…' : items.length ? 'Resultados' : 'Nada encontrado';
    list.hidden = !items.length;
    list.replaceChildren(...items.map(it => {
      const state = h('span', { class: 'pick-state' });
      const ico = cfg.pickWeb && fromWeb(it) ? remoteIcon(it.url) : '';
      const row = h('button', { type: 'button', class: 'row-item clickable pick-row' },
        favTile({ url: it.url, name: it.name, icon: ico }),
        h('div', { class: 'two' }, h('span', { class: 'lbl' }, it.name),
          h('span', { class: 'sub' }, bareHost(it.url) + (KIND[it.kind] ? ' · ' + KIND[it.kind] : ''))),
        state);
      const mark = () => {
        const on = isAdded(it.url) >= 0;
        row.classList.toggle('added', on);
        state.replaceChildren(icon(on ? 'check' : 'plus'));
        row.title = on ? 'Remover dos atalhos' : 'Adicionar aos atalhos';
      };
      row.addEventListener('click', async () => {
        const i = isAdded(it.url);
        if (i >= 0) { cfg.shortcuts.splice(i, 1); save(); render(); mark(); return; }
        const sc = { name: it.name, url: it.url, icon: '' };
        cfg.shortcuts.push(sc); save(); render(); mark();
        // sites que o navegador ainda não conhece: guarda o ícone no próprio atalho
        if (cfg.pickWeb && fromWeb(it)) {
          const data = await iconData(it.url);
          if (data && cfg.shortcuts.includes(sc)) { sc.icon = data; save(); render(); }
        }
      });
      mark();
      return row;
    }));
  }

  async function show() {
    const my = ++token, text = q.value;
    const items = await pickSearch(text);
    if (my !== token) return; // chegou uma busca mais nova
    const wantWeb = cfg.pickWeb && text.trim().length >= 2;
    paint(items, text, wantWeb);
    if (!wantWeb) return;
    let web = [];
    try { web = await webSites(text.trim()); } catch {}
    if (my !== token) return;
    const seen = new Set(items.map(it => normUrl(it.url)));
    for (const w of web) {
      const key = normUrl(w.url);
      if (key && !seen.has(key)) { seen.add(key); items.push({ url: w.url, name: w.name, kind: 'web' }); }
    }
    paint(items, text, false);
  }

  q.value = '';
  q.oninput = () => { clearTimeout(timer); timer = setTimeout(show, 250); };
  q.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); list.querySelector('.pick-row:not(.added)')?.click(); } };
  $('#pick-done').onclick = () => dlg.close();
  $('#pick-manual').onclick = () => { dlg.close(); editShortcut(-1); };
  dlg.onclose = () => syncPanel('atalhos');
  show();
  dlg.showModal();
  q.focus();
}

// ---------- Notícias (RSS/Atom de fontes escolhidas) ----------
// Cada fonte só é acessada depois que você liga ela (o navegador pede permissão para aquele site).
const NEWS_PRESETS = {
  // Brasil — "bias" vai de -2 (esquerda) a +2 (direita). Estimativa inicial pela linha editorial
  // pública de cada veículo; é discutível e você pode mudar a nota de qualquer um nas configurações.
  brasildefato: { name: 'Brasil de Fato', url: 'https://www.brasildefato.com.br/feed/', site: 'https://www.brasildefato.com.br', cat: 'Brasil', bias: -2 },
  brasil247: { name: 'Brasil 247', url: 'https://www.brasil247.com/feed/', site: 'https://www.brasil247.com', cat: 'Brasil', bias: -2 },
  forum: { name: 'Revista Fórum', url: 'https://revistaforum.com.br/feed/', site: 'https://revistaforum.com.br', cat: 'Brasil', bias: -2 },
  cartacapital: { name: 'CartaCapital', url: 'https://www.cartacapital.com.br/feed/', site: 'https://www.cartacapital.com.br', cat: 'Brasil', bias: -2 },
  intercept: { name: 'Intercept Brasil', url: 'https://www.intercept.com.br/feed/', site: 'https://www.intercept.com.br', cat: 'Brasil', bias: -1 },
  folha: { name: 'Folha', url: 'https://feeds.folha.uol.com.br/emcimadahora/rss091.xml', site: 'https://www.folha.uol.com.br', cat: 'Brasil', bias: -1 },
  g1: { name: 'g1', url: 'https://g1.globo.com/rss/g1/', site: 'https://g1.globo.com', cat: 'Brasil', bias: 0 },
  oglobo: { name: 'O Globo', url: 'https://oglobo.globo.com/rss/oglobo', site: 'https://oglobo.globo.com', cat: 'Brasil', bias: 0 },
  uol: { name: 'UOL', url: 'https://rss.uol.com.br/feed/noticias.xml', site: 'https://www.uol.com.br', cat: 'Brasil', bias: 0 },
  bbc: { name: 'BBC News Brasil', url: 'https://feeds.bbci.co.uk/portuguese/rss.xml', site: 'https://www.bbc.com/portuguese', cat: 'Brasil', bias: 0 },
  cnn: { name: 'CNN Brasil', url: 'https://www.cnnbrasil.com.br/feed/', site: 'https://www.cnnbrasil.com.br', cat: 'Brasil', bias: 0 },
  poder360: { name: 'Poder360', url: 'https://www.poder360.com.br/feed/', site: 'https://www.poder360.com.br', cat: 'Brasil', bias: 0 },
  metropoles: { name: 'Metrópoles', url: 'https://www.metropoles.com/feed', site: 'https://www.metropoles.com', cat: 'Brasil', bias: 0 },
  agenciabrasil: { name: 'Agência Brasil', url: 'https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml', site: 'https://agenciabrasil.ebc.com.br', cat: 'Brasil', bias: 0 },
  // o feed "últimas" do Estadão vem cheio de horóscopo antigo e cupons; as seções vêm limpas e com resumo
  estadao: { name: 'Estadão', url: 'https://www.estadao.com.br/arc/outboundfeeds/feeds/rss/sections/politica/', site: 'https://www.estadao.com.br', cat: 'Brasil', bias: 1,
    extra: ['economia', 'brasil', 'internacional'].map(s => `https://www.estadao.com.br/arc/outboundfeeds/feeds/rss/sections/${s}/`) },
  veja: { name: 'Veja', url: 'https://veja.abril.com.br/feed/', site: 'https://veja.abril.com.br', cat: 'Brasil', bias: 1 },
  gazeta: { name: 'Gazeta do Povo', url: 'https://www.gazetadopovo.com.br/feed/rss/ultimas-noticias.xml', site: 'https://www.gazetadopovo.com.br', cat: 'Brasil', bias: 1 },
  antagonista: { name: 'O Antagonista', url: 'https://oantagonista.com.br/feed/', site: 'https://oantagonista.com.br', cat: 'Brasil', bias: 1 },
  crusoe: { name: 'Crusoé', url: 'https://crusoe.com.br/feed/', site: 'https://crusoe.com.br', cat: 'Brasil', bias: 1 },
  oeste: { name: 'Revista Oeste', url: 'https://revistaoeste.com/feed/', site: 'https://revistaoeste.com', cat: 'Brasil', bias: 2 },
  jovempan: { name: 'Jovem Pan', url: 'https://jovempan.com.br/feed/', site: 'https://jovempan.com.br', cat: 'Brasil', bias: 2 },
  terrabrasil: { name: 'Terra Brasil Notícias', url: 'https://terrabrasilnoticias.com/feed/', site: 'https://terrabrasilnoticias.com', cat: 'Brasil', bias: 2 },
  infomoney: { name: 'InfoMoney', url: 'https://www.infomoney.com.br/feed/', site: 'https://www.infomoney.com.br', cat: 'Economia e cripto' },
  mises: { name: 'Mises Brasil', url: 'https://mises.org.br/feed/', site: 'https://mises.org.br', cat: 'Economia e cripto' },
  // sem RSS: lido direto da página de notícias (page: true)
  visaolib: { name: 'Visão Libertária', url: 'https://visaolibertaria.com/site/noticias', site: 'https://visaolibertaria.com', cat: 'Economia e cripto', page: true },
  livecoins: { name: 'Livecoins', url: 'https://livecoins.com.br/feed/', site: 'https://livecoins.com.br', cat: 'Economia e cripto' },
  bitcoinmag: { name: 'Bitcoin Magazine', url: 'https://bitcoinmagazine.com/feed', site: 'https://bitcoinmagazine.com', cat: 'Economia e cripto' },
  coindesk: { name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', site: 'https://www.coindesk.com', cat: 'Economia e cripto' },
  verge: { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', site: 'https://www.theverge.com', cat: 'Tecnologia' },
  hn: { name: 'Hacker News', url: 'https://hnrss.org/frontpage', site: 'https://news.ycombinator.com', cat: 'Tecnologia' }
};

// escala de viés: vermelho forte → vermelho fraco → cinza → azul fraco → azul forte
const BIAS = {
  '-2': { label: 'Esquerda', color: '#d93a3a' },
  '-1': { label: 'Centro-esquerda', color: '#ef8f8f' },
  '0': { label: 'Centro', color: '#9b9ba4' },
  '1': { label: 'Centro-direita', color: '#88afef' },
  '2': { label: 'Direita', color: '#2f6fe0' }
};
// categorias: as três do Brasil são definidas pelo viés; as outras pelo nome
const BR_SECTIONS = { 'Brasil · Esquerda': [-2, -1, -1], 'Brasil · Centro': [0, 0, 0], 'Brasil · Direita': [1, 2, 1] }; // [mín, máx, padrão ao mover]
const NEWS_SECTIONS = ['Brasil · Esquerda', 'Brasil · Centro', 'Brasil · Direita', 'Economia e cripto', 'Tecnologia', 'Suas fontes'];
// categoria atual de uma fonte: a que você escolheu, ou a original
function catOf(src) {
  if (src.id && NEWS_PRESETS[src.id]) return cfg.news.cat[src.id] || NEWS_PRESETS[src.id].cat;
  return src.cat || 'Suas fontes';
}
function setCat(s, cat) {
  if (!s.custom) { if (cat === NEWS_PRESETS[s.id].cat) delete cfg.news.cat[s.id]; else cfg.news.cat[s.id] = cat; }
  else { const c = cfg.news.custom[+s.key.slice(2)]; if (cat === 'Suas fontes') delete c.cat; else c.cat = cat; }
}
let moveOpen = null; // fonte com as opções de mover abertas
// nota atual de uma fonte (a sua, se você mudou; senão a inicial); null = sem nota
function biasOf(src) {
  if (src.id && NEWS_PRESETS[src.id]) {
    const own = cfg.news.bias[src.id];
    return own !== undefined ? own : NEWS_PRESETS[src.id].bias ?? null;
  }
  return src.bias ?? null;
}

// permissão por domínio (inclui subdomínios: o feed da Folha fica em feeds.folha.uol.com.br)
const baseDomain = host => host.split('.').slice(/\.(com|org|net|gov|edu|co|blog|art|jus|leg)\.[a-z]{2}$/.test(host) ? -3 : -2).join('.');
// esquemas separados: o navegador recusa "*://" se o manifesto só listar https e http um a um
const originsFor = url => {
  const b = baseDomain(urlHost(url));
  return b ? ['https', 'http'].flatMap(s => [`${s}://${b}/*`, `${s}://*.${b}/*`]) : [];
};
// chame direto no clique (o navegador só mostra o pedido durante uma ação sua)
function askPermission(urls) {
  if (!hasChrome || !chrome.permissions) return Promise.resolve(true);
  const origins = [...new Set(urls.flatMap(originsFor))];
  return chrome.permissions.request({ origins })
    .then(ok => { if (!ok) toast('Permissão não concedida. Sem ela a fonte não pode ser lida.'); return ok; })
    .catch(e => { console.warn('Vitral: permissão', e); toast('O navegador recusou o pedido: ' + (e && e.message || e)); return false; });
}
// aviso rápido no canto do painel
function toast(text) {
  const t = h('div', { class: 'toast', role: 'status' }, text);
  ($('#panel').hidden ? document.body : $('#panel')).append(t);
  setTimeout(() => t.classList.add('out'), 3500);
  setTimeout(() => t.remove(), 4000);
}
const covered = url => hasChrome && chrome.permissions ? chrome.permissions.contains({ origins: originsFor(url) }) : Promise.resolve(true);

async function fetchText(url, ms = 10000) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await net(url, { signal: ctl.signal, credentials: 'omit', cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    // r.text() sempre lê como UTF-8 e estraga acentos de feeds em ISO-8859-1 (ex.: "indeniza��o").
    // Usa a codificação que o site declara (cabeçalho ou <?xml encoding=…?>).
    const buf = await r.arrayBuffer();
    const head = new TextDecoder('ascii').decode(buf.slice(0, 300));
    const cs = ((r.headers.get('content-type') || '').match(/charset=["']?([\w-]+)/i) || head.match(/encoding=["']([\w-]+)/i) || [])[1] || 'utf-8';
    try { return new TextDecoder(cs.toLowerCase()).decode(buf); } catch { return new TextDecoder('utf-8').decode(buf); }
  } finally { clearTimeout(t); }
}

// texto puro a partir de HTML (o documento criado pelo DOMParser não executa nem carrega nada)
// HTML de fora (feeds, sites) vem com atributos como onerror="…" e <script>. Eles nunca rodam aqui,
// mas o navegador registra cada um como violação de segurança (CSP). Tiramos tudo isso antes de ler.
const inertHtml = html => (html || '')
  .replace(/<(script|style|noscript|iframe|object|embed)\b[\s\S]*?<\/\1\s*>/gi, '')
  .replace(/<(script|iframe|object|embed)\b[^>]*\/?>/gi, '')
  .replace(/\s(on[a-z]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  .replace(/(href|src|action)\s*=\s*(["']?)\s*javascript:[^"'\s>]*\2/gi, '');
const parseHtml = html => new DOMParser().parseFromString(inertHtml(html), 'text/html');
const htmlText = html => (parseHtml(html).body.textContent || '').replace(/\s+/g, ' ').trim();
const clip = (s, n) => s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n - 1) > n * .6 ? s.lastIndexOf(' ', n - 1) : n - 1).replace(/[\s,.;:–-]+$/, '') + '…';
const httpUrl = u => /^https?:\/\//i.test(u || '') ? u : '';
// o "importante": o primeiro parágrafo de verdade, sem legenda de foto nem rodapé do site
function leadText(html, title) {
  const doc = parseHtml((html || '').replace(/<br\s*\/?>|<\/p>|<\/div>|<\/h\d>/gi, '\n'));
  doc.querySelectorAll('img, figure, figcaption, script, style, iframe').forEach(el => el.remove());
  const lines = (doc.body.textContent || '').split('\n').map(l => l.replace(/\s+/g, ' ').trim())
    .filter(l => l && l !== title && !/^(The post|O post) .+ (appeared first on|apareceu primeiro em)/i.test(l))
    // sem linhas que são só endereço ou dados do agregador (Hacker News: "Article URL:", "Points:"…)
    .filter(l => !/^(https?:\/\/\S+|(Article URL|Comments URL|Points|# Comments|Link|Fonte|Source)\s*:.*)$/i.test(l));
  return lines.find(l => l.length >= 60) || lines.join(' ');
}
// "Tudo": divide a quantidade igualmente entre as fontes (as mais recentes de cada uma).
// Se uma fonte não tiver notícias suficientes, a vaga passa para as outras. Depois ordena por data.
function balance(items, count) {
  const bySrc = new Map();
  for (const it of items) { if (!bySrc.has(it.source)) bySrc.set(it.source, []); bySrc.get(it.source).push(it); }
  const queues = [...bySrc.values()].map(q => q.sort((a, b) => b.date - a.date));
  const out = [];
  // rodadas: uma de cada fonte por vez, até completar
  for (let round = 0; out.length < count && queues.some(q => q.length > round); round++)
    for (const q of queues) if (q[round] && out.length < count) out.push(q[round]);
  return out.sort((a, b) => b.date - a.date);
}
// parece inglês? (para quando o feed não diz o idioma)
const looksEnglish = s => (s.match(/\b(the|and|of|to|in|is|for|with|on|at|from|after|says)\b/gi) || []).length >= 2 && !/[ãõçáéíóúâêôà]/i.test(s);

// lê RSS 2.0, RSS 1.0 e Atom e devolve sempre o mesmo formato
// alguns sites publicam XML com pequenos erros (&nbsp;, & solto, caracteres de controle).
// O leitor do navegador rejeita o arquivo inteiro; aqui corrigimos o que dá antes de desistir.
const XML_NS = {
  media: 'http://search.yahoo.com/mrss/', content: 'http://purl.org/rss/1.0/modules/content/',
  dc: 'http://purl.org/dc/elements/1.1/', atom: 'http://www.w3.org/2005/Atom', itunes: 'http://www.itunes.com/dtds/podcast-1.0.dtd',
  slash: 'http://purl.org/rss/1.0/modules/slash/', wfw: 'http://wellformedweb.org/CommentAPI/', sy: 'http://purl.org/rss/1.0/modules/syndication/'
};
// ex.: a Revista Oeste usa <media:content> sem declarar "xmlns:media" — o navegador rejeita o feed todo
function addNamespaces(t) {
  const m = t.match(/<(rss|feed|rdf:RDF)\b[^>]*>/);
  if (!m) return t;
  const used = new Set([...t.matchAll(/<\/?([a-zA-Z][\w-]*):[\w.-]+/g)].map(x => x[1]));
  const missing = [...used].filter(p => p !== 'xml' && p !== 'xmlns' && !m[0].includes('xmlns:' + p + '='));
  if (!missing.length) return t;
  const decl = missing.map(p => ` xmlns:${p}="${XML_NS[p] || 'urn:x-' + p}"`).join('');
  return t.replace(m[0], m[0].replace(/\s*>$/, s => decl + s));
}
const fixXml = t => addNamespaces(t
  .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
  .replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;'));
function parseXml(raw) {
  const tryParse = t => { const d = new DOMParser().parseFromString(t, 'text/xml'); return d.querySelector('parsererror') ? null : d; };
  const text = fixXml(raw);
  let doc = tryParse(raw) || tryParse(text);
  if (doc) return doc;
  // último recurso: lê cada notícia separadamente e descarta só as quebradas
  const open = (text.match(/<(rss|feed|rdf:RDF)\b[^>]*>/) || [])[0];
  const parts = text.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/g);
  if (!open || !parts) return null;
  const tag = open.match(/<([\w:]+)/)[1], wrap = tag === 'rss' ? ['<channel>', '</channel>'] : ['', ''];
  const head = fixXml((text.match(/<channel[\s>][\s\S]*?(?=<item[\s>])/) || [''])[0].replace(/^<channel[^>]*>/, ''));
  const good = parts.map(fixXml).filter(p => tryParse(`${open}${wrap[0]}${p}${wrap[1]}</${tag}>`));
  return tryParse(`${open}${wrap[0]}${tryParse(open + wrap[0] + head + wrap[1] + '</' + tag + '>') ? head : ''}${good.join('')}${wrap[1]}</${tag}>`);
}

// imagem que não é foto: pixel de rastreamento (1×1), espaçador transparente
const isPixel = (tagHtml, src) =>
  /\b(width|height)=["']?[0-3]["'\s>\/]/i.test(tagHtml) ||
  /(\/(blank|spacer|pixel|transparent|1x1)\.(gif|png)|\/(pixel|tracker|tracking|beacon)[\/?.]|ebc\.(png|gif)|feedburner\.com|feeds\.feedblitz|gravatar\.com\/avatar)/i.test(src);
function parseFeed(text, src) {
  const doc = parseXml(text);
  if (!doc) return [];
  // idioma declarado pelo feed (<language>en-us</language> ou xml:lang)
  const root = doc.documentElement;
  const feedLang = ((doc.querySelector('channel > language') || {}).textContent || root.getAttribute('xml:lang') || '').trim().toLowerCase();
  return [...doc.querySelectorAll('item, entry')].map(n => {
    const tag = name => n.getElementsByTagName(name)[0];
    const val = (...names) => { for (const nm of names) { const el = tag(nm); if (el && el.textContent.trim()) return el.textContent.trim(); } return ''; };
    let link = '';
    for (const l of n.getElementsByTagName('link')) {
      const href = l.getAttribute('href'), rel = l.getAttribute('rel');
      if (href && (!rel || rel === 'alternate')) { link = href; break; }
      if (!href && l.textContent.trim()) { link = l.textContent.trim(); break; }
    }
    if (!link) { const g = tag('guid'); if (g && /^https?:/.test(g.textContent.trim())) link = g.textContent.trim(); }
    const html = val('content:encoded', 'description', 'summary', 'content');
    let image = '';
    for (const nm of ['media:content', 'media:thumbnail', 'enclosure']) {
      for (const el of n.getElementsByTagName(nm)) {
        const u = el.getAttribute('url'), type = el.getAttribute('type') || el.getAttribute('medium') || '';
        if (u && (nm !== 'enclosure' || /image/.test(type)) && (!type || /image/.test(type))) { image = u; break; }
      }
      if (image) break;
    }
    // primeira imagem de verdade do texto (pula pixels de rastreamento, como o da Agência Brasil)
    if (!image) for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
      const src = (m[0].match(/\bsrc=["']([^"']+)/i) || [])[1];
      if (src && !isPixel(m[0], src)) { image = src.replace(/&amp;/g, '&'); break; }
    }
    const summary = clip(leadText(html, val('title')), 420);
    const date = Date.parse(val('pubDate', 'published', 'updated', 'dc:date')) || 0;
    const title = htmlText(val('title'));
    // alguns feeds declaram o idioma errado (o do UOL diz "en-us"): acento português desmente
    const en = (feedLang ? feedLang.startsWith('en') : looksEnglish(title + ' ' + summary)) && !/[ãõçáéíóúâêôà]/i.test(title + summary);
    const cats = [...n.getElementsByTagName('category')].map(c => c.textContent.trim()).filter(Boolean).slice(0, 8);
    return { title, link: httpUrl(link), summary: summary === title ? '' : summary, image: httpUrl(image), date, source: src.name, site: src.site, en, cats };
  }).filter(it => it.title && it.link);
}

// é um feed? devolve o título dele
function feedInfo(text) {
  if (!/<(rss|feed|rdf:RDF)[\s>]/i.test(text.slice(0, 2000))) return null;
  const doc = parseXml(text);
  if (!doc) return null;
  const t = (doc.querySelector('channel > title, feed > title') || {}).textContent || '';
  return { title: clip(t.split(/ [-|–:] /)[0].trim(), 30) };
}

// acha o feed a partir do endereço de um site (ou aceita o próprio feed)
async function discoverFeed(url) {
  const text = await fetchText(url);
  const info = feedInfo(text);
  if (info) return { feed: url, title: info.title };
  const doc = parseHtml(text);
  const alt = [...doc.querySelectorAll('link[rel~="alternate"]')].find(l => /rss|atom/i.test(l.getAttribute('type') || ''));
  const list = alt ? [new URL(alt.getAttribute('href'), url).href] : [];
  list.push(...['/feed', '/rss', '/feed.xml', '/rss.xml', '/atom.xml', '/index.xml'].map(p => new URL(p, url).href));
  for (const c of list) {
    if (!(await covered(c))) return { needs: c }; // feed em outro domínio: precisa de outra permissão
    try { const t = await fetchText(c, 8000), fi = feedInfo(t); if (fi) return { feed: c, title: fi.title }; } catch {}
  }
  // sem RSS: tenta ler a própria página (ou a seção de notícias dela) como lista de cartões
  const siteTitle = clip(((doc.querySelector('meta[property="og:site_name"]') || {}).content || doc.title || '').split(/ [-|–:] /)[0].trim(), 30);
  // primeiro a seção de notícias do site (a página inicial costuma misturar vídeos, banners…)
  const origin = new URL(url).origin;
  const sections = [...new Set([...doc.querySelectorAll('a[href]')].map(a => { try { return new URL(a.getAttribute('href'), url).href.split('#')[0]; } catch { return ''; } })
    .filter(h => h.startsWith(origin) && h !== url && /\/(noticias?|news|ultimas|últimas|blog|artigos?|posts?|materias?)\/?(\?.*)?$/i.test(h)))].slice(0, 4);
  for (const s of sections) {
    try { if (parsePage(await fetchText(s, 8000), { name: '', site: s }, s).length >= 3) return { feed: s, title: siteTitle, page: true }; } catch {}
  }
  if (parsePage(text, { name: '', site: url }, url).length >= 3) return { feed: url, title: siteTitle, page: true };
  throw new Error('sem feed');
}

// ---------- Nome oficial e ícone de um site (para fontes que você adiciona) ----------
// Lê a página inicial: nome em og:site_name / application-name / <title>; ícone no <link rel=icon>
// (o maior que houver). O ícone é baixado uma vez e guardado na fonte (data:), como nos atalhos.
async function siteMeta(site) {
  const origin = new URL(site).origin;
  const html = await fetchText(origin + '/', 8000);
  const doc = parseHtml(html);
  const meta = sel => ((doc.querySelector(sel) || {}).content || '').trim();
  const rawTitle = (doc.querySelector('title') || {}).textContent || '';
  let name = meta('meta[property="og:site_name"]') || meta('meta[name="application-name"]') || meta('meta[name="apple-mobile-web-app-title"]');
  if (!name) {
    // "Notícia X | Brasil Paralelo" → pega o pedaço que mais parece o nome do site
    const parts = rawTitle.split(/\s+[|–—\-:·]\s+/).map(s => s.trim()).filter(Boolean);
    const host = bareHost(origin).split('.')[0].toLowerCase();
    name = parts.find(p => p.toLowerCase().replace(/[^a-z0-9]/g, '').includes(host.replace(/[^a-z0-9]/g, ''))) || parts[parts.length - 1] || '';
  }
  const size = l => { const s = (l.getAttribute('sizes') || '').match(/(\d+)/); return s ? +s[1] : /apple-touch/i.test(l.rel) ? 180 : /svg/.test(l.type || l.getAttribute('href')) ? 128 : 16; };
  const icons = [...doc.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]')]
    .filter(l => l.getAttribute('href')).sort((a, b) => size(b) - size(a));
  const iconUrls = icons.map(l => { try { return new URL(l.getAttribute('href'), origin + '/').href; } catch { return ''; } }).filter(Boolean);
  iconUrls.push(origin + '/favicon.ico');
  return { name: clip(name.replace(/\s+/g, ' '), 40), iconUrls };
}
async function iconToData(urls, site) {
  for (const u of urls) {
    try {
      if (!/^https?:/.test(u) || !(await covered(u))) continue;  // só domínios com permissão
      const r = await net(u, { credentials: 'omit' });
      const b = await r.blob();
      if (!r.ok || !/^image\//.test(b.type) || b.size < 80 || b.size > 300000) continue;
      return await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); });
    } catch {}
  }
  return iconData(site); // reserva: serviço de ícones do DuckDuckGo
}
// completa nome e ícone de uma fonte sua (ao adicionar e para as antigas que ficaram sem)
async function completeSource(c) {
  const site = c.site || c.url;
  let meta = { name: '', iconUrls: [] };
  try { meta = await siteMeta(site); } catch {}
  let changedSomething = false;
  if (meta.name && (!c.name || c.autoName || c.name === prettyHost(site))) { c.name = meta.name; delete c.autoName; changedSomething = true; }
  if (!c.icon) { const data = await iconToData(meta.iconUrls, site); if (data) { c.icon = data; changedSomething = true; } }
  return changedSomething;
}
async function repairSources() {
  let any = false;
  for (const c of cfg.news.custom) {
    if (!(!c.icon || c.name === prettyHost(c.site || c.url))) continue;
    if (c.repairAt && Date.now() - c.repairAt < 7 * 864e5) continue; // tenta no máximo uma vez por semana
    c.repairAt = Date.now(); any = true;
    await completeSource(c);
  }
  if (any) {
    save(); render(); syncPanel('blocos');
    const card = $('.card.news'); if (card) fillNews(card, true); // o nome da fonte aparece nas notícias
  }
}

// ---------- Sites sem RSS: lê a página e acha os "cartões" de notícia ----------
// Procura títulos (h1–h5) e sobe até o bloco que tem o link; o tipo de bloco que mais se repete
// na página é a lista de notícias. De cada bloco tira link, foto, resumo e data.
const MONTHS = { jan: 0, fev: 1, feb: 1, mar: 2, abr: 3, apr: 3, mai: 4, may: 4, jun: 5, jul: 6, ago: 7, aug: 7, set: 8, sep: 8, out: 9, oct: 9, nov: 10, dez: 11, dec: 11 };
function looseDate(s) {
  if (!s) return 0;
  let m = s.match(/\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?/);
  if (m) return Date.parse(m[0]) || 0;
  m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return Math.min(Date.now(), new Date(+m[3], +m[2] - 1, +m[1], 12).getTime());
  m = s.toLowerCase().match(/(\d{1,2})\s*(?:de\s+)?([a-zç]{3})[a-zç]*\.?\s*(?:de\s+)?(\d{4})/);
  if (m && m[2] in MONTHS) return Math.min(Date.now(), new Date(+m[3], MONTHS[m[2]], +m[1], 12).getTime()); // só a data: meio-dia, nunca no futuro
  return 0;
}
// títulos colados com o resumo pelo próprio site ("…Europe's InactionThe war in Ukraine…"):
// só em títulos longos demais, separa onde uma minúscula encosta numa maiúscula
function splitGlued(title) {
  if (title.length <= 110) return [title, ''];
  const m = title.slice(20).match(/[a-zà-ÿ][.!?"'”’)]?(?=[A-ZÀ-Ý][a-zà-ÿ])/);
  if (!m) return [title, ''];
  const cut = 20 + m.index + m[0].length, rest = title.slice(cut).trim();
  // o pedaço de depois precisa parecer um resumo (frase com ponto final); senão é nome como "PlayStation"
  if (rest.length < 40 || !/[.!?…]["'”’]?$/.test(rest)) return [title, ''];
  return [title.slice(0, cut).trim(), rest];
}
function parsePage(html, src, pageUrl) {
  const doc = parseHtml(html);
  const abs = u => { try { return new URL(u, pageUrl).href; } catch { return ''; } };
  const heads = 'h1, h2, h3, h4, h5';
  const groups = new Map();
  for (const hEl of doc.querySelectorAll(heads)) {
    const title = hEl.textContent.replace(/\s+/g, ' ').trim();
    if (title.length < 15 || title.length > 220) continue;
    // sobe até ter um link; depois continua enquanto o bloco tiver só este título (pega foto e resumo)
    let box = hEl;
    for (let i = 0; i < 5 && box.parentElement && !box.querySelector('a[href]'); i++) box = box.parentElement;
    if (!box.querySelector('a[href]')) continue;
    while (box.parentElement && box.parentElement !== doc.body && box.parentElement.querySelectorAll(heads).length === 1) box = box.parentElement;
    const links = [...box.querySelectorAll('a[href]')].filter(a => !/^(#|javascript:|mailto:)/i.test(a.getAttribute('href')));
    const pick = hEl.querySelector('a[href]') || hEl.closest('a[href]')
      || links.find(a => /^(ler|leia|continue|saiba|ver|read)\b/i.test(a.textContent.trim()))
      || links.find(a => a.textContent.trim().length > 15 && title.includes(a.textContent.trim().slice(0, 15)))
      || links.find(a => abs(a.getAttribute('href')).split('/').length > 4);
    const link = pick ? abs(pick.getAttribute('href')) : '';
    if (!httpUrl(link) || link.split('#')[0] === pageUrl) continue;
    const img = box.querySelector('img');
    let image = img ? abs(img.getAttribute('src') || img.getAttribute('data-src') || '') : '';
    if (image && isPixel(img.outerHTML, image)) image = '';
    const p = [...box.querySelectorAll('p')].map(x => x.textContent.replace(/\s+/g, ' ').trim()).find(t => t.length >= 40 && !t.includes(title));
    const t = box.querySelector('time');
    const date = looseDate(t && (t.getAttribute('datetime') || t.textContent)) || looseDate(box.textContent.replace(/\s+/g, ' ').replace(title, ''));
    const sig = box.tagName + '.' + [...box.classList].sort().join('.');
    if (!groups.has(sig)) groups.set(sig, []);
    const [head, rest] = splitGlued(title);
    const sum = p && !p.startsWith(rest.slice(0, 30)) ? p : (p || rest);
    groups.get(sig).push({ title: head, link, summary: sum ? clip(sum, 420) : '', image: httpUrl(image), date, source: src.name, site: src.site, en: looksEnglish(head + ' ' + sum), cats: [] });
  }
  const best = [...groups.values()].sort((a, b) => b.length - a.length)[0] || [];
  const seen = new Set();
  return best.length >= 3 ? best.filter(it => !seen.has(it.link) && seen.add(it.link)) : [];
}

// ícones das fontes prontas, guardados na extensão (icons/news): aparecem sem visitar o site
const NEWS_ICON_EXT = { brasil247: 'jpg', coindesk: 'jpg' };
const presetIcon = id => `icons/news/${id}.${NEWS_ICON_EXT[id] || 'png'}`;

// ---------- Tradução automática (inglês → português) ----------
// Usa o tradutor do próprio navegador quando existir (tudo no aparelho);
// senão, o serviço gratuito do Google Tradutor. Só o título e o resumo são enviados.
let browserTranslator = null;
async function translate(text) {
  try {
    if (browserTranslator === null && typeof self.Translator !== 'undefined') {
      const avail = await self.Translator.availability({ sourceLanguage: 'en', targetLanguage: 'pt' });
      browserTranslator = avail === 'available' ? await self.Translator.create({ sourceLanguage: 'en', targetLanguage: 'pt' }) : false;
    }
    if (browserTranslator) return await browserTranslator.translate(text);
  } catch { browserTranslator = false; }
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await net('https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pt&dt=t&q=' + encodeURIComponent(text), { signal: ctl.signal, credentials: 'omit' });
    const j = await r.json();
    return (j[0] || []).map(s => s[0]).join('');
  } finally { clearTimeout(t); }
}
// traduz título + resumo dos itens em inglês (os mais recentes), em pequenos lotes
async function translateItems(items, cache) {
  const old = new Map((cache.items || []).filter(i => i.tr).map(i => [i.link, i]));
  const todo = items.filter(i => i.en && !i.tr).slice(0, 40);
  for (const it of todo) { const prev = old.get(it.link); if (prev) Object.assign(it, { title: prev.title, summary: prev.summary, orig: prev.orig, tr: true }); }
  const pend = todo.filter(i => !i.tr);
  for (let i = 0; i < pend.length; i += 4) {
    await Promise.all(pend.slice(i, i + 4).map(async it => {
      try {
        // título e resumo traduzidos separadamente: juntos, o tradutor às vezes some com a quebra
        // de linha e o resumo "gruda" no título ("…da EuropaA guerra na Ucrânia…")
        const [title, summary] = await Promise.all([translate(it.title), it.summary ? translate(it.summary) : '']);
        if (title && title.trim()) Object.assign(it, { orig: { title: it.title, summary: it.summary }, title: title.trim(), summary: (summary || '').trim(), tr: true });
      } catch {}
    }));
  }
}

const newsSources = () => [
  ...Object.entries(NEWS_PRESETS).filter(([id]) => cfg.news.enabled[id]).map(([id, p]) => ({ ...p, id, icon: presetIcon(id) })),
  ...cfg.news.custom.filter(c => c.on && c.url).map(c => ({ name: c.name || prettyHost(c.site || c.url), url: c.url, site: c.site || c.url, bias: c.bias ?? null, page: !!c.page, icon: c.icon || '' }))
];
const newsKey = srcs => srcs.map(s => s.url).join('|');

let newsJob = null;
// sobe quando a forma de ler os feeds muda: as notícias guardadas são lidas de novo
const NEWS_V = 6;

// ---------- Peneira: filtro de qualidade — sem propaganda, sem "só manchete", sem notícia velha ----------
// no título só sinais fortes ("oferta de ações" e "ofertas de demissão" são notícia de verdade)
const PROMO_TITLE = /(^|[^\p{L}])(cupo(m|ns)( de desconto)?|economize|black friday|cashback|frete grátis|liquidação|publieditorial|conteúdo patrocinado|sponsored)(?![\p{L}])|^(promoção|promo|oferta|ofertas|desconto|descontos|cupom)\b/iu;
const PROMO_PRICE = /\d+\s?%\s?(off|de desconto)|R\$\s?[\d.,]+\s?off|até\s+\d+\s?%/i;
// nas categorias do feed, a marcação explícita de conteúdo pago
const PROMO_CAT = /(^|[^\p{L}])(patrocinad[oa]s?|publieditorial|publicidade|conteúdo de marca|branded content|informe publicitário|sponsored|cupons?|ofertas)(?![\p{L}])/iu;
const PROMO_PATH = /\/(cupons?|ofertas?|promocoes|promocao|guia-de-compras|compras|achadinhos|patrocinado|publieditorial|publicidade|branded|brand-studio|parceiros?|afiliados?|sponsored|deals|coupons)(\/|$)/i;
const INDEX_PATH = /\/(tudo-sobre|tags?|topicos?|horoscopo[\w-]*|fora-de-ultimas)(\/|$)/i;
// motivo para esconder (texto vazio = notícia boa)
function junkReason(it) {
  let path = '';
  try { path = new URL(it.link).pathname; } catch {}
  if (PROMO_PATH.test(path)) return 'seção de compras/patrocínio';
  if (INDEX_PATH.test(path)) return 'página de índice';
  if (PROMO_TITLE.test(it.title) || PROMO_PRICE.test(it.title)) return 'título promocional';   // "Promoção Adidas: economize até 60%"
  if ((it.cats || []).some(c => PROMO_CAT.test(c))) return 'categoria patrocinada';
  if ((!it.summary || it.summary.length < 40) && !it.image) return 'só manchete';               // sem resumo nem foto
  if (it.date && it.date - Date.now() > 864e5) return 'data no futuro';                          // ex.: "Ao vivo" agendado
  return '';
}
const isGoodNews = it => !junkReason(it);
// idade: aplicada na hora de mostrar, para o ajuste valer sem buscar tudo de novo
const recentEnough = it => !it.date || Date.now() - it.date <= cfg.news.maxAge * 864e5;
async function loadNews(force) {
  const srcs = newsSources(), key = newsKey(srcs);
  let cache = (await store.get('news')) || {};
  if (cache.v !== NEWS_V) cache = { key: cache.key, items: cache.items, stale: true };
  const fresh = !cache.stale && cache.key === key && Date.now() - (cache.at || 0) < cfg.news.refresh * 6e4;
  if (!srcs.length || (!force && fresh)) return cache.key === key ? cache : { key, items: [] };
  if (newsJob) return newsJob;
  newsJob = (async () => {
    // fontes com vários feeds (ex.: seções do Estadão) são lidas juntas; só falha se todos falharem
    const readSource = async s => {
      // sites sem RSS são lidos como página de cartões
      const parts = await Promise.allSettled([s.url, ...(s.extra || [])].map(async u => s.page ? parsePage(await fetchText(u), s, u) : parseFeed(await fetchText(u), s)));
      const ok = parts.filter(p => p.status === 'fulfilled').flatMap(p => p.value);
      if (!ok.length) throw new Error('sem notícias');
      return ok;
    };
    const res = await Promise.allSettled(srcs.map(readSource));
    const failed = srcs.filter((s, i) => res[i].status === 'rejected').map(s => s.name);
    const seen = new Set();
    let items = res.flatMap(r => r.status === 'fulfilled' ? r.value.filter(it => !cfg.news.clean || isGoodNews(it)).sort((a, b) => b.date - a.date).slice(0, 15) : [])
      .filter(it => !seen.has(it.link) && seen.add(it.link))
      .sort((a, b) => b.date - a.date);
    // se tudo falhou (ex.: sem internet), mantém as notícias que já estavam
    if (!items.length && cache.key === key) items = cache.items || [];
    // sem limite geral: cortar as N mais recentes de todas as fontes apagava as fontes mais lentas
    // (ex.: Visão Libertária, que só informa a data). Cada fonte já entra com no máximo 15.
    if (cfg.news.translate) await translateItems(items, cache.stale ? {} : cache);
    const data = { v: NEWS_V, key, at: Date.now(), items, failed };
    await store.set('news', data);
    return data;
  })().finally(() => { newsJob = null; });
  return newsJob;
}

const ago = ms => {
  if (!ms) return '';
  const m = Math.round((Date.now() - ms) / 6e4);
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m} min`;
  const hr = Math.round(m / 60);
  if (hr < 24) return `há ${hr} h`;
  const d = Math.round(hr / 24);
  return d === 1 ? 'ontem' : `há ${d} dias`;
};
// ícone guardado na extensão; senão o que o navegador já conhece
const srcIcon = (site, saved) => saved ? h('img', { class: 'src-ic', alt: '', src: saved })
  : hasChrome ? h('img', { class: 'src-ic', alt: '', src: `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(site)}&size=32` })
  : h('span', { class: 'src-ic dot' });

// filtros de fontes sempre com ícone e nome, todos à vista: se não cabem, vão se juntando
// (1: botões mais justos; 2: letra e ícone menores; 3: quebram em duas linhas, centralizadas).
// Só se nem assim couber a linha desliza com a roda do mouse (ou arrastando).
// "Tudo" no mesmo estilo das fontes: um ícone (quatro quadrados) no lugar do logotipo
const allIcon = () => { const i = icon('layout'); i.classList.add('src-ic', 'all-ic'); return i; };
function fitChips(chips, key) {
  chips.prepend(h('span', { class: 'chip-pill' }));
  const fit = () => {
    if (!chips.isConnected || !chips.clientWidth) return;
    chips.classList.remove('overflow');
    const over = () => chips.scrollWidth > chips.clientWidth + 1;
    let level = 0;
    chips.dataset.fit = 0;
    chips.style.paddingInline = '';
    while (over() && level < 3) chips.dataset.fit = ++level;
    if (level === 3) {
      // linhas equilibradas (nada de uma fonte sozinha embaixo): estreita a área até dividir por igual
      const btns = [...chips.querySelectorAll('button')];
      const total = btns.reduce((s, b) => s + b.offsetWidth + 2, 0), rows = Math.ceil(total / chips.clientWidth);
      const side = Math.max(0, (chips.clientWidth - total / rows * 1.08) / 2);
      chips.style.paddingInline = side + 'px';
      if (Math.round(chips.scrollHeight / (btns[0].offsetHeight + 2)) > rows) chips.style.paddingInline = '';
    }
    // em duas linhas, a primeira fonte de cada linha não leva divisória à esquerda
    let top = null;
    for (const b of chips.querySelectorAll('button')) { b.classList.toggle('line-start', top !== null && b.offsetTop !== top); top = b.offsetTop; }
    if (over()) {
      chips.classList.add('overflow');
      const on = chips.querySelector('.on');
      if (on) chips.scrollLeft = on.offsetLeft - chips.clientWidth / 2 + on.offsetWidth / 2;
    }
    pill();
    edges();
    // os filtros mudaram de uma para duas linhas (ou o contrário): a altura do bloco mudou, reajusta
    const shape = chips.dataset.fit + '|' + chips.offsetHeight;
    if (chips.dataset.shape !== shape) { chips.dataset.shape = shape; fitSoon(); }
  };
  // o destaque da fonte escolhida desliza da anterior até a nova
  const pill = () => {
    const p = chips.querySelector('.chip-pill'), on = chips.querySelector('button.on');
    if (!p || !on) return;
    const to = { l: on.offsetLeft, t: on.offsetTop, w: on.offsetWidth, h: on.offsetHeight };
    const from = pillAt[key];
    const put = q => { p.style.transform = `translate(${q.l}px, ${q.t || 0}px)`; p.style.width = q.w + 'px'; p.style.height = (q.h || on.offsetHeight) + 'px'; };
    if (from && (from.l !== to.l || from.t !== to.t || from.w !== to.w)) {
      p.style.transition = 'none';
      put(from);
      p.offsetWidth; // aplica a posição antiga antes de animar
      p.style.transition = '';
    }
    put(to);
    pillAt[key] = to;
  };
  const edges = () => {
    chips.classList.toggle('fade-l', chips.scrollLeft > 2);
    chips.classList.toggle('fade-r', chips.scrollLeft + chips.clientWidth < chips.scrollWidth - 2);
  };
  chips.addEventListener('scroll', edges, { passive: true });
  // arrastar com o mouse também desliza (um clique curto continua escolhendo a fonte)
  let drag = null;
  chips.addEventListener('pointerdown', e => { if (chips.classList.contains('overflow') && e.button === 0) drag = { x: e.clientX, left: chips.scrollLeft, moved: false }; });
  chips.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) > 4) { drag.moved = true; chips.setPointerCapture(e.pointerId); }
    if (drag.moved) chips.scrollLeft = drag.left - dx;
  });
  const stop = () => { if (drag && drag.moved) chips.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); }, { capture: true, once: true }); drag = null; };
  chips.addEventListener('pointerup', stop);
  chips.addEventListener('pointercancel', () => { drag = null; });
  chips.addEventListener('wheel', e => {
    if (!chips.classList.contains('overflow') || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault();
    chips.scrollBy({ left: e.deltaY, behavior: 'smooth' });
  }, { passive: false });
  new ResizeObserver(fit).observe(chips);
  requestAnimationFrame(fit);
}

// imagem da notícia: se falhar, vier minúscula (pixel, ícone) ou travar, sai de vez,
// sem deixar a caixa vazia ocupando espaço; quando carrega, aparece suave
function watchImage(img) {
  const drop = () => { clearTimeout(timer); img.remove(); fitSoon(); };
  img.addEventListener('error', drop);
  img.addEventListener('load', () => {
    if (img.naturalWidth < 48 || img.naturalHeight < 32) return drop();
    clearTimeout(timer); img.classList.add('ok');
  });
  // travou: depois de 12 s visível na tela sem terminar, desiste
  const timer = setTimeout(function check() {
    if (!img.isConnected || img.classList.contains('ok')) return;
    // escondida (não coube na tela): espera aparecer e, a partir daí, dá mais 12 s
    if (img.offsetParent === null) { img.dataset.waited = 1; setTimeout(check, 4000); return; }
    if (img.dataset.waited) { delete img.dataset.waited; setTimeout(check, 12000); return; }
    if (!img.complete || !img.naturalWidth) drop();
  }, 12000);
}
let newsFilter = ''; // fonte escolhida nos filtros (só nesta guia)
let newsSwitch = false; // a próxima pintura vem de uma troca de fonte (anima a lista)
const pillAt = {}; // onde estava o destaque de cada barra de filtros, para deslizar até o novo
function paintNews(card, data) {
  const n = cfg.news;
  const head = h('div', { class: 'news-head' }, h('h4', {}, 'Notícias'));
  if (!data) {
    card.replaceChildren(head, h('div', { class: 'news-empty' },
      h('span', {}, 'Escolha de onde vêm suas notícias.'),
      h('button', { type: 'button', onclick: () => {
        togglePanel(true); openTab('blocos');
        // rola só o painel (scrollIntoView rolaria a página inteira junto)
        const body = $('#panel-body'), target = $('#news-settings');
        if (target) body.scrollTo({ top: target.offsetTop - body.offsetTop - 8, behavior: 'smooth' });
      } }, 'Escolher fontes')));
    return;
  }
  data = { ...data, items: (data.items || []).filter(recentEnough) };
  const names = [...new Set(data.items.map(it => it.source))];
  if (newsFilter && !names.includes(newsFilter)) newsFilter = '';
  if (names.length > 1) {
    const chips = h('div', { class: 'news-chips' });
    const savedIcon = {};
    for (const s of newsSources()) savedIcon[s.name] = s.icon;
    for (const nm of ['', ...names]) {
      const site = nm && (data.items.find(it => it.source === nm) || {}).site;
      chips.append(h('button', {
        type: 'button', class: newsFilter === nm ? 'on' : '', title: nm || 'Todas as fontes',
        onclick: () => {
          if (newsFilter === nm) return;
          // a altura do bloco fica a mesma ao trocar de fonte (só muda o que está dentro)
          if (!card.dataset.lockH) card.dataset.lockH = card.offsetHeight;
          newsFilter = nm; newsSwitch = true; paintNews(card, data);
        }
      }, nm ? srcIcon(site, savedIcon[nm]) : allIcon(), h('span', { class: 'chip-name' }, nm || 'Tudo')));
    }
    head.append(chips);
    fitChips(chips, 'news');
  }
  const btn = h('button', { type: 'button', class: 'news-refresh' + (data.loading ? ' spin' : ''), title: 'Atualizar' }, icon('reset'));
  btn.addEventListener('click', () => fillNews(card, true));
  head.append(btn);

  let body;
  if (data.loading && !data.items.length) body = h('div', { class: 'news-list' }, [1, 2, 3, 4].map(() => h('div', { class: 'news-skel' })));
  else {
    // além da "Quantidade", vêm notícias de reserva (escondidas): se o bloco ficar mais alto que o
    // necessário (ex.: da altura do Mercado ao lado), elas aparecem para preencher o espaço
    const SPARE = 30;
    const items = newsFilter ? data.items.filter(it => it.source === newsFilter).slice(0, n.count + SPARE) : balance(data.items, n.count + SPARE);
    const spareFrom = Math.min(n.count, items.length);
    // cor do viés de cada fonte (calculada agora: a nota pode ter mudado depois de guardar as notícias)
    const biasBy = {}, iconBy = {};
    for (const s of newsSources()) { biasBy[s.name] = biasOf(s); iconBy[s.name] = s.icon; }
    // posição de cada notícia dentro da sua fonte (0 = a mais nova dela): quando não cabe tudo
    // na tela, saem primeiro as de posição maior, para nenhuma fonte sumir antes das outras
    const seenSrc = {};
    const rankOf = new Map(items.map(it => [it, seenSrc[it.source] = (seenSrc[it.source] ?? -1) + 1]));
    body = items.length ? h('div', { class: 'news-list' }, items.map(it => {
      const b = n.showBias ? biasBy[it.source] : null;
      const showTr = it.tr && n.translate;
      const title = showTr ? it.title : (it.orig ? it.orig.title : it.title);
      const summary = showTr ? it.summary : (it.orig ? it.orig.summary : it.summary);
      const img = n.images && it.image ? h('img', { class: 'news-img', src: it.image, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }) : null;
      if (img) watchImage(img);
      return h('a', { class: 'news-item', href: it.link, 'data-rank': rankOf.get(it), 'data-date': it.date || 0, 'data-spare': items.indexOf(it) >= spareFrom ? '' : null },
        h('div', { class: 'news-body' },
          h('div', { class: 'news-meta' }, srcIcon(it.site, iconBy[it.source]), h('span', {}, it.source),
            b != null ? h('span', { class: 'bias-pip', style: `--c:${BIAS[b].color}`, title: BIAS[b].label }) : null,
            it.date ? h('span', {}, '· ' + ago(it.date)) : null,
            showTr ? h('span', { class: 'tr-tag', title: 'Original: ' + it.orig.title }, '· traduzido') : null),
          h('div', { class: 'news-title' }, title),
          n.summary && summary ? h('div', { class: 'news-sum' }, summary) : null),
        img);
    })) : h('div', { class: 'news-empty' }, h('span', {}, 'Nenhuma notícia por enquanto.'));
  }
  if (newsSwitch && body) {
    newsSwitch = false;
    body.classList.add('switching');
    [...body.children].forEach((el, i) => el.style.setProperty('--i', i));
  }
  const foot = data.failed && data.failed.length ? h('div', { class: 'news-foot' }, 'Não carregou: ' + data.failed.join(', ')) : null;
  // replaceChildren escreveria "null" na tela se o rodapé não existir
  card.replaceChildren(...[head, body, foot].filter(Boolean));
  fitSoon();
}

async function fillNews(card, force) {
  const srcs = newsSources();
  if (!srcs.length) return paintNews(card, null);
  const key = newsKey(srcs), cache = (await store.get('news')) || {};
  const shown = cache.key === key ? cache : { items: [] };
  paintNews(card, { ...shown, loading: true });
  let data = shown;
  try { data = await loadNews(force); } catch {}
  const cur = card.isConnected ? card : $('.card.news'); // a página pode ter sido redesenhada nesse meio tempo
  if (cur) paintNews(cur, data);
}

// pontos de viés: mostram a nota e, com um toque, mudam ela
function biasDots(current, onPick) {
  const wrap = h('div', { class: 'bias-dots', title: current == null ? 'Sem nota de viés' : BIAS[current].label });
  for (const v of [-2, -1, 0, 1, 2]) {
    const b = h('button', { type: 'button', class: 'bias-dot' + (v === current ? ' on' : ''), style: `--c:${BIAS[v].color}`, title: BIAS[v].label });
    b.addEventListener('click', e => { e.stopPropagation(); onPick(v === current ? null : v); });
    wrap.append(b);
  }
  return wrap;
}

// configurações das notícias (aparecem em Blocos quando o bloco está ligado)
function newsSettings() {
  const n = cfg.news;
  const switchFor = (checked, onChange) => {
    const sw = h('input', { type: 'checkbox', checked });
    sw.addEventListener('change', () => onChange(sw));
    return h('label', { class: 'switch' }, sw, h('span', { class: 'knob' }));
  };
  const searchable = (row, ...words) => { row.dataset.q = words.join(' ').toLowerCase(); return row; };

  // todas as fontes (prontas e suas) num formato só, cada uma na categoria que você escolheu
  const all = [
    ...Object.entries(NEWS_PRESETS).map(([id, p]) => ({
      key: 'p:' + id, id, name: p.name, site: p.site, url: p.url, icon: presetIcon(id), cat: catOf({ id }), bias: biasOf({ id }),
      on: !!n.enabled[id], custom: false,
      setOn: v => { n.enabled[id] = v; }, perms: [p.url, p.site],
      setBias: v => { if (v === p.bias) delete n.bias[id]; else n.bias[id] = v; }
    })),
    ...n.custom.map((c, i) => ({
      key: 'c:' + i, name: c.name || prettyHost(c.url), site: c.site || c.url, url: c.url, icon: c.icon || '', cat: catOf(c), bias: c.bias ?? null,
      on: !!c.on, custom: true,
      setOn: v => { c.on = v; }, perms: [c.url],
      setBias: v => { c.bias = v; }, remove: () => n.custom.splice(i, 1)
    }))
  ];
  const sectionOf = s => s.cat !== 'Brasil' ? s.cat : s.bias == null || s.bias === 0 ? 'Brasil · Centro' : s.bias < 0 ? 'Brasil · Esquerda' : 'Brasil · Direita';
  const byKey = Object.fromEntries(all.map(s => [s.key, s]));

  // muda a fonte de categoria; nas seções do Brasil também ajusta o viés se ele não combinar
  const moveTo = (key, dest) => {
    const s = byKey[key];
    if (!s || sectionOf(s) === dest) return;
    const cat = BR_SECTIONS[dest] ? 'Brasil' : dest;
    setCat(s, cat);
    if (BR_SECTIONS[dest]) {
      const [lo, hi, def] = BR_SECTIONS[dest];
      if (s.bias == null ? def !== 0 : s.bias < lo || s.bias > hi) s.setBias(def);
    }
    changed(); refresh();
  };

  let openKey = moveOpen;
  const srcRow = s => {
    const row = searchable(h('div', { class: 'row-item src-row' + (s.on ? '' : ' off'), draggable: 'true', title: 'Arraste para outra categoria' },
      h('span', { class: 'grip' }, icon('grip')),
      favTile({ url: s.site, name: s.name, icon: s.icon }),
      h('div', { class: 'two' }, h('span', { class: 'lbl' }, s.name), h('span', { class: 'sub' }, bareHost(s.site))),
      s.cat === 'Brasil' ? biasDots(s.bias, v => { s.setBias(v); changed(); refresh(); }) : null,
      h('button', { type: 'button', class: 'icon-btn ghost move-btn' + (openKey === s.key ? ' on' : ''), title: 'Mover para outra categoria',
        onclick: () => { moveOpen = openKey === s.key ? null : s.key; refresh(); } }, icon('chevrons')),
      switchFor(s.on, sw => {
        const done = ok => { if (!ok) { sw.checked = false; return; } s.setOn(sw.checked); changed(); refresh(); };
        if (sw.checked) askPermission(s.perms).then(done); else done(true);
      })), s.name, bareHost(s.site), BIAS[s.bias] ? BIAS[s.bias].label : '', s.cat);
    row.addEventListener('dragstart', e => { e.dataTransfer.setData('text/x-news-src', s.key); e.dataTransfer.effectAllowed = 'move'; row.classList.add('dragging'); });
    row.addEventListener('dragend', () => row.classList.remove('dragging'));
    if (openKey !== s.key) return row;
    // escolhas de destino, logo abaixo da linha
    const here = sectionOf(s);
    const chips = h('div', { class: 'move-chips' }, NEWS_SECTIONS.map(dest => h('button', {
      type: 'button', class: 'move-chip' + (dest === here ? ' on' : ''),
      onclick: () => { moveOpen = null; moveTo(s.key, dest); }
    }, BR_SECTIONS[dest] ? h('span', { class: 'bias-pip', style: `--c:${BIAS[BR_SECTIONS[dest][2]].color}` }) : null, dest)));
    const extra = s.custom ? h('button', { type: 'button', class: 'size-reset danger-text', onclick: () => { moveOpen = null; s.remove(); changed(); refresh(); } }, 'Remover esta fonte') : null;
    return [row, h('div', { class: 'size-editor move-editor' }, h('span', { class: 'sub' }, 'Mover para:'), chips, extra)];
  };

  // seções; cada uma aceita fontes arrastadas de outra
  const sections = NEWS_SECTIONS.map(dest => {
    const list = all.filter(s => sectionOf(s) === dest).sort((a, b) => (a.bias ?? 0) - (b.bias ?? 0) || a.name.localeCompare(b.name));
    if (!list.length && dest === 'Suas fontes') return null;
    const rows = list.length ? list.flatMap(s => [].concat(srcRow(s))) : [h('div', { class: 'row-item empty-drop' }, h('span', { class: 'sub' }, 'Arraste fontes para cá'))];
    const [title, group] = ui.section(dest, ...rows);
    group.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('text/x-news-src')) { e.preventDefault(); group.classList.add('drop-here'); } });
    group.addEventListener('dragleave', e => { if (!group.contains(e.relatedTarget)) group.classList.remove('drop-here'); });
    group.addEventListener('drop', e => { e.preventDefault(); group.classList.remove('drop-here'); moveTo(e.dataTransfer.getData('text/x-news-src'), dest); });
    return [title, group];
  }).filter(Boolean);


  // pontuação do seu conjunto: média do viés das fontes ligadas que têm nota
  const scores = [
    ...Object.keys(NEWS_PRESETS).filter(id => n.enabled[id]).map(id => biasOf({ id })),
    ...n.custom.filter(c => c.on).map(c => c.bias ?? null)
  ].filter(s => s != null);
  let mix = null;
  if (scores.length) {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const lbl = BIAS[Math.max(-2, Math.min(2, Math.round(avg)))].label;
    mix = h('div', { class: 'row-item stack bias-mix' },
      h('div', { class: 'line' }, h('span', { class: 'badge' }, icon('sliders')), h('span', { class: 'lbl' }, 'Equilíbrio das suas fontes'), h('span', { class: 'val' }, lbl)),
      h('div', { class: 'bias-bar' }, h('span', { class: 'bias-mark', style: `left:${(avg + 2) / 4 * 100}%` })),
      h('div', { class: 'bias-ends' }, h('span', {}, 'Esquerda'), h('span', {}, 'Centro'), h('span', {}, 'Direita')));
  }

  // filtro rápido da lista (a busca na web fica em "Adicionar fonte")
  const q = h('input', { type: 'text', placeholder: 'Filtrar fontes…', spellcheck: 'false', autocomplete: 'off' });
  const listWrap = h('div', { class: 'news-src-list' }, ...sections.flat());
  q.addEventListener('input', () => {
    const term = q.value.trim().toLowerCase();
    for (const g of listWrap.querySelectorAll('.group')) {
      let any = false;
      for (const row of g.children) { const hit = !term || (row.dataset.q || '').includes(term); row.hidden = !hit; any = any || hit; }
      g.hidden = !any;
      if (g.previousElementSibling && g.previousElementSibling.tagName === 'H5') g.previousElementSibling.hidden = !any;
    }
  });

  return [
    h('h5', { id: 'news-settings' }, 'Notícias'),
    h('div', { class: 'group' }, ui.action('plus', 'Adicionar fonte', openSourcePicker, 'accent')),
    mix ? h('div', { class: 'group' }, mix) : null,
    h('label', { class: 'pick-search news-search' }, icon('search'), q),
    listWrap,
    ui.note('A nota de viés de cada veículo brasileiro é uma estimativa inicial feita pelo Claude a partir da linha editorial pública; toque nos pontos para dar a sua.'),
    ...ui.section('Exibição',
      ui.slider('list', 'Quantidade', 'news.count', 4, 30, 1),
      ui.toggle('image', 'Imagens', 'news.images'),
      ui.toggle('text', 'Resumo', 'news.summary'),
      ui.toggle('globe', 'Traduzir notícias em inglês', 'news.translate', () => { if (cfg.news.translate) { const c = $('.card.news'); if (c) fillNews(c, true); } }),
      // "Peneira": o filtro de qualidade das notícias (ver junkReason)
      (() => {
        const r = ui.toggle('sieve', 'Peneira', 'news.clean', () => { const c = $('.card.news'); if (c) fillNews(c, true); });
        r.querySelector('.lbl').replaceWith(h('div', { class: 'two' }, h('span', { class: 'lbl' }, 'Peneira'),
          h('span', { class: 'sub' }, 'Tira propaganda, cupons e notícias só com manchete')));
        return r;
      })(),
      ui.slider('calendar', 'Notícias de até (dias)', 'news.maxAge', 1, 30, 1),
      ui.toggle('sliders', 'Cor do viés nas notícias', 'news.showBias'),
      ui.segRow('reset', 'Atualizar', 'news.refresh', [[15, '15 min'], [30, '30 min'], [60, '1 h']])),
    ui.note('A tradução usa o tradutor do navegador quando disponível; senão, o Google Tradutor (só título e resumo são enviados).')
  ];
}

// ---------- Adicionar fonte: busca por nome, como na janela de favoritos ----------
function openSourcePicker() {
  const dlg = $('#src-dialog'), q = $('#src-q'), list = $('#src-list'), caption = $('#src-caption');
  const n = cfg.news;
  let token = 0, timer;

  // uma linha de resultado; "action" é chamada no toque (o pedido de permissão precisa nascer do toque)
  function row(it) {
    const state = h('span', { class: 'pick-state' });
    const sub = h('span', { class: 'sub' }, it.sub);
    const r = h('button', { type: 'button', class: 'row-item clickable pick-row' }, favTile({ url: it.site, name: it.name, icon: it.icon }),
      h('div', { class: 'two' }, h('span', { class: 'lbl' }, it.name), sub), state);
    const paint = (s, msg) => {
      r.classList.toggle('added', s === 'on');
      r.classList.toggle('busy', s === 'busy');
      state.replaceChildren(icon(s === 'on' ? 'check' : s === 'busy' ? 'reset' : s === 'allow' ? 'link' : 'plus'));
      sub.textContent = msg || it.sub;
    };
    paint(it.on() ? 'on' : 'off');
    let pending = null; // feed em outro domínio, esperando a segunda permissão
    r.addEventListener('click', () => {
      if (r.classList.contains('busy')) return;
      if (it.preset) {
        if (n.enabled[it.preset]) { n.enabled[it.preset] = false; changed(); paint('off'); return; }
        askPermission([it.feed, it.site]).then(ok => { if (ok) { n.enabled[it.preset] = true; changed(); paint('on'); } });
        return;
      }
      if (it.on()) { const i = n.custom.findIndex(c => bareHost(c.site || c.url) === bareHost(it.site)); if (i >= 0) n.custom.splice(i, 1); changed(); paint('off'); return; }
      askPermission([pending || it.site]).then(async ok => {
        if (!ok) return;
        paint('busy', 'Procurando o feed…');
        try {
          let found;
          if (pending) { const fi = feedInfo(await fetchText(pending)); if (!fi) throw 0; found = { feed: pending, title: fi.title }; }
          else found = await discoverFeed(it.site);
          if (found.needs) { pending = found.needs; paint('allow', 'Toque de novo para permitir ' + urlHost(found.needs)); return; }
          if (!n.custom.some(c => c.url === found.feed)) {
            // nome: o do Wikidata quando veio da busca; se você digitou o endereço, o nome oficial do site
            const c = { name: it.auto ? (found.title || it.name) : it.name, autoName: !!it.auto, url: found.feed, site: it.site, on: true, bias: null, page: !!found.page };
            paint('busy', 'Pegando nome e ícone…');
            await completeSource(c);
            n.custom.push(c);
          }
          changed(); paint('on');
        } catch { pending = null; paint('off', 'Não achei uma lista de notícias nesse site'); }
      });
    });
    return r;
  }

  const presetItem = ([id, p]) => ({ preset: id, name: p.name, site: p.site, feed: p.url, icon: presetIcon(id),
    sub: bareHost(p.site) + ' · ' + (biasOf({ id }) != null ? BIAS[biasOf({ id })].label : p.cat), on: () => !!n.enabled[id] });
  const webItem = (url, name, kind) => ({ name, auto: kind !== 'web', site: new URL(url).origin, icon: cfg.pickWeb ? remoteIcon(url) : '',
    sub: bareHost(url) + ' · ' + kind, on: () => n.custom.some(c => bareHost(c.site || c.url) === bareHost(url)) });

  async function show() {
    const my = ++token, text = q.value.trim(), term = text.toLowerCase();
    const presets = Object.entries(NEWS_PRESETS).filter(([, p]) => !term || p.name.toLowerCase().includes(term) || bareHost(p.site).includes(term));
    const items = presets.slice(0, term ? 20 : 40).map(presetItem);
    if (looksLikeAddress(text) && !presets.length) items.unshift(webItem(addressUrl(text), prettyHost(addressUrl(text)), 'endereço digitado'));
    let failed = false;
    const paintAll = (loading, web) => {
      caption.textContent = !term ? 'Fontes prontas' : loading ? 'Buscando na web…' : (items.length + web.length) ? 'Resultados'
        : failed ? 'A busca na web não respondeu. Tente de novo.' : 'Nada encontrado';
      list.hidden = !(items.length + web.length);
      list.replaceChildren(...items.map(row), ...web.map(row));
    };
    paintAll(term.length >= 2, []);
    if (term.length < 2) return;
    let res = [];
    try { res = await webSites(text); } catch { failed = true; }
    if (my !== token) return;
    const known = new Set([...Object.values(NEWS_PRESETS).map(p => bareHost(p.site)), ...items.map(i => bareHost(i.site))]);
    paintAll(false, res.filter(r => !known.has(bareHost(r.url))).map(r => webItem(r.url, r.name, 'web')));
  }

  q.value = '';
  q.oninput = () => { clearTimeout(timer); timer = setTimeout(show, 300); };
  q.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); list.querySelector('.pick-row:not(.added)')?.click(); } };
  $('#src-done').onclick = () => dlg.close();
  dlg.onclose = () => syncPanel('blocos');
  show();
  dlg.showModal();
  q.focus();
}
// ---------- Mercado: moedas, ações, FIIs, cripto, índices (Yahoo Finance, sem cadastro) ----------
const MARKET_RANGES = { '1d': ['1d', '5m', 'Dia'], '5d': ['5d', '30m', 'Semana'], '1mo': ['1mo', '1d', 'Mês'], '1y': ['1y', '1wk', 'Ano'] };
const YF = 'https://query1.finance.yahoo.com';

// rótulo curto para o círculo do ativo
// símbolo de cada ativo: ícone de traço fino (monocromático, na cor do texto) para o tipo de ativo,
// o símbolo da moeda, ou o código da ação quando o código é a melhor identificação
const MK_ICONS = {
  index: '<path d="M3 17l5-5 4 3 8-8"/><path d="M15 7h5v5"/>',
  up: '<path d="M7 17 17 7"/><path d="M9 7h8v8"/>',
  down: '<path d="M7 7l10 10"/><path d="M17 9v8H9"/>',
  bank: '<path d="M3 9.5 12 4l9 5.5"/><path d="M5 10v8M9.7 10v8M14.3 10v8M19 10v8"/><path d="M3 20h18"/>',
  percent: '<path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.3"/><circle cx="17" cy="17" r="2.3"/>',
  cart: '<path d="M3 4h2.5l2 11h10.5l2-8H7"/><circle cx="9.5" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>',
  building: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13 9 5 9-5"/>',
  bar: '<path d="M3.5 19h7.5l-1.6-5H5.1l-1.6 5zM13 19h7.5l-1.6-5h-4.3L13 19zM8.3 11.5h7.4L14.1 6.5H9.9l-1.6 5z"/>', // lingotes
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  leaf: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14"/><path d="M5 19 13 11"/>',
  btc: '<path d="M8 5v14M8 5h5.5a3.5 3.5 0 0 1 0 7H8M8 12h6.5a3.5 3.5 0 0 1 0 7H8M10 3v2M13 3v2M10 19v2M13 19v2"/>',
  eth: '<path d="m12 3-6 9.5 6 3.5 6-3.5L12 3z"/><path d="m6 14.5 6 6.5 6-6.5-6 3.5-6-3.5z"/>',
  coin: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.5"/>'
};
const CURRENCY_SIGN = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', CHF: '₣', CAD: '$', ARS: '$' };
function marketBadge(sym) {
  const ic = name => { const s = h('span', { class: 'mk-ic' }); s.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${MK_ICONS[name]}</svg>`; return s; };
  const txt = (s, cls = '') => h('span', { class: 'mk-txt ' + cls }, s);
  if (sym.startsWith('@bcb:')) return ic({ 432: 'bank', 4389: 'percent', 13522: 'cart' }[sym.slice(5)] || 'percent');
  if (/^@(top|bottom):/.test(sym)) return ic(sym.startsWith('@top') ? 'up' : 'down');
  const fx = sym.match(/^([A-Z]{3})(BRL)?=X$/);
  if (fx) return txt(CURRENCY_SIGN[sym === 'BRL=X' ? 'USD' : fx[1]] || fx[1], 'sign');
  if (/^BTC-/.test(sym)) return ic('btc');
  if (/^ETH-/.test(sym)) return ic('eth');
  if (marketKind(sym) === 'Cripto') return txt(sym.split('-')[0].slice(0, 3));
  if (sym.startsWith('^')) return ic('index');
  if (/^(GC|SI)=F/.test(sym)) return ic('bar');
  if (/^(CL|BZ|NG)=F/.test(sym)) return ic('drop');
  if (/=F$/.test(sym)) return ic('leaf');
  // ações e fundos: o código (PETR, VALE, AAPL) diz mais que qualquer ícone
  const code = sym.replace(/[.=-].*$/, '');
  return txt(code.replace(/\d+$/, '').slice(0, 4) || code.slice(0, 4), code.length > 3 ? 'small' : '');
}const marketKind = (sym, type = '', name = '') =>
  sym.startsWith('@bcb:') ? 'Taxa' : /^@(top|bottom):/.test(sym) ? 'Destaque do dia'
  : /=X$/.test(sym) || type === 'CURRENCY' ? 'Moeda'
  : type === 'CRYPTOCURRENCY' || /^(BTC|ETH|SOL|XRP|ADA|DOGE|LTC|BNB)-/.test(sym) ? 'Cripto'
  : sym.startsWith('^') || type === 'INDEX' ? 'Índice'
  : /=F$/.test(sym) || type === 'FUTURE' ? 'Commodity'
  : /11\.SA$/.test(sym) && /FII|IMOB|FDO|FUNDO/i.test(name) ? 'FII'
  : type === 'ETF' || /11\.SA$/.test(sym) ? 'ETF/FII'
  : 'Ação';

const getJson = async (url, ms = 9000) => {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try { const r = await net(url, { signal: ctl.signal, credentials: 'omit' }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); }
  finally { clearTimeout(t); }
};
// cripto: CoinGecko (gratuito, estável); preço e gráfico do período numa chamada só
const COINGECKO_IDS = { BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', XRP: 'ripple', ADA: 'cardano', DOGE: 'dogecoin', LTC: 'litecoin', BNB: 'binancecoin' };
// se o CoinGecko recusar (403/429), fica 6 h sem tentar: não gasta pedidos nem enche o console de erros
let cgOffUntil = null;
async function quoteCoinGecko(sym, range) {
  const [coin, vs] = sym.split('-'), id = COINGECKO_IDS[coin];
  if (!id) throw new Error('moeda desconhecida');
  if (cgOffUntil === null) cgOffUntil = (await store.get('cgOffUntil')) || 0;
  if (Date.now() < cgOffUntil) throw new Error('CoinGecko em pausa');
  const days = { '1d': 1, '5d': 7, '1mo': 30, '1y': 365 }[range] || 1;
  let j;
  try { j = await getJson(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=${vs.toLowerCase()}&days=${days}`); }
  catch (e) {
    if (/HTTP (403|429)/.test(e.message)) { cgOffUntil = Date.now() + 6 * 3600e3; store.set('cgOffUntil', cgOffUntil); }
    throw e;
  }
  const pts = (j.prices || []).map(p => p[1]);
  if (!pts.length) throw new Error('sem dados');
  const step = Math.max(1, Math.floor(pts.length / 120));
  return { price: pts[pts.length - 1], base: pts[0], currency: vs, name: coin, points: pts.filter((_, i) => i % step === 0), at: Date.now() };
}
// moedas: AwesomeAPI (brasileira, gratuita) — reserva quando o Yahoo não responder; sem gráfico
async function quoteAwesome(sym) {
  const pair = sym === 'BRL=X' ? 'USD-BRL' : sym.replace(/=X$/, '').replace(/^(\w{3})(\w{3})$/, '$1-$2');
  const j = await getJson(`https://economia.awesomeapi.com.br/json/last/${pair}`);
  const q = j[pair.replace('-', '')];
  if (!q) throw new Error('sem dados');
  const price = +q.bid, pct = +q.pctChange;
  // gráfico: últimas cotações do par (a API devolve da mais nova para a mais antiga)
  let points = [];
  try { points = (await getJson(`https://economia.awesomeapi.com.br/json/${pair}/60`)).map(x => +x.bid).filter(v => v > 0).reverse(); } catch {}
  return { price, base: price / (1 + pct / 100), currency: q.codein, name: q.name, points, at: Date.now() };
}
// ---------- Itens especiais do Mercado ----------
// "@top:BR" / "@bottom:BR": maior alta / maior baixa do dia entre as principais ações de cada bolsa
// "@bcb:432": séries do Banco Central (Selic, CDI, IPCA)
const MOVER_BASKETS = {
  BR: ['PETR4', 'VALE3', 'ITUB4', 'BBDC4', 'BBAS3', 'B3SA3', 'ABEV3', 'WEGE3', 'PRIO3', 'ELET3', 'SUZB3', 'RENT3', 'EMBR3', 'MGLU3', 'BBSE3', 'GGBR4', 'CSNA3', 'USIM5',
    'JBSS3', 'RADL3', 'RAIL3', 'SBSP3', 'EQTL3', 'VIVT3', 'TIMS3', 'LREN3', 'HAPV3', 'RDOR3', 'CMIG4', 'CPLE6', 'ENEV3', 'KLBN11', 'BRFS3', 'CSAN3', 'UGPA3', 'VBBR3',
    'BPAC11', 'SANB11', 'ITSA4', 'ASAI3', 'TOTS3', 'HYPE3', 'YDUQ3', 'COGN3', 'CVCB3', 'MRVE3', 'CYRE3', 'BRAV3'].map(s => s + '.SA'),
  AR: ['GGAL', 'BMA', 'YPFD', 'PAMP', 'TXAR', 'ALUA', 'CEPU', 'TGSU2', 'CRES', 'SUPV', 'BYMA', 'COME', 'EDN', 'LOMA', 'MIRG', 'TECO2', 'TRAN', 'VALO', 'BBAR', 'CVH', 'TGNO4', 'METR'].map(s => s + '.BA'),
  MX: ['AMXB', 'WALMEX', 'FEMSAUBD', 'GFNORTEO', 'GMEXICOB', 'CEMEXCPO', 'BIMBOA', 'GAPB', 'ASURB', 'OMAB', 'KOFUBL', 'AC', 'GRUMAB', 'ALSEA', 'PINFRA', 'ORBIA', 'LABB', 'KIMBERA', 'BOLSAA'].map(s => s + '.MX'),
  CRYPTO: ['BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'ADA', 'DOGE', 'TRX', 'AVAX', 'LINK', 'DOT', 'LTC', 'BCH', 'TON11419', 'SHIB', 'XLM', 'UNI7083', 'NEAR', 'ATOM', 'APT21794'].map(s => s + '-USD')
};
const MOVER_NAMES = { BR: 'Brasil', US: 'EUA', AR: 'Argentina', MX: 'México', CRYPTO: 'Cripto' };
const BCB_SERIES = {
  432: { name: 'Selic', unit: 'a.a.', days: 400 },        // meta definida pelo Copom
  4389: { name: 'CDI', unit: 'a.a.', days: 400 },         // CDI anualizado (base 252)
  13522: { name: 'IPCA', unit: '12m', days: 760 }
};
const isSpecial = s => s.startsWith('@');

// várias cotações num pedido só (até 20 por vez)
async function sparkBatch(symbols) {
  const out = {};
  for (let i = 0; i < symbols.length; i += 20) {
    const part = symbols.slice(i, i + 20);
    const j = await getJson(`${YF}/v8/finance/spark?symbols=${part.map(encodeURIComponent).join(',')}&range=1d&interval=1d`);
    for (const [k, v] of Object.entries(j)) {
      const last = (v.close || []).filter(x => x != null).pop();
      if (last != null && v.chartPreviousClose) out[k] = (last / v.chartPreviousClose - 1) * 100;
    }
  }
  return out;
}
async function quoteMover(code) {
  const [kind, region] = code.slice(1).split(':'), top = kind === 'top';
  let pick;
  if (region === 'US') {
    // EUA: lista pronta do Yahoo com o mercado inteiro
    const j = await getJson(`${YF}/v1/finance/screener/predefined/saved?scrIds=${top ? 'day_gainers' : 'day_losers'}&count=1&lang=pt-BR`);
    const q = j.finance.result[0].quotes[0];
    pick = q.symbol;
  } else {
    const ch = await sparkBatch(MOVER_BASKETS[region]);
    const list = Object.entries(ch).sort((a, b) => top ? b[1] - a[1] : a[1] - b[1]);
    if (!list.length) throw new Error('sem dados');
    pick = list[0][0];
  }
  const q = await quoteYahoo(pick, '1d');
  return { ...q, sym: pick, label: pick.replace(/\.(SA|BA|MX)$/, '').replace(/-USD$/, '') + ' · ' + q.name };
}
async function quoteBcb(code) {
  const id = +code.split(':')[1], meta = BCB_SERIES[id];
  // por intervalo de datas: o atalho "últimos N" do Banco Central aceita no máximo 20 registros
  const br = d => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const from = new Date(Date.now() - (meta ? meta.days : 400) * 864e5), to = new Date(Date.now() + 60 * 864e5);
  const j = await getJson(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${id}/dados?formato=json&dataInicial=${br(from)}&dataFinal=${br(to)}`);
  const today = Date.now();
  // a série da Selic traz datas futuras (a meta vigente); fica só até hoje, em ordem
  const rows = j.map(x => { const [d, m, y] = x.data.split('/'); return { t: new Date(+y, +m - 1, +d).getTime(), v: +x.valor }; })
    .filter(x => x.t <= today && !isNaN(x.v)).sort((a, b) => a.t - b.t);
  if (!rows.length) throw new Error('sem dados');
  const price = rows[rows.length - 1].v;
  // variação: em pontos percentuais desde a última mudança da taxa
  const prev = [...rows].reverse().find(x => x.v !== price);
  return { price, base: prev ? prev.v : price, rate: true, unit: meta ? meta.unit : '', currency: '', name: meta ? meta.name : 'Série ' + id,
    since: prev ? prev.t : null, points: rows.map(x => x.v), at: Date.now() };
}

async function fetchQuote(sym, range) {
  if (/^@(top|bottom):/.test(sym)) return quoteMover(sym);
  if (sym.startsWith('@bcb:')) return quoteBcb(sym);
  const crypto = sym.match(/^(BTC|ETH|SOL|XRP|ADA|DOGE|LTC|BNB)-(BRL|USD|EUR)$/);
  if (crypto) {
    try { return await quoteCoinGecko(sym, range); } catch {}
    // reservas: o Yahoo (direto em dólar, ou em dólar convertido pelo câmbio); depois o AwesomeAPI
    if (crypto[2] === 'USD') { try { return await quoteYahoo(sym, range); } catch {} }
    else {
      try {
        const [usd, fx] = await Promise.all([quoteYahoo(crypto[1] + '-USD', range), quoteYahoo(crypto[2] === 'BRL' ? 'BRL=X' : crypto[2] + 'USD=X', '1d')]);
        const k = crypto[2] === 'BRL' ? fx.price : 1 / fx.price;
        return { ...usd, price: usd.price * k, base: usd.base * k, points: usd.points.map(v => v * k), currency: crypto[2] };
      } catch {}
    }
    return quoteAwesome(crypto[1] + crypto[2] + '=X');
  }
  try { return await quoteYahoo(sym, range); }
  catch (e) { if (/=X$/.test(sym)) return quoteAwesome(sym); throw e; }
}
async function quoteYahoo(sym, range) {
  const [r, interval] = MARKET_RANGES[range] || MARKET_RANGES['1d'];
  {
    const j = await getJson(`${YF}/v8/finance/chart/${encodeURIComponent(sym)}?range=${r}&interval=${interval}`);
    const out = j.chart && j.chart.result && j.chart.result[0];
    if (!out) throw new Error('sem dados');
    const m = out.meta;
    let closes = ((out.indicators.quote[0] || {}).close || []).filter(v => v != null);
    const price = m.regularMarketPrice ?? closes[closes.length - 1];
    // variação: no "Dia" contra o fechamento anterior; nos outros períodos contra o começo do período
    const base = range === '1d' ? (m.chartPreviousClose ?? m.previousClose ?? closes[0]) : (closes[0] ?? m.chartPreviousClose);
    // no "Dia", moedas e cripto viram o dia de madrugada: logo depois, o pregão novo tem 0 ou poucos
    // pontos. Aí o gráfico usa as últimas 24 h do histórico de 5 dias.
    if (range === '1d' && closes.length < 12) {
      try {
        const w = (await getJson(`${YF}/v8/finance/chart/${encodeURIComponent(sym)}?range=5d&interval=30m`)).chart.result[0];
        const ts = w.timestamp || [], cs = (w.indicators.quote[0] || {}).close || [], since = Date.now() / 1000 - 26 * 3600;
        const last24 = cs.filter((v, i) => v != null && ts[i] >= since);
        if (last24.length >= 2) closes = last24;
      } catch {}
    }
    return { price, base, currency: m.currency || '', name: (m.shortName || m.longName || sym).replace(/\s{2,}.*/, '').trim(), points: closes.slice(-120), at: Date.now() };
  }
}

let marketJob = null;
async function loadMarket(force) {
  const mk = cfg.market, syms = mk.symbols.map(x => x.s), key = syms.join('|') + '@' + mk.range;
  const cache = (await store.get('market')) || {};
  // guardado e recente — a não ser que algum ativo tenha ficado sem cotação ou sem gráfico
  const complete = syms.every(s => cache.data && cache.data[s] && (cache.data[s].points || []).length >= 2);
  const age = Date.now() - (cache.at || 0);
  if (!force && cache.key === key && age < mk.refresh * 6e4 && (complete || age < 6e4)) return cache; // incompleto: tenta de novo no máximo 1×/min
  if (marketJob) return marketJob;
  marketJob = (async () => {
    // em fila, dois por vez: o Yahoo bloqueia por um tempo (erro 429) quem pede muito de uma vez
    const res = new Array(syms.length);
    let next = 0;
    await Promise.all([0, 1].map(async () => {
      while (next < syms.length) {
        const i = next++;
        try { res[i] = { status: 'fulfilled', value: await fetchQuote(syms[i], mk.range) }; }
        catch (e) { res[i] = { status: 'rejected', reason: e }; }
      }
    }));
    const data = {};
    res.forEach((r, i) => { data[syms[i]] = r.status === 'fulfilled' ? r.value : (cache.data && cache.data[syms[i]]) || null; });
    // "sem cotação" só para quem não tem nem o último valor guardado
    const out = { key, at: Date.now(), data, failed: syms.filter((s, i) => res[i].status === 'rejected' && !data[s]) };
    await store.set('market', out);
    return out;
  })().finally(() => { marketJob = null; });
  return marketJob;
}

const fmtPrice = (v, cur, sym) => {
  if (v == null || isNaN(v)) return '—';
  const digits = Math.abs(v) >= 1000 ? 0 : Math.abs(v) >= 10 ? 2 : Math.abs(v) >= 1 ? 2 : 4;
  if (sym.startsWith('^') || !cur) return v.toLocaleString('pt-BR', { maximumFractionDigits: digits });
  try { return v.toLocaleString('pt-BR', { style: 'currency', currency: cur, minimumFractionDigits: digits, maximumFractionDigits: digits }); }
  catch { return v.toLocaleString('pt-BR', { maximumFractionDigits: digits }); }
};
// taxas (Selic, CDI, IPCA): variação em pontos percentuais desde a última mudança
function rateChange(q) {
  const d = q.price - q.base;
  if (!d) return h('span', { class: 'mk-ch flat' }, 'estável');
  // a data da mudança fica na dica (passar o mouse), para a coluna de preço não alargar
  const when = q.since ? 'Mudou depois de ' + new Date(q.since).toLocaleDateString('pt-BR') : '';
  return h('span', { class: 'mk-ch ' + (d > 0 ? 'up' : 'down'), title: when }, (d > 0 ? '▲ ' : '▼ ') + Math.abs(d).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' p.p.');
}
// minigráfico do período (sem biblioteca: SVG desenhado no tamanho real, pixel a pixel)
let sparkSeq = 0;
const SPARK_W = 84, SPARK_H = 28;
// junta os pontos em faixas de ~2 px (média), para a linha não tremer com o ruído;
// o último ponto fica exato, pois é o valor de agora
function sparkPoints(points, n) {
  if (points.length <= n) return points.slice();
  const out = [], step = (points.length - 1) / (n - 1);
  for (let i = 0; i < n - 1; i++) {
    const a = Math.round(i * step), b = Math.max(a + 1, Math.round((i + 1) * step));
    let s = 0; for (let k = a; k < b; k++) s += points[k];
    out.push(s / (b - a));
  }
  out.push(points[points.length - 1]);
  return out;
}
// curva monotônica (Fritsch–Carlson): suave, mas sem "passar do ponto" acima ou abaixo dos dados
function smoothPath(xy) {
  const n = xy.length, f = v => v.toFixed(2), dx = [], m = [], t = [];
  for (let i = 0; i < n - 1; i++) { dx.push(xy[i + 1][0] - xy[i][0]); m.push((xy[i + 1][1] - xy[i][1]) / dx[i]); }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : 3 * (dx[i - 1] + dx[i]) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]);
  let d = `M${f(xy[0][0])},${f(xy[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = xy[i], [x1, y1] = xy[i + 1], h3 = dx[i] / 3;
    d += `C${f(x0 + h3)},${f(y0 + t[i] * h3)} ${f(x1 - h3)},${f(y1 - t[i + 1] * h3)} ${f(x1)},${f(y1)}`;
  }
  return d;
}
function sparkline(points, up) {
  if (!points || points.length < 2) return h('span', { class: 'spark empty' });
  const W = SPARK_W, H = SPARK_H, padR = 3, top = 3, bottom = H - 3;
  const pts = sparkPoints(points, 42);
  const min = Math.min(...pts), max = Math.max(...pts), span = max - min || 1;
  const xy = pts.map((v, i) => [i / (pts.length - 1) * (W - padR), max === min ? H / 2 : bottom - (v - min) / span * (bottom - top)]);
  const d = smoothPath(xy), [ex, ey] = xy[xy.length - 1];
  // sombra em degradê nos dois sentidos (some para baixo e para a esquerda, o passado);
  // a linha nasce suave à esquerda e termina num ponto discreto no valor atual
  const id = 'spk' + (++sparkSeq);
  const s = h('span', { class: 'spark ' + (up ? 'up' : 'down') });
  s.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" shape-rendering="geometricPrecision">
    <defs>
      <linearGradient id="${id}v" gradientUnits="userSpaceOnUse" x1="0" y1="${f2(Math.min(...xy.map(p => p[1])))}" x2="0" y2="${H}">
        <stop offset="0" stop-color="currentColor" stop-opacity=".30"/>
        <stop offset=".55" stop-color="currentColor" stop-opacity=".08"/>
        <stop offset="1" stop-color="currentColor" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="${id}h" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${W}" y2="0">
        <stop offset="0" stop-color="#fff" stop-opacity="0"/>
        <stop offset=".55" stop-color="#fff" stop-opacity=".55"/>
        <stop offset="1" stop-color="#fff" stop-opacity="1"/>
      </linearGradient>
      <mask id="${id}m" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">
        <rect width="${W}" height="${H}" fill="url(#${id}h)"/>
      </mask>
      <linearGradient id="${id}l" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${W}" y2="0">
        <stop offset="0" stop-color="currentColor" stop-opacity=".22"/>
        <stop offset=".45" stop-color="currentColor" stop-opacity=".8"/>
        <stop offset="1" stop-color="currentColor" stop-opacity="1"/>
      </linearGradient>
    </defs>
    <path class="area" d="${d}L${f2(ex)},${H}L0,${H}Z" fill="url(#${id}v)" mask="url(#${id}m)"/>
    <path class="line" d="${d}" stroke="url(#${id}l)" pathLength="1"/>
    <circle class="halo" cx="${f2(ex)}" cy="${f2(ey)}" r="3.2"/>
    <circle class="dot" cx="${f2(ex)}" cy="${f2(ey)}" r="1.7"/></svg>`;
  return s;
}
const f2 = v => v.toFixed(2);
// destaque do dia numa linha só, igual aos outros nomes: "PRIO3 · BR" (a seta do símbolo já diz
// se é alta ou baixa); o nome completo da empresa fica na dica ao passar o mouse
function moverLabel(s, q) {
  const m = s.match(/^@(top|bottom):(\w+)$/);
  if (!m || !q || !q.label) return null;
  const [code, company] = q.label.split(' · ');
  const kind = m[1] === 'top' ? 'alta' : 'baixa', where = MOVER_NAMES[m[2]] || m[2];
  return h('span', { class: 'lbl', title: `Maior ${kind} do dia · ${where}: ${code}${company ? ' (' + company + ')' : ''}` },
    `${code} · ${{ CRYPTO: 'cripto' }[m[2]] || m[2]}`);
}
function paintMarket(card, data) {
  const mk = cfg.market;
  const seg = h('div', { class: 'news-chips market-range' }, Object.entries(MARKET_RANGES).map(([k, [, , label]]) =>
    h('button', { type: 'button', class: mk.range === k ? 'on' : '', onclick: () => {
      if (mk.range === k) return;
      mk.range = k; save(); marketSwitch = true; fillMarket(card);
    } }, label)));
  const btn = h('button', { type: 'button', class: 'news-refresh' + (data && data.loading ? ' spin' : ''), title: 'Atualizar' }, icon('reset'));
  btn.addEventListener('click', () => fillMarket(card, true));
  // o cabeçalho continua o mesmo entre "carregando" e "pronto" (o destaque não pula no meio da animação)
  const old = card.querySelector(':scope > .news-head');
  let head;
  if (old && old.dataset.range === mk.range) { head = old; old.querySelector('.news-refresh').classList.toggle('spin', !!(data && data.loading)); }
  else { head = h('div', { class: 'news-head', 'data-range': mk.range }, h('h4', {}, 'Mercado'), seg, btn); fitChips(seg, 'market'); }
  if (!mk.symbols.length) {
    card.replaceChildren(head, h('div', { class: 'news-empty' }, h('span', {}, 'Escolha moedas, ações e cripto para acompanhar.'),
      h('button', { type: 'button', onclick: () => { togglePanel(true); openTab('blocos'); const b = $('#panel-body'), t = $('#market-settings'); if (t) b.scrollTo({ top: t.offsetTop - b.offsetTop - 8, behavior: 'smooth' }); } }, 'Escolher ativos')));
    return fitSoon();
  }
  // juros e inflação (Banco Central) não dependem do período escolhido: ficam num grupo à parte, embaixo
  const isRate = s => s.startsWith('@bcb:');
  const ordered = [...mk.symbols.filter(x => !isRate(x.s)), ...mk.symbols.filter(x => isRate(x.s))];
  const rows = ordered.map(({ s, name }) => {
    const q = data && data.data && data.data[s];
    const ch = q && q.base ? (q.price / q.base - 1) * 100 : null;
    const up = ch == null || ch >= 0;
    // subiu ou desceu desde a última atualização (mesmo período): o preço pisca na cor da mudança
    let tick = '';
    if (q && !(data && data.loading)) {
      const key = s + '|' + mk.range, prev = lastPrice[key];
      if (prev != null && prev !== q.price) tick = q.price > prev ? ' tick-up' : ' tick-down';
      lastPrice[key] = q.price;
    }
    return h('div', { class: 'mk-row' + (isRate(s) ? ' fixed' : '') + tick, title: s },
      h('span', { class: 'mk-badge' }, marketBadge(s)),
      // só o nome, numa linha; nos destaques do dia, o código da ação que foi a maior alta/baixa
      h('div', { class: 'mk-name' }, moverLabel(s, q) || h('span', { class: 'lbl' }, name || (q && q.name) || s)),
      mk.spark ? sparkline(q && q.points, q && q.rate ? q.price >= q.base : up) : null,
      h('div', { class: 'mk-price' }, h('span', {}, !q ? (data && data.loading ? '…' : '—') : q.rate ? q.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '% ' + q.unit : fmtPrice(q.price, q.currency, q.sym || s)),
        q && q.rate ? rateChange(q) : ch != null ? h('span', { class: 'mk-ch ' + (up ? 'up' : 'down') }, (up ? '▲ ' : '▼ ') + Math.abs(ch).toLocaleString('pt-BR', { maximumFractionDigits: 2, minimumFractionDigits: 2 }) + '%') : null));
  });
  const foot = data && data.failed && data.failed.length ? h('div', { class: 'news-foot' }, 'Sem cotação agora: ' + data.failed.map(s => (mk.symbols.find(x => x.s === s) || {}).name || s.replace(/\.SA$/, '')).join(', ')) : null;
  const firstRate = rows.findIndex(r => r.classList.contains('fixed'));
  if (firstRate >= 0) rows.splice(firstRate, 0, h('div', { class: 'mk-sep' + (firstRate === 0 ? ' alone' : ''), title: 'Estes valores não mudam com Dia, Semana, Mês ou Ano' },
    h('span', {}, 'Juros e inflação')));
  const list = h('div', { class: 'mk-list' }, rows);
  // troca de período: enquanto carrega, a lista antiga apaga; quando chega, as linhas entram em sequência
  if (marketSwitch) {
    if (data && data.loading) list.classList.add('dimmed');
    else {
      // a mesma resposta pode pintar o bloco duas vezes seguidas; as duas animam
      setTimeout(() => { marketSwitch = false; }, 120);
      list.classList.add('switching');
      rows.filter(el => !el.matches('.fixed, .mk-sep')).forEach((el, i) => el.style.setProperty('--i', i));
    }
  }
  card.replaceChildren(...[head, list, foot].filter(Boolean));
  fitSoon();
}
let marketSwitch = false; // a próxima pintura com dados vem de uma troca de período (anima a lista)
const lastPrice = {}; // último preço mostrado de cada ativo, para piscar quando ele muda
async function fillMarket(card, force) {
  const cache = (await store.get('market')) || {};
  paintMarket(card, { ...cache, loading: true });
  let data = cache;
  try { data = await loadMarket(force); } catch {}
  const cur = card.isConnected ? card : $('.card.market');
  if (cur) paintMarket(cur, data);
}
// atualiza sozinho enquanto a guia estiver aberta
setInterval(() => { const c = $('.card.market'); if (c && !document.hidden) fillMarket(c); }, 60000);

// catálogo de ativos por categoria (símbolos do Yahoo Finance; cripto também no CoinGecko)
const MARKET_CATALOG = {
  'Destaques do dia': [['@top:BR', 'Maior alta · Brasil'], ['@bottom:BR', 'Maior baixa · Brasil'], ['@top:US', 'Maior alta · EUA'], ['@bottom:US', 'Maior baixa · EUA'],
    ['@top:AR', 'Maior alta · Argentina'], ['@bottom:AR', 'Maior baixa · Argentina'], ['@top:MX', 'Maior alta · México'], ['@bottom:MX', 'Maior baixa · México'],
    ['@top:CRYPTO', 'Maior alta · Cripto'], ['@bottom:CRYPTO', 'Maior baixa · Cripto']],
  'Juros e inflação': [['@bcb:432', 'Selic'], ['@bcb:4389', 'CDI'], ['@bcb:13522', 'IPCA']],
  'Moedas': [['BRL=X', 'Dólar'], ['EURBRL=X', 'Euro'], ['GBPBRL=X', 'Libra'], ['CHFBRL=X', 'Franco suíço'], ['JPYBRL=X', 'Iene'], ['CNYBRL=X', 'Yuan'], ['CADBRL=X', 'Dólar canadense'], ['ARSBRL=X', 'Peso argentino']],
  'Cripto': [['BTC-BRL', 'Bitcoin'], ['ETH-BRL', 'Ethereum'], ['SOL-BRL', 'Solana'], ['XRP-BRL', 'XRP'], ['BNB-BRL', 'BNB'], ['ADA-BRL', 'Cardano'], ['DOGE-BRL', 'Dogecoin'], ['LTC-BRL', 'Litecoin'], ['BTC-USD', 'Bitcoin (US$)']],
  'Índices': [['^BVSP', 'Ibovespa'], ['^GSPC', 'S&P 500'], ['^IXIC', 'Nasdaq'], ['^DJI', 'Dow Jones'], ['^STOXX50E', 'Euro Stoxx 50'], ['^N225', 'Nikkei'], ['^TNX', 'Juros EUA 10 anos']],
  'Ações BR': [['PETR4.SA', 'Petrobras PN'], ['VALE3.SA', 'Vale'], ['ITUB4.SA', 'Itaú PN'], ['BBAS3.SA', 'Banco do Brasil'], ['BBDC4.SA', 'Bradesco PN'], ['WEGE3.SA', 'WEG'], ['ABEV3.SA', 'Ambev'], ['B3SA3.SA', 'B3'], ['PRIO3.SA', 'PRIO'], ['ELET3.SA', 'Eletrobras'], ['SUZB3.SA', 'Suzano'], ['RENT3.SA', 'Localiza'], ['EMBR3.SA', 'Embraer'], ['MGLU3.SA', 'Magazine Luiza'], ['TAEE11.SA', 'Taesa'], ['BBSE3.SA', 'BB Seguridade']],
  'FIIs': [['HGLG11.SA', 'HGLG11'], ['MXRF11.SA', 'MXRF11'], ['KNRI11.SA', 'KNRI11'], ['XPML11.SA', 'XPML11'], ['VISC11.SA', 'VISC11'], ['BTLG11.SA', 'BTLG11'], ['HGRU11.SA', 'HGRU11'], ['KNCR11.SA', 'KNCR11'], ['XPLG11.SA', 'XPLG11'], ['CPTS11.SA', 'CPTS11'], ['RECR11.SA', 'RECR11'], ['BCFF11.SA', 'BCFF11']],
  'ETFs': [['BOVA11.SA', 'BOVA11'], ['IVVB11.SA', 'IVVB11'], ['SMAL11.SA', 'SMAL11'], ['DIVO11.SA', 'DIVO11'], ['HASH11.SA', 'HASH11'], ['GOLD11.SA', 'GOLD11']],
  'EUA': [['AAPL', 'Apple'], ['MSFT', 'Microsoft'], ['NVDA', 'Nvidia'], ['GOOGL', 'Alphabet'], ['AMZN', 'Amazon'], ['META', 'Meta'], ['TSLA', 'Tesla'], ['BRK-B', 'Berkshire Hathaway'], ['MSTR', 'MicroStrategy'], ['COIN', 'Coinbase']],
  'Commodities': [['GC=F', 'Ouro'], ['SI=F', 'Prata'], ['BZ=F', 'Petróleo Brent'], ['CL=F', 'Petróleo WTI'], ['ZS=F', 'Soja'], ['KC=F', 'Café'], ['ZC=F', 'Milho']]
};

// janela "Adicionar ativos": categorias + busca no Yahoo; tocar adiciona ou tira
function openAssetPicker() {
  const mk = cfg.market, dlg = $('#asset-dialog'), q = $('#asset-q'), list = $('#asset-list'), cats = $('#asset-cats');
  const has = s => mk.symbols.some(x => x.s === s);
  let cat = 'Destaques do dia', token = 0, timer;
  const row = (s, name, sub) => {
    const state = h('span', { class: 'pick-state' });
    const r = h('button', { type: 'button', class: 'row-item clickable pick-row' }, h('span', { class: 'mk-badge' }, marketBadge(s)),
      h('div', { class: 'two' }, h('span', { class: 'lbl' }, name), h('span', { class: 'sub' }, sub)), state);
    const paint = () => { r.classList.toggle('added', has(s)); state.replaceChildren(icon(has(s) ? 'check' : 'plus')); };
    r.addEventListener('click', () => {
      if (has(s)) mk.symbols.splice(mk.symbols.findIndex(x => x.s === s), 1); else mk.symbols.push({ s, name });
      changed(); paint();
    });
    paint();
    return r;
  };
  const showCat = () => {
    cats.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.textContent === cat));
    list.hidden = false;
    list.replaceChildren(...MARKET_CATALOG[cat].map(([s, name]) => row(s, name, isSpecial(s) ? (s.startsWith('@bcb') ? 'Banco Central' : 'Atualiza a cada consulta') : s.replace(/\.SA$/, '') + ' · ' + marketKind(s, '', name))));
  };
  cats.replaceChildren(...Object.keys(MARKET_CATALOG).map(c => h('button', { type: 'button', onclick: () => { cat = c; q.value = ''; showCat(); } }, c)));
  q.value = '';
  q.oninput = () => {
    clearTimeout(timer);
    const term = q.value.trim();
    if (term.length < 2) { showCat(); return; }
    timer = setTimeout(async () => {
      const my = ++token;
      let found = [], failed = false;
      try {
        const j = await getJson(`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(term)}&quotesCount=10&newsCount=0&lang=pt-BR&region=BR`);
        found = (j.quotes || []).filter(x => x.symbol && x.quoteType !== 'OPTION');
      } catch { failed = true; }
      if (my !== token) return;
      // o que já está no catálogo também aparece, e ativos da B3 vêm primeiro
      const low = term.toLowerCase();
      const fromCatalog = Object.values(MARKET_CATALOG).flat().filter(([s, n]) => n.toLowerCase().includes(low) || s.toLowerCase().includes(low));
      found.sort((a, b) => (b.symbol.endsWith('.SA') ? 1 : 0) - (a.symbol.endsWith('.SA') ? 1 : 0));
      const seen = new Set(), rows = [];
      for (const [s, n] of fromCatalog) if (!seen.has(s)) { seen.add(s); rows.push(row(s, n, isSpecial(s) ? marketKind(s) : s.replace(/\.SA$/, '') + ' · ' + marketKind(s, '', n))); }
      for (const x of found) if (!seen.has(x.symbol)) {
        seen.add(x.symbol);
        const n = (x.shortname || x.longname || x.symbol).replace(/\s{2,}.*/, '').trim();
        rows.push(row(x.symbol, n, `${x.symbol.replace(/\.SA$/, '')} · ${marketKind(x.symbol, x.quoteType, n)} · ${x.exchDisp || x.exchange || ''}`));
      }
      cats.querySelectorAll('button').forEach(b => b.classList.remove('on'));
      list.replaceChildren(...(rows.length ? rows : [h('div', { class: 'row-item' }, h('span', { class: 'sub' }, failed ? 'A busca não respondeu agora. Tente de novo em instantes.' : 'Nada encontrado'))]));
    }, 300);
  };
  $('#asset-done').onclick = () => dlg.close();
  dlg.onclose = () => { syncPanel('blocos'); const c = $('.card.market'); if (c) fillMarket(c, true); };
  showCat();
  dlg.showModal();
  q.focus();
}

// configurações do mercado (em Blocos, quando o bloco está ligado)
function marketSettings() {
  const mk = cfg.market;
  const rows = mk.symbols.map((x, i) => {
    const grip = h('span', { class: 'grip', title: 'Arraste para reordenar' }, icon('grip'));
    const row = h('div', { class: 'row-item' }, grip, h('span', { class: 'mk-badge' }, marketBadge(x.s)),
      h('div', { class: 'two' }, h('span', { class: 'lbl' }, x.name || x.s), h('span', { class: 'sub' }, isSpecial(x.s) ? marketKind(x.s) : x.s.replace(/\.SA$/, '') + ' · ' + marketKind(x.s, '', x.name))),
      h('button', { type: 'button', class: 'icon-btn ghost', title: 'Remover', onclick: () => { mk.symbols.splice(i, 1); changed(); refresh(); } }, icon('trash')));
    sortable(row, mk.symbols, i, refresh, grip);
    return row;
  });
  return [
    h('h5', { id: 'market-settings' }, 'Mercado'),
    h('div', { class: 'group' }, ui.action('plus', 'Adicionar ativos', openAssetPicker, 'accent')),
    ...(rows.length ? ui.section('', ...rows) : []),
    rows.length ? ui.note('Arraste pela alça para reordenar.') : null,
    ...ui.section('Exibição',
      ui.toggle('chart', 'Minigráfico', 'market.spark'),
      ui.segRow('reset', 'Atualizar', 'market.refresh', [[1, '1 min'], [5, '5 min'], [15, '15 min']])),
    ui.note('Cotações do Yahoo Finance (cripto também pelo CoinGecko), gratuitas e sem cadastro. Ações e FIIs podem ter atraso de até 15 minutos.')
  ];
}

// ---------- Ícones (traço fino, 24×24) ----------
const ICONS = {
  palette: '<circle cx="13.5" cy="6.5" r="1"/><circle cx="17.5" cy="10.5" r="1"/><circle cx="8.5" cy="7.5" r="1"/><circle cx="6.5" cy="12.5" r="1"/><path d="M12 2a10 10 0 0 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.3A5.7 5.7 0 0 0 22 9.7C22 5.5 17.5 2 12 2z"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="9" cy="9" r="2"/><path d="m21 15-4.5-4.5L7 20"/>',
  layout: '<rect x="3" y="3" width="7.5" height="7.5" rx="2.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.8l-5.3 2.8 1-5.8-4.2-4.1 5.9-.9z"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  x: '<path d="M7 7l10 10M17 7 7 17"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  down: '<path d="m7 10 5 5 5-5"/>',
  pencil: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14a4 4 0 0 0 7 0"/><path d="M9 9.5h.01M15 9.5h.01" stroke-width="2.4"/>',
  text: '<path d="M5 7V5h14v2M12 5v14M9 19h6"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  corner: '<path d="M5 20v-8a7 7 0 0 1 7-7h8"/>',
  scale: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
  width: '<path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="4"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  grain: '<circle cx="6" cy="6" r=".8"/><circle cx="12" cy="8" r=".8"/><circle cx="18" cy="5" r=".8"/><circle cx="8" cy="13" r=".8"/><circle cx="15" cy="14" r=".8"/><circle cx="5" cy="19" r=".8"/><circle cx="11" cy="19" r=".8"/><circle cx="19" cy="19" r=".8"/>',
  blur: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8" stroke-dasharray="1.5 3"/>',
  angle: '<path d="M4 20h16M4 20 15 6"/><path d="M10 20a6 6 0 0 0-1.8-4.3"/>',
  shuffle: '<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
  quote: '<path d="M6 8h4v4c0 3-2 5-4 5.5M14 8h4v4c0 3-2 5-4 5.5"/>',
  note: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h6M9 16h4"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  list: '<path d="m4 7 2 2 3-3M4 16l2 2 3-3M13 8h7M13 17h7"/>',
  link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4M10 2h4"/>',
  cursor: '<path d="M9 4h6M9 20h6M12 4v16"/>',
  newtab: '<path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
  focus: '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/>',
  chevrons: '<path d="m8 9 4-4 4 4M8 15l4 4 4-4"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 16V5M7 10l5-5 5 5M5 20h14"/>',
  reset: '<path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.5M4 4v4.5h4.5"/>',
  code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>',
  zTop: '<path d="M5 4h14"/><rect x="7" y="8" width="10" height="5" rx="2"/>',
  zCenter: '<path d="M5 4h14M5 20h14" opacity=".35"/><rect x="7" y="9.5" width="10" height="5" rx="2"/>',
  zGrid: '<rect x="4" y="5" width="7" height="6" rx="2"/><rect x="13" y="5" width="7" height="6" rx="2"/><rect x="4" y="13" width="7" height="6" rx="2"/><rect x="13" y="13" width="7" height="6" rx="2"/>',
  grip: '<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" stroke-width="2.6"/>',
  columns: '<rect x="3" y="4" width="18" height="16" rx="4"/><path d="M9 4v16M15 4v16"/>',
  news: '<rect x="3" y="4" width="18" height="16" rx="4"/><path d="M7 9h10M7 13h10M7 17h6"/>',
  chart: '<path d="M4 19h16"/><path d="m5 15 4-5 4 3 6-7"/>',
  sieve: '<path d="M3 6h18l-7 8v5l-4 2v-7z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'
};
const icon = name => {
  const s = h('span', { class: 'ic', 'aria-hidden': 'true' });
  s.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
  return s;
};
const BLOCK_ICONS = { clock: 'clock', greeting: 'smile', search: 'search', shortcuts: 'star', quote: 'quote', notes: 'note', todo: 'list', links: 'link', countdown: 'timer', news: 'news', market: 'chart' };

// ---------- Painel de configurações ----------
const get = path => path.split('.').reduce((o, k) => o[k], cfg);
const set = (path, v) => {
  const keys = path.split('.'), last = keys.pop();
  keys.reduce((o, k) => o[k], cfg)[last] = v;
};
const changed = () => { save(); applyTheme(); render(); };
const refresh = () => openTab(currentTab);

const ui = {
  // legenda pequena + grupo arredondado
  section(title, ...rows) {
    return [title ? h('h5', {}, title) : null, h('div', { class: 'group' }, rows)];
  },
  row(ic, label, control, cls = '') {
    return h('div', { class: 'row-item ' + cls }, ic ? h('span', { class: 'badge' }, icon(ic)) : null,
      label ? h('span', { class: 'lbl' }, label) : null, control);
  },
  text(ic, label, path, placeholder = '') {
    const inp = h('input', { type: 'text', class: 'inline', value: get(path), placeholder, spellcheck: 'false' });
    inp.addEventListener('input', () => { set(path, inp.value); changed(); });
    return ui.row(ic, label, inp);
  },
  date(ic, label, path) {
    const inp = h('input', { type: 'date', class: 'inline', value: get(path) });
    inp.addEventListener('change', () => { set(path, inp.value); changed(); });
    return ui.row(ic, label, inp);
  },
  toggle(ic, label, path, after, invert) {
    const inp = h('input', { type: 'checkbox', checked: invert ? !get(path) : get(path) });
    inp.addEventListener('change', () => { set(path, invert ? !inp.checked : inp.checked); changed(); after && after(); });
    return ui.row(ic, label, h('label', { class: 'switch' }, inp, h('span', { class: 'knob' })));
  },
  // controle segmentado em pílula; opções: [valor, texto] ou [valor, null, ícone, dica]
  seg(path, options, after) {
    const wrap = h('div', { class: 'seg' });
    for (const [v, t, ic, tip] of options) {
      const b = h('button', { type: 'button', class: String(get(path)) === String(v) ? 'on' : '', title: tip || t || '' }, ic ? icon(ic) : null, t);
      b.addEventListener('click', () => { set(path, v); changed(); after ? after() : refresh(); });
      wrap.append(b);
    }
    return wrap;
  },
  segRow(ic, label, path, options, after) { return ui.row(ic, label, ui.seg(path, options, after)); },
  slider(ic, label, path, min, max, step = 1, unit = '') {
    const out = h('span', { class: 'val' }, get(path) + unit);
    const inp = h('input', { type: 'range', min, max, step, value: get(path) });
    const fill = () => inp.style.setProperty('--p', ((inp.value - min) / (max - min) * 100) + '%');
    fill();
    inp.addEventListener('input', () => { set(path, +inp.value); out.textContent = inp.value + unit; fill(); changed(); });
    return h('div', { class: 'row-item stack' },
      h('div', { class: 'line' }, h('span', { class: 'badge' }, icon(ic)), h('span', { class: 'lbl' }, label), out), inp);
  },
  swatch(path, title, removable) {
    const v = get(path);
    const inp = h('input', { type: 'color', value: v || '#888888' });
    inp.addEventListener('input', () => { set(path, inp.value); sw.style.background = inp.value; changed(); });
    const sw = h('label', { class: 'swatch' + (v ? '' : ' empty'), title, style: v ? `background:${v}` : '' }, inp, v ? null : icon('plus'));
    if (!removable || !v) return sw;
    const x = h('button', { type: 'button', class: 'swatch-x', title: 'Remover' }, icon('x'));
    x.addEventListener('click', () => { set(path, ''); changed(); refresh(); });
    return h('span', { class: 'swatch-wrap' }, sw, x);
  },
  colorRow(ic, label, path) { return ui.row(ic, label, ui.swatch(path, label)); },
  area(path, placeholder, mono) {
    const ta = h('textarea', { placeholder, spellcheck: 'false', rows: 1, class: mono ? 'mono' : '' });
    ta.value = get(path);
    ta.addEventListener('input', () => { set(path, ta.value); changed(); });
    return h('div', { class: 'row-item area' }, ta);
  },
  action(ic, label, onclick, cls = '') {
    return h('button', { type: 'button', class: 'row-item action ' + cls, onclick }, h('span', { class: 'badge' }, icon(ic)), h('span', { class: 'lbl' }, label));
  },
  note: t => h('p', { class: 'note' }, t)
};

const FONTS = [
  ['system-ui, sans-serif', 'Sistema'],
  ['"Inter", "Segoe UI", sans-serif', 'Inter / Segoe'],
  ['Georgia, "Times New Roman", serif', 'Georgia'],
  ['"Palatino Linotype", Palatino, serif', 'Palatino'],
  ['ui-monospace, "JetBrains Mono", Consolas, monospace', 'Mono'],
  ['"Trebuchet MS", sans-serif', 'Trebuchet'],
  ['Impact, "Arial Narrow", sans-serif', 'Condensada']
];
const ACCENTS = ['#f7931a', '#ff6b5e', '#f5c451', '#4fd1a5', '#5aa9ff', '#a78bfa', '#f472b6', '#e8e8ea'];

function favTile(sc) {
  const t = h('span', { class: 'mini-tile' });
  if (sc.icon && /^(https?:|data:|icons\/)/.test(sc.icon)) t.append(h('img', { src: sc.icon, alt: '', referrerpolicy: 'no-referrer' }));
  else if (sc.icon) t.textContent = sc.icon;
  else if (hasChrome) t.append(h('img', { alt: '', src: `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(sc.url)}&size=32` }));
  else t.textContent = (sc.name || '?')[0].toUpperCase();
  return t;
}
const hostOf = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

// arrastar para reordenar linhas de uma lista
function sortable(row, list, i, after, handle) {
  // com "handle", só a alça arrasta: assim dá para selecionar texto nos campos da linha
  row.draggable = !handle;
  if (handle) {
    handle.addEventListener('pointerdown', () => { row.draggable = true; });
    handle.addEventListener('pointerup', () => { row.draggable = false; });
    row.addEventListener('dragend', () => { row.draggable = false; });
  }
  row.addEventListener('dragstart', e => { e.dataTransfer.effectAllowed = 'move'; sortable.from = i; row.classList.add('dragging'); });
  // sem isso, um arraste cancelado deixava "from" preso e o próximo drop movia o item errado
  row.addEventListener('dragend', () => { row.classList.remove('dragging'); sortable.from = null; });
  row.addEventListener('dragover', e => { e.preventDefault(); row.classList.add('over'); });
  row.addEventListener('dragleave', () => row.classList.remove('over'));
  row.addEventListener('drop', e => {
    e.preventDefault(); row.classList.remove('over');
    const from = sortable.from;
    if (from == null || from === i) return;
    const [moved] = list.splice(from, 1);
    list.splice(i, 0, moved);
    sortable.from = null; changed(); after();
  });
}

const TABS = [
  ['aparencia', 'palette', 'Aparência'],
  ['fundo', 'image', 'Fundo'],
  ['blocos', 'layout', 'Blocos'],
  ['busca', 'search', 'Busca'],
  ['atalhos', 'star', 'Atalhos'],
  ['avancado', 'sliders', 'Avançado']
];

const tabs = {
  aparencia() {
    const accents = h('div', { class: 'swatches' });
    for (const c of ACCENTS) accents.append(h('button', {
      type: 'button', class: 'swatch' + (cfg.theme.accent.toLowerCase() === c ? ' on' : ''), style: `background:${c}`, title: c,
      onclick: () => { cfg.theme.accent = c; changed(); refresh(); }
    }));
    const custom = ui.swatch('theme.accent', 'Personalizada');
    custom.classList.add('rainbow');
    if (!ACCENTS.includes(cfg.theme.accent.toLowerCase())) custom.classList.add('on');
    accents.append(custom);

    const fonts = h('div', { class: 'fonts' });
    for (const [f, n] of FONTS) fonts.append(h('button', {
      type: 'button', class: cfg.theme.font === f ? 'on' : '', title: n, style: `font-family:${f}`,
      onclick: () => { cfg.theme.font = f; changed(); refresh(); }
    }, 'Aa'));

    return [
      ...ui.section('',
        ui.text('user', 'Nome', 'name', 'Seu nome'),
        ui.segRow('smile', 'Saudação', 'greetingMode', [['auto', 'Auto'], ['custom', 'Fixa']]),
        cfg.greetingMode === 'custom' ? ui.text('text', 'Texto', 'greetingText', 'Olá') : null
      ),
      ...ui.section('Destaque', h('div', { class: 'row-item' }, accents)),
      ...ui.section('Cores',
        ui.colorRow('text', 'Texto', 'theme.text'),
        ui.colorRow('drop', 'Cartões', 'theme.card'),
        ui.slider('eye', 'Opacidade', 'theme.cardOpacity', 0, 100, 1, '%'),
        ui.slider('blur', 'Vidro', 'theme.blur', 0, 40, 1, 'px'),
        ui.slider('grain', 'Granulado', 'theme.grain', 0, 100, 1, '%')
      ),
      ...ui.section('Fonte', h('div', { class: 'row-item' }, fonts)),
      ...ui.section('Layout',
        ui.slider('scale', 'Escala', 'theme.scale', 70, 150, 1, '%'),
        ui.slider('corner', 'Cantos', 'theme.radius', 0, 40, 1, 'px'),
        ui.slider('width', 'Largura', 'theme.maxWidth', 600, 2000, 10, 'px'),
        ui.segRow('columns', 'Posição', 'theme.align', [['top', null, 'zTop', 'Topo'], ['center', null, 'zCenter', 'Centro']])
      ),
      ...ui.section('Relógio',
        ui.slider('clock', 'Tamanho', 'theme.clockSize', 32, 220, 1, 'px'),
        ui.segRow('clock', 'Formato', 'clock.h24', [[true, '24h'], [false, '12h']]),
        ui.toggle('timer', 'Segundos', 'clock.seconds'),
        ui.toggle('calendar', 'Data', 'clock.showDate')
      )
    ];
  },

  fundo() {
    const b = cfg.bg, list = [
      h('div', { class: 'center-seg' }, ui.seg('bg.type', [['gradient', 'Gradiente'], ['solid', 'Cor'], ['image', 'Imagem']]))
    ];
    if (b.type === 'solid') list.push(...ui.section('', ui.colorRow('drop', 'Cor', 'bg.color')));
    if (b.type === 'gradient') {
      const stops = [b.g1, b.g2, b.g3].filter(Boolean).join(', ');
      const shuffle = h('button', { type: 'button', class: 'icon-btn', title: 'Aleatório', onclick: () => {
        const rnd = () => '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
        Object.assign(cfg.bg, { g1: rnd(), g2: rnd(), angle: Math.floor(Math.random() * 360) });
        changed(); refresh();
      } }, icon('shuffle'));
      list.push(
        h('div', { class: 'preview', style: `background:linear-gradient(${b.angle}deg, ${stops})` }),
        ...ui.section('',
          h('div', { class: 'row-item' }, h('div', { class: 'swatches' },
            ui.swatch('bg.g1', 'Cor 1'), ui.swatch('bg.g2', 'Cor 2'), ui.swatch('bg.g3', 'Cor 3', true)), h('span', { class: 'grow' }), shuffle),
          ui.slider('angle', 'Ângulo', 'bg.angle', 0, 360, 1, '°')
        )
      );
    }
    if (b.type === 'image') {
      const file = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
      file.addEventListener('change', async () => {
        const imgs = (await store.get('images')) || [];
        for (const f of file.files) imgs.push(await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); }));
        await store.set('images', imgs); bgChosen = imgs.length - 1; changed(); refresh();
      });
      const thumbs = h('div', { class: 'thumbs' }, h('button', { type: 'button', class: 'thumb add', title: 'Enviar imagens', onclick: () => file.click() }, icon('plus')), file);
      store.get('images').then(imgs => (imgs || []).forEach((src, i) => thumbs.append(
        h('div', { class: 'thumb' },
          h('img', { src, alt: '', title: 'Usar agora', onclick: () => { bgChosen = i; applyBackground(); } }),
          h('button', { type: 'button', class: 'swatch-x', title: 'Remover', onclick: async () => {
            imgs.splice(i, 1); await store.set('images', imgs); bgChosen = null; changed(); refresh();
          } }, icon('x'))))));
      list.push(
        ...ui.section('Suas imagens', h('div', { class: 'row-item' }, thumbs)),
        ui.note('Ficam salvas só no navegador.'),
        ...ui.section('Rotação', h('div', { class: 'row-item' }, ui.seg('bg.rotate', [['random', 'Aleatória'], ['daily', 'Diária'], ['first', 'Fixa']]))),
        ...ui.section('Links de imagens', ui.area('bg.imageUrls', 'https://… (uma por linha)')),
        ui.note('Links externos fazem requisição ao site da imagem.')
      );
    }
    list.push(...ui.section('Efeitos',
      ui.slider('moon', 'Escurecer', 'bg.dim', 0, 90, 1, '%'),
      ui.slider('blur', 'Desfocar', 'bg.blurPx', 0, 30, 1, 'px')
    ));
    return list;
  },

  blocos() {
    const rows = cfg.blocks.map((b, i) => {
      const cb = h('input', { type: 'checkbox', checked: b.on });
      cb.addEventListener('change', () => { b.on = cb.checked; changed(); refresh(); });
      const open = openSize === b.id;
      const sizeBtn = b.on ? h('button', { type: 'button', class: 'icon-btn ghost size-btn' + (open ? ' on' : ''), title: 'Posição e tamanho',
        onclick: () => { openSize = open ? null : b.id; refresh(); } }, icon('sliders')) : null;
      const row = h('div', { class: 'row-item' + (b.on ? '' : ' off') },
        h('span', { class: 'grip', title: 'Arraste para reordenar' }, icon('grip')),
        h('span', { class: 'badge' }, icon(BLOCK_ICONS[b.id] || 'layout')),
        h('span', { class: 'lbl' }, BLOCKS[b.id]),
        sizeBtn,
        h('label', { class: 'switch' }, cb, h('span', { class: 'knob' })));
      sortable(row, cfg.blocks, i, refresh);
      return open && b.on ? [row, sizeEditor(b, i)] : row;
    }).flat();
    const on = id => cfg.blocks.some(b => b.id === id && b.on);
    return [
      ...ui.section('', ...rows),
      ui.note('Arraste para reordenar. Toque no ajuste de um bloco para mudar posição, tamanho e largura.'),
      // alinhamento dos blocos que ficam lado a lado na grade (ex.: Mercado e Notícias)
      ...ui.section('Alinhar blocos lado a lado', h('div', { class: 'row-item' }, ui.seg('theme.gridAlign', [['top', 'Topo'], ['stretch', 'Mesma altura'], ['center', 'Centro'], ['end', 'Base']]))),
      ...(on('quote') ? ui.section('Frases', ui.area('quotes', 'Frase — Autor (uma por linha)')) : []),
      ...(on('links') ? ui.section('Links',
        ui.text('text', 'Título', 'linksTitle', 'Links'),
        ui.area('links', 'Nome | https://… (um por linha)')) : []),
      ...(on('countdown') ? ui.section('Contagem',
        ui.text('text', 'Nome', 'countdown.label', 'Evento'),
        ui.date('calendar', 'Data', 'countdown.date')) : []),
      ...(on('news') ? newsSettings() : []),
      ...(on('market') ? marketSettings() : [])
    ];
  },

  busca() {
    const s = cfg.search;
    const rows = s.engines.map((en, i) => {
      const e = eng(en);
      const pick = h('button', { type: 'button', class: 'radio' + (+s.current === i ? ' on' : ''), title: 'Usar como padrão', disabled: !usable(en),
        onclick: () => { s.current = i; changed(); refresh(); } }, icon('check'));
      // ligar/desligar: o mecanismo some do menu, mas a configuração fica guardada
      const sw = h('input', { type: 'checkbox', checked: e.on });
      sw.addEventListener('change', () => {
        if (!sw.checked && s.engines.filter(isOn).length === 1) { sw.checked = true; return; } // pelo menos um ligado
        en.on = sw.checked;
        if (!isOn(s.engines[+s.current])) s.current = s.engines.findIndex(isOn);
        changed(); refresh();
      });
      const toggle = h('label', { class: 'switch', title: e.on ? 'Desativar' : 'Ativar' }, sw, h('span', { class: 'knob' }));
      let body, del = null;
      if (e.builtin) {
        body = [engineIcon(e), h('div', { class: 'two' }, h('span', { class: 'lbl' }, e.name), h('span', { class: 'sub' }, e.host))];
      } else {
        const n = h('input', { type: 'text', class: 'inline strong', value: en.name, placeholder: 'Nome' });
        const u = h('input', { type: 'text', class: 'inline sub', value: en.url, placeholder: 'https://…?q=%s', spellcheck: 'false' });
        n.addEventListener('input', () => { en.name = n.value; changed(); });
        // ao terminar de editar, atualiza a bolinha de "padrão" (só vale com endereço válido)
        u.addEventListener('input', () => { en.url = u.value; changed(); });
        u.addEventListener('change', refresh);
        body = [h('div', { class: 'two' }, n, u)];
        del = h('button', { type: 'button', class: 'icon-btn ghost', title: 'Remover', onclick: () => {
          const chosen = s.engines[+s.current];
          s.engines.splice(i, 1);
          s.current = chosen === en ? s.engines.findIndex(isOn) : s.engines.indexOf(chosen);
          changed(); refresh();
        } }, icon('trash'));
      }
      const grip = h('span', { class: 'grip', title: 'Arraste para reordenar' }, icon('grip'));
      const row = h('div', { class: 'row-item' + (e.on ? '' : ' off') }, grip, pick, ...body, del, toggle);
      // depois de mover, o padrão continua sendo o mesmo mecanismo
      const chosen = s.engines[+s.current];
      sortable(row, s.engines, i, () => { s.current = Math.max(0, s.engines.indexOf(chosen)); changed(); refresh(); }, grip);
      return row;
    });
    return [
      ...ui.section('Mecanismos', ...rows,
        ui.action('plus', 'Adicionar outro', () => { s.engines.push({ name: '', url: 'https://', on: true }); changed(); refresh(); }, 'accent')),
      ui.note('Arraste pela alça para reordenar. Nos que você adicionar, use %s onde entra o termo buscado.'),
      ...ui.section('Comportamento',
        ui.toggle('focus', 'Focar ao abrir', 'search.autofocus'),
        ui.toggle('chevrons', 'Mostrar seletor', 'search.showPicker'),
        ui.toggle('newtab', 'Abrir em nova guia', 'search.newTab'),
        ui.text('cursor', 'Dica', 'search.placeholder', 'Buscar…')
      )
    ];
  },

  atalhos() {
    const rows = cfg.shortcuts.map((sc, i) => {
      const row = h('div', { class: 'row-item clickable', title: 'Editar', onclick: () => editShortcut(i) },
        h('span', { class: 'grip' }, icon('grip')), favTile(sc),
        h('div', { class: 'two' }, h('span', { class: 'lbl' }, sc.name), h('span', { class: 'sub' }, hostOf(sc.url))),
        h('span', { class: 'chev' }, icon('pencil')));
      sortable(row, cfg.shortcuts, i, refresh);
      return row;
    });
    return [
      ...ui.section('', ...rows, ui.action('plus', 'Adicionar favoritos', openPicker, 'accent')),
      ...ui.section('Estilo',
        ui.segRow('star', 'Ícone', 'theme.iconStyle', [['favicon', null, 'globe', 'Ícone do site'], ['letter', null, 'text', 'Inicial']]),
        ui.slider('scale', 'Tamanho', 'theme.scSize', 40, 140, 1, 'px'),
        ui.slider('columns', 'Por linha', 'theme.scCols', 2, 14, 1),
        ui.toggle('text', 'Mostrar nomes', 'theme.hideLabels', null, true),
        ui.toggle('globe', 'Buscar sites na web', 'pickWeb')
      )
    ];
  },

  avancado() {
    const file = h('input', { type: 'file', accept: 'application/json', hidden: true });
    file.addEventListener('change', async () => {
      try {
        const data = JSON.parse(await file.files[0].text());
        cfg = merge(DEFAULTS, data.cfg || data);
        normalizeEngines(cfg.search);
        if (Array.isArray(data.images)) await store.set('images', data.images);
        await store.set('cfg', cfg); await applyTheme(); render(); refresh();
        alert('Configuração importada.');
      } catch (e) { alert('Arquivo inválido: ' + e.message); }
    });
    return [
      ...ui.section('Backup',
        ui.action('download', 'Exportar', async () => {
          const blob = new Blob([JSON.stringify({ cfg, images: (await store.get('images')) || [] }, null, 2)], { type: 'application/json' });
          const a = h('a', { href: URL.createObjectURL(blob), download: `vitral-${new Date().toISOString().slice(0, 10)}.json` });
          a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); // revogar na hora pode cancelar o download
        }),
        ui.action('upload', 'Importar', () => file.click()), file),
      ...ui.section('CSS personalizado', ui.area('customCss', '.clock { font-weight: 700 }', true)),
      ...ui.section('',
        ui.action('reset', 'Restaurar padrão', async () => {
          if (!confirm('Restaurar tudo para o padrão? Notas, tarefas e imagens serão apagadas.')) return;
          cfg = structuredClone(DEFAULTS); await store.set('cfg', cfg); await store.set('images', []); await store.set('news', {}); await store.set('market', {});
          await applyTheme(); render(); refresh();
        }, 'danger')),
      h('div', { class: 'keys' }, h('kbd', {}, '/'), ' busca', h('kbd', {}, ','), ' ajustes', h('kbd', {}, 'Esc'), ' fechar')
    ];
  }
};

// ---------- Ajuste de tamanho de um bloco (abre embaixo da linha dele em Blocos) ----------
let openSize = null;
function sizeEditor(b, i) {
  const id = b.id, s = cfg.sizes[id] || {}, p = k => `sizes.${id}.${k}`;
  const rows = [ui.segRow('layout', 'Posição', `blocks.${i}.zone`, [['top', null, 'zTop', 'Topo'], ['center', null, 'zCenter', 'Centro'], ['widgets', null, 'zGrid', 'Grade']])];
  if (!SIZE_DEFAULTS[id]) return h('div', { class: 'size-editor' }, rows);
  rows.push(ui.slider('scale', 'Tamanho', p('scale'), 50, 200, 5, '%'));
  if (id === 'clock') rows.push(ui.slider('clock', 'Relógio', 'theme.clockSize', 32, 260, 1, 'px'));
  if (id === 'shortcuts') rows.push(
    ui.slider('star', 'Ícones', 'theme.scSize', 32, 140, 1, 'px'),
    ui.slider('columns', 'Por linha', 'theme.scCols', 2, 14, 1));
  // na grade a largura é em colunas; fora dela, em pixels
  if (b.zone === 'widgets' && s.span !== undefined) rows.push(ui.segRow('width', 'Largura', p('span'), [['1', '1/3'], ['2', '2/3'], ['full', 'Inteira']]));
  else if (s.width !== undefined) rows.push(ui.slider('width', 'Largura', p('width'), 280, 1600, 10, 'px'));
  if (id === 'notes') rows.push(ui.slider('note', 'Altura', p('height'), 80, 700, 10, 'px'));
  if (id === 'news') rows.push(
    ui.segRow('columns', 'Colunas', p('cols'), [[0, 'Auto'], [1, '1'], [2, '2'], [3, '3'], [4, '4']]),
    ui.slider('image', 'Imagem', p('img'), 40, 160, 2, 'px'));
  rows.push(h('button', { type: 'button', class: 'size-reset', onclick: () => {
    cfg.sizes[id] = structuredClone(SIZE_DEFAULTS[id]);
    if (id === 'clock') cfg.theme.clockSize = DEFAULTS.theme.clockSize;
    if (id === 'shortcuts') Object.assign(cfg.theme, { scSize: DEFAULTS.theme.scSize, scCols: DEFAULTS.theme.scCols });
    changed(); refresh();
  } }, 'Voltar ao tamanho padrão'));
  return h('div', { class: 'size-editor' }, rows);
}

let currentTab = 'aparencia';
// reinicia uma animação de CSS (tirar e pôr a classe no mesmo quadro não reinicia)
const replay = (el, cls, ms) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); clearTimeout(el['_' + cls]); el['_' + cls] = setTimeout(() => el.classList.remove(cls), ms); };

function openTab(name) {
  const body = $('#panel-body'), switching = name !== currentTab, keep = switching ? 0 : body.scrollTop;
  currentTab = name;
  const [, , title] = TABS.find(t => t[0] === name);
  $('#panel-title').textContent = title;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
  body.replaceChildren(...tabs[name]().filter(Boolean));
  body.scrollTop = keep;
  // troca de aba: o conteúdo novo entra em sequência (não anima nos redesenhos da mesma aba)
  if (switching && !$('#panel').hidden) { replay(body, 'switching', 500); replay($('#panel-title'), 'switching', 400); }
}
let panelTimer;
function togglePanel(force) {
  const p = $('#panel'), isOpen = !p.hidden && !p.classList.contains('closing');
  const show = force ?? !isOpen;
  if (show === isOpen) return;
  clearTimeout(panelTimer);
  // a engrenagem fica no mesmo canto: o mesmo clique abre e fecha
  document.body.classList.toggle('panel-open', show);
  const gear = $('#open-settings');
  gear.title = show ? 'Fechar configurações ( , )' : 'Configurações ( , )';
  gear.setAttribute('aria-expanded', show);
  if (show) {
    // abre "saindo" da engrenagem: cresce do canto, desembaça, e o conteúdo entra em sequência
    p.classList.remove('closing');
    p.hidden = false;
    openTab(currentTab);
    replay(p, 'opening', 700);
  } else {
    // fecha "voltando" para a engrenagem e só some de vez quando a animação termina
    p.classList.remove('opening');
    p.classList.add('closing');
    const done = () => { clearTimeout(panelTimer); p.removeEventListener('animationend', onEnd); if (p.classList.contains('closing')) { p.hidden = true; p.classList.remove('closing'); } };
    const onEnd = e => { if (e.target === p && e.animationName === 'panel-out') done(); };
    p.addEventListener('animationend', onEnd);
    panelTimer = setTimeout(done, 600); // reserva, caso a animação não rode (ex.: guia em segundo plano)
  }
}

// janelas (favoritos, fontes, ativos, atalho) fecham com animação, inclusive pelo Esc
const calmMotion = matchMedia('(prefers-reduced-motion: reduce)');
for (const dlg of document.querySelectorAll('dialog')) {
  const realClose = dlg.close.bind(dlg);
  dlg.close = value => {
    if (!dlg.open || calmMotion.matches) return realClose(value);
    if (dlg.classList.contains('closing')) return;
    dlg.classList.add('closing');
    let done = false;
    const finish = () => { if (done) return; done = true; dlg.classList.remove('closing'); realClose(value); };
    dlg.addEventListener('animationend', finish, { once: true });
    setTimeout(finish, 400); // garantia, caso a animação não dispare
  };
  dlg.addEventListener('cancel', e => { e.preventDefault(); dlg.close(); });
}

// ---------- Inicialização ----------
(async () => {
  const saved = (await store.get('cfg')) || {};
  cfg = merge(DEFAULTS, saved);
  // visual minimalista (v2): atualiza o tema de quem já usava a versão antiga; nome, atalhos e notas ficam
  if (saved.theme && saved.design !== DEFAULTS.design) {
    for (const k of ['card', 'cardOpacity', 'blur', 'radius', 'clockSize', 'scSize']) cfg.theme[k] = DEFAULTS.theme[k];
    if (cfg.bg.type === 'gradient') Object.assign(cfg.bg, { g1: DEFAULTS.bg.g1, g2: DEFAULTS.bg.g2, g3: '', angle: DEFAULTS.bg.angle, dim: 0 });
    cfg.design = DEFAULTS.design;
    save();
  }
  // escala nova de Opacidade e Granulado (0–100% no controle = 0–50% de verdade): dobra os valores
  // guardados uma vez, para o visual de quem já usava não mudar
  if (saved.theme && saved.glassScale !== DEFAULTS.glassScale) {
    for (const k of ['cardOpacity', 'grain']) if (saved.design === DEFAULTS.design && k in saved.theme) cfg.theme[k] = Math.min(100, (+saved.theme[k] || 0) * 2);
    cfg.glassScale = DEFAULTS.glassScale;
    save();
  }
  // "IPCA 12 meses" virou só "IPCA" (o "12m" ao lado do valor já diz o período)
  for (const x of cfg.market.symbols) if (x.s === '@bcb:13522' && x.name === 'IPCA 12 meses') x.name = 'IPCA';
  // mecanismos: os 6 padrão sempre presentes e protegidos (roda a cada abertura, não perde nada)
  const enginesBefore = JSON.stringify(cfg.search.engines) + cfg.search.current;
  normalizeEngines(cfg.search);
  if (JSON.stringify(cfg.search.engines) + cfg.search.current !== enginesBefore) save();
  // garante que blocos novos (de versões futuras) apareçam
  for (const id of Object.keys(BLOCKS)) if (!cfg.blocks.some(b => b.id === id)) cfg.blocks.push({ id, zone: 'widgets', on: false });
  await applyTheme();
  render();
  repairSources(); // fontes suas que ficaram sem nome oficial ou sem ícone (em segundo plano)

  $('#open-settings').onclick = () => togglePanel();
  $('#close-settings').onclick = () => togglePanel(false);
  $('#tabs').replaceChildren(...TABS.map(([id, ic, t]) => h('button', { type: 'button', 'data-tab': id, title: t, 'aria-label': t }, icon(ic))));
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) openTab(b.dataset.tab); });
  $('#close-settings').replaceChildren(icon('x'));

  document.addEventListener('keydown', e => {
    // com uma janela aberta, o Esc fecha só ela (antes fechava o painel junto)
    if (document.querySelector('dialog[open]')) return;
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if (e.key === 'Escape') togglePanel(false);
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '/') { e.preventDefault(); $('.search input')?.focus(); }
    if (e.key === ',') { e.preventDefault(); togglePanel(); }
  });

  // grava o que estiver pendente ao fechar ou trocar de guia
  addEventListener('pagehide', () => { if (saveTimer) flush(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && saveTimer) flush(); });

  // sincroniza entre guias abertas. Ignora a própria gravação e não sobrescreve
  // mudanças locais ainda não salvas (antes podia apagar letras digitadas nas notas)
  if (hasChrome) chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== 'local' || !ch.cfg || !ch.cfg.newValue || saveTimer || !$('#panel').hidden) return;
    const incoming = snapshot(ch.cfg.newValue);
    if (lastWritten.includes(incoming) || incoming === snapshot(cfg)) return;
    cfg = merge(DEFAULTS, ch.cfg.newValue); normalizeEngines(cfg.search); applyTheme(); render();
  });
})();
