# Vitral: guia para quem mexe no código (pessoas e IAs)

Extensão de nova guia (MV3) para **Brave/Chrome e Firefox, com um código só**. Sem build de JS, sem dependências, sem telemetria. Textos e comentários em português.

## Arquivos

| Arquivo | O que tem |
| --- | --- |
| `newtab.html` | Esqueleto da página e os diálogos; carrega `grade.js` e depois `newtab.js` |
| `newtab.js` | Tudo: configuração (`DEFAULTS`, `cfg`, `flush`), blocos (`render`, `BLOCKS`), notícias, mercado, painel (`ui.*`) |
| `grade.js` | Contas da grade 12×12 (sem DOM). Exporta para o Node via `module.exports` |
| `newtab.css` | Estilos. Vidro = `backdrop-filter` |
| `manifest.json` | Manifesto **base (Chrome/Brave)**. O do Firefox é gerado a partir dele |
| `tools/build.ps1` | Monta `dist/chrome`, `dist/firefox` e os dois zips do release |
| `tests/grade.test.js` | Testes das contas da grade (`node tests/grade.test.js`) |
| `tests/smoke.js` | Abre a versão montada num navegador sem janela e confere o básico |

`grade.js` e `newtab.js` são scripts clássicos e dividem o escopo global: o que um declara no topo o outro enxerga.

## Regras para as duas versões

1. **Use `chrome.*`.** O Firefox aceita o mesmo nome e devolve promessas. Não use `browser.*`.
2. **Tudo o que só um navegador tem fica no topo do `newtab.js`**, na seção "Diferenças entre navegadores", como uma constante que diz se o recurso existe (ex.: `favUrl` é `null` no Firefox). O resto do código pergunta pela constante. Nunca pelo nome do navegador nem pelo user agent.
3. **Diferenças no manifesto vão no `tools/build.ps1`**, não no `manifest.json`. Hoje: o Firefox perde a permissão `favicon` e ganha `browser_specific_settings` (id `vitral@notcapivara`, versão mínima 140, sem coleta de dados).
4. **CSS só do WebKit precisa do equivalente do Firefox**, ou de um `@supports` com alternativa. Exemplos que já existem: `::-moz-range-*` ao lado de `::-webkit-slider-*`; `@supports not (field-sizing: content)` para os campos de texto.
5. **Permissões de site** são pedidas com `askPermission()` direto no clique (sem `await` antes), senão o Firefox recusa.

Diferenças conhecidas, de propósito:

- **Ícones dos sites:** no Firefox, atalhos sem ícone baixado mostram a inicial, e a opção "Ícone do site" some do painel.
- **Permissões:** no Firefox, as `host_permissions` do manifesto vêm liberadas na instalação. O `*://*/*` opcional, não: cada site de notícias é autorizado pela pessoa.

## Antes de entregar uma mudança

```
node --check newtab.js
node tests/grade.test.js
powershell -File tools/build.ps1
node tests/smoke.js brave
node tests/smoke.js firefox
```

O `smoke.js` usa os navegadores instalados (ou `BRAVE_BIN`, `CHROME_BIN`, `FIREFOX_BIN`). Ele cria um perfil descartável e libera todos os sites só na cópia de teste. Depois de rodar, salva um print em `%TEMP%\vitral-smoke-<navegador>.png`.

Limite conhecido: o Firefox sem janela não desenha `backdrop-filter`. O teste confere o estilo calculado, e o desfoque em si só aparece no Firefox com janela.

## Release

Todo envio para o GitHub com release leva **as duas versões**:

1. Suba `version` no `manifest.json`.
2. Rode `powershell -File tools/build.ps1` e os testes acima.
3. Crie o release anexando `dist/vitral-vX.Y.Z-chrome.zip` e `dist/vitral-vX.Y.Z-firefox.zip`.

O zip do Chrome tem a pasta `vitral/`, para carregar "sem compactação". O do Firefox tem o manifesto na raiz, que é o que o about:debugging e o addons.mozilla.org pedem. O Firefox só instala de vez extensões assinadas pela Mozilla: a assinatura é feita pelo dono da conta no addons.mozilla.org.

## Princípios do projeto

- Toda chamada de rede passa por `net()`: sem cookies e sem Referer, e só para o que a pessoa ligou.
- Configurações só em `chrome.storage.local`. Nada sai do navegador.
- A tela cabe sem rolagem. Cada bloco se ajusta ao tamanho da sua caixa na grade (`fitToScreen`).
