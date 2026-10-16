# Produtos MAGNUS para o Claude

Este repositório é o marketplace de plugins `magnus`, com os produtos do programa MAGNUS para o app Claude. Hoje ele tem dois produtos: o Editor Chefe e o Copywriter MHL.

## Editor Chefe

O Editor Chefe edita vídeos curtos de quem tem um negócio: corta as pausas, legenda as falas, aplica o estilo que você escolher com a identidade visual do seu negócio e entrega o vídeo vertical em MP4.

- **Onde roda:** no seu computador, pelo app Claude, na aba Code, numa conversa local.
- **Privacidade:** o vídeo não vai para o servidor MAGNUS; o Claude lê o texto da fala e alguns quadros para conferir o enquadramento.
- **Estilos:** veja a galeria em https://adrianomagno.github.io/magnus-produtos/galeria/
- **Lista atual dos estilos e das capas:** o catálogo, em `plugins/editor-chefe/skills/editor-chefe/references/catalogo.md` (no GitHub: https://github.com/adrianomagno/magnus-produtos/blob/main/plugins/editor-chefe/skills/editor-chefe/references/catalogo.md).
- **Requisitos:** cerca de 5 GB livres na primeira instalação. Ele baixa o Node.js e o FFmpeg portáteis (sem pedir senha de administrador), a HyperFrames, o Chrome que ela usa e o modelo de transcrição Parakeet; precisa de internet durante a instalação e em cada render.
- **Motor de vídeo:** o plugin `hyperframes` é a HyperFrames, da HeyGen (licença Apache-2.0). O marketplace instala essa HyperFrames direto do repositório oficial dela, numa versão fixa.

## Copywriter MHL

A skill de copy do aluno da Mentoria High Level: roteiros de Reels, carrosséis, posts e caixinhas de pergunta, escritos a partir do Raio-X 7Ps e do Mapa 3D do próprio aluno.

- **Fonte:** o repositório https://github.com/adrianomagno/mhl-copywriter, numa versão fixa. O catálogo só aponta para ele.
- **O que vem no plugin:** só o método. O Raio-X 7Ps, o Mapa 3D e o perfil de cada aluno ficam com o aluno e nunca entram aqui.
- **Instalação e atualização:** para quem é aluno MHL e cliente MAGNUS, o Magnus instala e atualiza. Quem usa só o claude.ai instala pelo ZIP do repositório.

## Como usar com o seu MAGNUS

São duas conversas no app Claude, aba Code:
- **MAGNUS** (no servidor): você pede o vídeo e ele prepara o pedido. Ele não edita.
- **Editor Chefe** (Local, no seu computador, pasta Documentos): edita e mostra a prévia. O arquivo de vídeo fica no seu computador; o Claude lê o texto da fala e alguns quadros para conferir a edição.

### 1. Abrir a conversa Local
Aba Code, nova sessão. Escolha **o seu computador (Local)**, não o servidor do MAGNUS, e a pasta **Documentos**. Confira colando:
> Em que pasta você está?

A resposta tem que ser a pasta Documentos do seu computador. Se aparecer `/opt/magnus` ou o servidor do MAGNUS, você está na conversa errada: abra outra, Local.

### 2. Instalar (uma vez)
Na conversa Local, cole:
> Instale o Editor Chefe: adicione o marketplace https://github.com/adrianomagno/magnus-produtos e instale os plugins hyperframes@magnus e editor-chefe@magnus. Depois me diga quando abrir uma conversa nova.

Abra outra conversa Local, em Documentos, e cole:
> Prepare o Editor Chefe neste computador. Baixe tudo o que faltar, faça o teste completo e só responda "Editor Chefe pronto" depois que o teste passar. Se falhar, me entregue o bloco de erro para a Equipe Técnica.

Leva alguns minutos; reserve cerca de 5 GB livres. Autorize só o que for do Editor Chefe (downloads e comandos dele). Nunca informe senha, chave ou acesso ao servidor. Sem "Editor Chefe pronto", não está instalado: veja o passo 6.

### 3. Pedir ao MAGNUS
Na conversa do MAGNUS:
> Prepare um pedido para o Editor Chefe. Vídeo: [nome do arquivo e pasta onde está]. Use a minha marca. Se você escreveu o roteiro deste vídeo, mande o roteiro junto. Não escolha estilo nem capa por mim.

Já sabe o estilo? Acrescente, por exemplo: "Estilo 1, capa Manchete."

### 4. Editar
Cole o pedido do MAGNUS na conversa Local do Editor Chefe. Ele confirma o pedido e pergunta o que faltar (estilo, tipo de vídeo, capa). Responda pelo número.

Sem o MAGNUS, cole direto na conversa Local:
> Edite com o Editor Chefe o vídeo que está em Downloads/meu-video.mp4

### 5. Aprovar
O Editor Chefe renderiza uma prévia de 10 segundos e mostra onde abri-la. Responda:
> Aprovado, faça o vídeo inteiro.

Ou peça o ajuste, por exemplo: "Tire os 3 primeiros segundos." O vídeo pronto fica em Documentos, pasta Editor Chefe, dentro de "prontos".

### 6. Erro
Vale para qualquer erro: falta de espaço, sem internet, permissão negada, Git ausente no Windows ou a opção Local que não aparece. Na conversa Local:
> Escreva o bloco de erro para a Equipe Técnica.

Na conversa do MAGNUS:
> Abra um chamado com este erro: [cole o bloco]

### Sem gravação (estilo 10)
Na conversa do MAGNUS:
> Escreva um texto de 55 a 70 palavras para o estilo 10 do Editor Chefe sobre [assunto], me mostre e, com o meu ok, prepare o pedido.

Na primeira vez do estilo 10, o Editor Chefe orienta como escolher a voz da sua conta na ElevenLabs e como guardar a chave só no seu computador.

### Atualizar
Quando o MAGNUS avisar, cole numa conversa Local:
> Atualize o Editor Chefe: atualize o marketplace magnus e os plugins hyperframes@magnus e editor-chefe@magnus. Depois me diga quando abrir uma conversa nova.

Depois, numa conversa Local nova, o "Prepare o Editor Chefe" do passo 2.

**Pelo terminal (opcional):** `claude plugin marketplace add https://github.com/adrianomagno/magnus-produtos`, `claude plugin install hyperframes@magnus`, `claude plugin install editor-chefe@magnus`; para atualizar, `claude plugin marketplace update magnus`, `claude plugin update hyperframes@magnus`, `claude plugin update editor-chefe@magnus`.

## Licença

Todos os direitos reservados, veja [LICENSE](LICENSE). Componentes de terceiros e as licenças deles: [NOTICE](NOTICE).
