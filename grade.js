// Grade da página, como a tela inicial do Android: cada bloco ocupa um retângulo de células.
// Só contas (sem página nem configuração), para dar para testar: node tests/grade.test.js
const GRID_COLS = 12, GRID_ROWS = 12;
// tamanho padrão e mínimo de cada bloco, em células: [largura, altura, largura mín., altura mín.]
const BLOCK_SIZES = {
  clock: [6, 2, 2, 1], greeting: [6, 1, 2, 1], search: [6, 1, 3, 1], shortcuts: [8, 2, 2, 1], quote: [8, 1, 3, 1],
  notes: [4, 4, 2, 2], todo: [4, 4, 2, 2], links: [3, 4, 2, 2], countdown: [3, 2, 2, 1],
  news: [8, 4, 3, 3], market: [4, 4, 3, 2]
};
// layout de quem nunca mexeu: relógio, saudação, busca e atalhos no meio da tela
const DEFAULT_LAYOUT = {
  clock: { x: 3, y: 2, w: 6, h: 2 }, greeting: { x: 3, y: 4, w: 6, h: 1 },
  search: { x: 3, y: 5, w: 6, h: 1 }, shortcuts: { x: 2, y: 6, w: 8, h: 2 }
};

const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inGrid = r => !!r && r.w >= 1 && r.h >= 1 && r.x >= 0 && r.y >= 0 && r.x + r.w <= GRID_COLS && r.y + r.h <= GRID_ROWS;
const sameRect = (a, b) => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// lugar livre de tamanho w×h mais perto de (nx, ny); null se não houver
function nearestFree(w, h, nx, ny, taken) {
  let best = null, bestD = Infinity;
  for (let y = 0; y + h <= GRID_ROWS; y++) for (let x = 0; x + w <= GRID_COLS; x++) {
    const r = { x, y, w, h }, d = Math.abs(x - nx) + Math.abs(y - ny) * 1.01; // empate: fica na mesma linha
    if (d < bestD && !taken.some(o => overlap(o, r))) { best = r; bestD = d; }
  }
  return best;
}
// lugar para um bloco que acabou de ser ligado: onde ele estava, senão o espaço livre mais perto
// no tamanho padrão, e se não couber, encolhendo até o mínimo
function placeFor(id, taken, prefer) {
  if (inGrid(prefer) && !taken.some(o => overlap(o, prefer))) return { ...prefer };
  const [w, h, mw, mh] = BLOCK_SIZES[id];
  for (let hh = h; hh >= mh; hh--) for (let ww = w; ww >= mw; ww--) {
    const r = nearestFree(ww, hh, prefer ? prefer.x : 0, prefer ? prefer.y : 0, taken);
    if (r) return r;
  }
  return null;
}
// "id" vai para r: os blocos que ficarem por baixo saem para o lugar livre mais perto; null se algum não couber
function pushAside(items, id, r) {
  const out = { ...items, [id]: r };
  const others = Object.keys(items).filter(k => k !== id), hit = others.filter(k => overlap(items[k], r));
  const taken = [r, ...others.filter(k => !hit.includes(k)).map(k => items[k])];
  for (const k of hit) {
    const o = items[k], s = nearestFree(o.w, o.h, o.x, o.y, taken);
    if (!s) return null;
    out[k] = s; taken.push(s);
  }
  return out;
}
// divisas: onde a borda direita (ou de baixo) de um bloco encosta na esquerda (ou de cima) de outro.
// axis 'x' = a à esquerda de b; 'y' = a em cima de b; from/to = trecho em comum (linhas ou colunas)
function seams(items) {
  const out = [];
  for (const a in items) for (const b in items) {
    const A = items[a], B = items[b];
    if (A.x + A.w === B.x) { const from = Math.max(A.y, B.y), to = Math.min(A.y + A.h, B.y + B.h); if (to > from) out.push({ a, b, axis: 'x', from, to }); }
    if (A.y + A.h === B.y) { const from = Math.max(A.x, B.x), to = Math.min(A.x + A.w, B.x + B.w); if (to > from) out.push({ a, b, axis: 'y', from, to }); }
  }
  return out;
}
// arrasta a divisa d células: um bloco cresce e o outro encolhe junto (até o mínimo de cada um);
// null se algum dos dois passar por cima de um terceiro
function moveSeam(items, a, b, axis, d) {
  const A = items[a], B = items[b], [, , amw, amh] = BLOCK_SIZES[a], [, , bmw, bmh] = BLOCK_SIZES[b];
  let na, nb;
  if (axis === 'x') { d = clamp(d, amw - A.w, B.w - bmw); na = { ...A, w: A.w + d }; nb = { ...B, x: B.x + d, w: B.w - d }; }
  else { d = clamp(d, amh - A.h, B.h - bmh); na = { ...A, h: A.h + d }; nb = { ...B, y: B.y + d, h: B.h - d }; }
  const others = Object.keys(items).filter(k => k !== a && k !== b).map(k => items[k]);
  if (others.some(o => overlap(o, na) || overlap(o, nb))) return null;
  return { ...items, [a]: na, [b]: nb };
}
// layout antigo (zonas Topo/Centro/Grade e larguras 1/3, 2/3, inteira) → células, o mais parecido possível
function migrateLayout(blocks, sizes) {
  const items = {}, zone = b => ['top', 'center', 'widgets'].indexOf(b.zone || 'widgets');
  const on = blocks.filter(b => b.on && BLOCK_SIZES[b.id]).sort((a, b) => zone(a) - zone(b));
  let y = 0;
  // topo e centro: um por linha, centralizados
  for (const b of on.filter(b => zone(b) < 2)) {
    const [w, h] = BLOCK_SIZES[b.id];
    if (y + h <= GRID_ROWS) items[b.id] = { x: (GRID_COLS - w) >> 1, y, w, h };
    y += h;
  }
  // grade: prateleiras de 12 colunas (1/3 = 4, 2/3 = 8, inteira = 12), na ordem de antes
  const shelves = [];
  for (const b of on.filter(b => zone(b) === 2)) {
    const span = String((sizes[b.id] || {}).span || '1'), w = span === 'full' ? GRID_COLS : span === '2' ? 8 : 4;
    let s = shelves.at(-1);
    if (!s || s.w + w > GRID_COLS) shelves.push(s = { w: 0, h: 0, min: 0, ids: [] });
    s.ids.push([b.id, w]); s.w += w; s.h = Math.max(s.h, BLOCK_SIZES[b.id][1]); s.min = Math.max(s.min, BLOCK_SIZES[b.id][3]);
  }
  // altura: se as prateleiras não cabem no padrão, começam no mínimo; a sobra vai para a das
  // notícias (ou a última). Sem grade, o topo e o centro ficam no meio da altura
  const room = GRID_ROWS - y, sum = k => shelves.reduce((a, s) => a + s[k], 0);
  if (sum('h') > room) for (const s of shelves) s.h = s.min;
  const spare = room - sum('h');
  if (spare > 0 && shelves.length) (shelves.find(s => s.ids.some(([id]) => id === 'news')) || shelves.at(-1)).h += spare;
  if (spare > 0 && !shelves.length) for (const r of Object.values(items)) r.y += spare >> 1;
  for (const s of shelves) {
    let x = 0;
    for (const [id, w] of s.ids) { if (y + s.h <= GRID_ROWS) items[id] = { x, y, w, h: s.h }; x += w; }
    y += s.h;
  }
  return items; // o que não coube é posto por ensureLayout (newtab.js) no espaço livre
}

if (typeof module === 'object') module.exports = { GRID_COLS, GRID_ROWS, BLOCK_SIZES, DEFAULT_LAYOUT, overlap, inGrid, sameRect, nearestFree, placeFor, pushAside, seams, moveSeam, migrateLayout };
