# A marca do negócio

Guarde a marca em `Documentos/Editor Chefe/marca.json` e reaproveite nos próximos vídeos. Ordem para descobrir:

1. **Claude Design:** liste os design systems da conta (ferramenta Artifact, `action: "list"`, `type: "Design System"`). Se a ferramenta Artifact não existir nesta conversa, ou se não houver design system do negócio, pule para o passo 2. Se houver, leia o README e os tokens (cores e fontes).
2. **Arquivo que veio com o pedido:** se o dono colou um `marca.json` junto com a frase de instalação, use.
3. **Perguntar:** o que faltar, em linguagem simples, uma pergunta por campo do esquema:
   - nome do negócio (`nome`) e a frase do rodapé (`assinatura`; se ele não tiver, use o nome);
   - as 4 cores: fundo claro (`cores.fundo_claro`), fundo escuro (`cores.fundo_escuro`), cor do texto (`cores.texto`) e cor de destaque (`cores.destaque`). Ele pode responder pelo nome da cor; converta para `#RRGGBB` e confirme com ele;
   - as 3 fontes: a dos títulos (`fontes.titulo`), a de destaque, que aparece em itálico no estilo Editorial claro (`fontes.destaque`), e a do texto corrido (`fontes.corpo`). Se ele não souber, use as do exemplo abaixo.

Esquema:

    {
      "nome": "Nome do negócio",
      "assinatura": "Texto do rodapé",
      "cores": { "fundo_claro": "#FAF8F3", "fundo_escuro": "#111111", "texto": "#111111", "destaque": "#9A6A5A" },
      "fontes": { "titulo": "Montserrat", "destaque": "Playfair Display", "corpo": "Inter" }
    }

Fontes: baixe cada família de `fontes` direto na pasta `fonts/` da pasta do vídeo, **antes** de montar: `node "${CLAUDE_PLUGIN_ROOT}/scripts/baixar-fonte.mjs" "<Família>" "400,800" "<pasta do vídeo>/fonts"`. O `montar.mjs` só lê `fonts/`: se faltar a fonte de uma família que o estilo usa, ou se o arquivo não for woff2 de verdade, ele para com erro; se faltar o peso 800 ou o itálico, usa o arquivo mais perto e avisa. Fonte que não está no Google Fonts: use a mais parecida e avise o dono.
