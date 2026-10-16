# Caixinha de pergunta

**Quando usar:** a pergunta numa caixinha igual à do Instagram, o vídeo inteiro, com a legenda embaixo. Bom para responder a pergunta de um seguidor (a caixinha de perguntas dos stories) ou uma dúvida comum do público.

**Fluxo da HyperFrames:** `embedded-captions`, identidade `anchor` (legenda fiel à fala, entrada em 2 quadros, sem efeito), no molde `estilos/caixinha-pergunta.html` do plugin, que o `scripts/montar.mjs` preenche com a marca, a fala, os trechos e os textos da caixinha. A composição segue a `hyperframes-core`, com os cortes pelas receitas `Hard cut` e `Trim in/out`. É só a edição básica (corte das pausas e legenda) mais a caixinha: sem tela escura ou clara, sem cartões, sem zoom e sem gancho de capa.

## Desenho

- **Layout:** vídeo em tela cheia, 1080x1920. Caixinha de 780 px de largura (de 150 a 930 px), com o topo a 920 px, logo abaixo do queixo (ou 60 px abaixo do `queixo` do `escolhas.json`, quando o rosto está mais baixo), e cantos de 24 px; ela cresce para baixo com o texto. Fica parada na tela o vídeo inteiro, desde o primeiro quadro: ela já é a capa do vídeo. Legenda da Legenda viva centralizada na faixa entre a base da caixinha mais 40 px e 1500 px, a 90 px das bordas; grupos de até 4 palavras e 18 letras, quebra em ponto, em vírgula e em pausa de mais de 0,35 s.
- **Tipografia:** a caixinha usa a Inter 700, fixa, e não a fonte da marca: a chamada em 32 px, numa linha só; a pergunta em 46 px, em até 3 linhas, com as linhas equilibradas. Se a pergunta passa de 3 linhas, ou se a caixa (com a caixinha mais baixa) não deixa lugar para a folga de 40 px e duas linhas de legenda até 1500 px, a letra da pergunta encolhe de 2 em 2 px, até 30 px. Legenda em `fontes.titulo`, peso 800, 82 px.
- **Cores:** a caixinha imita a do Instagram e não usa as cores da marca: faixa de cima em #262B2E com a chamada em branco, corpo branco com a pergunta em #262626. A legenda é a da Legenda viva, nas cores da marca: texto em `cores.fundo_claro` com sombra em `cores.fundo_escuro`, e a palavra falada numa caixa em `cores.destaque`. Com a faixa da legenda clara no vídeo (jaleco, parede branca), o molde liga um véu escuro atrás dela; o montador mede a claridade de 1250 a 1500 px, faixa que cobre tanto a pergunta curta quanto a de 3 linhas.

## Efeitos sonoros

Nenhum. Este estilo é só a edição básica: o montador não põe efeito sonoro, não precisa dos sons do plugin hyperframes e o campo `"efeitos"` não muda nada aqui. Na prévia, não fale de efeito sonoro com o dono.

## Os textos da caixinha

- **Chamada** (a frase da faixa escura, como "Pergunta aqui sobre emagrecimento"): costuma ser a mesma em todos os vídeos deste estilo. Pergunte só se o `marca.json` ainda não tem `chamada_caixinha` (a primeira vez que o dono usa este estilo) e guarde a resposta lá (veja `marca.md`); nos próximos vídeos, use a guardada sem perguntar. Para um vídeo com outra chamada, ponha `"chamada"` dentro de `"caixinha"` no `escolhas.json`: ela vale mais que a do `marca.json`.
- **Pergunta**, nesta ordem (a mesma do texto do gancho em `capas.md`):
  1. **Veio no pedido:** o dono escreveu, ou o Magnus dele mandou junto. Use esse texto. Se o que veio foi um gancho de capa (a frase dos primeiros segundos), diga ao dono, em palavras simples, que neste estilo a caixinha faz o papel de capa e pergunte se aquele texto é a pergunta da caixinha.
  2. **Não veio:** pergunte: "Você já tem a pergunta da caixinha? Se tiver, cole aqui."
  3. **Não tem:** diga ao dono, em palavras simples, que você vai ouvir o vídeo primeiro e depois mostra 3 sugestões de pergunta. Faça os passos 1 e 2 de `audio-e-corte.md` (fonte de trabalho e transcrição, já corrigida) e só então sugira, sempre a partir do `transcript.json` corrigido. Mostre 3 perguntas numeradas, escritas como um seguidor perguntaria, e o dono escolhe pelo número ou pede ajuste. Se o pedido trouxe o roteiro do vídeo, ele é a primeira fonte: a sugestão 1 é a pergunta que o roteiro responde, se a resposta está na fala. Use as ideias que a pessoa realmente respondeu no vídeo; não invente promessa, número nem resultado que não está na fala.
- **Limites:** chamada com até 50 caracteres, pergunta com até 110, contando os espaços. A chamada cabe numa linha de 32 px até umas 40 letras e depois encolhe até caber (27 px com 50). A pergunta cabe em 3 linhas de 46 px até umas 65 letras e depois encolhe até caber em 3 linhas (38 px com 100, 34 px com 110). Passando do limite, o montador para com erro: mostre ao dono uma versão mais curta, com as palavras dele e sem mudar o sentido, e use só com o ok dele. Quebra de linha e espaços repetidos viram um espaço só.

## Como montar

1. Siga `audio-e-corte.md` até ter, na pasta do vídeo, `fonte.mp4`, `transcript.json` corrigido e `trechos.json`.
2. Baixe as fontes como manda `marca.md` e também a Inter 700 da caixinha, na mesma pasta `fonts/`:

       node "${CLAUDE_PLUGIN_ROOT}/scripts/baixar-fonte.mjs" "Inter" "700" "<pasta do vídeo>/fonts"

   Sem o arquivo `fonts/Inter-700.woff2`, o montador para dizendo que falta a fonte da caixinha.
3. Escreva o `escolhas.json` na pasta do vídeo:

       {
         "estilo": "caixinha-pergunta",
         "foco": "50% 40%",
         "caixinha": { "pergunta": "Emagrecer é só comer menos?", "chamada": "Pergunta aqui sobre emagrecimento" }
       }

   `"chamada"` pode ficar de fora quando o `marca.json` tem `chamada_caixinha`. `"queixo"`, dentro de `"caixinha"`, é opcional e só entra se a caixinha cobrir a boca (passo 5): é a altura do queixo na imagem de conferência do passo 5, de 0 a 1920, contada de cima para baixo num quadro de 1080x1920, como na capa Manchete. Com ele, o topo da caixinha fica 60 px abaixo do queixo, nunca acima de 920 px; sem ele, fica em 920 px. Exemplo: `"caixinha": { "pergunta": "...", "queixo": 980 }`. Campos que valem para todo estilo: `"estilo"`, `"foco"` (a posição do rosto, `"50% 40%"` para começar: o primeiro número vai de 0%, que mostra a borda esquerda do vídeo, a 100%, a direita; o segundo, de 0%, o topo, a 100%, a base). O montador lê a marca em `../marca.json` (troque com `"marca": "<caminho>"`). Não ponha `"capa"`: a caixinha já é a capa, e o montador recusa o gancho de capa neste estilo.
4. Monte: `node "${CLAUDE_PLUGIN_ROOT}/scripts/montar.mjs" .` grava `index.html` e `comum.js` na pasta.
5. Confira o enquadramento com `hf snapshot . --at 2` (a imagem fica na pasta `snapshots/` do vídeo): a caixinha logo abaixo do queixo e o rosto livre. Se a caixinha cobrir a boca ou o queixo:
   1. Estime pela imagem a altura do queixo: a imagem tem 1080x1920; conte de cima para baixo até a ponta do queixo (o meio da imagem é 960). Na dúvida, escolha um número um pouco maior (mais para baixo na imagem).
   2. Ponha esse número em `"queixo"` dentro de `"caixinha"` no `escolhas.json`, monte de novo e olhe de novo o `hf snapshot . --at 2`.
   3. Rode `hf check . --strict`. Se ele acusar "a caixinha não cabe com a legenda", a caixinha mais baixa não deixa lugar para a legenda nem com a pergunta na menor letra: diga ao dono, em palavras simples, e sugira uma pergunta mais curta ou outro estilo (a Legenda viva é o mais parecido). Se o próprio montador parar dizendo que o rosto está baixo demais (queixo depois de 1010), não há pergunta que caiba: ofereça outro estilo.

## Prévia, conferência e render

Na pasta do vídeo (`hf` é a HyperFrames, como manda o passo 3 da SKILL):

1. Prévia dos primeiros 10 segundos (edição de até 12 s: renderize inteira):

       sed 's/data-duration="[0-9.]*" data-width/data-duration="10" data-width/' index.html > previa.html
       HF_VIDEO_COVERAGE_THRESHOLD=0 hf render . -c previa.html -o previa.mp4
       rm previa.html

   A variável vale só na prévia: ela aceita o trecho que passa dos 10 s. Apague o `previa.html` logo depois; com ele na pasta, o `lint` acusa `multiple_root_compositions`. Mostre a prévia olhando primeiro o quadro do começo: é ele que vira a capa no feed.
2. Ajuste pelo que o dono disser no `escolhas.json` ou no `transcript.json` e rode o `montar.mjs` de novo; não edite o `index.html` à mão.
3. Antes do render final: `hf lint .` e `hf check . --strict`, os dois sem erro e sem aviso.
4. Render final: `hf render . -o "../prontos/<AAAA-MM-DD>-<nome curto>.mp4"`, depois as conferências de `entrega.md`.

## Cuidados

- **Caixinha sobre a boca:** acerte pelo `"queixo"` da caixinha (passo 5 de "Como montar"), não pelo `"foco"`: em vídeo gravado em pé no formato do Reels (9:16), como o da câmera do celular, o `"foco"` não move a imagem na vertical. Quanto mais baixa a caixinha, menos lugar sobra para a legenda: com o queixo baixo, prefira perguntas curtas.
- **Vídeo deitado em tela cheia amplia a imagem:** uma gravação de 1280x660 vira quase 3 vezes maior e fica macia. Para vídeo deitado, ofereça antes `painel-escuro` ou `editorial-claro`.
- **Tempo da fala:** o reconhecedor erra até 0,3 s perto das pausas. O molde encaixa cada palavra no trecho mantido mais próximo e nunca a perde; não mexa nos tempos do `transcript.json` à mão.
- **Não é a marca:** a caixinha copia o visual do Instagram de propósito, para parecer uma pergunta de verdade. Não troque as cores nem a letra pelas da marca; a marca aparece na legenda.
- **Pergunta grande demais:** com mais de 3 linhas a letra encolheria até ficar pequena demais para ler no celular. Por isso o limite de 110 caracteres; prefira perguntas curtas, de até umas 65 letras, que ficam no tamanho cheio.
- **Fonte sem peso 800:** o montador usa o peso mais pesado que houver em `fonts/` para a legenda e avisa. Diga ao dono que a letra da legenda fica um pouco mais leve que a da marca.
- **O render precisa de internet:** o molde carrega o GSAP da CDN jsDelivr na hora do render. Confira a conexão antes de renderizar.
- **Teste de referência:** 15 s de gravação viraram 14,3 s de edição; render em cerca de 30 s num Mac M1 Pro; sem efeitos, áudio em -16,8 LUFS.
