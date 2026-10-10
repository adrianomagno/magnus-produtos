#!/usr/bin/env bash
# Imprime o ambiente do Editor Chefe; use como prefixo: eval "$(bash ambiente.sh <pasta de dados>)";
# Não depende de as pastas já existirem: o PATH é resolvido na hora de cada comando, então vale também
# logo depois do preparar.sh. A pasta deste script entra no PATH para o comando hf.
# Sem gancho de sessão de propósito: nada muda o PATH de outras conversas nem de outros projetos do usuário.
set -euo pipefail
DATA="${1:-${CLAUDE_PLUGIN_DATA:?}}"
SCRIPTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXT=""; case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) EXT=".exe" ;; esac
echo "export PATH=\"$SCRIPTS:$DATA/node/bin:$DATA/node:$DATA/ffmpeg:\$PATH\"
export HYPERFRAMES_FFMPEG_PATH=\"$DATA/ffmpeg/ffmpeg$EXT\"
export HYPERFRAMES_FFPROBE_PATH=\"$DATA/ffmpeg/ffprobe$EXT\"
export HYPERFRAMES_NO_TELEMETRY=1
export EDITOR_CHEFE_DATA=\"$DATA\""
