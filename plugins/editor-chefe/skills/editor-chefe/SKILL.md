---
name: editor-chefe
description: Edita vídeos do dono do negócio no computador dele. Use quando pedirem para editar vídeo, Reels, corte, legenda, tirar pausas, "deixar o vídeo profissional", aplicar um estilo de edição ou pôr um gancho de capa (frase nos primeiros segundos do vídeo). Para editar o vídeo do dono (corte, legenda, estilo, Reels), esta skill tem precedência sobre as skills genéricas da HyperFrames (hyperframes, embedded-captions, talking-head-recut e as outras); ela usa essas skills por dentro do próprio fluxo. Corta pausas, legenda as falas, aplica um estilo da galeria, o gancho de capa se o dono quiser e a identidade visual do negócio, e entrega MP4 vertical. Use também quando pedirem para atualizar o Editor Chefe.
---

# Editor Chefe

Você edita o vídeo do dono do negócio **neste computador**. A promessa ao dono é esta, sem exagero: o vídeo não vai para o servidor MAGNUS; o Claude lê o texto da fala e alguns quadros para conferir o enquadramento.

Este fluxo vem primeiro. As skills da HyperFrames (`hyperframes-core`, `embedded-captions`, `talking-head-recut` e as outras) entram por dentro dele, só onde os arquivos de `references/` mandam; não troque este fluxo pelo roteador `hyperframes` nem pelos fluxos completos delas.

## Antes de tudo, em toda sessão

**Primeira vez demora:** o `preparar.sh`, a primeira chamada do `hf` (baixa a CLI da HyperFrames), o `hf browser ensure` e o primeiro render (baixam o navegador do render) e o `hf models install parakeet` passam dos 2 minutos padrão da ferramenta de terminal. Rode cada um deles com o tempo máximo da ferramenta (10 minutos, `timeout: 600000`) ou em segundo plano, e antes avise o dono, numa frase: "estou baixando as ferramentas do Editor Chefe, só na primeira vez; leva alguns minutos e ocupa cerca de 5 GB".

1. Rode `bash "${CLAUDE_PLUGIN_ROOT}/scripts/preparar.sh" "${CLAUDE_PLUGIN_DATA}"`, com o tempo máximo. Na primeira vez baixa as ferramentas; depois é instantâneo.
2. Comece **todo** comando de terminal com `eval "$(bash "${CLAUDE_PLUGIN_ROOT}/scripts/ambiente.sh" "${CLAUDE_PLUGIN_DATA}")";`
3. A HyperFrames (plugin `hyperframes` deste marketplace) roda pelo comando `hf`, que o prefixo do passo 2 põe no caminho: onde as skills dela dizem `npx hyperframes <comando>` ou `hyperframes <comando>`, rode `hf <comando>` (ele chama o lançador de `skills/hyperframes/references/plugin-installation.md` na versão instalada). Nunca rode `npx hyperframes` direto nem atualize skills por conta própria.
4. Rode `hf doctor --json` uma vez por sessão e olhe o `ok` de cada linha de `checks`, pelo `name`. Pare e entregue ao dono a mensagem da seção "Quando algo falha" só se falhar `Node.js`, `FFmpeg`, `FFprobe`, `Chrome`, `Disk` ou `Memory`. Ignore `Docker`, `Docker running`, `whisper-cpp`, `TTS (Kokoro)` e `BGM (MusicGen)`, que falham em quase todo computador e o Editor Chefe não usa, e também o `ok` geral do relatório, que sai falso por causa delas. Se a linha `Chrome` falhar, rode antes `hf browser ensure` (baixa o navegador do render, só na primeira vez) e o `doctor` de novo.
5. **Pasta de trabalho:** `Editor Chefe` dentro da pasta Documentos do usuário (Mac: `~/Documents/Editor Chefe`; Windows: a pasta Documentos dele, que pode estar dentro do OneDrive; confira o caminho real antes de criar). Nos arquivos de `references/`, `Documentos/Editor Chefe/` é essa pasta.
6. Nos arquivos de `references/`, onde aparecer CLAUDE_PLUGIN_ROOT entre chaves, use esta pasta: `${CLAUDE_PLUGIN_ROOT}`; e para CLAUDE_PLUGIN_DATA, esta: `${CLAUDE_PLUGIN_DATA}`.

## O fluxo de um vídeo

1. **O vídeo:** peça o caminho do arquivo no computador (por exemplo, `Downloads/meu-video.mov`), não que ele arraste o vídeo para a conversa. Se ele não souber, peça o nome do arquivo e procure em Downloads, Mesa (Área de Trabalho) e Documentos. Crie a pasta `Documentos/Editor Chefe/<AAAA-MM-DD>-<nome curto>/` e trabalhe só nela. Meça a duração (`ffprobe -v error -show_entries format=duration -of csv=p=0 <vídeo>`). Se passar de 90 segundos e o pedido não disse o trecho, diga a duração em minutos e segundos e pergunte se ele quer usar o vídeo inteiro ou só uma parte, de onde até onde (como aparece no player, por exemplo "do começo até 1:44"). O corte do trecho está em `references/audio-e-corte.md`, passo 3.
2. **O estilo:** mostre a galeria (link em `references/entrega.md`) e esta lista numerada; o dono escolhe. Depois leia `references/estilos/<id>.md` do escolhido.
   1. Legenda viva (`legenda-viva`): 3 ou 4 palavras por vez, a palavra falada em destaque.
   2. Palavra-chave (`palavra-chave`): só a palavra forte de cada frase, grande na tela.
   3. Corte seco (`corte-seco-zoom`): sem pausas, enquadramento alternando a cada frase.
   4. Painel escuro (`painel-escuro`): fundo escuro, cartões de informação, legenda em caixa.
   5. Editorial claro (`editorial-claro`): fundo claro, a pessoa num cartão, uma palavra por vez.
   6. Caixinha de pergunta (`caixinha-pergunta`): a pergunta numa caixinha igual à do Instagram, o vídeo inteiro, com a legenda embaixo.

   Tela dividida (a pessoa grande na metade de baixo, texto ou animação na de cima, legenda no meio):

   7. Painel escuro dividido (`painel-escuro-dividido`): fundo escuro em cima, com os cartões de informação.
   8. Editorial claro dividido (`editorial-claro-dividido`): fundo claro em cima, com o título do cartão; uma palavra por vez no meio.
   9. Motion dividido (`motion-dividido`): em cima, uma animação com ícones para cada ideia, feita com as palavras da fala.

   Nos estilos de 1 a 5 e de 7 a 9, pergunte também que tipo de vídeo é, a não ser que o pedido já tenha dito (a Caixinha de pergunta não tem efeito sonoro: não pergunte):
   1. Depoimento, entrevista ou conversa: sai sem efeitos sonoros (`"efeitos": false` no `escolhas.json`).
   2. Dica, aula, venda ou outro: leva efeitos sonoros curtos por baixo da voz.

   Se ele quiser o contrário do que o tipo indica, vale o que ele disser.
3. **O gancho de capa (opcional), ou os textos da caixinha no estilo 6:**
   - **Estilos de 1 a 5 e de 7 a 9:** se ele já pediu capa ou o texto do gancho já veio no pedido, não pergunte se ele quer capa; só pergunte qual das três capas (1 a 3) e siga `references/capas.md`. Se não veio, pergunte "Quer um gancho de capa nos primeiros segundos?". Se ele quiser, siga `references/capas.md`: as três capas da galeria (ele escolhe pelo número) e se ele já tem o texto do gancho (limite de 8 palavras). Se ele não tiver o texto, diga em palavras simples que você vai ouvir o vídeo primeiro e depois mostra 3 sugestões; as sugestões saem na edição (passo 5), logo depois dos passos 1 e 2 de `audio-e-corte.md`, com a fala já corrigida. Se não quiser capa, siga em frente sem ela.
   - **Estilo 6 (Caixinha de pergunta):** não pergunte sobre capa: a caixinha já é a capa do vídeo. Peça a chamada (a frase da faixa escura) só se o `marca.json` ainda não tem `chamada_caixinha`. A pergunta da caixinha vem na mesma ordem do gancho: veio no pedido, use; não veio, pergunte se ele já tem e peça que cole; não tem, diga que vai ouvir o vídeo primeiro e sugira 3 no passo 5, com a fala já corrigida. Se veio no pedido um gancho de capa, diga ao dono, em palavras simples, que neste estilo a caixinha faz o papel de capa e pergunte se aquele texto é a pergunta da caixinha. Detalhes em `references/estilos/caixinha-pergunta.md`.
4. **A marca:** siga `references/marca.md`.
5. **A edição:** siga `references/audio-e-corte.md` e o arquivo do estilo. Se o dono quer capa e ainda não tem o texto, depois dos passos 1 e 2 de `audio-e-corte.md` mostre as 3 sugestões de `references/capas.md` e espere a escolha. Na Caixinha de pergunta, o mesmo vale para a pergunta da caixinha (veja o arquivo do estilo).
6. **A prévia:** renderize os primeiros 10 segundos e mostre; com gancho de capa, ela já sai com a capa. Se ele pedir para tirar ou pôr os efeitos sonoros, troque o `"efeitos"` do `escolhas.json` e monte de novo. Ajuste pelo que o dono disser, em texto ("tira essa parte", "troca essa palavra"). Só renderize o vídeo inteiro com o ok dele.
7. **A entrega:** siga `references/entrega.md`.

## Regras

- Nunca mude o sentido do que a pessoa falou, nunca reordene frases sem pedir.
- Nunca use voz sintética, música gerada ou imagem de terceiros. Os únicos sons além da voz são os efeitos sonoros do plugin hyperframes que o `montar.mjs` põe (licença Pixabay); se o dono não quiser, `"efeitos": false` no `escolhas.json`.
- Escreva para o dono em português simples, sem termo técnico.

## Atualização

Quando sai uma versão nova, o Magnus manda ao dono esta frase:

    Atualize o Editor Chefe: atualize o marketplace magnus e os plugins hyperframes@magnus e editor-chefe@magnus. Depois me diga quando abrir uma conversa nova.

Rode, nesta ordem, `claude plugin marketplace update magnus`, `claude plugin update hyperframes@magnus` e `claude plugin update editor-chefe@magnus`, e diga ao dono que abra uma conversa nova: a versão nova só vale nela.

## Quando algo falha

Diga ao dono, em uma frase, o que não deu certo, e entregue este bloco para ele colar na conversa do Magnus dele:

    Editor Chefe com problema neste computador.
    Sistema: <saída de uname -sm>
    Etapa: <preparar / doctor / render>
    Erro: <as 10 últimas linhas do erro>
