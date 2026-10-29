# Painel escuro dividido

**Quando usar:** a tela dividida ao meio, com fundo escuro e cartões de informação em cima, a pessoa grande embaixo e a legenda do Corte seco, sem caixa, dentro do vídeo. É o Painel escuro com a pessoa maior: no Painel escuro ela fica numa janela pequena no meio da tela.

**Fluxo da HyperFrames:** `talking-head-recut`, tema escuro, layout `split` (cartão em cima, vídeo embaixo em toda a largura) e cartões no estilo `audit` (cabeçalho com filete, título pesado com uma palavra marcada), no molde `estilos/painel-escuro-dividido.html` do plugin, que o `scripts/montar.mjs` preenche com a marca, a fala, os trechos e os cartões. A composição segue a `hyperframes-core`, com os cortes pelas receitas `Hard cut` e `Trim in/out`; os cartões saem de uma lista, no lugar dos fragmentos `public/cards/` da skill.

## Desenho

- **Layout:** 1080x1920 dividido em duas metades. Em cima (0 a 960 px), fundo em `cores.fundo_escuro`: no alto, a 150 px, o cabeçalho com o `nome` da marca à esquerda, a numeração do cartão (01 / 04) à direita e um filete embaixo; logo abaixo, o título do cartão centrado entre 230 e 870 px, a 64 px das bordas, do maior tamanho que couber, para ocupar a metade de cima. Embaixo (960 a 1920 px), o vídeo em toda a largura, 1080x960, sem moldura. Na emenda, um filete de 6 px na cor de destaque e a legenda numa caixa escura centrada em 960 px, até 4 palavras e 22 letras: ela fica entre as duas metades, longe do rosto e longe dos botões e do texto do Reels.
- **Legenda:** a do Corte seco, sem caixa (com muitos elementos na tela, a legenda vai só branca com um leve contorno). Linhas de até 5 palavras, em `fontes.titulo`, peso 800, 66 px, no `cores.fundo_claro` com um leve contorno no escuro da marca e sombra, dentro da metade do vídeo, embaixo e longe do rosto, de 1500 a 1650 px, sem cruzar a emenda. A palavra de ênfase ganha um traço de 8 px na cor de destaque no instante em que é dita: por padrão, a palavra forte (entre asteriscos) de cada cartão, dita no tempo dele; `"enfase"` no `escolhas.json` (palavras da fala, na ordem, como no Corte seco) troca. Quando a faixa da legenda é clara no vídeo, mesmo só em parte (jaleco, camisa branca, parede), o montador mede e reforça o contorno e a sombra, e diz isso no fim da montagem ("contorno da legenda reforçado"); não volta a caixa.
- **Tipografia:** os cartões do Painel escuro. Cabeçalho em `fontes.corpo`, 24 px, caixa alta. Título em `fontes.titulo`, peso 800, de 120 px (título curto) a 88 px (título longo): o molde começa em 120 e diminui de 4 em 4 até caber. Legenda em `fontes.titulo`, peso 800, 58 px.
- **Cores:** textos em `cores.fundo_claro`. A palavra marcada no título sai em `cores.destaque`; se essa cor não tiver contraste de 3:1 com `cores.fundo_escuro`, o molde clareia o título. A caixa da legenda é opaca, em `cores.fundo_escuro`, e a palavra falada sai em `cores.destaque`, clareada até ler bem (3,4:1) quando a cor da marca é escura demais.

## Efeitos sonoros

- **Whoosh largo** na entrada de cada cartão, um som só dos cartões.
- A legenda fica sem som: ela troca a cada segundo.

Os sons são os do `sons/manifest.json` do plugin: os da pasta `sons/` (licença CC0, com a origem de cada um em `sons/LICENCAS.md`) e 3 do plugin hyperframes (`whoosh-short`, `pop` e `impact-bass-1`, licença Pixabay, uso comercial sem atribuição); o montador copia só os usados para a pasta `efeitos/` do vídeo. O volume de cada som foi medido no arquivo e todos ficam no mesmo nível, por baixo da voz. Cada som começa antes do movimento o tanto do pico medido dele, para o ponto mais forte do som cair no quadro em que o elemento aparece. Quando um momento tem mais de um som, eles se revezam, para não repetir o mesmo som seguido. Dois efeitos a menos de 0,5 s um do outro: fica o mais forte. Ligados por padrão; `"efeitos": false` no `escolhas.json` desliga neste vídeo.

## Como montar

1. Siga `audio-e-corte.md` até ter, na pasta do vídeo, `fonte.mp4`, `transcript.json` corrigido e `trechos.json`.
2. Baixe as fontes como manda `marca.md`; o montador usa as de `fonts/`.
3. Monte os cartões como no Painel escuro: um a cada 3 a 8 segundos de edição, um por ideia. O título é um trecho literal da fala (pode cortar o começo e o fim, nunca reescrever), com no máximo 8 palavras e a palavra forte entre asteriscos. `"de"` é o segundo do vídeo original em que a ideia começa (o `start` da primeira palavra dela no `transcript.json`); o cartão fica até o próximo começar. Escreva o `escolhas.json` na pasta do vídeo:

       {
         "estilo": "painel-escuro-dividido",
         "foco": "50% 25%",
         "cartoes": [
           { "de": 0.5, "titulo": "Todo cliente recebe *resposta* no mesmo dia." },
           { "de": 4.8, "titulo": "A *solução* sai antes do almoço." }
         ]
       }

   Campos que valem para todo estilo: `"estilo"`, `"foco"` (a posição do rosto, `"50% 25%"` para começar neste estilo: o primeiro número vai de 0%, que mostra a borda esquerda do vídeo, a 100%, a direita; o segundo, de 0%, o topo, a 100%, a base). O montador lê a marca em `../marca.json` (troque com `"marca": "<caminho>"`). `"efeitos"` é opcional: `true` (padrão) ou `false`. `"capa"` é opcional e vale para os estilos de 1 a 5, de 7 a 9, 11 e 12 (a Caixinha de pergunta não leva capa): se o dono escolheu um gancho de capa, veja `capas.md`. `"aproximar"` é opcional: a lista das frases de ênfase em que o vídeo aproxima no rosto, se o dono quis (veja `audio-e-corte.md`, passo 4b).
4. Monte: `node "${CLAUDE_PLUGIN_ROOT}/scripts/montar.mjs" .` grava `index.html` e `comum.js` na pasta e, com os efeitos ligados, copia os sons usados para `efeitos/`.
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

- **A pessoa fica grande, mas cortada:** a metade de baixo é quase quadrada (1080x960). Vídeo em pé do celular mostra só do alto da cabeça até o peito; vídeo deitado perde as laterais. Por isso o `"foco"` importa mais aqui que nos outros estilos: confira sempre o passo 5.
- **Título longo:** com mais de 8 palavras, o título desce para 88 px e passa de 4 linhas, pesado para ler nos poucos segundos do cartão. Corte o trecho.
- **Fonte sem peso 800:** o montador usa o peso mais pesado que houver em `fonts/` e avisa. Diga ao dono que a letra fica um pouco mais leve que a da marca.
- **O render não precisa de internet:** o GSAP vem no plugin (`estilos/gsap.min.js`, conferido pelo SHA-256), e o montador copia o arquivo para a pasta do vídeo.
- **Sem o plugin hyperframes:** os efeitos sonoros deste estilo são todos da pasta `sons/` do Editor Chefe, então a montagem não para por falta deles (o render continua precisando da HyperFrames).
- **Teste de referência:** 15 s de gravação viraram 13,2 s de edição com 4 cartões; render em cerca de 25 s num Mac M1 Pro; com os 4 efeitos, áudio em -16,5 LUFS.
