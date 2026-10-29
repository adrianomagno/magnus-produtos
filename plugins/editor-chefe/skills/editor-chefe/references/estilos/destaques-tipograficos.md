# Destaques tipográficos

**Quando usar:** a pessoa em tela cheia, a legenda de uma palavra por vez na altura do peito e, acima da cabeça (ou logo abaixo do queixo, quando em cima não cabe), no instante da palavra, as frases fortes em letra grande e as peças animadas: selo, lista com check, capítulo numerado, "Comenta PALAVRA", objeto 3D, ícone do aplicativo citado, janela com um print e esquema. Bom para dica, aula e venda, em que cada ideia ganha uma imagem.

**Fluxo da HyperFrames:** composição da `hyperframes-core` no molde `estilos/destaques-tipograficos.html` do plugin, com as peças de `estilos/pecas.js`, que o `scripts/montar.mjs` preenche com a marca, a fala, os trechos, as frases e as peças escolhidas. Os cortes seguem as receitas `Hard cut` e `Trim in/out`. Os scripts do `embedded-captions` não entram: os temas dele trazem fonte e cor fixas, posições em pixel para 1280x720 e pedem o recorte da pessoa.

## Desenho

- **Vídeo sem moldura:** o vídeo cobre a tela inteira o tempo todo; nunca desce nem diminui, e nenhuma faixa ou barra de cor aparece em volta dele. Com a cabeça alta, 0,4 s antes de uma frase ou peça entrar acima da cabeça ele aproxima, ancorado no alto (a cabeça desce e cresce), até sobrarem 360 px acima da cabeça (270 px num vídeo só com frases), no máximo 125% (115% em vídeo que já foi ampliado mais de 1,5 vez para encher a tela) e sem o queixo passar de 20 px acima da legenda. Ele volta ao tamanho gravado quando a frase ou peça sai; duas seguidas acima da cabeça a menos de 1,2 s uma da outra deixam o vídeo aproximado entre elas. Com a frase ou peça embaixo do queixo ele não aproxima, e a que fica perto de um trecho aproximado conta o queixo já aproximado.
- **Onde entram a frase e a peça (desde 2026-10-27):** uma de cada vez, em um destes lugares, medidos no `rosto.json` (a parte mais alta da cabeça, com o cabelo, e o queixo, os dois no momento em que ela está na tela):
  - **Acima da cabeça**, de 240 px do topo (abaixo do cabeçalho do Instagram) até 30 px acima dela, quando ali ela cabe inteira (a frase em duas linhas de 112 px; a peça no tamanho de desenho). A legenda continua na tela.
  - **Logo abaixo do queixo**, encostada nele (30 px abaixo, nunca acima de 240 px), até 1650 px, o mesmo piso da legenda corrida dos estilos 7, 9 e 12. Vale quando em cima não cabe inteira e embaixo sobra mais: a selfie comum, com a cabeça colada no topo, e a gravação de cabeça baixa com o rosto grande. **A legenda sai da tela enquanto ela está ali**, porque a frase e a peça já mostram as palavras da fala; ela volta logo depois.
  - **A janela com print é a exceção:** o print não mostra a fala, então a legenda fica na tela durante a janela, e a janela vai para o maior destes lugares sem cobrir a legenda nem o rosto: acima da cabeça, entre o queixo e a legenda (até 20 px acima dela) ou embaixo da legenda (de 1500 a 1650 px, 150 px no máximo). Quando ela não cabe inteira em nenhum dos três (a gravação de cabeça baixa e rosto grande), desce para logo abaixo do queixo, até 1650 px, se ali ficar maior, e **a legenda sobe para acima da cabeça enquanto a janela está na tela**: a caixa dela (os mesmos 170 px) vai para o alto da área segura, de 240 a 410 px, o mais longe possível do cabelo, e só sobe se a cabeça mais alta nesse tempo ficar 20 px ou mais abaixo dela. Se a legenda não couber ali, a janela fica no maior dos três lugares de antes.
  Cada uma sai 0,35 s antes da seguinte entrar, e a que entra antes de a anterior terminar o que tem a mostrar (a fala dela e mais meio segundo, ou 1,2 s na tela) fica de fora, com aviso. A peça encolhe para caber no lugar; abaixo de 55% do tamanho, o montador avisa. Nunca cobre o rosto: sem lugar em nenhum dos três, o montador avisa que ficou apertada.
- **Frase em destaque:** num cartão branco encostado embaixo da faixa, que entra crescendo de leve logo antes da primeira palavra; cada palavra entra no instante em que é dita, de baixo para cima, dentro do cartão, e a palavra-chave com um leve impulso. A frase fica até 1,5 s depois da última palavra. Letra `fontes.titulo`, peso 800, de 112 px (encolhe até 56 px), no escuro da marca (escurecido até 4,6:1 no branco); a palavra-chave na cor de destaque, escurecida rumo ao preto até 3,2:1 no branco quando é clara demais (o amarelo vira mostarda), as mesmas contas do painel branco do Motion dividido.
- **Legenda de uma palavra:** uma palavra por vez, no instante dela, em caixa alta, na faixa de 1310 a 1480 px. Sai da tela enquanto uma frase ou peça está embaixo do queixo (a palavra que viria ali não entra e a de antes sai quando ela entra) e fica durante a janela; com a janela embaixo do queixo, ela sobe para acima da cabeça e volta para o lugar quando a janela sai. Palavra de 1 ou 2 letras colada na seguinte vai junto ("A ANÁLISE"), para não piscar sozinha. Leva só as palavras de fora das frases em destaque. A letra é condensada e pesada: a `fontes.titulo` da marca, se ela já for condensada (Oswald, Anton, Bebas Neue, as "Condensed"), ou a Anton, que o Editor Chefe baixa. Branca, com um contorno no escuro da marca; a palavra-chave sai na cor de destaque, clareada até ler bem contra o contorno (4,5:1). Palavras-chave: as que puxam o objeto 3D e o aplicativo, e as de `"chaves"` no `escolhas.json`.
- **Cores das peças:** cartões brancos com as cores do painel branco do Motion dividido: o texto no escuro da marca, o traço e os destaques na cor de destaque (escurecida até ler no branco). Verde e vermelho só no selo de aprovado e reprovado e no "pronto" do Comenta, os dois com 4,5:1 no branco.

## As peças

Cada peça entra na `"fala"` dela: as palavras da fala, seguidas e como estão no `transcript.json`, em que ela aparece (de 1 a 8 palavras). Os textos de dentro da peça também saem da fala, com as palavras dela; só a PALAVRA do Comenta vem do dono.

| Peça | `"tipo"` | Quando entra | Campos (além de `"fala"`) | Como anima |
|---|---|---|---|---|
| Selo | `selo` | certo e errado, antes e depois, um alerta, uma novidade | `"selo"`: `aprovado`, `reprovado`, `atencao` ou `novo` | o carimbo bate e pousa inclinado |
| Cartão de lista | `lista` | lista falada, passo a passo | `"titulo"` (opcional, até 30 letras), `"itens"`: 2 a 4, até 24 letras cada | cada item se escreve quando começa a ser dito e ganha o check na última palavra dele |
| Capítulo | `capitulo` | vídeo em partes ("primeiro", "segundo") | `"numero"`: 1 a 9, `"titulo"`: até 28 letras | número grande com o título em duas linhas, que encolhe para uma pílula no canto (em cima, ou logo acima da legenda quando a cabeça ocupa o alto) e fica ali até o próximo capítulo; enquanto outra peça passa, a pílula mostra só o número |
| Comenta PALAVRA | `comenta` | a chamada para comentar | `"palavra"`: uma palavra, até 12 letras, **a que o dono escolheu** | a palavra acende, desce uma notificação de mensagem com o nome do negócio e uma barra enche até "pronto" |
| Objeto | `objeto` | a palavra concreta da fala | `"objeto"`: um da biblioteca (abaixo), em 3D ou no estilo sóbrio | entra com um pulo e uma sombra, e boia de leve |
| Ícone do aplicativo | `app` | a pessoa cita a ferramenta | `"apps"`: 1 a 4, na ordem da fala | o primeiro no meio; os outros giram em órbita, cada um quando o nome dele é dito |
| Janela com print | `janela` | mostrar a tela de verdade | `"print"`: o print do dono, copiado para `prints/` da pasta do vídeo (`"prints/tela.png"`); `"endereco"` (opcional, até 40 letras) | janela estilo Mac que abre com o print, que cresce devagar; a legenda continua na tela (no alto, se a janela desceu para embaixo do queixo) |
| Esquema | `esquema` | "uma coisa vira várias", o método | `"centro"`: até 16 letras, `"vagas"`: 2 a 4, até 24 letras cada | o centro aparece com as vagas tracejadas; cada linha sai do centro quando a vaga é dita e a vaga se preenche |

**Objetos da biblioteca**, os mesmos 38 nas duas famílias: `acordo`, `alerta`, `alvo`, `ampulheta`, `balanca`, `cadeado`, `calendario`, `cama`, `cartao`, `casa`, `celular`, `chave`, `check`, `contrato`, `coracao`, `dente`, `dinheiro`, `documento`, `envelope`, `erro`, `estetoscopio`, `foguete`, `grafico`, `hospital`, `lampada`, `lupa`, `megafone`, `moeda`, `obra`, `pasta`, `predio`, `presente`, `queda`, `recibo`, `relogio`, `remedio`, `seringa`, `trofeu`. Outro nome também vale, em minúsculas e sem acento, o que a imagem mostra (como `comida`): o montador procura na biblioteca do dono e no banco central (seção "Banco de peças" da SKILL) e, sem a peça, põe uma genérica e escreve o pedido para o Magnus. O mesmo vale para aplicativo fora da lista abaixo, que entra com um ícone neutro.

**Duas famílias de objetos, escolha do dono:**
- `3d` (o padrão): objetos 3D coloridos, mais animados (Fluent Emoji, licença MIT, em `pecas/objetos/`).
- `sobrio`: ícone de traço com a forma de trás em duas cores da marca (o escuro e o destaque), num disco branco, sem cara de emoji, pensado para médicos, advogados e profissionais da mesma linha (Phosphor, licença MIT, em `pecas/icones/`).

Quando o negócio for clínica, consultório, escritório de advocacia ou de contabilidade (o `pecas.mjs` avisa pelo nome no `marca.json`; vale também o que o dono disse), sugira a família sóbria numa frase e deixe o dono decidir, por exemplo: "Para um escritório de advocacia, os objetos podem vir num estilo sóbrio, de traço nas cores da sua marca, em vez do 3D colorido. Prefere assim?". Neste vídeo: `"icones": "sobrio"` (ou `"3d"`) no `escolhas.json`. Para todos os vídeos do negócio: `"icones"` no `marca.json`; o do `escolhas.json` vale sobre ele. O `ultimo-estilo.mjs` guarda a família junto com o estilo, e ela entra na pergunta do "mesmo estilo do último vídeo".

**Aplicativos** (24, com o logo oficial de cada um, em `pecas/apps/`): `whatsapp`, `instagram`, `facebook`, `threads`, `youtube`, `linkedin`, `telegram`, `perplexity`, `trello`, `claude`, `chatgpt`, `gemini`, `google-drive`, `gmail`, `google-agenda`, `google-meet`, `google-planilhas`, `google-docs`, `tiktok`, `x`, `pinterest`, `notion`, `canva`, `zoom`. Nunca desenhe nem imite o logo de uma marca de fora desta lista: sem ela no banco, a peça não entra. O `pecas.mjs` sugere o aplicativo pelo nome dito e pelos apelidos ("zap", "insta", "Chat GPT", "o GPT", "planilha do Google", "pelo Zoom"); "zoom" de aproximar, "x" letra e "drive" sozinho não chamam logo.

## Efeitos sonoros

Cada movimento tem um som curto, com o pico no quadro em que a peça pousa:

- **Frase em destaque:** whoosh na entrada, pop na palavra-chave.
- **Selo:** o impacto suave quando o carimbo pousa.
- **Lista:** whoosh largo na entrada do cartão; tique ou clique discreto em cada check.
- **Capítulo:** whoosh largo na entrada; whoosh curto quando ele vira pílula.
- **Comenta:** whoosh largo na entrada, pop quando a palavra acende, a notificação quando a mensagem desce e o "pronto" quando a barra chega ao fim.
- **Objeto 3D e aplicativo:** pop quando ele pousa; clique discreto em cada aplicativo seguinte.
- **Janela:** whoosh largo quando ela abre.
- **Esquema:** whoosh curto no centro; tique em cada vaga que se preenche.
- Nada na legenda.

Os sons são os do `sons/manifest.json` do plugin: os da pasta `sons/` (licença CC0, com a origem de cada um em `sons/LICENCAS.md`) e 3 do plugin hyperframes (`whoosh-short`, `pop` e `impact-bass-1`, licença Pixabay, uso comercial sem atribuição); o montador copia só os usados para a pasta `efeitos/` do vídeo. Todos ficam no mesmo nível, por baixo da voz. Dois efeitos a menos de 0,5 s um do outro: fica o mais forte. Ligados por padrão; `"efeitos": false` no `escolhas.json` desliga neste vídeo.

## Como montar

1. Siga `audio-e-corte.md` até ter, na pasta do vídeo, `fonte.mp4`, `rosto.json` (passo 1b, com `destaques-tipograficos`), `transcript.json` corrigido, `trechos.json` e a conferência de dado pessoal (passo 3b). Sem o `rosto.json`, o montador avisa e põe tudo numa faixa fixa, de 240 a 640 px, sem aproximar o vídeo.
2. Baixe as fontes como manda `marca.md` e, se a fonte de título da marca não for condensada, também a Anton: `node "${CLAUDE_PLUGIN_ROOT}/scripts/baixar-fonte.mjs" "Anton" "400" fonts`.
3. Peça as sugestões: `node "${CLAUDE_PLUGIN_ROOT}/scripts/pecas.mjs" .` lê o `transcript.json` corrigido e imprime, por momento do vídeo editado, a peça que caberia ali, já no formato do `escolhas.json` (e grava a lista em `pecas-sugeridas.json`): objeto 3D para a palavra concreta da biblioteca, ícone para o aplicativo citado, capítulo para "primeiro, segundo" (duas partes ou mais), cartão de lista para a lista falada ("três documentos: ...", "A, B e C", "primeiro... depois..."), esquema para "X vira A, B e C", selo para certo e errado, alerta ou novidade, Comenta para "comenta" e janela quando a pessoa fala de site, sistema ou planilha. **Ele só sugere, e sugere demais de propósito.** Confira cada sugestão pela regra abaixo, ajuste os textos com as palavras da fala e ponha no `escolhas.json` só as que você aceitar.
4. Escolha as frases e as peças no `transcript.json` corrigido. **Só entra o que a fala pede, com as palavras da fala; na dúvida, fica de fora.** Uma ideia a cada 4 a 10 segundos de vídeo, nada nos primeiros 3 segundos com gancho de capa. As frases: de 2 a 10 palavras seguidas da fala (até 48 caracteres), com a palavra-chave entre asteriscos (uma só, de uma ou duas palavras). Nunca invente nem troque palavra.
   - **Comenta:** a PALAVRA vem do dono. Se a fala diz "comenta X", pergunte se é X mesmo; se a fala não diz, pergunte qual palavra ele quer, e se ele não quiser, não ponha a peça.
   - **Ícone do aplicativo:** só quando a pessoa cita a ferramenta, para identificá-la; nunca para sugerir parceria.
   - **Janela:** só com um print que o dono mandou. Copie o arquivo do dono para `prints/` da pasta do vídeo (por exemplo `prints/tela.png`) e use sempre esse caminho, a partir da pasta do vídeo: o Editor Chefe recusa caminho absoluto, `..` e link que saia da pasta do vídeo. Rode `node "${CLAUDE_PLUGIN_ROOT}/scripts/sigilo.mjs" . --print prints/tela.png`. Leia o resumo como no passo 3b de `audio-e-corte.md`: se aparecer dado pessoal (`NO PRINT [n]`) ou nome de cliente ou de paciente no texto do print, diga ao dono e ofereça borrar; com o sim, `node "${CLAUDE_PLUGIN_ROOT}/scripts/sigilo.mjs" . --borrar <n>` e monte de novo (o montador borra o print). O montador só aceita o print conferido e sem mudança depois da conferência; fora do Mac, a leitura do print não existe e a janela não entra: diga isso ao dono numa frase.

   Escreva o `escolhas.json` na pasta do vídeo:

       {
         "estilo": "destaques-tipograficos",
         "foco": "50% 40%",
         "destaques": ["todo cliente recebe *resposta* no mesmo dia"],
         "pecas": [
           { "tipo": "objeto", "objeto": "casa", "fala": "um apartamento" },
           { "tipo": "selo", "selo": "reprovado", "fala": "Isso não é paciência" },
           { "tipo": "lista", "titulo": "o que deveria existir", "itens": ["a análise técnica", "a negociação", "a justiça"], "fala": "uma ordem" }
         ],
         "chaves": ["contrato"],
         "icones": "sobrio"
       }

   `"destaques"` e `"pecas"` são opcionais, mas o vídeo precisa de pelo menos uma frase ou uma peça. `"icones"` (opcional): `"3d"` ou `"sobrio"`, a família dos objetos (veja acima). `"chaves"` (opcional): palavras da fala que saem na cor de destaque na legenda, além das que puxam o objeto e o aplicativo. Campos que valem para todo estilo: `"estilo"`, `"foco"` (a posição do rosto, `"50% 40%"` para começar). O montador lê a marca em `../marca.json` (troque com `"marca": "<caminho>"`). `"efeitos"` é opcional: `true` (padrão) ou `false`. `"capa"` é opcional: se o dono escolheu um gancho de capa, veja `capas.md`. `"aproximar"` é opcional (veja `audio-e-corte.md`, passo 4b); a aproximação que cair com uma frase ou peça acima da cabeça fica de fora, com aviso.
5. Monte: `node "${CLAUDE_PLUGIN_ROOT}/scripts/montar.mjs" .` grava `index.html`, `comum.js` e `pecas.js` na pasta, copia para `pecas/` os objetos, os logos e o print usados e, com os efeitos ligados, os sons para `efeitos/`. Leia os avisos: frase ou peça que não foi achada na fala (corrija a grafia pelo `transcript.json`), que cai no gancho de capa, que entra antes de a anterior terminar, que ficou apertada ou pequena acima da cabeça ou embaixo do queixo, item da lista ou vaga que não foi achada. A que ficou de fora: troque e monte de novo. Leia também as linhas do banco de peças: a peça que veio do banco central, a que saiu da biblioteca do dono e, quando faltou uma, a frase do pedido, que você entrega ao dono para ele colar no Magnus dele.
6. Confira com `hf snapshot . --at <segundo de uma peça> --describe false` que a peça está fora do rosto e se lê, e que o vídeo cobre a tela inteira.

## Prévia, conferência e render

Na pasta do vídeo (`hf` é a HyperFrames, como manda o passo 3 da SKILL):

1. Prévia dos primeiros 10 segundos (edição de até 12 s: renderize inteira):

       sed 's/data-duration="[0-9.]*" data-width/data-duration="10" data-width/' index.html > previa.html
       HF_VIDEO_COVERAGE_THRESHOLD=0 hf render . -c previa.html -o previa.mp4
       rm previa.html

   A variável vale só na prévia: ela aceita o trecho que passa dos 10 s. Apague o `previa.html` logo depois; com ele na pasta, o `lint` acusa `multiple_root_compositions`.
2. Ajuste pelo que o dono disser ("tira o selo", "troca o objeto", "outra palavra no Comenta") no `escolhas.json` ou no `transcript.json` e rode o `montar.mjs` de novo; não edite o `index.html` à mão.
3. Antes do render final: `hf lint .` e `hf check . --strict`, os dois sem erro e sem aviso.
4. Render final: `hf render . -o "../prontos/<AAAA-MM-DD>-<nome curto>.mp4"`, depois as conferências de `entrega.md`. A conferência automática lê a faixa de cada frase, de cada peça e da pílula do capítulo (o tempo e o lugar de cada uma) e reprova se alguma cobrir o rosto.

## Cuidados

- **Peça ou frase em cima do rosto:** se a conferência reprovar, a pessoa subiu no quadro naquele trecho. Troque a peça de momento ou tire.
- **Rosto muito grande:** com a cabeça baixa e o queixo perto da legenda, quase nada cabe inteiro acima da cabeça: a frase e a peça vão para logo abaixo do queixo, sem a legenda. A janela, que mantém a legenda, desce para embaixo do queixo com a legenda acima da cabeça; o montador avisa quando a peça fica pequena. Prefira as peças baixas (selo, objeto, capítulo) e menos peças; a lista com título e quatro itens é a mais alta.
- **Vídeo deitado em tela cheia amplia a imagem:** uma gravação de 1280x660 vira quase 3 vezes maior e fica macia. Para vídeo deitado, ofereça antes `painel-escuro` ou `editorial-claro`.
- **Fonte que não carrega:** o molde monta mesmo assim, com a fonte de reserva. Confira na prévia que a letra é a da marca e a condensada.
- **O render não precisa de internet:** o GSAP vem no plugin (`estilos/gsap.min.js`, conferido pelo SHA-256), e o montador copia o arquivo para a pasta do vídeo.
- **Sem o plugin hyperframes:** o montador para dizendo que não achou os efeitos sonoros. Instale o plugin hyperframes do mesmo marketplace e abra uma conversa nova; se não der, monte com `"efeitos": false`.
