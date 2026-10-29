#!/usr/bin/env bash
# tests/test_estrutura.sh: o marketplace e o plugin passam na validação e não levam nada proibido
# A lista de nomes proibidos fica em tests/.proibidos (uma expressão por linha), fora do git.
# Obs.: em bash, "! cmd" não dispara o set -e; por isso as negações usam if.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f tests/.proibidos ] || { echo "falta tests/.proibidos (uma expressão por linha com os nomes que não podem ir para o repositório)"; exit 1; }
claude plugin validate .
claude plugin validate plugins/editor-chefe
# git grep nos arquivos rastreados: 0 = achou, 1 = nada, 2 ou mais = erro (falha o teste)
acha() { local s=0; git grep -nIE "$@" || s=$?; case $s in 0) return 0 ;; 1) return 1 ;; *) echo "git grep falhou ($s)"; exit 2 ;; esac; }
# Só nos arquivos do Editor Chefe: o marketplace é compartilhado e outros produtos levam esses nomes de propósito
if acha -f tests/.proibidos -- plugins/editor-chefe tests; then echo "nome proibido"; exit 1; fi
if acha $'\xe2\x80\x94|\xe2\x80\x93'; then echo "travessão"; exit 1; fi
# Snapshot da HyperFrames sem --describe false manda quadros do vídeo ao Gemini quando há chave do Google no ambiente
if git grep -hoIE 'hf snapshot[^`]*' -- plugins/editor-chefe | grep -v -- '--describe false'; then echo "hf snapshot sem --describe false"; exit 1; fi # travessões em bytes, para este arquivo não achar a si mesmo
[ ! -d plugins/editor-chefe/bin ]
[ ! -e plugins/editor-chefe/hooks ] # sem gancho de sessão: o PATH do usuário só muda com o prefixo eval
# Catálogo único dos estilos: cada estilo tem a referência e o molde, a lista bate com os arquivos e a SKILL não guarda lista própria
SK=plugins/editor-chefe/skills/editor-chefe
CAT=$SK/references/catalogo.md
[ -f "$CAT" ] || { echo "falta $CAT"; exit 1; }
PARES=$(awk '/^## Estilos/{d=1;next} /^## /{d=0} d' "$CAT" | sed -nE 's/^([0-9]+)\. \*\*[^*]+\*\* \(`([a-z0-9-]+)`\).*/\1:\2/p')
[ "$(printf '%s\n' "$PARES" | cut -d: -f1 | paste -sd, -)" = "1,2,3,4,5,6,7,8,9,10,11,12" ] || { echo "catálogo: os estilos precisam ser os números de 1 a 12, em ordem"; exit 1; }
for id in $(printf '%s\n' "$PARES" | cut -d: -f2); do
  { [ -f "$SK/references/estilos/$id.md" ] && [ -f "plugins/editor-chefe/estilos/$id.html" ]; } || { echo "catálogo: falta a referência ou o molde de $id"; exit 1; }
done
[ "$(printf '%s\n' "$PARES" | cut -d: -f2 | sort)" = "$(cd $SK/references/estilos && ls *.md | sed 's/\.md$//' | sort)" ] || { echo "catálogo: a lista não bate com os arquivos de references/estilos"; exit 1; }
grep -q 'references/catalogo.md' $SK/SKILL.md || { echo "a SKILL precisa citar references/catalogo.md"; exit 1; }
if grep -qE '^[[:space:]]*[0-9]+\. .*\(`[a-z-]+`\)' $SK/SKILL.md; then echo "a SKILL ainda tem lista própria de estilos ou de capas"; exit 1; fi
# Capas: o capas.md cita o catálogo e tem os ids das capas da seção "## Capas" dele
IDCAPAS=$(awk '/^## Capas/{d=1;next} /^## /{d=0} d' "$CAT" | sed -nE 's/^[0-9]+\. \*\*[^*]+\*\* \(`([a-z0-9-]+)`\).*/\1/p')
[ -n "$IDCAPAS" ] || { echo "catálogo: a seção Capas está vazia"; exit 1; }
grep -q 'catalogo.md' $SK/references/capas.md || { echo "o capas.md precisa citar o catálogo"; exit 1; }
for id in $IDCAPAS; do grep -q "\`$id\`" $SK/references/capas.md || { echo "capas.md: falta a capa $id"; exit 1; }; done
echo OK
