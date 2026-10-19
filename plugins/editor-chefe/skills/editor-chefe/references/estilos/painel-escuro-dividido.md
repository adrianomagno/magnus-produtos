# Painel escuro dividido

**Quando usar:** a tela dividida ao meio, com fundo escuro e cartões de informação em cima, a pessoa grande embaixo e a legenda em caixa na emenda. É o Painel escuro com a pessoa maior: no Painel escuro ela fica numa janela pequena no meio da tela.

**Fluxo da HyperFrames:** `talking-head-recut`, tema escuro, layout `split` (cartão em cima, vídeo embaixo em toda a largura) e cartões no estilo `audit` (cabeçalho com filete, título pesado com uma palavra marcada), no molde `estilos/painel-escuro-dividido.html` do plugin, que o `scripts/montar.mjs` preenche com a marca, a fala, os trechos e os cartões. A composição segue a `hyperframes-core`, com os cortes pelas receitas `Hard cut` e `Trim in/out`; os cartões saem de uma lista, no lugar dos fragmentos `public/cards/` da skill.

## Desenho

- **Layout:** 1080x1920 dividido em duas metades. Em cima (0 a 960 px), fundo em `cores.fundo_escuro`: no alto, a 150 px, o cabeçalho com o `nome` da marca à esquerda, a numeração do cartão (01 / 04) à direita e um filete embaixo; logo abaixo, o título do cartão centrado entre 230 e 870 px, a 64 px das bordas, do maior tamanho que couber, para ocupar a metade de cima. Embaixo (960 a 1920 px), o vídeo em toda a largura, 1080x960, sem moldura. Na emenda, um filete de 6 px na cor de destaque e a legenda numa caixa escura centrada em 960 px, até 4 palavras e 22 letras: ela fica entre as duas metades, longe do rosto e longe dos botões e do texto do Reels.
- **Tipografia:** os cartões do Painel escuro. Cabeçalho em `fontes.corpo`, 24 px, caixa alta. Título em `fontes.titulo`, peso 800, de 120 px (título curto) a 88 px (título longo): o molde começa em 120 e diminui de 4 em 4 até caber. Legenda em `fontes.titulo`, peso 800, 58 px.
- **Cores:** textos em `cores.fundo_claro`. A palavra marcada no título sai em `cores.destaque`; se essa cor não tiver contraste de 3:1 com `cores.fundo_escuro`, o molde clareia o título. A caixa da legenda é opaca, em `cores.fundo_escuro`, e a palavra falada sai em `cores.destaque`, clareada até ler bem (3,4:1) quando a cor da marca é escura demais.

## Efeitos sonoros

- **Whoosh curto** na entrada de cada cartão.
- A legenda em caixa fica sem som: ela troca a cada segundo.

Os sons são do plugin hyperframes (`skills/media-use/audio/assets/sfx/`, licença Pixabay, uso comercial sem atribuição); o montador copia só os usados para a pasta `efeitos/` do vídeo. Volume 0,35, por baixo da voz (o impacto grave, 9 dB mais alto de origem, vai a 0,2); cada som começa um instante antes, para o pico cair quando o elemento aparece; dois efeitos a menos de 0,5 s um do outro: fica o mais forte. Ligados por padrão; `"efeitos": false` no `escolhas.json` desliga neste vídeo.

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

   Campos que valem para todo estilo: `"estilo"`, `"foco"` (a posição do rosto, `"50% 25%"` para começar neste estilo: o primeiro número vai de 0%, que mostra a borda esquerda do vídeo, a 100%, a direita; o segundo, de 0%, o topo, a 100%, a base). O montador lê a marca em `../marca.json` (troque com `"marca": "<caminho>"`). `"efeitos"` é opcional: `true` (padrão) ou `false`. `"capa"` é opcional e vale para os estilos de 1 a 5 e de 7 a 9 (a Caixinha de pergunta não leva capa): se o dono escolheu um gancho de capa, veja `capas.md`. `"aproximar"` é opcional: a lista das frases de ênfase em que o vídeo aproxima no rosto, se o dono quis (veja `audio-e-corte.md`, passo 4b).
4. Monte: `node "${CLAUDE_PLUGIN_ROOT}/scripts/montar.mjs" .` grava `index.html` e `comum.js` na pasta e, com os efeitos ligados, copia os sons usados para `efeitos/`.
5. Confira o rosto com `hf snapshot . --at 2` (com gancho de capa, `--at 3.5`): a cabeça precisa começar abaixo da legenda da emenda (a caixa desce até uns 1010 px). Se a legenda encostar no cabelo ou na testa, diminua o segundo número do `"foco"` (de 25% para 20%, 15%...), que desce a pessoa; se o queixo sair por baixo, aumente.

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
- **O render precisa de internet:** o molde carrega o GSAP da CDN jsDelivr na hora do render. Confira a conexão antes de renderizar.
- **Sem o plugin hyperframes:** o montador para dizendo que não achou os efeitos sonoros. Instale o plugin hyperframes do mesmo marketplace e abra uma conversa nova; se não der, monte com `"efeitos": false`.
- **Teste de referência:** 15 s de gravação viraram 13,2 s de edição com 4 cartões; render em cerca de 25 s num Mac M1 Pro; com os 4 efeitos, áudio em -16,5 LUFS.
