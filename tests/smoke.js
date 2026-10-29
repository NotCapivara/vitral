// Teste de fumaça da versão montada, num navegador sem janela e com perfil descartável:
//   powershell -File tools/build.ps1   (monta dist/chrome e dist/firefox)
//   node tests/smoke.js brave          (ou chrome, firefox)
// Caminhos: BRAVE_BIN, CHROME_BIN, FIREFOX_BIN (senão os de instalação padrão no Windows).
// Liga Notícias (8 fontes) e Mercado, espera carregar e confere: sem erros de script, blocos na tela,
// notícias de várias fontes, cotações, vidro, painel abrindo. Salva um print em %TEMP%\vitral-smoke-<navegador>.png.
// Só para o teste, a cópia da extensão recebe permissão para todos os sites (na real a pessoa autoriza cada um).
const fs = require('fs'), os = require('os'), path = require('path'), { spawn } = require('child_process');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const which = process.argv[2];
const BIN = {
  brave: process.env.BRAVE_BIN || 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  chrome: process.env.CHROME_BIN || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  firefox: process.env.FIREFOX_BIN || 'C:\\Program Files\\Mozilla Firefox\\firefox.exe'
}[which];
if (!BIN) { console.log('uso: node tests/smoke.js brave|chrome|firefox'); process.exit(2); }
const isFx = which === 'firefox', PORT = isFx ? 9445 : 9444;
const root = path.join(__dirname, '..'), built = path.join(root, 'dist', isFx ? 'firefox' : 'chrome');
if (!fs.existsSync(built)) { console.log('falta montar: powershell -File tools/build.ps1'); process.exit(2); }

// cópia descartável da extensão + perfil
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vitral-smoke-'));
const ext = path.join(tmp, 'ext'), prof = path.join(tmp, 'perfil');
fs.cpSync(built, ext, { recursive: true }); fs.mkdirSync(prof);
const man = JSON.parse(fs.readFileSync(path.join(ext, 'manifest.json'), 'utf8'));
man.host_permissions.push('*://*/*');
fs.writeFileSync(path.join(ext, 'manifest.json'), JSON.stringify(man));
const UUID = '7a1b2c3d-0000-4000-8000-000000000001';
if (isFx) fs.writeFileSync(path.join(prof, 'user.js'), [
  `user_pref("extensions.webextensions.uuids", ${JSON.stringify(JSON.stringify({ 'vitral@notcapivara': UUID }))});`,
  'user_pref("browser.shell.checkDefaultBrowser", false);', 'user_pref("datareporting.policy.dataSubmissionEnabled", false);',
  'user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);', 'user_pref("app.update.enabled", false);'].join('\n'));
const args = isFx ? ['--headless', '--no-remote', '--profile', prof, '--remote-debugging-port', String(PORT)]
  : ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, `--load-extension=${ext}`, '--no-first-run', '--no-default-browser-check'];
const proc = spawn(BIN, args, { stdio: 'ignore', env: { ...process.env, MOZ_REMOTE_ALLOW_SYSTEM_ACCESS: '1' } });

let ws, id = 0; const pend = {}, errors = [];
const send = (method, params = {}, extra = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params, ...extra })); });
async function connect(url) {
  for (let i = 0; i < 60; i++) {
    try { ws = new WebSocket(typeof url === 'function' ? await url() : url); await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; }); break; }
    catch { ws = null; await sleep(500); }
  }
  if (!ws) throw new Error('não conectou ao navegador');
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pend[m.id]) { pend[m.id](m); delete pend[m.id]; return; }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description?.split('\n')[0]);
    if (m.method === 'log.entryAdded' && m.params.level === 'error') errors.push(m.params.text);
  };
}

// abre a nova guia e devolve ev(expr): avalia na página e devolve o valor (a expressão deve dar uma string JSON)
async function openNewTab() {
  if (!isFx) {
    await connect(async () => {
      const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
      return t.webSocketDebuggerUrl;
    });
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1504, height: 722, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: 'chrome://newtab/' }); await sleep(3000);
    return {
      ev: async x => { const r = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }); return r.result.exceptionDetails ? { erro: r.result.exceptionDetails.exception?.description } : JSON.parse(r.result.result.value ?? 'null'); },
      shot: async () => (await send('Page.captureScreenshot', { format: 'png' })).result.data
    };
  }
  await connect(`ws://127.0.0.1:${PORT}/session`);
  const s = await send('session.new', { capabilities: {} }); if (s.error) throw new Error(s.message);
  await send('session.subscribe', { events: ['log.entryAdded'] });
  const inst = await send('webExtension.install', { extensionData: { type: 'path', path: ext } }); if (inst.error) throw new Error(inst.message);
  const win = (await send('browsingContext.getTree', { 'moz:scope': 'chrome' })).result.contexts[0].context;
  const chromeEv = x => send('script.evaluate', { target: { context: win }, expression: x, awaitPromise: true });
  // o Firefox não concede "*://*/*" na instalação: concede aqui e recarrega a extensão
  await chromeEv(`(async () => {
    const { ExtensionPermissions } = ChromeUtils.importESModule('resource://gre/modules/ExtensionPermissions.sys.mjs');
    const { AddonManager } = ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
    await ExtensionPermissions.add('vitral@notcapivara', { origins: ['*://*/*'], permissions: [] });
    await (await AddonManager.getAddonByID('vitral@notcapivara')).reload();
  })()`);
  await sleep(1500);
  // a nova guia da extensão só aparece numa guia aberta como o Ctrl+T (navegar até moz-extension:// é bloqueado)
  const before = new Set((await send('browsingContext.getTree', {})).result.contexts.map(c => c.context));
  await chromeEv('BrowserCommands.openTab(); 1'); await sleep(3000);
  const ctx = (await send('browsingContext.getTree', {})).result.contexts.map(c => c.context).find(c => !before.has(c));
  await send('browsingContext.setViewport', { context: ctx, viewport: { width: 1504, height: 722 } });
  return {
    ev: async x => { const r = await send('script.evaluate', { target: { context: ctx }, expression: x, awaitPromise: true }); return r.error ? { erro: r.message } : r.result.type === 'exception' ? { erro: r.result.exceptionDetails.text } : JSON.parse(r.result.result.value ?? 'null'); },
    shot: async () => (await send('browsingContext.captureScreenshot', { context: ctx })).result.data
  };
}

(async () => {
  let fail = [];
  try {
    const { ev, shot } = await openNewTab();
    await ev(`(async () => {
      cfg.blocks.forEach(b => { b.on = ['clock', 'greeting', 'search', 'shortcuts', 'news', 'market'].includes(b.id); });
      cfg.layout.items = structuredClone(DEFAULT_LAYOUT); ensureLayout();
      ['g1', 'folha', 'estadao', 'poder360', 'metropoles', 'jovempan', 'cnn', 'uol'].forEach(k => { if (NEWS_PRESETS[k]) cfg.news.enabled[k] = true; });
      await flush(); render(); fillNews(document.querySelector('.card.news'), true); return '1';
    })()`);
    await sleep(20000);
    const st = await ev(`JSON.stringify({
      blocos: document.querySelectorAll('#app > .cell').length,
      noticias: document.querySelectorAll('.card.news .news-item:not([hidden])').length,
      fontes: new Set([...document.querySelectorAll('.card.news .news-item')].map(a => a.dataset.src)).size,
      cotacoes: (document.querySelector('.card.market')?.innerText.match(/R\\$/g) || []).length,
      vidro: getComputedStyle(document.querySelector('.cell .card')).backdropFilter
    })`);
    // painel: abre, e o campo de texto (lista de imagens de fundo) tem altura
    const panel = await ev(`(async () => { document.querySelector('#open-settings').click(); await new Promise(r => setTimeout(r, 600));
      return JSON.stringify({ aberto: !document.querySelector('#panel').hidden, abas: document.querySelectorAll('#tabs button').length }); })()`);
    console.log(which, JSON.stringify({ ...st, painel: panel }));
    fs.writeFileSync(path.join(os.tmpdir(), `vitral-smoke-${which}.png`), Buffer.from(await shot(), 'base64'));
    if (st.erro || panel.erro) fail.push(st.erro || panel.erro);
    else {
      if (st.blocos < 6) fail.push('faltam blocos: ' + st.blocos);
      if (st.noticias < 1 || st.fontes < 4) fail.push(`notícias: ${st.noticias} itens de ${st.fontes} fontes`);
      if (st.cotacoes < 2) fail.push('mercado sem cotações');
      if (!st.vidro || st.vidro === 'none') fail.push('sem vidro (backdrop-filter)');
      if (!panel.aberto || panel.abas < 3) fail.push('painel não abriu');
    }
  } catch (e) { fail.push(String(e)); }
  fail.push(...errors.map(e => 'erro na página: ' + e));
  console.log(fail.length ? 'FALHOU\n- ' + fail.join('\n- ') : 'ok');
  proc.kill(); await sleep(1000);
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  process.exit(fail.length ? 1 : 0);
})();
