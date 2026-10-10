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
if acha -f tests/.proibidos; then echo "nome proibido"; exit 1; fi
if acha $'\xe2\x80\x94|\xe2\x80\x93'; then echo "travessão"; exit 1; fi # travessões em bytes, para este arquivo não achar a si mesmo
[ ! -d plugins/editor-chefe/bin ]
[ ! -e plugins/editor-chefe/hooks ] # sem gancho de sessão: o PATH do usuário só muda com o prefixo eval
echo OK
