# Novidades do Editor Chefe

A versão mais nova fica no alto. Datas no formato ano-mês-dia.

## 0.9.3 (teste, 2026-11-08)

- **Título do cartão no ritmo da fala.** Nos estilos 4 (Painel escuro), 5 (Editorial claro), 7 (Painel escuro dividido), 8 (Editorial claro dividido) e 9 (Motion dividido, no título da ideia), o título entra inteiro, apagado, e cada palavra acende e sobe um pouco no instante em que é dita, pelos tempos que o Editor Chefe já tem da fala. Palavra dita antes de o cartão entrar acende junto com ele; palavra que não está na fala acende junto com a anterior, então um título que não é literal sai inteiro, como antes.
- **Marca-texto na palavra forte.** A palavra entre asteriscos do título ganha o marca-texto, desenhado da esquerda para a direita no instante em que é dita: uma faixa forte na cor de destaque (puxada para o fundo do cartão só o necessário) e a letra por cima no claro ou no escuro da marca, com pelo menos 4,5:1 de contraste, no fundo claro, no escuro e no painel branco.
- **Estilo 8: os cartões mostram a fala inteira e a legenda sai.** No Editorial claro dividido o montador põe toda a fala da edição em cartões, em sequência: os cartões do dono valem no trecho deles e o resto vira fala literal, quebrada no fim da frase, na pausa e no tamanho (até 40 letras, 3 linhas de 84 px). Com o título acendendo palavra por palavra, a legenda repetia o texto e saiu; `"legenda": "corrida"` (sem caixa, dentro do vídeo) ou `"legenda": "palavra"` (a aba clara da emenda) trazem de volta. A troca de cartão é seca (sai em 0,12 s, entra em 0,18 s), sem numeração, e só os cartões do dono têm o som de entrada.
- **Quebra dos cartões automáticos sem palavra fraca.** O cartão de fala literal nunca termina em artigo, preposição, conjunção ou pronome átono ("a", "de", "no", "para", "que", "te" e outros). A quebra prefere a vírgula, depois a pausa e depois o lugar antes de uma preposição ou conjunção, com até 44 letras por cartão. Quando a frase continua num cartão do dono, a palavra fraca passa para a frente dele ("para solicitar" e "a isenção do imposto de renda...").
- **Conferência da cobertura.** No estilo 8, o `conferir.mjs` mede a porcentagem das palavras faladas da edição que aparecem nos cartões (meta 100%) e o maior tempo sem texto na tela (máximo 0,6 s), e reprova fora disso. Mede também, no vídeo pronto, a altura de cada cartão na faixa de cima e reprova cartão com mais de 3 linhas ou fora da faixa de 236 a 680 px.
- **Risco, só quando o cartão pede.** Com `"risco": true` no cartão, a palavra forte é riscada no lugar do marca-texto. O Editor Chefe nunca escolhe o risco sozinho. Na Papelaria o campo não vale: ela já risca os itens da lista com `"marca": "risco"`.
- **A letra não diminui.** Os cartões continuam com o tamanho de sempre (84 px no Editorial claro e no dividido, 88 px no Painel escuro, de 120 a 88 px no dividido) e nenhuma faixa nova entra na tela.
- **Fora desta versão:** etiquetas, checks, documento com carimbo e número vivo do teste do bang-motion. A Papelaria (12) fica como era: o título dela já é escrito à mão da esquerda para a direita.
- **Licença:** o marca-texto, o risco e a palavra que acende são adaptados do bang-motion (MIT License, Copyright (c) 2026 Bang Tutorial); o aviso e o texto da licença ficam no trecho adaptado do `estilos/comum.js` e no NOTICE do repositório.

## Versões anteriores

- **0.9.2** (2026-11-06): rosto no terço de cima, tela dividida 40/60 e capa do perfil com o ângulo bonito.
- **0.9.1** (2026-10-30): banco central de peças ligado, lido pelo commit fixo e conferido pelo SHA-256.
- **0.9.0** (2026-10-29): estilos Destaques tipográficos e Papelaria, peças em duas famílias, 24 logos de aplicativo e banco de peças que se alimenta sozinho.
- **0.8.2** (2026-10-27): o vídeo termina sem quadro vazio e o áudio não trava com a máquina carregada.
- **0.8.1** (2026-10-24): nenhum quadro sem vídeo nas emendas.
- **0.8.0** (2026-10-24): corte fino com a melhor tomada, efeitos sonoros CC0, aviso de dado pessoal na tela e mesmo estilo do último vídeo.
- **0.7.0** (2026-10-22): capa do perfil com gancho para a grade do Instagram.
- **0.6.1** (2026-10-19): aproximação no rosto nas frases de ênfase e visuais de cor fortes.
- **0.6.0** (2026-10-19): enquadramento que segue o rosto, limpeza de ruído, visuais de cor e conferência automática.
- **0.5.2** (2026-10-16): sem regras de proibição de voz, música ou imagem.
- **0.5.1** (2026-10-16): preparar com autoteste, roteiro como referência e README em 6 passos.
- **0.5.0** (2026-10-16): catálogo único dos estilos e das capas e confirmação do pedido preenchido.
- **0.4.0** (2026-10-15): estilo 10, Motion narrado.
- **0.3.2** (2026-10-12): caminho da pasta de dados no Windows.
- **0.3.1** (2026-10-12): legenda opaca no Painel escuro.
- **0.3.0** (2026-10-12): estilos de tela dividida e roteiro com trecho e tipo de vídeo.
- **0.2.1** (2026-10-12): capa sem cópia repetida quando o primeiro trecho é curto.
- **0.2.0** (2026-10-11): gancho de capa (Faixa, Manchete, Editorial) e o estilo Caixinha de pergunta.
- **0.1.0** (2026-10-10).
