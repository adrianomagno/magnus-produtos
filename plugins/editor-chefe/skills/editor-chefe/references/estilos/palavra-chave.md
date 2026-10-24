# Palavra-chave

**Quando usar:** só a palavra forte de cada frase, grande na tela.

**Fluxo da HyperFrames:** `embedded-captions`, identidade `keynote` (padrão: letra pesada, imóvel, entrada curta de baixo para cima) ou `stomp` (alternativa: cartão seco sobre o vídeo escurecido, crescendo devagar, e o ápice com a tela inteira na cor de destaque), no molde `estilos/palavra-chave.html` do plugin, que o `scripts/montar.mjs` preenche com a marca, a fala, os trechos e as palavras escolhidas. A composição segue a `hyperframes-core`, com os cortes pelas receitas `Hard cut` e `Trim in/out`. Os scripts do `embedded-captions` não entram: os temas dele trazem fonte e cor fixas, posições em pixel para 1280x720 e pedem o recorte da pessoa.

## Desenho

- **Layout:** vídeo em tela cheia, 1080x1920. Uma palavra por vez, centralizada na largura, numa faixa de 300 px a partir de 1220 px do topo (abaixo do rosto, acima dos botões do Reels). Entra no instante em que é dita e fica até 0,9 s depois do fim dela (no mínimo 0,6 s), ou até a próxima.
- **Tipografia:** `fontes.titulo`, peso 800, em caixa alta, 210 px, espaçamento -0,045em. Palavra comprida diminui sozinha até caber em 960 px (880 px no `stomp`, que cresce na tela).
- **Cores:** palavra em `cores.fundo_claro` com sombra em `cores.fundo_escuro`. No `keynote`, o ápice ganha caixa em `cores.destaque`. No `stomp`, o vídeo escurece com `cores.fundo_escuro` enquanto a palavra está na tela e, no ápice, a tela inteira vira `cores.destaque`, com clarão rápido em `cores.fundo_claro`. O texto do ápice fica no fundo claro ou escuro que der mais contraste.

## Efeitos sonoros

- **Whoosh** na entrada de cada palavra forte, revezando o curto e o rápido.
- **Impacto** no ápice, no lugar do whoosh: grave no `stomp` (junto com a tela na cor de destaque) e suave no `keynote`.

Os sons são os do `sons/manifest.json` do plugin: os da pasta `sons/` (licença CC0, com a origem de cada um em `sons/LICENCAS.md`) e 3 do plugin hyperframes (`whoosh-short`, `pop` e `impact-bass-1`, licença Pixabay, uso comercial sem atribuição); o montador copia só os usados para a pasta `efeitos/` do vídeo. O volume de cada som foi medido no arquivo e todos ficam no mesmo nível, por baixo da voz. Cada som começa antes do movimento o tanto do pico medido dele, para o ponto mais forte do som cair no quadro em que o elemento aparece. Quando um momento tem mais de um som, eles se revezam, para não repetir o mesmo som seguido. Dois efeitos a menos de 0,5 s um do outro: fica o mais forte. Ligados por padrão; `"efeitos": false` no `escolhas.json` desliga neste vídeo.

## Como montar

1. Siga `audio-e-corte.md` até ter, na pasta do vídeo, `fonte.mp4`, `transcript.json` corrigido e `trechos.json`.
2. Baixe as fontes como manda `marca.md`; o montador usa as de `fonts/`.
3. Escolha uma palavra por frase, a que carrega o sentido (nunca "é", "tipo", "né"), escrita como está no `transcript.json` e na ordem da fala, e uma delas como ápice. O dono troca o que quiser na prévia. Escreva o `escolhas.json` na pasta do vídeo:

       {
         "estilo": "palavra-chave",
         "foco": "50% 40%",
         "identidade": "keynote",
         "chaves": ["cliente", "resposta", "almoço"],
         "apice": "resposta"
       }

   `"identidade"` é `keynote` (padrão) ou `stomp`; `"apice"` precisa estar em `"chaves"`.

   Campos que valem para todo estilo: `"estilo"`, `"foco"` (a posição do rosto, `"50% 40%"` para começar: o primeiro número vai de 0%, que mostra a borda esquerda do vídeo, a 100%, a direita; o segundo, de 0%, o topo, a 100%, a base). O montador lê a marca em `../marca.json` (troque com `"marca": "<caminho>"`). `"efeitos"` é opcional: `true` (padrão) ou `false`. `"capa"` é opcional e vale para os estilos de 1 a 5 e de 7 a 9 (a Caixinha de pergunta não leva capa): se o dono escolheu um gancho de capa, veja `capas.md`. `"aproximar"` é opcional: a lista das frases de ênfase em que o vídeo aproxima no rosto, se o dono quis (veja `audio-e-corte.md`, passo 4b).
4. Monte: `node "${CLAUDE_PLUGIN_ROOT}/scripts/montar.mjs" .` grava `index.html` e `comum.js` na pasta e, com os efeitos ligados, copia os sons usados para `efeitos/`. Aviso de palavra "não foi achada na fala" quer dizer que ela não aparece no `transcript.json` na ordem pedida: corrija a palavra no `escolhas.json` e monte de novo.
5. Confira o rosto com `hf snapshot . --at 2 --describe false` (com gancho de capa, `--at 3.5`) e ajuste o `"foco"` se preciso.

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

- **Palavra que não está na fala:** o montador avisa e deixa só ela de fora; as seguintes continuam. Confira a grafia no `transcript.json` (acento e pontuação não contam).
- **Ápice em cor sobre o vídeo:** sem a caixa (ou sem a tela em `cores.destaque`, no `stomp`), a palavra do ápice em cor de destaque ficou com 2,15:1 de contraste no teste. Por isso o ápice nunca sai só pintado.
- **Rosto:** a faixa da palavra fica abaixo do rosto num vídeo em pé comum. Se a pessoa estiver tão baixa no quadro que a palavra cubra a boca, ofereça `legenda-viva` ou `corte-seco-zoom`.
- **Fonte que não carrega:** o molde monta a animação mesmo assim, com a fonte de reserva, e nem o montador nem o `lint` avisam quando a fonte falha no navegador. O montador só confere antes de montar: falta de arquivo da família ou arquivo que não é woff2 param a montagem com erro. Confira na prévia que a letra é a da marca antes de entregar.
- **O render precisa de internet:** o molde carrega o GSAP da CDN jsDelivr na hora do render. Confira a conexão antes de renderizar.
- **Sem o plugin hyperframes:** o montador para dizendo que não achou os efeitos sonoros. Instale o plugin hyperframes do mesmo marketplace e abra uma conversa nova; se não der, monte com `"efeitos": false`.
- **Teste de referência:** 15 s de gravação viraram 12,2 s de edição; render em 22 a 25 s num Mac M1 Pro; com os 6 efeitos (um impacto grave), áudio em -15,4 LUFS nas duas identidades.
