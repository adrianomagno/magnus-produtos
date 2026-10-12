# Corte seco

**Quando usar:** sem pausas, enquadramento alternando a cada frase.

**Fluxo da HyperFrames:** `hyperframes-core`, receitas `Hard cut` e `Trim in/out` para tirar as pausas e `Zoom / punch` para o enquadramento (aplicado no invólucro `#enquadramento`, nunca no `<video>`), mais a legenda da identidade `anchor` do `embedded-captions` (linha corrida, entrada em 2 quadros, traço na cor de destaque sob a palavra forte), no molde `estilos/corte-seco-zoom.html` do plugin, que o `scripts/montar.mjs` preenche com a marca, a fala, os trechos e as palavras de ênfase. Os scripts do `embedded-captions` não entram: os temas dele trazem fonte e cor fixas, posições em pixel para 1280x720 e pedem o recorte da pessoa.

## Desenho

- **Layout:** vídeo em tela cheia, 1080x1920. A cada frase nova (depois de ponto, interrogação ou exclamação) e a cada corte, o enquadramento troca entre 100% e 115%, sem transição, com o centro no rosto (`"foco"`); trocas a menos de 0,8 s da anterior são puladas. Legenda numa faixa de 200 px a partir de 1270 px do topo, em linhas de até 5 palavras e 24 letras.
- **Tipografia:** `fontes.titulo`, peso 800, 66 px.
- **Cores:** legenda em `cores.fundo_claro` com sombra em `cores.fundo_escuro`. As palavras de ênfase ganham um traço de 8 px em `cores.destaque`, que se desenha no instante em que são ditas.

## Efeitos sonoros

- **Whoosh curto** em cada aproximação do enquadramento (de 100% para 115%); a volta para 100% fica sem som.
- **Pop** em cada palavra de ênfase, junto com o traço.

Os sons são do plugin hyperframes (`skills/media-use/audio/assets/sfx/`, licença Pixabay, uso comercial sem atribuição); o montador copia só os usados para a pasta `efeitos/` do vídeo. Volume 0,35, por baixo da voz (o impacto grave, 9 dB mais alto de origem, vai a 0,2); cada som começa um instante antes, para o pico cair quando o elemento aparece; dois efeitos a menos de 0,5 s um do outro: fica o mais forte. Ligados por padrão; `"efeitos": false` no `escolhas.json` desliga neste vídeo.

## Como montar

1. Siga `audio-e-corte.md` até ter, na pasta do vídeo, `fonte.mp4`, `transcript.json` corrigido e `trechos.json`.
2. Baixe as fontes como manda `marca.md`; o montador usa as de `fonts/`.
3. Escolha de 2 a 4 palavras de ênfase (as que carregam a ideia), escritas como estão no `transcript.json` e na ordem da fala. Pode ficar vazio (`[]`). Escreva o `escolhas.json` na pasta do vídeo:

       { "estilo": "corte-seco-zoom", "foco": "50% 40%", "enfase": ["resposta", "almoço"] }

   Campos que valem para todo estilo: `"estilo"`, `"foco"` (a posição do rosto, `"50% 40%"` para começar: o primeiro número vai de 0%, que mostra a borda esquerda do vídeo, a 100%, a direita; o segundo, de 0%, o topo, a 100%, a base). O montador lê a marca em `../marca.json` (troque com `"marca": "<caminho>"`). `"efeitos"` é opcional: `true` (padrão) ou `false`. `"capa"` é opcional e vale para os estilos de 1 a 5 e de 7 a 9 (a Caixinha de pergunta não leva capa): se o dono escolheu um gancho de capa, veja `capas.md`.
4. Monte: `node "${CLAUDE_PLUGIN_ROOT}/scripts/montar.mjs" .` grava `index.html` e `comum.js` na pasta e, com os efeitos ligados, copia os sons usados para `efeitos/`. Aviso de palavra "não foi achada na fala" quer dizer que ela não aparece no `transcript.json` na ordem pedida: corrija a palavra no `escolhas.json` e monte de novo.
5. Confira o rosto com `hf snapshot . --at 2` (com gancho de capa, `--at 3.5`) e ajuste o `"foco"` se preciso.

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

- **115% sobre vídeo deitado:** uma gravação de 1280x660 já fica quase 3 vezes maior em tela cheia; com o zoom, perde ainda mais nitidez. Para vídeo deitado, ofereça antes `painel-escuro` ou `editorial-claro`.
- **O centro do zoom é o `"foco"`:** confira com `hf snapshot . --at <segundo>`, um pouco antes e um pouco depois de uma frase nova, que o rosto fica inteiro nos dois enquadramentos.
- **Fonte sem peso 800:** o montador usa o peso mais pesado que houver em `fonts/` e avisa. Diga ao dono que a letra fica um pouco mais leve que a da marca.
- **O render precisa de internet:** o molde carrega o GSAP da CDN jsDelivr na hora do render. Confira a conexão antes de renderizar.
- **Sem o plugin hyperframes:** o montador para dizendo que não achou os efeitos sonoros. Instale o plugin hyperframes do mesmo marketplace e abra uma conversa nova; se não der, monte com `"efeitos": false`.
- **Teste de referência:** 15 s de gravação viraram 12,2 s de edição com 5 trocas de enquadramento; render em cerca de 22 s num Mac M1 Pro; com os 5 efeitos, áudio em -15,8 LUFS.
