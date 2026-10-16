# Produtos MAGNUS para o Claude

Este repositório é o marketplace de plugins `magnus`, com os produtos do programa MAGNUS para o app Claude. Hoje ele tem dois produtos: o Editor Chefe e o Copywriter MHL.

## Editor Chefe

O Editor Chefe edita vídeos curtos de quem tem um negócio: corta as pausas, legenda as falas, aplica o estilo que você escolher com a identidade visual do seu negócio e entrega o vídeo vertical em MP4.

- **Onde roda:** no seu computador, pelo app Claude, na aba Code, numa conversa local.
- **Privacidade:** o vídeo não vai para o servidor MAGNUS; o Claude lê o texto da fala e alguns quadros para conferir o enquadramento.
- **Estilos:** veja a galeria em https://adrianomagno.github.io/magnus-produtos/galeria/
- **Lista atual dos estilos e das capas:** o catálogo, em `plugins/editor-chefe/skills/editor-chefe/references/catalogo.md` (no GitHub: https://github.com/adrianomagno/magnus-produtos/blob/main/plugins/editor-chefe/skills/editor-chefe/references/catalogo.md).
- **Requisitos:** cerca de 5 GB livres na primeira instalação. Ele baixa o Node.js e o FFmpeg portáteis (sem pedir senha de administrador), a HyperFrames, o Chrome que ela usa e o modelo de transcrição Parakeet; precisa de internet durante a instalação e em cada render.

## Copywriter MHL

A skill de copy do aluno da Mentoria High Level: roteiros de Reels, carrosséis, posts e caixinhas de pergunta, escritos a partir do Raio-X 7Ps e do Mapa 3D do próprio aluno.

- **Fonte:** o repositório https://github.com/adrianomagno/mhl-copywriter, numa versão fixa. O catálogo só aponta para ele.
- **O que vem no plugin:** só o método. O Raio-X 7Ps, o Mapa 3D e o perfil de cada aluno ficam com o aluno e nunca entram aqui.
- **Instalação e atualização:** para quem é aluno MHL e cliente MAGNUS, o Magnus instala e atualiza. Quem usa só o claude.ai instala pelo ZIP do repositório.

## Instalação

Numa conversa local da aba Code do app Claude, cole esta frase:

> Instale o Editor Chefe: adicione o marketplace https://github.com/adrianomagno/magnus-produtos e instale os plugins hyperframes@magnus e editor-chefe@magnus. Depois me diga quando abrir uma conversa nova.

Clientes MAGNUS recebem esta frase do Magnus deles. No terminal, são os comandos `claude plugin marketplace add https://github.com/adrianomagno/magnus-produtos`, `claude plugin install hyperframes@magnus` e `claude plugin install editor-chefe@magnus`.

O plugin `hyperframes` é a HyperFrames, da HeyGen (licença Apache-2.0), o motor de vídeo que o Editor Chefe usa. O marketplace instala essa HyperFrames direto do repositório oficial dela, numa versão fixa.

## Atualização

Quando sai uma versão nova, o Magnus manda esta frase aos clientes MAGNUS. Cole numa conversa local da aba Code:

> Atualize o Editor Chefe: atualize o marketplace magnus e os plugins hyperframes@magnus e editor-chefe@magnus. Depois me diga quando abrir uma conversa nova.

No terminal, são os comandos `claude plugin marketplace update magnus`, `claude plugin update hyperframes@magnus` e `claude plugin update editor-chefe@magnus`. A versão nova vale a partir da próxima conversa.

## Licença

Todos os direitos reservados, veja [LICENSE](LICENSE). Componentes de terceiros e as licenças deles: [NOTICE](NOTICE).
