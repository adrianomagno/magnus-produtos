#!/usr/bin/env bash
# tests/test_ambiente.sh
set -euo pipefail
A="$(dirname "$0")/../plugins/editor-chefe/scripts/ambiente.sh"
D="$(mktemp -d)"; trap 'rm -rf "$D"' EXIT; bash "$(dirname "$0")/../plugins/editor-chefe/scripts/preparar.sh" "$D" >/dev/null
out="$(bash "$A" "$D")"
echo "$out" | grep -q "HYPERFRAMES_NO_TELEMETRY=1"
( eval "$out"; node -v | grep -qx v22.23.3; ffprobe -version >/dev/null; [ -x "$HYPERFRAMES_FFMPEG_PATH" ]
  [ "$(command -v node)" = "$D/node/bin/node" ]
  [ "$(command -v ffprobe)" = "$D/ffmpeg/ffprobe" ]
  [ -x "$HYPERFRAMES_FFPROBE_PATH" ]
  [ "$(command -v hf)" = "$(cd "$(dirname "$A")" && pwd)/hf" ] )
# sem argumento, usa CLAUDE_PLUGIN_DATA e só imprime
[ "$(CLAUDE_PLUGIN_DATA="$D" bash "$A")" = "$out" ]
echo OK
