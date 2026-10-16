# A marca do negócio

Guarde a marca em `Documentos/Editor Chefe/marca.json` e reaproveite nos próximos vídeos. Ordem para descobrir:

1. **Claude Design:** liste os design systems da conta (ferramenta Artifact, `action: "list"`, `type: "Design System"`). Se a ferramenta Artifact não existir nesta conversa, ou se não houver design system do negócio, pule para o passo 2. Se houver, leia o README e os tokens (cores e fontes).
2. **Arquivo que veio com o pedido:** se o dono colou um `marca.json` junto com a frase de instalação, use.
3. **Perguntar:** o que faltar, em linguagem simples, uma pergunta por campo do esquema:
   - nome do negócio (`nome`) e a frase do rodapé (`assinatura`; se ele não tiver, use o nome);
   - as 4 cores: fundo claro (`cores.fundo_claro`), fundo escuro (`cores.fundo_escuro`), cor do texto (`cores.texto`) e cor de destaque (`cores.destaque`). Ele pode responder pelo nome da cor; converta para `#RRGGBB` e confirme com ele;
   - as 3 fontes: a dos títulos (`fontes.titulo`), a de destaque, que aparece em itálico no estilo Editorial claro (`fontes.destaque`), e a do texto corrido (`fontes.corpo`). Se ele não souber, use as do exemplo abaixo.
   - só no estilo Motion narrado (10), na primeira vez que o dono escolher esse estilo: a voz (`voz`) e o logo (`logo`, opcional), como manda a seção "Voz" abaixo.
   - só no estilo Caixinha de pergunta, na primeira vez que o dono escolher esse estilo: a frase da faixa escura da caixinha (`chamada_caixinha`), como "Pergunta aqui sobre emagrecimento", com até 50 caracteres. Se ela já veio no passo 3 da SKILL, não pergunte de novo. Guarde no `marca.json` e use nos próximos vídeos desse estilo sem perguntar de novo. Os outros estilos não usam esse campo.

Esquema:

    {
      "nome": "Nome do negócio",
      "assinatura": "Texto do rodapé",
      "cores": { "fundo_claro": "#FAF8F3", "fundo_escuro": "#111111", "texto": "#111111", "destaque": "#9A6A5A" },
      "fontes": { "titulo": "Montserrat", "destaque": "Playfair Display", "corpo": "Inter" },
      "chamada_caixinha": "Pergunta aqui sobre emagrecimento",
      "voz": { "elevenlabs_voice_id": "<id da voz>", "ritmo": 2.54 },
      "logo": "logo-claro.png"
    }

`chamada_caixinha` é opcional: só entra depois que o dono usou a Caixinha de pergunta. `voz` e `logo` são opcionais e só o Motion narrado usa.

Fontes: baixe cada família de `fontes` direto na pasta `fonts/` da pasta do vídeo, **antes** de montar: `node "${CLAUDE_PLUGIN_ROOT}/scripts/baixar-fonte.mjs" "<Família>" "400,800" "<pasta do vídeo>/fonts"`. O `montar.mjs` só lê `fonts/`: se faltar a fonte de uma família que o estilo usa, ou se o arquivo não for woff2 de verdade, ele para com erro; se faltar o peso 800 ou o itálico, usa o arquivo mais perto e avisa. Fonte que não está no Google Fonts: use a mais parecida e avise o dono.

## Voz (só o Motion narrado)

- **A voz:** `voz.elevenlabs_voice_id` é o ID de uma voz da conta do dono na ElevenLabs (no site, em Voices, o botão de copiar o ID da voz). Pode ser qualquer voz da conta dele, a que ele escolher. Não há voz padrão: sem esse campo, o `voz-com-tempos.mjs` para e pede.
- **O ritmo:** `voz.ritmo` (opcional) é a velocidade da fala, em palavras por segundo; o padrão é 2,54. A voz é acelerada até 10% para chegar nele, nunca desacelerada.
- **O logo:** `logo` (opcional) é o caminho de um PNG, JPG, WebP ou SVG a partir da pasta do `marca.json`, de preferência a versão clara com fundo transparente, porque o fecho fica sobre o fundo escuro. Sem logo, o fecho mostra o `nome`.
- **A chave da API** fica só no computador do dono, num arquivo que só ele lê, e **nunca** na conversa. Ele cria a chave no site da ElevenLabs (no perfil, em API Keys; se o site oferecer, só com a permissão de texto para fala) e guarda com um comando de uma linha, no Terminal do Mac ou no Git Bash do Windows (vem com o Git que o Claude Code usa); o comando chama o `bash`, então vale também no zsh, o padrão do Mac. Mande este comando a ele com a pasta de dados escrita por extenso no lugar de CLAUDE_PLUGIN_DATA entre chaves, porque o Terminal dele não conhece essa variável (no Windows, com barras normais, como `C:/Users/...`):

      bash -c 'read -rsp "Chave da ElevenLabs (não aparece na tela): " K; echo; umask 077; printf %s "$K" > "$1"; chmod 600 "$1"' _ "${CLAUDE_PLUGIN_DATA}/chave-elevenlabs"

  Ele cola a chave quando o Terminal pedir (ela não aparece enquanto ele cola) e tecla Enter. O `voz-com-tempos.mjs` lê a chave desse arquivo, ou da variável `ELEVENLABS_API_KEY`, se ela existir. Se o dono colar a chave na conversa, peça a ele que apague essa chave no site da ElevenLabs, crie outra e guarde pelo comando.
