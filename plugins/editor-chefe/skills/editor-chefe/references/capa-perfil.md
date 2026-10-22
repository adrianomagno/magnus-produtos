# Capa do perfil

É a imagem parada que aparece na grade do perfil do Instagram. Quem passa pelo perfil não vê o vídeo rodando, só essa imagem: em vídeo de evento, lançamento ou anúncio, é ela que vende. Não confunda com o gancho de capa (`capas.md`), que é a frase dentro do vídeo nos primeiros segundos.

## A checagem, em todo vídeo que vai ser postado

Depois do vídeo aprovado e entregue (`entrega.md`), avalie e faça **uma pergunta só**. Não é etapa obrigatória: só gere a capa se houver necessidade e o dono quiser.

Recomende a capa quando:
- o vídeo é de evento, lançamento ou anúncio (pelo que ele disse, pelo roteiro ou pela fala); ou
- o primeiro quadro do vídeo (o primeiro da `conferencia.jpg`) não mostra o rosto nem o assunto, e a grade mostraria uma imagem que não diz nada.

Recomendando, pergunte assim:

    Este vídeo é de evento, lançamento ou anúncio. Quem passa pelo seu perfil vê só a imagem parada dele. Quer que eu faça uma capa com o seu rosto e uma frase curta?

Sem motivo para recomendar (conteúdo do dia a dia com rosto no começo), pergunte de leve:

    Quer uma capa para a grade do seu perfil? Para vídeo do dia a dia é opcional: no feed ele já roda sozinho.

Se ele não quiser, a entrega termina aí. No estilo 10 (sem gravação) não há rosto: não ofereça.

## O título

Se o dono já tem o título, use o dele (passando pelas regras abaixo; se quebrar alguma, mostre o problema e uma versão ajustada com as palavras dele, e use só com o ok). Se não tem, mostre **3 sugestões numeradas**, tiradas do `transcript.json` corrigido (e do roteiro, se veio). Regras:

1. **Até 6 palavras**, para ler na miniatura, em 2 ou 3 linhas.
2. **Fala com quem nunca ouviu falar do assunto:** uma dor ou um desejo que a pessoa reconhece em 1 segundo.
3. **Não só informa.** Data e lugar vão no selo, nunca no título.
4. **Nunca mostra o custo antes do ganho e nunca é negativo.** A tensão pode aparecer, mas a frase aponta saída.
5. **Casa com o que o vídeo fala de fato:** quem para pela capa precisa ouvir o assunto logo no começo do vídeo.
6. **Sem promessa de resultado e sem travessão.**
7. Uma palavra forte, em **negrito** na sugestão, que sai na cor de destaque da marca. De preferência no fim da frase.

Exemplos, para um vídeo que convida para um dia inteiro de evento:
- Boa: "Um dia para olhar **seu negócio**." (aponta o ganho).
- Ruim: "Um dia inteiro parece muito?" (planta a objeção do tempo antes do ganho).
- Ruim: "Sábado, na sua cidade" (só informa; data e lugar vão no selo).
- Ruim: "Você paga o imposto certo?" num vídeo que não fala de imposto.

## O selo (opcional)

Abaixo do título, com o logo do `marca.json` (ou o nome do negócio, se não houver logo) e, se o dono quiser, um texto curto de até 32 letras, como a data e o lugar do evento ("24/10 · Centro"). Pergunte só em vídeo de evento ou lançamento; no resto, sem selo.

## Como fazer

Na pasta do vídeo, depois do prefixo `eval`:

1. **Os quadros:** `node "${CLAUDE_PLUGIN_ROOT}/scripts/capa-perfil.mjs" quadros .` Ele usa o `original` da pasta (o vídeo do dono em resolução cheia, sem legenda), só dos trechos que ficaram na edição, acha o rosto em 24 quadros e guarda os 6 com o rosto maior, com a folha `capa-perfil/candidatos.jpg` (de 1 a 6, da esquerda para a direita, de cima para baixo). Se o dono mandou um vídeo de maior resolução que o original da pasta, passe o caminho dele depois do ponto.
2. **Olhe a folha** e escolha o quadro com os olhos abertos, expressão natural e boca fechada ou sorrindo. Se nenhum servir, rode de novo numa janela do vídeo (`--de 12 --ate 20`, em segundos do original). Mostre ao dono o quadro escolhido junto com o título.
3. **O pedido da capa:** grave o `capa-perfil.json` na pasta do vídeo:

       { "quadro": 4, "titulo": "Um dia para olhar *seu negócio.*", "selo": "24/10 · Centro" }

   `titulo`: uma palavra forte entre asteriscos, até 6 palavras. `selo`: o texto do selo, `true` para só o logo ou o nome, ou sem o campo para não ter selo. A marca vem do `escolhas.json` do vídeo (ou de `../marca.json`); a fonte dos títulos já está em `fonts/` desde a edição.
4. **A capa:** `node "${CLAUDE_PLUGIN_ROOT}/scripts/capa-perfil.mjs" montar .` Ela sai em 1080x1920, com o rosto em close no alto, o título grande com a palavra forte na cor de destaque, o selo e um degradê escuro embaixo, tudo dentro da faixa 3:4 do meio (y de 240 a 1680), que é o que a grade mostra. Grava também a prévia desse corte 3:4.
5. **A conferência é automática:** tamanho das duas imagens, título e selo dentro do 3:4, rosto dentro do 3:4 e livre do título, título em até 3 linhas, a fonte da marca carregada e nenhum travessão. Com `CAPA REPROVADA`, corrija (outro quadro, título mais curto) e rode de novo. Com `CAPA OK`, as duas imagens já estão em `Documentos/Editor Chefe/prontos/`, com o nome do vídeo e o final `-capa.jpg` e `-capa-grade.jpg`.
6. **Olhe as duas imagens** antes de mostrar ao dono. Ajuste pelo que ele disser e rode o passo 4 de novo.

**Se o script der erro** (não o `CAPA REPROVADA`, mas um erro que impede a capa de sair, como o navegador do render que não abre): o vídeo já está entregue e continua valendo. Diga ao dono, numa frase, que a capa do perfil não saiu neste computador e que o vídeo está pronto do mesmo jeito; entregue o bloco de "Quando algo falha" da SKILL com a etapa `capa do perfil`, e encerre a entrega normalmente. Não tente outro caminho para gerar a imagem.

## Na entrega

Diga onde estão as duas imagens e como pôr a capa no Instagram:

- **Ao postar:** na tela de edição do Reel, toque em Capa (ou Editar capa), depois em Adicionar da galeria, e escolha a `-capa.jpg`.
- **Reel já publicado:** abra o Reel, toque nos três pontinhos, Editar, Editar capa, Adicionar da galeria, e escolha a `-capa.jpg`.

A `-capa-grade.jpg` é só para ele ver como fica na grade do perfil; a que sobe é a `-capa.jpg`.
