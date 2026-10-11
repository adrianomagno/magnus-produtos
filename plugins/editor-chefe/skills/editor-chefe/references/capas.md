# Gancho de capa

Opcional. É uma frase curta escrita na tela nos primeiros 3 segundos do vídeo, por cima da imagem, que prende quem está rolando o feed. Vale para os estilos de edição de 1 a 5: a capa fica numa camada por cima de tudo e o estilo escolhido continua igual por baixo. A Caixinha de pergunta (estilo 6) não leva gancho de capa: a caixinha já é a capa, e o `montar.mjs` recusa o campo `capa` nesse estilo.

## Quando perguntar

Logo depois que o dono escolheu o estilo, antes da marca, como manda o passo 3 da SKILL: no estilo 6 (Caixinha de pergunta), não pergunte, a caixinha já é a capa; se ele já pediu capa ou o texto do gancho já veio no pedido, não pergunte se ele quer capa, só qual capa. Nos outros casos, pergunte, numa frase: "Quer um gancho de capa nos primeiros segundos?". Se ele disser que não, siga como sempre: o `escolhas.json` fica sem o campo `capa`.

## As três capas

Mostre o link da seção de capas da galeria (o endereço base está em `entrega.md`): https://adrianomagno.github.io/magnus-produtos/galeria/#capas. Junto com o link, mostre esta lista numerada, e o dono escolhe pelo número:

1. Faixa (`faixa`): tarja na cor de destaque no topo, frase em letras maiúsculas, o vídeo logo abaixo.
2. Manchete (`manchete`): frase grande sobre o vídeo, abaixo do rosto, com o fundo escurecido por baixo.
3. Editorial (`editorial`): fundo clareado embaixo, frase com a palavra forte em itálico.

## O texto do gancho, nesta ordem

1. **Veio no pedido:** o dono escreveu, ou o Magnus dele mandou junto. Use esse texto (se passar de 8 palavras, veja "Até 8 palavras" abaixo).
2. **Não veio:** pergunte se ele já tem o gancho: "Você já tem o texto do gancho? Se tiver, cole aqui."
3. **Não tem:** no passo da capa, só diga ao dono, em palavras simples, que você vai ouvir o vídeo primeiro e depois mostra 3 sugestões de gancho. A fala só existe depois dos passos 1 e 2 de `audio-e-corte.md` (fonte de trabalho e transcrição, já corrigida), então faça esses dois passos e só então sugira, sempre a partir do `transcript.json` corrigido (a transcrição crua erra palavras e o erro iria para a capa). Mostre 3 ganchos numerados, e o dono escolhe pelo número ou pede ajuste. Cada sugestão tem até 8 palavras e uma palavra forte (mostre em **negrito**), com a palavra forte no fim da frase (veja "A palavra forte"). Use as palavras e as ideias que ele realmente falou; não invente promessa, número nem resultado que não está na fala.

Exemplo de sugestões, para um vídeo sobre sono e fome:

    1. Emagrecer é só **comer menos**?
    2. Dormir mal bagunça a **fome**
    3. Antes da dieta, cuide do **sono**

## Até 8 palavras

Na capa cabem até 8 palavras; passando disso, o `montar.mjs` para com erro. Se o gancho que veio (do dono ou de um roteiro) tem mais de 8, não corte sozinho em silêncio: mostre ao dono uma versão encurtada com as mesmas palavras dele (só tirar palavras, sem reescrever, sem trocar nenhuma) e use só depois do ok. Diga assim, em linguagem simples:

    O gancho tem <N> palavras e na capa cabem até 8. Esta é a versão encurtada, só com palavras do seu texto: "<versão encurtada>". Posso usar assim?

Se ele não aprovar, ele escolhe outra versão ou outro texto. Nunca mude o sentido do que ele escreveu.

## A palavra forte

Uma só, entre asteriscos: `*comer menos*`. Pode ser uma palavra ou duas seguidas. Ela ganha destaque na capa. O texto antes da palavra forte fica na primeira linha e a palavra forte (com o que vier depois) abre a segunda, a linha grande. Por isso ponha a palavra forte no fim da frase, com poucas palavras antes dela (se ela abrir a frase, o texto inteiro vai para a linha grande): tudo o que vem depois dela desce junto para a linha grande, e toda linha mais larga que a tela encolhe até caber, o que desequilibra a capa. Pontuação colada fica com a palavra: `*comer menos*?`. Se o texto veio sem a palavra forte marcada, escolha a que carrega a tensão da frase e diga qual foi ao dono, junto com o texto final.

## O campo `capa` do `escolhas.json`

Entra ao lado dos outros campos do estilo:

    {
      "estilo": "legenda-viva",
      "foco": "50% 40%",
      "capa": { "estilo": "faixa", "texto": "Emagrecer é só *comer menos*?" }
    }

- `estilo`: `faixa`, `manchete` ou `editorial`.
- `texto`: o gancho, com uma palavra forte entre asteriscos e até 8 palavras. Quebra de linha e espaços repetidos viram um espaço só.
- `queixo`: opcional, só na Manchete. É a altura do queixo no primeiro quadro, de 0 a 1920 (de cima para baixo, num quadro de 1080x1920); o padrão é 840. Veja "Conferência" abaixo.
- Sem o campo `capa`, ou com `"capa": null` ou `"capa": false`: sem capa.

Exemplo da Manchete com o `queixo` ajustado:

    "capa": { "estilo": "manchete", "texto": "Emagrecer é só *comer menos*?", "queixo": 960 }

## O que a capa faz com o vídeo

- Aparece desde o primeiro quadro e termina de sumir aos 3 segundos (a saída começa em 2,6 s; na Manchete, em 2,7 s). Por isso a edição precisa ter pelo menos 4 segundos; mais curta, o montador para dizendo que ela é curta demais para gancho de capa.
- O texto do próprio estilo (legenda, palavra, cartão) fica escondido enquanto a capa cobre a tela e volta quando ela sai.
- Os efeitos sonoros que cairiam antes do fim da capa são tirados, e um som curto de passagem toca na saída da capa. Com `"efeitos": false`, não há som nenhum.
- Faixa: o quadro inteiro desce a altura da tarja durante a capa. Nada do quadro fica sob a tarja, mas a parte de baixo é cortada por 3 segundos.
- A cor de destaque da marca é ajustada sozinha quando não dá contraste suficiente para ler (mínimo de 4,6 para 1), então na capa ela pode sair um pouco mais escura ou mais clara que a da marca.

## Fontes

Todas as capas usam a fonte dos títulos (`fontes.titulo`, peso 800). A Editorial pede também a fonte de destaque (`fontes.destaque`, em itálico). Baixe antes de montar, como em `marca.md`, dentro da pasta `fonts/` do vídeo:

    node "${CLAUDE_PLUGIN_ROOT}/scripts/baixar-fonte.mjs" "<Família de destaque>" "400" "<pasta do vídeo>/fonts"

O script baixa o normal e o itálico do peso pedido. Sem esse arquivo, o `montar.mjs` para com a mensagem de fonte faltando.

## Conferência

1. Monte (`node "${CLAUDE_PLUGIN_ROOT}/scripts/montar.mjs" .`). Se o montador reclamar do texto (palavra forte, mais de 8 palavras, estilo que não existe) ou de a edição ser curta demais, ajuste o `escolhas.json` e monte de novo.
2. Olhe o primeiro quadro: `hf snapshot . --at 0` grava a imagem na pasta `snapshots/` do vídeo. Confira se o texto não cobre a boca nem o rosto.
3. Na Manchete, se o texto cobrir a boca, estime pela imagem a altura do queixo (a imagem tem 1080x1920; conte de cima para baixo), ponha em `"queixo"` e monte de novo. O texto passa a começar 160 pontos abaixo do queixo, nunca acima de 1000. Com o queixo depois de 1000, o montador para: o texto cairia embaixo dos botões do Instagram, o rosto está baixo demais para a Manchete; ofereça a Faixa ou a Editorial.
4. Na Faixa o quadro inteiro desce a altura da tarja: confira que a boca e o queixo continuam dentro do quadro depois da descida; se saírem, diga ao dono e ofereça trocar de capa. Na Editorial o texto tem posição fixa: se cobrir a boca, diga ao dono e ofereça trocar de capa.
5. Com capa, a imagem de 2 s mostra a capa e não o enquadramento do estilo. Para conferir o enquadramento do estilo (o `"foco"`, como mandam os arquivos de estilo), olhe depois da capa: `hf snapshot . --at 3.5`, e não `--at 2`.

A prévia dos primeiros 10 segundos já sai com a capa; mostre-a ao dono olhando primeiro os 3 segundos da capa. Ajuste o texto ou troque de capa pelo que ele disser. O vídeo inteiro só sai com o ok dele.
