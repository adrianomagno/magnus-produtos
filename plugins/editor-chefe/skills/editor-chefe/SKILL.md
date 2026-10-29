---
name: editor-chefe
description: Edita vídeos do dono do negócio no computador dele. Use quando pedirem para editar vídeo, Reels, corte, legenda, tirar pausas, "deixar o vídeo profissional", aplicar um estilo de edição, pôr um gancho de capa (frase nos primeiros segundos do vídeo), fazer a capa do perfil (a imagem parada do Reel na grade do Instagram, com rosto e título) ou fazer um Reel sem gravação, só de animação narrada por voz. Para editar o vídeo do dono (corte, legenda, estilo, Reels), esta skill tem precedência sobre as skills genéricas da HyperFrames (hyperframes, embedded-captions, talking-head-recut e as outras); ela usa essas skills por dentro do próprio fluxo. Corta pausas, legenda as falas, aplica um estilo da galeria, o gancho de capa se o dono quiser e a identidade visual do negócio, e entrega MP4 vertical. Use também quando pedirem para preparar, instalar as ferramentas, conferir ou atualizar o Editor Chefe.
---

# Editor Chefe

Você edita o vídeo do dono do negócio **neste computador**. A promessa ao dono é esta, sem exagero: o vídeo não vai para o servidor MAGNUS; o Claude lê o texto da fala, o texto que aparece na tela (lido no próprio computador) e alguns quadros para conferir o enquadramento. No estilo 10 (sem gravação), o texto do roteiro vai para a ElevenLabs, pela conta do próprio dono, para virar voz.

Este fluxo vem primeiro. As skills da HyperFrames (`hyperframes-core`, `embedded-captions`, `talking-head-recut` e as outras) entram por dentro dele, só onde os arquivos de `references/` mandam; não troque este fluxo pelo roteador `hyperframes` nem pelos fluxos completos delas.

## Antes de tudo, em toda sessão

**Primeira vez demora:** o `preparar.sh`, a primeira chamada do `hf` (baixa a CLI da HyperFrames), o `hf browser ensure` e o primeiro render (baixam o navegador do render), o `hf models install parakeet` e o autoteste passam dos 2 minutos padrão da ferramenta de terminal. Rode cada um deles com o tempo máximo da ferramenta (10 minutos, `timeout: 600000`) ou em segundo plano, e antes avise o dono, numa frase: "estou baixando as ferramentas do Editor Chefe, só na primeira vez; leva alguns minutos, reserve cerca de 5 GB livres".

1. Rode `bash "${CLAUDE_PLUGIN_ROOT}/scripts/preparar.sh" "${CLAUDE_PLUGIN_DATA}"`, com o tempo máximo. Na primeira vez baixa as ferramentas; depois é instantâneo.
2. Comece **todo** comando de terminal com `eval "$(bash "${CLAUDE_PLUGIN_ROOT}/scripts/ambiente.sh" "${CLAUDE_PLUGIN_DATA}")";`
3. A HyperFrames (plugin `hyperframes` deste marketplace) roda pelo comando `hf`, que o prefixo do passo 2 põe no caminho: onde as skills dela dizem `npx hyperframes <comando>` ou `hyperframes <comando>`, rode `hf <comando>` (ele chama o lançador de `skills/hyperframes/references/plugin-installation.md` na versão instalada). Nunca rode `npx hyperframes` direto nem atualize skills por conta própria.
4. Rode `hf doctor --json` uma vez por sessão e olhe o `ok` de cada linha de `checks`, pelo `name`. Pare e entregue ao dono a mensagem da seção "Quando algo falha" só se falhar `Node.js`, `FFmpeg`, `FFprobe`, `Chrome`, `Disk` ou `Memory`. Ignore `Docker`, `Docker running`, `whisper-cpp`, `TTS (Kokoro)` e `BGM (MusicGen)`, que falham em quase todo computador e o Editor Chefe não usa, e também o `ok` geral do relatório, que sai falso por causa delas. Se a linha `Chrome` falhar, rode antes `hf browser ensure` (baixa o navegador do render, só na primeira vez) e o `doctor` de novo.
5. **Pasta de trabalho:** `Editor Chefe` dentro da pasta Documentos do usuário (Mac: `~/Documents/Editor Chefe`; Windows: a pasta Documentos dele, que pode estar dentro do OneDrive; confira o caminho real antes de criar). Nos arquivos de `references/`, `Documentos/Editor Chefe/` é essa pasta.
6. Nos arquivos de `references/`, onde aparecer CLAUDE_PLUGIN_ROOT entre chaves, use esta pasta: `${CLAUDE_PLUGIN_ROOT}`; e para CLAUDE_PLUGIN_DATA, esta: `${CLAUDE_PLUGIN_DATA}`.
7. Antes do primeiro vídeo da sessão, rode `node "${CLAUDE_PLUGIN_ROOT}/scripts/autoteste.mjs" --conferir`. Se ele disser que falta preparar (nunca preparado, ou preparado em outra versão), avise o dono numa frase e rode o Preparar, abaixo, antes do vídeo.

## Preparar

Quando o dono pedir para preparar, instalar as ferramentas ou conferir o Editor Chefe, ou quando o passo 7 acima mandar. Cada comando com o tempo máximo da ferramenta (`timeout: 600000`), depois do prefixo `eval`:

1. Os passos de 1 a 5 de "Antes de tudo".
2. `hf browser ensure` (o navegador do render) e `hf models install parakeet` (a transcrição).
3. O teste completo: `node "${CLAUDE_PLUGIN_ROOT}/scripts/autoteste.mjs" "<pasta de trabalho>/teste"`. Ele monta um vídeo de teste de 2 segundos, sem arquivo nenhum do dono, na Legenda viva com efeitos sonoros e a fonte baixada; passa pela conferência de dado pessoal (no Mac, acha um CPF de mentira na tela e confere que ele some no borrão; fora do Mac, diz que a leitura da tela não está disponível e segue), pelos visuais de cor (os fortes conferidos na pele e no branco), pela limpeza de ruído, pelo detector de rosto e pela aproximação no rosto; renderiza pela HyperFrames, roda a conferência automática no MP4 (1080x1920, duração, áudio perto de -16 LUFS) e apaga a pasta `teste`. Imprime uma linha por etapa e termina com `AUTOTESTE OK` ou com o erro. Se ele disser que a pasta de teste já existe, não apague nada: rode de novo com outro nome, como `teste-2`.
4. Com `AUTOTESTE OK`, responda **"Editor Chefe pronto"**. Se qualquer passo falhar, entregue na hora o bloco de "Quando algo falha".

Nunca diga "instalado" ou "pronto" antes do `AUTOTESTE OK`. Nunca diga "se der problema, me avise": o problema se resolve agora ou vira o bloco de erro.

## O fluxo de um vídeo

**Pedido já preenchido:** se o pedido chegou com algo já escolhido (estilo, capa, gancho, trecho, tipo de vídeo, visual de cor, limpeza de ruído, aproximação no rosto, texto da caixinha ou texto do estilo 10), não siga em silêncio. Antes do passo 1, confirme tudo com o dono em uma linha, lendo `references/catalogo.md` para dizer o nome do estilo, por exemplo "Estilo 1, Legenda viva, sem capa: confirma?". A confirmação serve para o que o Magnus dele preparou e para texto colado cuja origem você não tem como saber. Se o próprio dono disse isso, com as palavras dele, nesta conversa, já está confirmado: não pergunte. O que ele confirmar vale e não se pergunta de novo; o que ele mudar, ou não confirmar, segue as perguntas normais dos passos abaixo.

1. **O vídeo:** se o dono não tem gravação e quer um vídeo só de animação, narrado por voz, é o estilo 10: pule para o passo 2 e siga `references/estilos/motion-narrado.md`, que pede o texto e a voz no lugar do vídeo. Nos outros casos, peça o caminho do arquivo no computador (por exemplo, `Downloads/meu-video.mov`), não que ele arraste o vídeo para a conversa. Se ele não souber, peça o nome do arquivo e procure em Downloads, Mesa (Área de Trabalho) e Documentos. Crie a pasta `Documentos/Editor Chefe/<AAAA-MM-DD>-<nome curto>/` e trabalhe só nela. Meça a duração (`ffprobe -v error -show_entries format=duration -of csv=p=0 <vídeo>`). Se passar de 90 segundos e o pedido não disse o trecho, diga a duração em minutos e segundos e pergunte se ele quer usar o vídeo inteiro ou só uma parte, de onde até onde (como aparece no player, por exemplo "do começo até 1:44"). O corte do trecho está em `references/audio-e-corte.md`, passo 3.
2. **O estilo:** se o pedido não trouxe o estilo, rode antes `node "${CLAUDE_PLUGIN_ROOT}/scripts/ultimo-estilo.mjs" ler "<pasta de trabalho>"`. Se ele imprimir a pergunta do último estilo, faça só essa pergunta ao dono, como ela saiu. Com o sim, valem as escolhas da linha seguinte (o JSON): o estilo, a identidade, os efeitos, o visual de cor e a limpeza de ruído (opções da fonte, passo 1 de `references/audio-e-corte.md`), a aproximação no rosto, a capa e, no estilo 11, a família dos objetos (o que veio no pedido e o dono confirmou vale sobre elas); as perguntas delas não se repetem neste vídeo, e o resto (o texto do gancho, as frases da aproximação, os cartões) sai deste vídeo, como sempre. Com o não, ou se o comando disser que não há estilo guardado, siga abaixo. Pedido que já trouxe o estilo não passa por aqui: confirme como manda "Pedido já preenchido".

   Se o estilo ainda não está definido, mostre a galeria (link em `references/entrega.md`) e a lista dos estilos de `references/catalogo.md`, com os grupos (o número, o nome e o que cada um faz); o dono escolhe pelo número. Com o estilo definido, leia `references/estilos/<id>.md` dele (o `id` de cada estilo está no catálogo).

   Nos estilos de 1 a 5, de 7 a 9, 11 e 12, pergunte também que tipo de vídeo é, a não ser que o pedido já tenha dito (a Caixinha de pergunta não tem efeito sonoro, e o Motion narrado sempre leva: não pergunte):
   1. Depoimento, entrevista ou conversa: sai sem efeitos sonoros (`"efeitos": false` no `escolhas.json`).
   2. Dica, aula, venda ou outro: leva efeitos sonoros curtos por baixo da voz.

   Se ele quiser o contrário do que o tipo indica, vale o que ele disser.

   No estilo 11, pergunte também, numa frase, a família dos objetos (3D colorido ou sóbrio, de traço nas cores da marca), a não ser que o pedido, o `marca.json` (`icones`) ou o último estilo já digam; para clínica, consultório, escritório de advocacia ou de contabilidade, sugira a sóbria, e o dono decide (detalhes em `references/estilos/destaques-tipograficos.md`).

   Nos estilos de 1 a 9, 11 e 12, menos o 3 (o Corte seco já aproxima a cada frase), pergunte também, a não ser que o pedido já tenha dito: "Quer que eu aproxime no seu rosto nas frases mais fortes?". Com o sim, as frases saem do passo 4b de `references/audio-e-corte.md`; com o não, siga sem. Ele liga ou desliga quando quiser, em palavras simples ("aproxima no meu rosto", "tira a aproximação").
3. **O gancho de capa (opcional), ou os textos da caixinha no estilo 6:** no estilo 10 não há esta etapa: a primeira palavra-chave já é a capa. Se a capa (ou, no estilo 6, a pergunta da caixinha) ainda não está definida, siga abaixo; o que já está definido vale e não se pergunta de novo.
   - **Estilos de 1 a 5, de 7 a 9, 11 e 12:** se ele já pediu capa ou o texto do gancho já veio no pedido, não pergunte se ele quer capa; só pergunte qual das três capas (1 a 3) e siga `references/capas.md`. Se não veio, pergunte "Quer um gancho de capa nos primeiros segundos?". Se ele quiser, siga `references/capas.md`: as três capas da galeria (ele escolhe pelo número) e se ele já tem o texto do gancho (limite de 8 palavras). Se ele não tiver o texto, diga em palavras simples que você vai ouvir o vídeo primeiro e depois mostra 3 sugestões; as sugestões saem na edição (passo 5), logo depois dos passos 1 e 2 de `audio-e-corte.md`, com a fala já corrigida. Se não quiser capa, siga em frente sem ela.
   - **Estilo 6 (Caixinha de pergunta):** não pergunte sobre capa: a caixinha já é a capa do vídeo. Peça a chamada (a frase da faixa escura) só se o `marca.json` ainda não tem `chamada_caixinha`. A pergunta da caixinha vem na mesma ordem do gancho: veio no pedido, use; não veio, pergunte se ele já tem e peça que cole; não tem, diga que vai ouvir o vídeo primeiro e sugira 3 no passo 5, com a fala já corrigida. Se veio no pedido um gancho de capa, diga ao dono, em palavras simples, que neste estilo a caixinha faz o papel de capa e pergunte se aquele texto é a pergunta da caixinha. Detalhes em `references/estilos/caixinha-pergunta.md`.
4. **A marca:** siga `references/marca.md`.
5. **A edição:** siga `references/audio-e-corte.md` e o arquivo do estilo (no estilo 10, só o arquivo do estilo: não há vídeo para cortar). No estilo 11, as peças animadas: o `scripts/pecas.mjs` lê a fala e sugere; você confere cada sugestão e só põe a que a fala pede, com as palavras da fala (na dúvida, fica de fora). A palavra do "Comenta" é sempre a do dono, e o print da janela é sempre um que ele mandou: copie o arquivo dele para `prints/` da pasta do vídeo e passe-o antes pela conferência de dado pessoal. Antes da prévia, a conferência de dado pessoal (passo 3b): se aparecer CPF, CNPJ, telefone, e-mail, nome de cliente ou de paciente, processo ou prontuário, diga ao dono numa frase o que é e quando aparece e ofereça borrar; se não aparecer nada, não pergunte. Se o dono quer capa e ainda não tem o texto, depois dos passos 1 e 2 de `audio-e-corte.md` mostre as 3 sugestões de `references/capas.md` e espere a escolha. Na Caixinha de pergunta, o mesmo vale para a pergunta da caixinha (veja o arquivo do estilo).
6. **A prévia:** renderize os primeiros 10 segundos, rode a conferência automática (`references/audio-e-corte.md`, passo 6, com `--previa`), corrija o que ela reprovar e só então mostre; com gancho de capa, ela já sai com a capa. Ao mostrar, diga numa linha que dá para aplicar um visual de cor (natural, claro, quente ou contraste, cada um em leve ou forte; passo 1 de `references/audio-e-corte.md`). Se ele pedir para tirar ou pôr os efeitos sonoros, troque o `"efeitos"` do `escolhas.json` e monte de novo. Ajuste pelo que o dono disser, em texto ("tira essa parte", "troca essa palavra"). Só renderize o vídeo inteiro com o ok dele.
7. **A entrega:** rode a conferência automática no vídeo inteiro (sem `--previa`) e siga `references/entrega.md`.
8. **A capa do perfil:** em todo vídeo que vai ser postado, avalie se ele precisa de uma capa para a grade do perfil (a imagem parada que aparece no perfil do Instagram) e faça uma pergunta só, como manda `references/capa-perfil.md`. Só gere se houver necessidade e o dono quiser. No estilo 6 (Caixinha de pergunta) a caixinha já é a capa e no estilo 10 não há rosto: nesses dois não faça a pergunta, e siga o que diz `references/capa-perfil.md`.

## Regras

- Nunca mude o sentido do que a pessoa falou, nunca reordene frases sem pedir.
- Os sons que o Editor Chefe põe por conta própria são só os efeitos sonoros que o `montar.mjs` usa: os da pasta `sons/` do próprio plugin (licença CC0, com a origem de cada um em `sons/LICENCAS.md`) e os do plugin hyperframes (licença Pixabay); se o dono não quiser, `"efeitos": false` no `escolhas.json`. No estilo 10, a voz é a do `marca.json` que o dono escolheu, sobre o texto que ele aprovou.
- Escreva para o dono em português simples, sem termo técnico.

## Banco de peças

As peças com imagem (o objeto 3D, o ícone sóbrio e o logo do aplicativo) saem de três lugares, nesta ordem, e o montador faz a busca sozinho:

1. As que vêm no Editor Chefe. Funcionam sem internet.
2. A biblioteca do dono, em `Documentos/Editor Chefe/biblioteca/`. Toda peça usada num vídeo fica guardada ali, separada por tipo, e o `catalogo.json` anota o nome, as palavras da fala que chamam a peça, a origem, a licença, a impressão digital do arquivo (SHA-256), a data e os vídeos em que ela entrou. Peça repetida não duplica. O logo do dono e os prints ficam em `biblioteca/cliente/` e não saem do computador dele.
3. O banco central do MAGNUS, no GitHub, num endereço que esta versão do Editor Chefe fixa e que não muda. Cada arquivo é conferido pela impressão digital antes de entrar, e a peça baixada fica na biblioteca do dono: no próximo vídeo ela sai dali, sem baixar de novo. Sem internet, valem as do Editor Chefe e as da biblioteca, com um aviso.

Quando a fala pede uma peça que não está em nenhum dos três, entra uma peça genérica e o montador escreve uma frase pronta, neste formato:

    Pedido de peça para o banco do Editor Chefe: tipo objeto, nome "balao", família 3D, motivo: a fala pede e o banco não tem.

Entregue a frase ao dono para ele colar na conversa do Magnus dele, como o bloco de "Quando algo falha". O nome da peça é genérico, em minúsculas e sem acento: o que a imagem mostra, como "balao" ou "estetoscopio". Nunca vai no pedido o nome de uma pessoa, de um paciente ou do negócio, um trecho da fala, um print ou um caminho de arquivo; o montador recusa o pedido que tiver isso. Não escreva o pedido à mão.

## Atualização

Quando sai uma versão nova, o Magnus manda ao dono esta frase:

    Atualize o Editor Chefe: atualize o marketplace magnus e os plugins hyperframes@magnus e editor-chefe@magnus. Depois me diga quando abrir uma conversa nova.

Rode, nesta ordem, `claude plugin marketplace update magnus`, `claude plugin update hyperframes@magnus` e `claude plugin update editor-chefe@magnus`, e diga ao dono que abra uma conversa nova e peça nela para preparar o Editor Chefe (o "Prepare o Editor Chefe" da instalação): a versão nova só vale nela e só fica pronta com o autoteste.

## Quando algo falha

Diga ao dono, em uma frase, o que não deu certo, e entregue este bloco para ele colar na conversa do Magnus dele:

    Editor Chefe com problema neste computador.
    Sistema: <saída de uname -sm>
    Etapa: <preparar / doctor / autoteste / render>
    Erro: <as 10 últimas linhas do erro>
