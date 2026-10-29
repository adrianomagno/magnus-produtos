# Papelaria

**Quando usar:** visual claro de papelaria, com cartões brancos em letra de mão acima da pessoa e, quando a fala tem uma lista (passos, cuidados, erros comuns), cada item ganha o check ou é riscado no instante em que é dito. Bom para dica e aula com etapas, ou para desmontar mitos (o item riscado).

**Fluxo da HyperFrames:** composição da `hyperframes-core` no molde `estilos/papelaria.html` do plugin, que o `scripts/montar.mjs` preenche com a marca, a fala, os trechos e os cartões. Os cortes seguem as receitas `Hard cut` e `Trim in/out`.

## Desenho

- **Layout:** tela dividida. Em cima (0 a 960 px), o papel pontilhado de caderno no `cores.fundo_claro`, a assinatura do negócio no alto (150 px) e um cartão de papel branco por vez, centrado entre 220 e 870 px, levemente torto, com uma fita adesiva no alto. Embaixo (960 a 1920 px), o vídeo em toda a largura, com a sombra da borda do papel por cima. A legenda é a do Corte seco, sem caixa, dentro do vídeo (abaixo).
- **Legenda:** a do Corte seco, sem caixa (com muitos elementos na tela, a legenda vai só branca com um leve contorno). Linhas de até 5 palavras, em `fontes.titulo`, peso 800, 66 px, no `cores.fundo_claro` com um leve contorno no escuro da marca e sombra, dentro da metade do vídeo, embaixo e longe do rosto, de 1500 a 1650 px, sem cruzar a emenda. A palavra de ênfase ganha um traço de 8 px na cor de destaque no instante em que é dita: por padrão, a palavra forte (entre asteriscos) de cada cartão, dita no tempo dele; `"enfase"` no `escolhas.json` (palavras da fala, na ordem, como no Corte seco) troca. Quando a faixa da legenda é clara no vídeo, mesmo só em parte (jaleco, camisa branca, parede), o montador mede e reforça o contorno e a sombra, e diz isso no fim da montagem ("contorno da legenda reforçado"); não volta a caixa.
- **O cartão:** o título em letra de mão, que se escreve da esquerda para a direita quando o cartão entra; a palavra forte (`*assim*`) na cor de destaque, com um sublinhado à mão que se desenha logo depois. Se o cartão tem lista, os itens já entram escritos, cada um com um quadradinho desenhado à mão; quando a pessoa diz o item, o check se desenha no quadradinho (ou, com `"marca": "risco"`, uma linha à mão risca o item e ele fica cinza). Cartão alto demais encolhe a letra até 64%.
- **Tipografia:** a letra de mão é a Caveat 700, fixa (licença SIL OFL 1.1, do Google Fonts), e não a fonte da marca: título de 104 px (86 px com lista) e itens de 66 px. A assinatura em `fontes.corpo`, 26 px em caixa alta; a legenda em `fontes.titulo`, peso 800, 56 px.
- **Cores e contraste:** as do painel branco do Motion dividido: tinta no `cores.fundo_escuro` (escurecido até 4,6:1 no tom mais escuro do papel); traço, check, risco, sublinhado e palavra forte no `cores.destaque`, escurecido rumo ao preto até 3,2:1 se for claro demais (o amarelo vira mostarda no mesmo matiz); item riscado em cinza ainda com 4,6:1; quadradinho com 3:1. A assinatura no `cores.texto`, escurecido até 4,6:1 contra o fundo claro. Na legenda, tinta escura e a palavra falada na cor do traço. Os pontos do papel e a fita são só enfeite.

## Efeitos sonoros

- **Whoosh largo** na entrada de cada cartão (o papel que chega).
- **Clique discreto** em cada check ou risco, revezando o tique e o clique suave, no instante em que o item é dito.
- Nada na legenda.

Os sons são os do `sons/manifest.json` do plugin: os da pasta `sons/` (licença CC0, com a origem de cada um em `sons/LICENCAS.md`) e 3 do plugin hyperframes (`whoosh-short`, `pop` e `impact-bass-1`, licença Pixabay, uso comercial sem atribuição); o montador copia só os usados para a pasta `efeitos/` do vídeo. O volume de cada som foi medido no arquivo e todos ficam no mesmo nível, por baixo da voz. Cada som começa antes do movimento o tanto do pico medido dele, para o ponto mais forte do som cair no quadro em que o elemento aparece. Dois efeitos a menos de 0,5 s um do outro: fica o mais forte. Ligados por padrão; `"efeitos": false` no `escolhas.json` desliga neste vídeo.

## Como montar

1. Siga `audio-e-corte.md` até ter, na pasta do vídeo, `fonte.mp4` (com o passo 1b rodado com `papelaria`), `transcript.json` corrigido e `trechos.json`.
2. Baixe as fontes como manda `marca.md` e também a letra de mão, na mesma pasta `fonts/`:

       node "${CLAUDE_PLUGIN_ROOT}/scripts/baixar-fonte.mjs" "Caveat" "700" "<pasta do vídeo>/fonts"

   Sem o arquivo `fonts/Caveat-700.woff2`, o montador para dizendo que falta a letra de mão.
3. Escolha os cartões no `transcript.json` corrigido: um por ideia, cada um com o segundo do vídeo original em que a ideia começa (`"de"`) e o título, um trecho da fala de até 48 caracteres, com no máximo uma palavra forte entre asteriscos. Quando a fala enumera coisas, o cartão leva a `"lista"`: de 1 a 4 itens, cada um com as palavras da fala, seguidas e na ordem em que foram ditas, até 32 caracteres; `"marca": "check"` (padrão) para o que se faz ou se ganha, `"risco"` para o que se deve evitar ou o mito desmontado. Nunca invente nem troque palavra. Escreva o `escolhas.json` na pasta do vídeo:

       {
         "estilo": "papelaria",
         "foco": "50% 25%",
         "cartoes": [
           { "de": 0.5, "titulo": "Todo cliente recebe *resposta*" },
           { "de": 4.8, "titulo": "Antes do *almoço*", "lista": ["chega de manhã", "antes do almoço"], "marca": "check" }
         ]
       }

   Campos que valem para todo estilo: `"estilo"`, `"foco"` (a posição do rosto, `"50% 25%"` para começar neste estilo: o primeiro número vai de 0%, que mostra a borda esquerda do vídeo, a 100%, a direita; o segundo, de 0%, o topo, a 100%, a base). O montador lê a marca em `../marca.json` (troque com `"marca": "<caminho>"`). `"efeitos"` é opcional: `true` (padrão) ou `false`. `"capa"` é opcional e vale para os estilos de 1 a 5, de 7 a 9, 11 e 12 (a Caixinha de pergunta não leva capa): se o dono escolheu um gancho de capa, veja `capas.md`. `"aproximar"` é opcional: a lista das frases de ênfase em que o vídeo aproxima no rosto, se o dono quis (veja `audio-e-corte.md`, passo 4b).
4. Monte: `node "${CLAUDE_PLUGIN_ROOT}/scripts/montar.mjs" .` grava `index.html` e `comum.js` na pasta e, com os efeitos ligados, copia os sons usados para `efeitos/`. Aviso de título ou item que "não aparece igual na fala desse cartão" quer dizer que as palavras não estão no `transcript.json`, seguidas, entre o começo desse cartão e o do seguinte: o item sem fala ganha a marca 0,5 s depois do anterior, sem acompanhar a voz. Corrija pelo `transcript.json` e monte de novo.
5. Confira o rosto com `hf snapshot . --at 2 --describe false` (com gancho de capa, `--at 3.5`): a legenda fica embaixo, de 1500 a 1650 px, e não pode cobrir o queixo. Se cobrir, aumente o segundo número do `"foco"` (de 25% para 30%, 35%...), que sobe a pessoa; se a cabeça sair por cima, diminua.

## Prévia, conferência e render

Na pasta do vídeo (`hf` é a HyperFrames, como manda o passo 3 da SKILL):

1. Prévia dos primeiros 10 segundos (edição de até 12 s: renderize inteira):

       sed 's/data-duration="[0-9.]*" data-width/data-duration="10" data-width/' index.html > previa.html
       HF_VIDEO_COVERAGE_THRESHOLD=0 hf render . -c previa.html -o previa.mp4
       rm previa.html

   A variável vale só na prévia: ela aceita o trecho que passa dos 10 s. Apague o `previa.html` logo depois; com ele na pasta, o `lint` acusa `multiple_root_compositions`.
2. Ajuste pelo que o dono disser no `escolhas.json` ou no `transcript.json` e rode o `montar.mjs` de novo; não edite o `index.html` à mão.
3. Antes do render final: `hf lint .` e `hf check . --strict`, os dois sem erro e sem aviso.
4. Render final: `hf render . -o "../prontos/<AAAA-MM-DD>-<nome curto>.mp4"`, depois as conferências de `entrega.md`.

## Cuidados

- **Lista sem fala:** a marca só acompanha a voz quando o item está na fala do cartão. Se a pessoa não enumera nada, use cartões só com título.
- **Marca do item:** o check (ou o risco) se desenha no começo da última palavra do item, para terminar junto com ele. Item dito antes de o cartão entrar fica de fora do tempo (o cartão procura a fala a partir de 0,5 s antes do começo dele): ponha o `"de"` do cartão antes do primeiro item.
- **O render não precisa de internet:** o GSAP vem no plugin (`estilos/gsap.min.js`, conferido pelo SHA-256), e o montador copia o arquivo para a pasta do vídeo.
- **Sem o plugin hyperframes:** o montador para dizendo que não achou os efeitos sonoros. Instale o plugin hyperframes do mesmo marketplace e abra uma conversa nova; se não der, monte com `"efeitos": false`.
