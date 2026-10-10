# Editorial claro

**Quando usar:** fundo claro, a pessoa num cartão, uma palavra por vez.

**Fluxo da HyperFrames:** `talking-head-recut`, layout `stack` com o vídeo num cartão arredondado (quadro `clean` com sombra) e cartões no estilo `editorial` (título pesado com a palavra forte em itálico), no molde `estilos/editorial-claro.html` do plugin, que o `scripts/montar.mjs` preenche com a marca, a fala, os trechos e os cartões. A composição segue a `hyperframes-core`, com os cortes pelas receitas `Hard cut` e `Trim in/out`; os cartões saem de uma lista, no lugar dos fragmentos `public/cards/` da skill.

## Desenho

- **Layout:** fundo inteiro em `cores.fundo_claro`, 1080x1920. Cartão na faixa de 150 a 710 px, a 72 px das bordas. Uma palavra por vez no meio, na faixa de 770 a 1000 px. A pessoa num cartão de 960x540 a partir de 1056 px do topo (55% da altura), cantos de 28 px e sombra suave. Assinatura no rodapé, a 1636 px, com um filete curto acima.
- **Tipografia:** linha de apoio do cartão em `fontes.corpo`, 24 px, caixa alta, com a numeração e o `nome` da marca. Título em `fontes.titulo`, peso 800, 84 px, com a palavra forte em `fontes.destaque` itálica. A palavra do meio alterna `fontes.titulo` peso 800 (120 px) e `fontes.destaque` itálica (150 px). Assinatura (`assinatura` do `marca.json`) em `fontes.destaque` itálica, 46 px.
- **Cores:** textos em `cores.texto`. Itálicos, filete do cartão e filete da assinatura em `cores.destaque`; se essa cor não tiver contraste de 3:1 com `cores.fundo_claro`, o molde escurece os itálicos.

## Efeitos sonoros

- **Whoosh curto** na entrada de cada cartão.
- A palavra do meio fica sem som: ela troca a cada palavra falada.

Os sons são do plugin hyperframes (`skills/media-use/audio/assets/sfx/`, licença Pixabay, uso comercial sem atribuição); o montador copia só os usados para a pasta `efeitos/` do vídeo. Volume 0,35, por baixo da voz (o impacto grave, 9 dB mais alto de origem, vai a 0,2); cada som começa um instante antes, para o pico cair quando o elemento aparece; dois efeitos a menos de 0,5 s um do outro: fica o mais forte. Ligados por padrão; `"efeitos": false` no `escolhas.json` desliga neste vídeo.

## Como montar

1. Siga `audio-e-corte.md` até ter, na pasta do vídeo, `fonte.mp4`, `transcript.json` corrigido e `trechos.json`.
2. Baixe as fontes como manda `marca.md`; o montador usa as de `fonts/`.
3. Monte os cartões: um a cada 3 a 8 segundos de edição, um por ideia. O título é um trecho literal da fala (pode cortar o começo e o fim, nunca reescrever), com no máximo 8 palavras e a palavra forte entre asteriscos. `"de"` é o segundo do vídeo original em que a ideia começa (o `start` da primeira palavra dela no `transcript.json`); o cartão fica até o próximo começar. Escreva o `escolhas.json` na pasta do vídeo:

       {
         "estilo": "editorial-claro",
         "foco": "50% 40%",
         "cartoes": [
           { "de": 0.5, "titulo": "Todo cliente recebe *resposta* no mesmo dia." },
           { "de": 4.8, "titulo": "A *solução* sai antes do almoço." }
         ]
       }

   Campos que valem para todo estilo: `"estilo"`, `"foco"` (a posição do rosto, `"50% 40%"` para começar: o primeiro número vai de 0%, que mostra a borda esquerda do vídeo, a 100%, a direita; o segundo, de 0%, o topo, a 100%, a base). O montador lê a marca em `../marca.json` (troque com `"marca": "<caminho>"`). `"efeitos"` é opcional: `true` (padrão) ou `false`.
4. Monte: `node "${CLAUDE_PLUGIN_ROOT}/scripts/montar.mjs" .` grava `index.html` e `comum.js` na pasta e, com os efeitos ligados, copia os sons usados para `efeitos/`. Aviso de palavra "não foi achada na fala" quer dizer que ela não aparece no `transcript.json` na ordem pedida: corrija a palavra no `escolhas.json` e monte de novo.
5. Confira o rosto com `hf snapshot . --at 2` e ajuste o `"foco"` se preciso.

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

- **Fonte de destaque sem itálico:** sem o arquivo `-400-italic.woff2` em `fonts/`, o montador declara a fonte normal e avisa; o navegador inclina a própria fonte da marca (itálico falso, conferido a olho numa amostra, sem teste automático). Se o dono não gostar, escolha a serifada mais parecida que tenha itálico no Google Fonts.
- **Vídeo em pé:** o cartão de 960x540 é deitado; com vídeo em pé, use o segundo número do `"foco"` perto de 25% para o rosto não sair do corte e confira com `hf snapshot . --at 2`.
- **Título longo:** com mais de 8 palavras, o título passa de 3 linhas e fica pesado para ler nos poucos segundos do cartão. Corte o trecho, não diminua a letra.
- **O render precisa de internet:** o molde carrega o GSAP da CDN jsDelivr na hora do render. Confira a conexão antes de renderizar.
- **Sem o plugin hyperframes:** o montador para dizendo que não achou os efeitos sonoros. Instale o plugin hyperframes do mesmo marketplace e abra uma conversa nova; se não der, monte com `"efeitos": false`.
- **Teste de referência:** 15 s de gravação viraram 12,2 s de edição com 4 cartões; render em cerca de 17 s num Mac M1 Pro; com os 4 efeitos, áudio em -15,8 LUFS.
