# Editorial claro dividido

**Quando usar:** a tela dividida ao meio, com fundo claro, o título do cartão e a assinatura em cima e a pessoa grande embaixo. Os cartões mostram a fala inteira, um depois do outro, com cada palavra acendendo quando é dita; não tem legenda. É o Editorial claro com a pessoa maior: no Editorial claro ela fica num cartão pequeno no meio da tela.

**Fluxo da HyperFrames:** `talking-head-recut`, layout `split` (cartão em cima, vídeo embaixo em toda a largura) e cartões no estilo `editorial` (título pesado com a palavra forte em itálico), no molde `estilos/editorial-claro-dividido.html` do plugin, que o `scripts/montar.mjs` preenche com a marca, a fala, os trechos e os cartões. A composição segue a `hyperframes-core`, com os cortes pelas receitas `Hard cut` e `Trim in/out`; os cartões saem de uma lista, no lugar dos fragmentos `public/cards/` da skill.

## Desenho

- **Layout:** 1080x1920 dividido em duas partes, a de cima menor: em cima, 40% da tela (0 a 768 px), fundo em `cores.fundo_claro`: a assinatura no alto, a 150 px, com um filete curto embaixo, e o cartão centrado entre 236 e 680 px, a 72 px das bordas. Embaixo, 60% da tela (768 a 1920 px), o vídeo em toda a largura, 1080x1152, sem moldura.
- **Os cartões cobrem a fala inteira (desde a 0.9.3):** o montador põe toda a fala da edição em cartões, em sequência, e nenhum trecho fica sem texto. Os cartões do `escolhas.json` (os do dono, com a palavra forte entre asteriscos) valem no trecho deles, se o título está na fala, seguido e igual; o resto vira cartões com a fala literal, quebrados no fim da frase, na pausa de meio segundo e no tamanho (até 44 letras, para caber em até 3 linhas de 84 px). Dentro da frase, a quebra prefere a vírgula, depois a pausa e depois o lugar antes de uma preposição ou conjunção, e o cartão nunca termina em palavra fraca (artigo, preposição, conjunção ou pronome átono); se a frase continua num cartão do dono, a palavra fraca vai para a frente dele. A conferência mede no vídeo pronto a altura de cada cartão e reprova o que passar de 3 linhas ou sair da faixa de cima. Uma ou duas palavras soltas colam no cartão vizinho; com palavra na frente, o título do dono continua a frase ("Eu escuto..."). Cartão do dono que não está na fala vira fala literal, com aviso. A transcrição corrigida (nomes, marcas) é o texto dos cartões, então corrija o `transcript.json` como sempre.
- **Sem legenda:** com o título acendendo palavra por palavra, a legenda repetia o texto. Quem quiser de volta: `"legenda": "corrida"` (a do Corte seco, sem caixa, dentro do vídeo, de 1500 a 1650 px, branca com contorno e sombra suaves) ou `"legenda": "palavra"` (a palavra grande numa aba clara na emenda, como até a 0.9.2).
- **A troca de cartão:** seca e curta. O cartão sai em 0,12 s e o seguinte entra em 0,18 s, sem os dois juntos na tela; o texto nunca fica mais de 0,15 s fora (a conferência mede). O cartão entra 0,25 s antes da primeira palavra dele. Sem numeração: com 30 ou 40 cartões, "01 / 37" só ocupava lugar.
- **A assinatura:** no Editorial claro ela fica no rodapé, embaixo da pessoa. Aqui o rodapé é vídeo e fica sob o texto e os botões do Reels, então ela sobe para o alto da metade clara, logo abaixo da faixa do topo onde o Instagram escreve "Reels". A marca aparece só ali.
- **Tipografia:** título em `fontes.titulo`, peso 800, 84 px, com a palavra forte em `fontes.destaque` itálica. Assinatura (`assinatura` do `marca.json`) em `fontes.destaque` itálica, 42 px.
- **O título no ritmo da fala (desde a 0.9.3):** o título entra inteiro, apagado, e cada palavra acende e sobe um pouco no instante em que é dita, pelos tempos da fala. Palavra dita antes de o cartão entrar acende junto com ele; palavra que não está na fala acende junto com a anterior (por isso o título precisa ser literal). A palavra forte (entre asteriscos) ganha o marca-texto, desenhado da esquerda para a direita no instante em que é dita: uma faixa forte na cor de destaque, e a letra por cima troca para o claro ou o escuro da marca, o que ler mais (pelo menos 4,5:1). Com `"risco": true` no cartão, ela é riscada no lugar do marca-texto: só quando o dono ou o roteiro pedir (por exemplo, em "O problema não é a *lei*"), nunca por escolha do Editor Chefe. O tamanho da letra continua o de sempre.
- **Cores:** textos em `cores.texto`. Itálicos, filete do cartão e filete da assinatura em `cores.destaque`; se essa cor não tiver contraste de 3:1 com `cores.fundo_claro`, o molde escurece os itálicos.

## Efeitos sonoros

- **Whoosh largo** na entrada de cada cartão do dono (os da fala literal entram sem som, senão seria um som a cada 2 segundos).

Os sons são os do `sons/manifest.json` do plugin: os da pasta `sons/` (licença CC0, com a origem de cada um em `sons/LICENCAS.md`) e 3 do plugin hyperframes (`whoosh-short`, `pop` e `impact-bass-1`, licença Pixabay, uso comercial sem atribuição); o montador copia só os usados para a pasta `efeitos/` do vídeo. O volume de cada som foi medido no arquivo e todos ficam no mesmo nível, por baixo da voz. Cada som começa antes do movimento o tanto do pico medido dele, para o ponto mais forte do som cair no quadro em que o elemento aparece. Quando um momento tem mais de um som, eles se revezam, para não repetir o mesmo som seguido. Dois efeitos a menos de 0,5 s um do outro: fica o mais forte. Ligados por padrão; `"efeitos": false` no `escolhas.json` desliga neste vídeo.

## Como montar

1. Siga `audio-e-corte.md` até ter, na pasta do vídeo, `fonte.mp4`, `transcript.json` corrigido e `trechos.json`.
2. Baixe as fontes como manda `marca.md`; o montador usa as de `fonts/`.
3. Escolha os cartões fortes (opcional): os trechos da fala que merecem a palavra forte, cada um com o título literal (pode cortar o começo e o fim, nunca reescrever), no máximo 8 palavras e a palavra forte entre asteriscos; `"de"` é o segundo do vídeo original em que a ideia começa (o `start` da primeira palavra dela no `transcript.json`). Não precisa cobrir a fala: o montador preenche o resto com a fala literal. Sem nenhum, `"cartoes"` pode ficar de fora. Escreva o `escolhas.json` na pasta do vídeo:

       {
         "estilo": "editorial-claro-dividido",
         "foco": "50% 25%",
         "cartoes": [
           { "de": 0.5, "titulo": "Todo cliente recebe *resposta* no mesmo dia." },
           { "de": 4.8, "titulo": "A *solução* sai antes do almoço." }
         ]
       }

   Campos que valem para todo estilo: `"estilo"`, `"foco"` (a posição do rosto, `"50% 25%"` para começar neste estilo: o primeiro número vai de 0%, que mostra a borda esquerda do vídeo, a 100%, a direita; o segundo, de 0%, o topo, a 100%, a base). O montador lê a marca em `../marca.json` (troque com `"marca": "<caminho>"`). `"efeitos"` é opcional: `true` (padrão) ou `false`. `"capa"` é opcional e vale para os estilos de 1 a 5, de 7 a 9, 11 e 12 (a Caixinha de pergunta não leva capa): se o dono escolheu um gancho de capa, veja `capas.md`. `"aproximar"` é opcional: a lista das frases de ênfase em que o vídeo aproxima no rosto, se o dono quis (veja `audio-e-corte.md`, passo 4b).
4. Monte: `node "${CLAUDE_PLUGIN_ROOT}/scripts/montar.mjs" .` grava `index.html` e `comum.js` na pasta e, com os efeitos ligados, copia os sons usados para `efeitos/`.
5. Confira o rosto com `hf snapshot . --at 2 --describe false` (com gancho de capa, `--at 3.5`): sem legenda, nada cobre o vídeo; com `"legenda": "corrida"`, a cabeça precisa ficar acima dela (ela começa em 1500 px). Com o `rosto.json` do passo 1b o enquadramento já põe os olhos no terço de cima do vídeo, e o `"foco"` não muda nada. Sem ele (rosto não achado), ajuste o `"foco"`: se a legenda encostar no queixo, aumente o segundo número, que sobe a pessoa; se a testa colar na emenda, diminua.

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
- **A pessoa fica grande, mas cortada:** a parte de baixo é um pouco mais alta que larga (1080x1152, 60% da tela). Vídeo em pé do celular mostra do alto da cabeça até o peito; vídeo deitado perde as laterais. Confira sempre o passo 5.
- **Título longo:** com mais de 8 palavras, o título passa de 3 linhas e fica pesado para ler nos poucos segundos do cartão. Corte o trecho, não diminua a letra.
- **O render não precisa de internet:** o GSAP vem no plugin (`estilos/gsap.min.js`, conferido pelo SHA-256), e o montador copia o arquivo para a pasta do vídeo.
- **Sem o plugin hyperframes:** os efeitos sonoros deste estilo são todos da pasta `sons/` do Editor Chefe, então a montagem não para por falta deles (o render continua precisando da HyperFrames).
- **Teste de referência:** 15 s de gravação viraram 13,2 s de edição com 4 cartões; render em cerca de 21 s num Mac M1 Pro; com os 4 efeitos, áudio em -16,5 LUFS.
