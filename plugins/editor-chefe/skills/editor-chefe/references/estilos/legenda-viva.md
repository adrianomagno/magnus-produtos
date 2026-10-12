# Legenda viva

**Quando usar:** 3 ou 4 palavras por vez, a palavra falada em destaque.

**Fluxo da HyperFrames:** `embedded-captions`, identidade `anchor` (legenda fiel à fala no terço de baixo, entrada em 2 quadros, sem efeito), no molde `estilos/legenda-viva.html` do plugin, que o `scripts/montar.mjs` preenche com a marca, a fala e os trechos. A composição segue a `hyperframes-core`, com os cortes pelas receitas `Hard cut` e `Trim in/out`. Os scripts do `embedded-captions` não entram: os temas dele trazem fonte e cor fixas, posições em pixel para 1280x720 e pedem o recorte da pessoa.

## Desenho

- **Layout:** vídeo em tela cheia, 1080x1920. Legenda centralizada numa faixa de 220 px a partir de 1250 px do topo (terço de baixo, acima dos botões do Reels). Grupos de até 4 palavras e 18 letras, sempre numa linha; quebra em ponto, em vírgula e em pausa de mais de 0,35 s.
- **Tipografia:** `fontes.titulo`, peso 800, 82 px.
- **Cores:** texto em `cores.fundo_claro` com sombra em `cores.fundo_escuro`. A palavra que está sendo falada ganha uma caixa em `cores.destaque`, com o texto em `cores.fundo_claro` ou `cores.fundo_escuro`, o que der mais contraste (o molde escolhe sozinho).

## Efeitos sonoros

- **Whoosh curto** no começo de cada frase: a primeira legenda do vídeo e a primeira depois de ponto, interrogação ou exclamação.
- Nada a cada palavra nem a cada grupo: a legenda troca a cada segundo e o som viraria ruído.

Os sons são do plugin hyperframes (`skills/media-use/audio/assets/sfx/`, licença Pixabay, uso comercial sem atribuição); o montador copia só os usados para a pasta `efeitos/` do vídeo. Volume 0,35, por baixo da voz (o impacto grave, 9 dB mais alto de origem, vai a 0,2); cada som começa um instante antes, para o pico cair quando o elemento aparece; dois efeitos a menos de 0,5 s um do outro: fica o mais forte. Ligados por padrão; `"efeitos": false` no `escolhas.json` desliga neste vídeo.

## Como montar

1. Siga `audio-e-corte.md` até ter, na pasta do vídeo, `fonte.mp4`, `transcript.json` corrigido e `trechos.json`.
2. Baixe as fontes como manda `marca.md`; o montador usa as de `fonts/`.
3. Escreva o `escolhas.json` na pasta do vídeo. Este estilo não pede escolha além do enquadramento:

       { "estilo": "legenda-viva", "foco": "50% 40%" }

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

- **Palavra falada em caixa, não em letra colorida:** no teste, a palavra só pintada em `cores.destaque` sobre o vídeo ficou entre 1,2:1 e 1,8:1 de contraste (o `check` pede 3:1). Com a caixa, passou.
- **Fonte sem peso 800:** o montador usa o peso mais pesado que houver em `fonts/` e avisa. Diga ao dono que a letra fica um pouco mais leve que a da marca.
- **Vídeo deitado em tela cheia amplia a imagem:** uma gravação de 1280x660 vira quase 3 vezes maior e fica macia. Para vídeo deitado, ofereça antes `painel-escuro` ou `editorial-claro`.
- **Tempo da fala:** o reconhecedor erra até 0,3 s perto das pausas. O molde encaixa cada palavra no trecho mantido mais próximo e nunca a perde; não mexa nos tempos do `transcript.json` à mão.
- **O render precisa de internet:** o molde carrega o GSAP da CDN jsDelivr na hora do render. Confira a conexão antes de renderizar.
- **Sem o plugin hyperframes:** o montador para dizendo que não achou os efeitos sonoros. Instale o plugin hyperframes do mesmo marketplace e abra uma conversa nova; se não der, monte com `"efeitos": false`.
- **Teste de referência:** 15 s de gravação viraram 12,2 s de edição; render em cerca de 21 s num Mac M1 Pro; com os 5 efeitos, áudio em -15,8 LUFS.
