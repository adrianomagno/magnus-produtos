# Editorial claro dividido

**Quando usar:** a tela dividida ao meio, com fundo claro, o título do cartão e a assinatura em cima, a pessoa grande embaixo e uma palavra por vez na emenda. É o Editorial claro com a pessoa maior: no Editorial claro ela fica num cartão pequeno no meio da tela.

**Fluxo da HyperFrames:** `talking-head-recut`, layout `split` (cartão em cima, vídeo embaixo em toda a largura) e cartões no estilo `editorial` (título pesado com a palavra forte em itálico), no molde `estilos/editorial-claro-dividido.html` do plugin, que o `scripts/montar.mjs` preenche com a marca, a fala, os trechos e os cartões. A composição segue a `hyperframes-core`, com os cortes pelas receitas `Hard cut` e `Trim in/out`; os cartões saem de uma lista, no lugar dos fragmentos `public/cards/` da skill.

## Desenho

- **Layout:** 1080x1920 dividido em duas metades. Em cima (0 a 960 px), fundo em `cores.fundo_claro`: a assinatura no alto, a 150 px, com um filete curto embaixo, e o cartão centrado entre 260 e 860 px, a 72 px das bordas. Embaixo (960 a 1920 px), o vídeo em toda a largura, 1080x960, sem moldura.
- **A palavra grande é a legenda:** no Editorial claro, a palavra do meio já é a fala, uma palavra por vez. Aqui ela vai para a emenda, centrada em 960 px, numa aba do fundo claro que desce sobre o vídeo (de 880 a 1040 px), com sombra suave embaixo. Assim o estilo tem uma legenda só, e ela fica longe do rosto e dos botões do Reels.
- **A assinatura:** no Editorial claro ela fica no rodapé, embaixo da pessoa. Aqui o rodapé é vídeo e fica sob o texto e os botões do Reels, então ela sobe para o alto da metade clara, logo abaixo da faixa do topo onde o Instagram escreve "Reels". A marca aparece só ali: a linha de apoio do cartão leva só a numeração.
- **Tipografia:** linha de apoio do cartão em `fontes.corpo`, 24 px, com a numeração (01 / 04). Título em `fontes.titulo`, peso 800, 84 px, com a palavra forte em `fontes.destaque` itálica. A palavra da emenda alterna `fontes.titulo` peso 800 (92 px) e `fontes.destaque` itálica (112 px); palavra longa encolhe até caber na largura. Assinatura (`assinatura` do `marca.json`) em `fontes.destaque` itálica, 42 px.
- **Cores:** textos em `cores.texto`. Itálicos, filete do cartão e filete da assinatura em `cores.destaque`; se essa cor não tiver contraste de 3:1 com `cores.fundo_claro`, o molde escurece os itálicos. A aba da emenda é do `cores.fundo_claro`, então a palavra lê bem sobre qualquer vídeo.

## Efeitos sonoros

- **Whoosh largo** na entrada de cada cartão, um som só dos cartões.
- A palavra da emenda fica sem som: ela troca a cada palavra falada.

Os sons são os do `sons/manifest.json` do plugin: os da pasta `sons/` (licença CC0, com a origem de cada um em `sons/LICENCAS.md`) e 3 do plugin hyperframes (`whoosh-short`, `pop` e `impact-bass-1`, licença Pixabay, uso comercial sem atribuição); o montador copia só os usados para a pasta `efeitos/` do vídeo. O volume de cada som foi medido no arquivo e todos ficam no mesmo nível, por baixo da voz. Cada som começa antes do movimento o tanto do pico medido dele, para o ponto mais forte do som cair no quadro em que o elemento aparece. Quando um momento tem mais de um som, eles se revezam, para não repetir o mesmo som seguido. Dois efeitos a menos de 0,5 s um do outro: fica o mais forte. Ligados por padrão; `"efeitos": false` no `escolhas.json` desliga neste vídeo.

## Como montar

1. Siga `audio-e-corte.md` até ter, na pasta do vídeo, `fonte.mp4`, `transcript.json` corrigido e `trechos.json`.
2. Baixe as fontes como manda `marca.md`; o montador usa as de `fonts/`.
3. Monte os cartões como no Editorial claro: um a cada 3 a 8 segundos de edição, um por ideia. O título é um trecho literal da fala (pode cortar o começo e o fim, nunca reescrever), com no máximo 8 palavras e a palavra forte entre asteriscos. `"de"` é o segundo do vídeo original em que a ideia começa (o `start` da primeira palavra dela no `transcript.json`); o cartão fica até o próximo começar. Escreva o `escolhas.json` na pasta do vídeo:

       {
         "estilo": "editorial-claro-dividido",
         "foco": "50% 25%",
         "cartoes": [
           { "de": 0.5, "titulo": "Todo cliente recebe *resposta* no mesmo dia." },
           { "de": 4.8, "titulo": "A *solução* sai antes do almoço." }
         ]
       }

   Campos que valem para todo estilo: `"estilo"`, `"foco"` (a posição do rosto, `"50% 25%"` para começar neste estilo: o primeiro número vai de 0%, que mostra a borda esquerda do vídeo, a 100%, a direita; o segundo, de 0%, o topo, a 100%, a base). O montador lê a marca em `../marca.json` (troque com `"marca": "<caminho>"`). `"efeitos"` é opcional: `true` (padrão) ou `false`. `"capa"` é opcional e vale para os estilos de 1 a 5 e de 7 a 9 (a Caixinha de pergunta não leva capa): se o dono escolheu um gancho de capa, veja `capas.md`. `"aproximar"` é opcional: a lista das frases de ênfase em que o vídeo aproxima no rosto, se o dono quis (veja `audio-e-corte.md`, passo 4b).
4. Monte: `node "${CLAUDE_PLUGIN_ROOT}/scripts/montar.mjs" .` grava `index.html` e `comum.js` na pasta e, com os efeitos ligados, copia os sons usados para `efeitos/`.
5. Confira o rosto com `hf snapshot . --at 2 --describe false` (com gancho de capa, `--at 3.5`): a cabeça precisa começar abaixo da aba da palavra (ela desce até 1040 px). Se a aba encostar na testa, diminua o segundo número do `"foco"` (de 25% para 20%, 15%...), que desce a pessoa; se o queixo sair por baixo, aumente.

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

- **Fonte de destaque sem itálico:** sem o arquivo `-400-italic.woff2` em `fonts/`, o montador declara a fonte normal e avisa; o navegador inclina a própria fonte da marca (itálico falso). Se o dono não gostar, escolha a serifada mais parecida que tenha itálico no Google Fonts.
- **A pessoa fica grande, mas cortada:** a metade de baixo é quase quadrada (1080x960). Vídeo em pé do celular mostra só do alto da cabeça até o peito; vídeo deitado perde as laterais. Confira sempre o passo 5.
- **Título longo:** com mais de 8 palavras, o título passa de 3 linhas e fica pesado para ler nos poucos segundos do cartão. Corte o trecho, não diminua a letra.
- **O render precisa de internet:** o molde carrega o GSAP da CDN jsDelivr na hora do render. Confira a conexão antes de renderizar.
- **Sem o plugin hyperframes:** os efeitos sonoros deste estilo são todos da pasta `sons/` do Editor Chefe, então a montagem não para por falta deles (o render continua precisando da HyperFrames).
- **Teste de referência:** 15 s de gravação viraram 13,2 s de edição com 4 cartões; render em cerca de 21 s num Mac M1 Pro; com os 4 efeitos, áudio em -16,5 LUFS.
