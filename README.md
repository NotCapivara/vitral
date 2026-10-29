# Vitral

**Um redesign da nova guia do Brave (e do Chrome e do Firefox).** Em vez da página padrão, uma tela de vidro limpa, com relógio, busca, notícias das fontes que você escolher e o mercado do dia. Tudo cabe numa tela só, sem rolagem, e sem rastreamento.

![Nova guia com relógio, busca, citação, Mercado e Notícias](docs/captura.webp)

## O que tem

- **Relógio e saudação**
- **Busca**, com mecanismos fixos (DuckDuckGo, Google, Brave, Startpage e outros) que você pode ligar, desligar e reordenar
- **Favoritos**: você adiciona pesquisando o site na web
- **Notícias** de várias fontes:
  - RSS, ou leitura direta de sites sem RSS
  - viés de cada fonte por cores
  - tradução automática
  - divisão igual entre as fontes
  - mesma notícia em várias fontes num cartão só (passe o mouse para ver todas as versões)
  - filtro de assuntos (política, esportes, loterias, promoções…) e palavras bloqueadas
- **Mercado**:
  - moedas, ações, FIIs, ETFs, cripto e commodities
  - maior alta e maior baixa do dia por país
  - Selic, CDI e IPCA
  - minigráficos por período
- **Grade como a do Android**: em "Editar layout" (ou tecla E), arraste os blocos para mover e puxe as bordas para redimensionar; o conteúdo se ajusta ao tamanho de cada bloco
- **Personalização**: fundo, vidro, cantos e cores
- **Outros blocos**: notas, tarefas, links, contagem regressiva e citações

As configurações ficam só no navegador (`chrome.storage.local`).

## Instalar

### Brave e Chrome

1. Baixe o **`vitral-vX.Y.Z-chrome.zip`** da [versão mais recente](https://github.com/NotCapivara/vitral/releases/latest) e extraia numa pasta que você não vá apagar.
2. Abra `brave://extensions` (ou `chrome://extensions`) e ligue o **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e escolha a pasta **`vitral`** que saiu do zip.

Se você clonou o repositório para editar o código, escolha a pasta do clone e, depois de cada edição, clique em ↻ no cartão da extensão.

### Firefox (140 ou mais novo)

1. Baixe o **`vitral-vX.Y.Z-firefox.zip`** da [versão mais recente](https://github.com/NotCapivara/vitral/releases/latest) (não precisa extrair).
2. Abra `about:debugging#/runtime/this-firefox` e clique em **Carregar extensão temporária…**; escolha o zip.

O Firefox só instala de vez extensões assinadas pela Mozilla. Carregada assim, a extensão some quando o Firefox fecha. No Firefox, os atalhos mostram a inicial do site em vez do ícone guardado pelo navegador (os ícones baixados continuam funcionando).

## Desenvolvimento

O código é um só para os dois navegadores. Como montar, testar e o que muda entre eles está em [AGENTS.md](AGENTS.md).

## Dados externos

Os dados de fora vêm de serviços gratuitos e sem cadastro:

| Dado | Serviço |
| --- | --- |
| Cotações | Yahoo Finance, CoinGecko, AwesomeAPI |
| Juros e inflação | Banco Central (SGS) |
| Ícones | DuckDuckGo |
| Nomes de sites | Wikidata |
| Notícias de um site cujo feed falhou (ex.: verificação anti-robô) | Bing Notícias |

Os sites de notícias só são acessados depois que você dá permissão para cada um.
