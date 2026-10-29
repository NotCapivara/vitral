// Contas da grade: node tests/grade.test.js (sem dependências)
const assert = require('assert');
const g = require('../grade.js');
const noOverlap = items => Object.values(items).every((a, i, all) => all.every((b, j) => i === j || !g.overlap(a, b)));

// soltar um bloco em cima de outro empurra o de baixo para o lugar livre mais perto
const two = { a: { x: 0, y: 0, w: 4, h: 4 }, b: { x: 4, y: 0, w: 4, h: 4 } };
const p = g.pushAside(two, 'a', { x: 2, y: 0, w: 4, h: 4 });
assert(p && noOverlap(p), 'empurra sem sobrepor');
assert(g.sameRect(p.a, { x: 2, y: 0, w: 4, h: 4 }), 'o arrastado fica onde foi solto');
// sem espaço para o empurrado: recusa
assert.strictEqual(g.pushAside({ a: { x: 0, y: 0, w: 12, h: 6 }, b: { x: 0, y: 6, w: 12, h: 6 } }, 'a', { x: 0, y: 0, w: 12, h: 7 }), null);
assert.strictEqual(g.nearestFree(12, 12, 0, 0, [{ x: 0, y: 0, w: 1, h: 1 }]), null, 'grade cheia');

// bloco ligado sem espaço no padrão encolhe até caber; sem espaço nem no mínimo, null
const full = Object.values(g.DEFAULT_LAYOUT);
const n = g.placeFor('news', full, null);
assert(n && g.inGrid(n) && !full.some(o => g.overlap(o, n)), 'notícias cabem no layout padrão');
assert.strictEqual(g.placeFor('news', [{ x: 0, y: 0, w: 12, h: 12 }], null), null);

// layout antigo da v1.3: topo + centro + Notícias inteira + Mercado 1/3 → tudo dentro, sem sobrepor e sem sobrar linha
const old = [['clock', 'top'], ['greeting', 'top'], ['search', 'center'], ['shortcuts', 'center'], ['news', 'widgets'], ['market', 'widgets']]
  .map(([id, zone]) => ({ id, zone, on: true }));
const m = g.migrateLayout(old, { news: { span: 'full' }, market: { span: '1' } });
assert.deepStrictEqual(Object.keys(m).sort(), ['clock', 'greeting', 'market', 'news', 'search', 'shortcuts']);
assert(Object.values(m).every(g.inGrid) && noOverlap(m), 'migra para dentro da grade');
assert.strictEqual(Math.max(...Object.values(m).map(r => r.y + r.h)), g.GRID_ROWS, 'usa a altura toda');
// Notícias 2/3 e Mercado 1/3 lado a lado continuam lado a lado
const side = g.migrateLayout([{ id: 'news', zone: 'widgets', on: true }, { id: 'market', zone: 'widgets', on: true }], { news: { span: '2' }, market: { span: '1' } });
assert(side.news.w === 8 && side.market.w === 4 && side.news.y === side.market.y);

// divisa entre Notícias (esquerda) e Mercado (direita): puxar 2 para a esquerda encolhe um e cresce o outro
const pair = { news: { x: 0, y: 8, w: 8, h: 4 }, market: { x: 8, y: 8, w: 4, h: 4 }, clock: { x: 3, y: 0, w: 6, h: 2 } };
const s = g.seams(pair);
assert.deepStrictEqual(s, [{ a: 'news', b: 'market', axis: 'x', from: 8, to: 12 }]);
const left = g.moveSeam(pair, 'news', 'market', 'x', -2);
assert(g.sameRect(left.news, { x: 0, y: 8, w: 6, h: 4 }) && g.sameRect(left.market, { x: 6, y: 8, w: 6, h: 4 }), 'divisa anda junto');
assert.strictEqual(g.moveSeam(pair, 'news', 'market', 'x', 9).market.w, 3, 'para no mínimo do Mercado');
// o que cresce não pode passar por cima de um terceiro bloco
// (Notícias mais alta que o Mercado, Notas em cima do Mercado: Notícias crescendo bateria nas Notas)
const tall = { news: { x: 0, y: 6, w: 8, h: 6 }, market: { x: 8, y: 8, w: 4, h: 4 }, notes: { x: 8, y: 6, w: 4, h: 2 } };
assert.strictEqual(g.moveSeam(tall, 'news', 'market', 'x', 1), null);

console.log('grade: ok');
