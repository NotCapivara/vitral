# Plano: grade de blocos redimensionáveis (estilo widgets do Android)

Para o agente que vai implementar. Leia tudo antes de mexer no código.

## Objetivo

Trocar o layout atual (zonas fixas + larguras 1/3, 2/3, inteira) por uma **grade de células que ocupa a tela inteira**, como a tela inicial do Android:

- cada bloco ocupa um retângulo de células (`x, y, w, h`);
- no **modo de edição**, o usuário arrasta o bloco para mover e puxa as alças das bordas/cantos para redimensionar, sempre encaixando nas células;
- os outros blocos se afastam para abrir espaço; se não houver espaço, o movimento é recusado (o bloco volta);
- fora do modo de edição, a página fica como hoje: limpa, sem alças, sem rolagem.

## Como está hoje (o que vai mudar)

Tudo em `newtab.js` / `newtab.css` / `newtab.html` (extensão MV3, JS puro, sem build e sem dependências).

- `DEFAULTS.blocks` (newtab.js ~73): lista ordenada `{ id, zone: 'top'|'center'|'widgets', on }`. A ordem da lista é a ordem na página.
- `SIZE_DEFAULTS` / `cfg.sizes` (~39): por bloco, `scale` (%), `width` (px, fora da grade), `span` ('1'|'2'|'full', na grade), e extras (`notes.height`, `news.cols`, `news.img`).
- `render()` (~482): limpa `#top`, `#center`, `#widgets` e põe cada bloco ligado na zona dele; `applyBlockSize()` (~571) aplica escala/largura/span.
- CSS: `.zone` (coluna flex), `.grid` com 3 colunas (~46, ~534), `body.grid-stretch` e `theme.gridAlign` (alinhamento lado a lado), `#app` com `height: 100dvh; overflow: hidden` (~623), `zoom: var(--fit-zoom)` nas zonas (~861).
- `fitToScreen()` (~501): faz tudo caber numa tela: compacta o Mercado (`data-fit` 1–2), reduz o zoom da página até 70%, e escolhe quantas notícias mostrar (busca binária + níveis de compactação 0–5 + rodízio entre fontes + completar a última linha + espalhar quando sobra espaço). Tem a "trava" `lockH/lockZoom/lockMk` para o topo das notícias não pular ao trocar de fonte.
- Painel → aba **Blocos** (`tabs.blocos`, ~2859): lista com liga/desliga, arrastar para reordenar (`sortable`) e o botão de ajuste que abre `sizeEditor()` (~3005: Posição, Tamanho, Largura, Altura das notas, Colunas e Imagem das notícias, "Voltar ao tamanho padrão").
- Migrações de config ficam no início da inicialização (~3090), no padrão "se a versão salva for antiga, converte uma vez e `save()`". Export/import de config em JSON (~2987) também precisa passar pela migração.

## Decisões (recomendação; confirmar com o Arthur se quiser mudar)

1. **Implementação própria, sem biblioteca.** Gridstack.js faz arrastar/redimensionar, mas pensa em página que rola para baixo e traz ~80 KB e estilos próprios. Aqui a grade é fixa na tela, então é pouco código: CSS Grid + Pointer Events. Só considere a biblioteca se a parte de colisão ficar grande demais, e justifique.
2. **Tamanho da grade:** 12 colunas × 8 linhas, células esticam com a janela (`grid-template-columns: repeat(12, 1fr)`, `grid-template-rows: repeat(8, 1fr)` dentro de `#app` com altura da tela). Assim o layout é o mesmo em qualquer monitor, só muda a proporção.
3. **Sem gravidade:** o bloco fica onde o usuário soltou (como no Android), não "cai" para cima.
4. **Colisão:** ao soltar em cima de outros, tenta empurrar os atingidos para o espaço livre mais próximo (primeiro para baixo, depois para os lados); se algum não couber, recusa e anima de volta. Mostrar a prévia (sombra na posição de destino e os outros já deslocados) durante o arrasto.
5. **Tamanho mínimo/máximo por bloco** (em células), por exemplo: busca min 4×1; relógio 2×1; atalhos 3×1; notícias min 4×3; mercado min 3×2; notas/tarefas/links/contagem min 2×2. O agente ajusta ao ver o conteúdo.
6. **O conteúdo se adapta à caixa**, sem zoom de página: tamanho de fonte e quantidade de itens vêm do tamanho do bloco (container queries `cqw/cqh` e `@container`). Isso substitui `cfg.sizes.*.scale`, `width`, `span`, `theme.gridAlign`, `theme.clockSize` e o `--fit-zoom`.
7. **Janela estreita (< ~700 px):** não tenta encaixar a grade; empilha os blocos numa coluna, na ordem (y, x), com rolagem. Edição desligada nesse modo.

## Modelo de dados

```js
cfg.layout = { v: 1, cols: 12, rows: 8, items: { search: { x: 3, y: 1, w: 6, h: 1 }, ... } }
```

- `cfg.blocks` continua só com `{ id, on }` (some o `zone`; a ordem passa a valer só para a lista do painel e o modo estreito).
- Bloco ligado sem posição → vai para o primeiro espaço livre do tamanho padrão dele (varredura linha a linha); se não couber, tenta o tamanho mínimo; se nem assim, avisa no painel ("Sem espaço: diminua um bloco") e não liga.
- Extras que são do conteúdo ficam em `cfg.sizes`: `news.img`, `news.cols` (Auto continua sendo o padrão), `theme.scSize`/`scCols` se ainda fizerem sentido. Tudo que era tamanho/posição sai.
- **Migração** (uma vez, `cfg.layout` ausente): converter o layout antigo para células preservando o visual o máximo possível: zona `top` → linhas de cima centralizadas, `center` → logo abaixo, `widgets` → resto, com `span` 1/2/full → 4/8/12 colunas, empacotando em linhas na ordem antiga. Notícias com `span: 'full'` ficam com a altura que sobrar. Testar a migração com a config padrão e com uma config "cheia" (todos os blocos ligados).

## Modo de edição

- Entrada: botão "Editar layout" na aba Blocos (fecha o painel e entra no modo) e atalho de teclado (ex.: `E`, sem conflitar com os atalhos que já existem; verificar). Saída: botão "Pronto" flutuante, Esc ou clique fora dos blocos.
- No modo: pontos/linhas suaves marcando as células; cada bloco com borda tracejada, nome do bloco, alça de mover (o bloco todo) e alças de redimensionar nos 4 cantos e 4 lados; links e botões dos blocos ficam inativos (`pointer-events` no conteúdo desligado) para o arrasto não abrir notícia.
- Arrasto com Pointer Events + `setPointerCapture`; posição convertida para célula com arredondamento; prévia atualizada só quando a célula muda; animação dos vizinhos com FLIP (Web Animations, como `slide()` já faz) e respeitando `prefers-reduced-motion`.
- Acessibilidade: bloco focável no modo de edição; setas movem 1 célula, Shift+setas redimensionam; `aria-live` anunciando "Notícias: coluna 3, linha 2, 6 × 4".
- Desfazer: já existe o histórico `lastWritten` (~204); garantir que uma mudança de layout vira um passo desfazível e oferecer "Desfazer" no aviso de saída, se o mecanismo atual permitir sem muito código.
- "Voltar ao layout padrão" na aba Blocos.

## Ajuste do conteúdo à caixa (a parte mais delicada)

- `fitToScreen()` vira "ajustar cada bloco à sua caixa". Nada mais de zoom global nem de "o resto da página precisa caber".
- **Notícias:** manter a lógica de escolher quantas cabem (rodízio entre fontes, níveis de compactação, completar a última linha, espalhar quando sobra), mas medindo contra a altura da caixa do bloco, não da página. A trava de troca de fonte (`lockH` etc.) deve ficar desnecessária, porque a caixa já tem altura fixa: confirme e remova o que sobrar. A pilha de versões (`sameStoryPop`) usa posição fixa na tela e deve continuar funcionando; testar.
- **Mercado:** os níveis `data-fit` passam a ser escolhidos pela altura da caixa.
- **Relógio, saudação, busca, frase:** fonte proporcional à caixa (`cqh`/`cqw` com `clamp`).
- **Atalhos:** colunas e tamanho do ícone derivados da largura/altura da caixa; quando não cabem todos, mostrar os que cabem (sem rolagem).
- **Notas, tarefas, links, contagem:** rolagem interna discreta se o conteúdo passar da caixa (é o único caso aceitável de rolagem).
- Cartão de vidro: cada bloco da grade é um cartão; relógio/saudação/busca continuam sem cartão como hoje.

## Painel (aba Blocos)

- Fica: lista com liga/desliga (sem a alça de reordenar, ou mantida só para o modo estreito), botão grande "Editar layout", "Voltar ao layout padrão", e os menus de ajustes que já existem (Notícias, Mercado, Frases, Links, Contagem).
- Sai: `sizeEditor` (Posição, Tamanho, Largura, Altura), "Alinhar blocos lado a lado". Opções de conteúdo que estavam lá (colunas e imagem das notícias, ícones dos atalhos) vão para o menu do próprio bloco.

## Fases (cada uma termina testada e funcionando)

1. **Modelo + migração + render na grade** (sem edição): `cfg.layout`, migração, render posicionando por `grid-area`, modo estreito. Página com a config padrão deve ficar parecida com a atual.
2. **Conteúdo adaptado à caixa:** reescrever `fitToScreen` por bloco; tirar zoom global, `span`, `scale`, `gridAlign`.
3. **Modo de edição:** mover, redimensionar, colisão, prévia, animação, teclado.
4. **Painel:** nova aba Blocos, ligar bloco no primeiro espaço livre, layout padrão, export/import passando pela migração.
5. **Acabamento:** reduced motion, foco, textos em português, README, versão no `manifest.json`.

## Como testar

- Igual ao que já se fazia: Brave headless com `--remote-debugging-port` e um perfil próprio (`--user-data-dir` numa pasta de teste, **nunca** o perfil do Arthur), cópia da extensão na pasta de teste, scripts Node via CDP, capturas de tela.
- Casos: config padrão; todos os blocos ligados; migração de uma config antiga salva (exportar a do v1.3 antes); janelas 1920×1080, 1366×768, 1242×728 e estreita; arrastar para cima de outro bloco (empurra / recusa); redimensionar até o mínimo; notícias com uma fonte só e com 14 fontes; troca de fonte sem o topo pular; pilha de versões abrindo no lugar certo.
- Teste pequeno e automático para a função de colisão/espaço livre (assert em Node, sem framework).

## Regras para o agente

- JS puro, sem dependências novas e sem etapa de build. Comentários curtos em português, no estilo do arquivo.
- Não apagar dados do usuário: a migração lê o formato antigo e só remove campos depois de converter.
- Não fazer commit, push nem release sem o Arthur pedir. Não fechar o Brave dele; só processos de teste identificados pelo `--user-data-dir` de teste.
- Ao final de cada fase, mostrar capturas antes/depois.

## Fora do escopo (não fazer agora)

- Várias páginas/telas de widgets deslizáveis, layouts diferentes por monitor, blocos duplicados (ex.: dois blocos de notas), widgets novos.
