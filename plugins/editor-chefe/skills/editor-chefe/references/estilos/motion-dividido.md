# Motion dividido

**Quando usar:** a tela dividida ao meio, com a pessoa grande embaixo e, em cima, um painel com uma animação simples para cada ideia da fala (etapas, antes e depois, lista, número, pergunta ou comparação), feita com as palavras que ela disse, com ícones desenhados (balão de conversa, documento, celular, setas e outros) e nas cores da marca. A legenda fica em caixa na emenda. Bom para aula, dica e explicação, quando a fala tem uma ideia que dá para desenhar.

**Fluxo da HyperFrames:** `talking-head-recut` no layout `split` (painel em cima, vídeo embaixo em toda a largura), com a animação de cada ideia em JavaScript pela `hyperframes-animation` (GSAP, traço que se desenha, contagem de número com `onUpdate`, como na receita `counting-dynamic-scale`) e ícones de traço em SVG desenhados para o Editor Chefe (a biblioteca fica em `estilos/comum.js`; nenhum ícone nem imagem de terceiros), no molde `estilos/motion-dividido.html` do plugin, que o `scripts/montar.mjs` preenche com a marca, a fala, os trechos e as ideias. A composição segue a `hyperframes-core`, com os cortes pelas receitas `Hard cut` e `Trim in/out`. A animação é determinística: cada quadro sai igual, em qualquer ordem em que o render pedir.

## Desenho

- **Layout:** 1080x1920 dividido em duas metades. Em cima (0 a 960 px), fundo em `cores.fundo_escuro`: no alto, a 150 px, um filete e o `nome` da marca à esquerda e a numeração da ideia (01 / 04) à direita; embaixo dele, de 230 a 870 px, o painel branco, com cantos de 28 px e sem borda: o fundo escuro em volta e o branco por onde passa a animação. Dentro do painel, o título da ideia (de 262 a 398 px, até 2 linhas) e a animação (de 410 a 830 px). Embaixo (960 a 1920 px), o vídeo em toda a largura, 1080x960, sem moldura. A animação fica sempre em cima, nunca sobre a pessoa. Na emenda, um filete de 6 px na cor de destaque e a legenda numa caixa escura centrada em 960 px, até 4 palavras e 22 letras.
- **Legenda:** a do Corte seco, sem caixa (com muitos elementos na tela, a legenda vai só branca com um leve contorno). Linhas de até 5 palavras, em `fontes.titulo`, peso 800, 66 px, no `cores.fundo_claro` com um leve contorno no escuro da marca e sombra, dentro da metade do vídeo, embaixo e longe do rosto, de 1500 a 1650 px, sem cruzar a emenda. A palavra de ênfase ganha um traço de 8 px na cor de destaque no instante em que é dita: por padrão, a palavra forte (entre asteriscos) de cada cartão, dita no tempo dele; `"enfase"` no `escolhas.json` (palavras da fala, na ordem, como no Corte seco) troca. Quando a faixa da legenda é clara no vídeo, mesmo só em parte (jaleco, camisa branca, parede), o montador mede e reforça o contorno e a sombra, e diz isso no fim da montagem ("contorno da legenda reforçado"); não volta a caixa.
- **Arranjo:** etapas, antes e depois e comparação ficam numa fileira que desliza a cada item que entra, para o que já está na tela ficar sempre no meio do painel (sem metade vazia). A lista e a conversa da pergunta ficam no meio do painel desde o começo.
- **Com ícone e sem ícone:** item com ícone vira figura, o desenho grande com o rótulo embaixo, sem caixa (160 px nas etapas, 170 px nos dois lados do antes e depois e da comparação, 84 px na lista, 104 px em cima do número, 76 px dentro do balão). Item sem ícone fica numa caixa de contorno, como antes. O ícone entra com o traço se desenhando, um traço depois do outro.
- **Tipografia:** tudo em `fontes.titulo`, peso 800: título da ideia em 56 px, rótulos da animação em caixa alta (de 36 a 46 px, conforme o espaço), número que cresce em 190 px (150 px com ícone), legenda em 58 px. Rótulo que não cabe encolhe até 26 px; se nem assim couber, a palavra quebra dentro do espaço dela.
- **Cores:** fora do painel, sobre o fundo escuro, tudo como antes: os filetes (do cabeçalho e da emenda) na cor de destaque, clareada até 3,2:1 quando a cor da marca é escura demais, o nome da marca em `cores.fundo_claro` e a numeração num tom apagado do claro, legível no escuro. Dentro do painel branco, os textos (título da ideia, rótulos, número da etapa e texto dos balões) em `cores.fundo_escuro`, escurecida até 4,6:1 quando a marca tem um escuro claro demais para o branco. Traços dos ícones, setas, marcas, o número que cresce e a palavra forte do título na cor de destaque, escurecida até 3,2:1 contra o branco quando a cor da marca é clara demais (um amarelo vira mostarda); o detalhe de cada ícone, como as linhas de texto do documento, sai em cinza (3:1). Item da lista que ainda não foi dito fica em cinza, mas legível (4,6:1); trilhos e traços apagados, em cinza claro (2:1). A caixa em destaque do antes e depois e o balão da resposta ganham um tom claro da cor de destaque (18%). Nenhum texto fica sobre preenchimento da cor de destaque: todo texto lê contra o branco ou contra esse tom claro.

## A biblioteca de animações

Cada ideia (`cartao`) tem uma animação e os `itens` dela. Os itens são palavras da fala, seguidas e na ordem em que foram ditas, curtas (até 28 caracteres; na pergunta, até 70). O primeiro item entra junto com o título, no começo da ideia (no `"de"`), para o painel nunca ficar vazio; na pergunta sem título, ele entra sozinho nesse instante. Os seguintes entram no instante em que a pessoa fala as palavras deles. Escolha a animação pelo que a fala faz naquela ideia:

| A fala... | Animação | Itens |
|---|---|---|
| conta passos em ordem ("primeiro...", "depois...", "aí...") | `etapas`: caixas numeradas com seta entre elas | 2 ou 3 passos |
| mostra uma mudança: como era e como fica, o problema e a saída | `antes-depois`: o primeiro lado, a seta e o segundo em destaque; o primeiro se apaga | 2: o antes e o depois |
| enumera coisas sem ordem ("três coisas: ...") | `lista`: os itens aparecem apagados e cada um acende quando é dito | 2 a 4 |
| diz um número: preço, porcentagem, prazo, quantidade | `numero`: o número conta de zero até ele, com uma barra que enche junto | 1 ou 2: o número com algarismos, como foi dito ("30%", "R$ 2.000", "3 meses"), e um rótulo |
| faz uma pergunta, a do público ou a que ela mesma responde | `pergunta`: a pergunta num balão com o sinal de interrogação; a resposta, se houver, noutro balão | 1 ou 2: a pergunta e a resposta |
| põe duas coisas lado a lado ("isso ou aquilo", "um... o outro") | `comparacao`: dois lados que entram de lados opostos, com um divisor no meio | 2 |

Na dúvida entre duas, prefira a mais simples para quem assiste: `lista` serve para quase toda ideia com duas a quatro partes. Para mais de 3 passos, use a `lista`, que cabe 4, ou divida em duas ideias. Nas `etapas`, prefira palavras de até 12 letras: as caixas são estreitas.

## Os ícones

Cada item pode levar um ícone da biblioteca. Escreva o item assim: `{ "texto": "recebe resposta", "icone": "conversa" }`; item só com o texto (`"recebe resposta"`) fica sem ícone. Nas `etapas`, na `lista`, no `antes-depois` e na `comparacao`, ponha ícone em todos os itens da ideia ou em nenhum (o montador recusa a mistura); no `numero` e na `pergunta`, cada item tem ou não o seu. O ícone ilustra o item, o texto continua sendo a palavra da fala; se nenhum ícone combina com o que foi dito, deixe sem. Escolha pelo que a fala diz:

| A fala diz... | Ícone |
|---|---|
| conversa, mensagem, atendimento, WhatsApp, falar com o cliente | `conversa` |
| documento, arquivo, relatório, papel, conteúdo escrito | `documento` |
| celular, aplicativo, Instagram, vídeo, rede social | `celular` |
| dinheiro, preço, pagamento, cobrança, faturamento, multa | `dinheiro` |
| agenda, data, prazo, compromisso, horário marcado | `calendario` |
| cliente, paciente, uma pessoa, um profissional | `pessoa` |
| equipe, sócios, time, família, um encontro | `equipe` |
| crescimento, resultado, vendas, funil, número que sobe | `grafico` |
| pronto, resolvido, aprovado, confirmado | `check` |
| cuidado, risco, erro, problema | `alerta` |
| tempo, horas, demora, rapidez | `relogio` |
| loja, escritório, clínica, empresa, o lugar do negócio | `loja` |
| contrato, assinatura, acordo | `contrato` |
| ideia, dica, solução, aprendizado | `ideia` |
| objetivo, meta, público-alvo, foco | `alvo` |
| divulgação, anúncio, marketing, avisar o público | `megafone` |
| pasta, Drive, arquivos guardados, organização dos documentos | `pasta` |
| processo, sistema, automação, configuração | `engrenagem` |
| inteligência artificial, agente, robô | `robo` |

## Efeitos sonoros

- **Whoosh largo** na entrada de cada animação (de cada ideia), um som só da entrada.
- **Clique discreto** em cada item depois do primeiro, no instante em que ele entra na animação, revezando o tique e o clique suave. O primeiro entra junto com o título e fica com o whoosh.
- A legenda fica sem som.

Os sons são os do `sons/manifest.json` do plugin: os da pasta `sons/` (licença CC0, com a origem de cada um em `sons/LICENCAS.md`) e 3 do plugin hyperframes (`whoosh-short`, `pop` e `impact-bass-1`, licença Pixabay, uso comercial sem atribuição); o montador copia só os usados para a pasta `efeitos/` do vídeo. O volume de cada som foi medido no arquivo e todos ficam no mesmo nível, por baixo da voz. Cada som começa antes do movimento o tanto do pico medido dele, para o ponto mais forte do som cair no quadro em que o elemento aparece. Quando um momento tem mais de um som, eles se revezam, para não repetir o mesmo som seguido. Dois efeitos a menos de 0,5 s um do outro: fica o mais forte. Ligados por padrão; `"efeitos": false` no `escolhas.json` desliga neste vídeo.

## Como montar

1. Siga `audio-e-corte.md` até ter, na pasta do vídeo, `fonte.mp4`, `transcript.json` corrigido e `trechos.json`.
2. Baixe as fontes como manda `marca.md`; este estilo só usa a `fontes.titulo`.
3. Divida a fala em ideias, uma a cada 3 a 8 segundos de edição, e escolha a animação de cada uma pela tabela acima. O título da ideia é um trecho literal da fala, curto (até 40 caracteres), com a palavra forte entre asteriscos se quiser; pode ficar vazio (`""`) quando a animação já mostra a frase, como na pergunta. `"de"` é o segundo do vídeo original em que a ideia começa (o `start` da primeira palavra dela no `transcript.json`); a ideia fica até a próxima começar. Escreva o `escolhas.json` na pasta do vídeo:

       {
         "estilo": "motion-dividido",
         "foco": "50% 25%",
         "cartoes": [
           { "de": 0.5, "titulo": "Resposta no *mesmo dia*", "animacao": "etapas", "itens": [
             { "texto": "todo cliente", "icone": "pessoa" }, { "texto": "recebe resposta", "icone": "conversa" }, { "texto": "no mesmo dia", "icone": "check" } ] },
           { "de": 4.8, "titulo": "Antes do *almoço*", "animacao": "antes-depois", "itens": ["chega de manhã", "antes do almoço"] }
         ]
       }

   Campos que valem para todo estilo: `"estilo"`, `"foco"` (a posição do rosto, `"50% 25%"` para começar neste estilo: o primeiro número vai de 0%, que mostra a borda esquerda do vídeo, a 100%, a direita; o segundo, de 0%, o topo, a 100%, a base). O montador lê a marca em `../marca.json` (troque com `"marca": "<caminho>"`). `"efeitos"` é opcional: `true` (padrão) ou `false`. `"capa"` é opcional e vale para os estilos de 1 a 5, de 7 a 9, 11 e 12 (a Caixinha de pergunta não leva capa): se o dono escolheu um gancho de capa, veja `capas.md`. `"aproximar"` é opcional: a lista das frases de ênfase em que o vídeo aproxima no rosto, se o dono quis (veja `audio-e-corte.md`, passo 4b).
4. Monte: `node "${CLAUDE_PLUGIN_ROOT}/scripts/montar.mjs" .` grava `index.html` e `comum.js` na pasta e, com os efeitos ligados, copia os sons usados para `efeitos/`. O montador para com erro em português se a animação não existe, se a quantidade ou o tamanho dos itens não cabe nela, se o ícone não é da biblioteca ou está em só parte da fileira, se o número não tem algarismo ou se o título passa de 40 caracteres: corrija o `escolhas.json` e monte de novo. Aviso de item que "não aparece igual na fala desse cartão" quer dizer que aquelas palavras não foram ditas assim, seguidas, dentro daquela ideia: o item entra sem acompanhar a fala (o primeiro entra com o título do mesmo jeito, mas o texto dele precisa ser da fala). Troque pelas palavras exatas do `transcript.json` (ou mude o `"de"` da ideia) e monte de novo.
5. Confira o rosto com `hf snapshot . --at 2 --describe false` (com gancho de capa, `--at 3.5`): a legenda fica embaixo, de 1500 a 1650 px, e não pode cobrir o queixo. Se cobrir, aumente o segundo número do `"foco"` (de 25% para 30%, 35%...), que sobe a pessoa; se a cabeça sair por cima, diminua. Olhe também um quadro de cada ideia (`hf snapshot . --at <segundo> --describe false`) para ver a animação montada.

## Prévia, conferência e render

Na pasta do vídeo (`hf` é a HyperFrames, como manda o passo 3 da SKILL):

1. Prévia dos primeiros 10 segundos (edição de até 12 s: renderize inteira):

       sed 's/data-duration="[0-9.]*" data-width/data-duration="10" data-width/' index.html > previa.html
       HF_VIDEO_COVERAGE_THRESHOLD=0 hf render . -c previa.html -o previa.mp4
       rm previa.html

   A variável vale só na prévia: ela aceita o trecho que passa dos 10 s. Apague o `previa.html` logo depois; com ele na pasta, o `lint` acusa `multiple_root_compositions`.
2. Ajuste pelo que o dono disser no `escolhas.json` ou no `transcript.json` ("troca a animação dessa parte", "essa palavra está errada") e rode o `montar.mjs` de novo; não edite o `index.html` à mão.
3. Antes do render final: `hf lint .` e `hf check . --strict`, os dois sem erro e sem aviso.
4. Render final: `hf render . -o "../prontos/<AAAA-MM-DD>-<nome curto>.mp4"`, depois as conferências de `entrega.md`.

## Cuidados

- **Palavras da fala, nunca inventadas:** título e itens saem do `transcript.json` corrigido. Não escreva promessa, número nem resultado que a pessoa não disse. O número do `numero` é o que ela falou, escrito com algarismos.
- **Ideia curta demais:** com menos de 2 segundos, a animação mal termina de entrar e já sai. Junte com a vizinha.
- **A pessoa fica grande, mas cortada:** a metade de baixo é quase quadrada (1080x960). Vídeo em pé do celular mostra só do alto da cabeça até o peito; vídeo deitado perde as laterais. Confira sempre o passo 5.
- **O render não precisa de internet:** o GSAP vem no plugin (`estilos/gsap.min.js`, conferido pelo SHA-256), e o montador copia o arquivo para a pasta do vídeo.
- **Sem o plugin hyperframes:** os efeitos sonoros deste estilo são todos da pasta `sons/` do Editor Chefe, então a montagem não para por falta deles (o render continua precisando da HyperFrames).
- **Ícone de fora da biblioteca:** não existe. Não desenhe ícone novo nem use imagem; se nenhum dos 19 combina, o item fica sem ícone.
- **Teste de referência:** 15 s de gravação viraram 13,2 s de edição com 4 ideias (etapas, pergunta, lista, antes e depois), 3 delas com ícones; render em cerca de 25 s num Mac M1 Pro; com os 4 efeitos, áudio em -16,5 LUFS.
