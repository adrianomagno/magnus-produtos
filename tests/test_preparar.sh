#!/usr/bin/env bash
# tests/test_preparar.sh
set -euo pipefail
S="$(dirname "$0")/../plugins/editor-chefe/scripts/preparar.sh"
p() { PREPARAR_UNAME_S="$1" PREPARAR_UNAME_M="$2" PREPARAR_SO_PLATAFORMA=1 bash "$S" /tmp/x; }
[ "$(p Darwin arm64)" = darwin-arm64 ]
[ "$(p Darwin x86_64)" = darwin-x64 ]
[ "$(p MINGW64_NT-10.0 x86_64)" = win32-x64 ]
if p Linux x86_64 2>/dev/null; then echo "Linux deveria ser recusado"; exit 1; fi
# instalação real nesta máquina, numa pasta temporária
D="$(mktemp -d)"
bash "$S" "$D"
"$D/node/bin/node" -v | grep -qx v22.23.3
"$D/ffmpeg/ffmpeg" -version | head -1 | grep -q "ffmpeg version"
# idempotente: segunda vez não baixa de novo e termina rápido
t0=$(date +%s); bash "$S" "$D"; t1=$(date +%s); [ $((t1-t0)) -lt 5 ]
# checksum errado é recusado
D2="$(mktemp -d)"; if PREPARAR_SHA_NODE_FORCADO=000 bash "$S" "$D2" 2>/dev/null; then echo "checksum errado passou"; exit 1; fi
echo OK
