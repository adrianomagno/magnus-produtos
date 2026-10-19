#!/usr/bin/env bash
# Instala Node 22 e ffmpeg portáteis em DATA, sem administrador e sem mexer no PATH do sistema, e o detector de rosto
# (YuNet no ONNX Runtime Web, em DATA/rosto). Idempotente: se DATA/.versao e DATA/rosto/.versao batem, não faz nada.
set -euo pipefail
DATA="${1:?uso: preparar.sh <pasta de dados do plugin>}"
command -v cygpath >/dev/null && DATA="$(cygpath -u "$DATA")" # Windows: C:\Users\... vira /c/Users/...
NODE_VER="22.23.3"
FF_TAG="b6.1.1"
VERSAO="node=$NODE_VER ffmpeg=$FF_TAG"
# Detector de rosto: 3 arquivos do pacote onnxruntime-web (licença MIT) e o modelo YuNet de 2026-05 (licença MIT, OpenCV Zoo)
ORT_VER="1.30.0"; ORT_SHA=d2228df7e4616bc3348bf504ee888f3bec43789a273f0a63f3e68d203ce3bf71
YUNET_COMMIT="47534e27c9851bb1128ccc0102f1145e27f23f98"; YUNET_SHA=ebafce4e3c118d6554634be5c27ab333b4c047a9a8c3faf1d7cf93101c22f0f0
ROSTO_VERSAO="ort=$ORT_VER yunet=$YUNET_COMMIT"

plataforma() {
  local s="${PREPARAR_UNAME_S:-$(uname -s)}" m="${PREPARAR_UNAME_M:-$(uname -m)}"
  case "$s" in
    Darwin) case "$m" in arm64) echo darwin-arm64 ;; x86_64) echo darwin-x64 ;; *) return 1 ;; esac ;;
    MINGW*|MSYS*|CYGWIN*) echo win32-x64 ;;
    *) return 1 ;;
  esac
}
PLAT="$(plataforma)" || { echo "Editor Chefe: este computador não é Mac nem Windows 64 bits." >&2; exit 1; }
[ "${PREPARAR_SO_PLATAFORMA:-}" = 1 ] && { echo "$PLAT"; exit 0; }

FERRAMENTAS=1; [ "$(cat "$DATA/.versao" 2>/dev/null)" = "$VERSAO" ] && FERRAMENTAS=0
ROSTO=1; [ "$(cat "$DATA/rosto/.versao" 2>/dev/null)" = "$ROSTO_VERSAO" ] && ROSTO=0
[ "$FERRAMENTAS$ROSTO" = 00 ] && exit 0

case "$PLAT" in
  darwin-arm64) NODE_ARQ="node-v$NODE_VER-darwin-arm64.tar.gz"; NODE_SHA=23b25245dcfb9af7262f8ff142e9e2e0af025368117329e7a7458a51e5922f53
                FF_SHA=a90e3db6a3fd35f6074b013f948b1aa45b31c6375489d39e572bea3f18336584; FP_SHA=bb2db6f5d8cef919da12fbf592119a987202a8c060a886f3cab091f9cab90b64; EXT="" ;;
  darwin-x64)   NODE_ARQ="node-v$NODE_VER-darwin-x64.tar.gz";   NODE_SHA=8a677b0219178efd6eb0e475457c4afb452b521a92f6e67845a73bd85727f2a8
                FF_SHA=ebdddc936f61e14049a2d4b549a412b8a40deeff6540e58a9f2a2da9e6b18894; FP_SHA=fa3add0ce901f7241abe0dfc0155d958fc834aca3f8ce61f87cc712ae669c1e0; EXT="" ;;
  win32-x64)    NODE_ARQ="node-v$NODE_VER-win-x64.zip";          NODE_SHA=2b0ff57b049cda1bbcea2240eec20467018713c1efe1f7360c2681859b90ed71
                FF_SHA=04e1307997530f9cf2fe35cba2ca7e8875ca91da02f89d6c7243df819c94ad00; FP_SHA=3a7e2dc003dc2cd1472827e4c7c4f056ae1ae0ae7c5bbc580c99b49827351ba4; EXT=".exe" ;;
esac
NODE_SHA="${PREPARAR_SHA_NODE_FORCADO:-$NODE_SHA}"

sha256() { if command -v sha256sum >/dev/null; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi; }
baixar() { # url destino sha
  curl -fsSL --connect-timeout 20 --retry 3 --retry-all-errors -o "$2" "$1" || { echo "Editor Chefe: não consegui baixar $1. Confira a internet." >&2; exit 1; }
  [ "$(sha256 "$2")" = "$3" ] || { rm -f "$2"; echo "Editor Chefe: o arquivo baixado não confere ($1). Nada foi instalado." >&2; exit 1; }
}
extrair_zip() { # zip destino
  if command -v unzip >/dev/null; then unzip -q "$1" -d "$2"; else "$(cygpath -u "$SYSTEMROOT")/System32/tar.exe" -xf "$(cygpath -w "$1")" -C "$(cygpath -w "$2")"; fi
}

echo "Editor Chefe: baixando as ferramentas, só na primeira vez, alguns minutos."
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
mkdir -p "$DATA"

if [ "$ROSTO" = 1 ]; then
  rm -rf "$DATA/rosto"; mkdir -p "$TMP/r" "$TMP/rosto"
  baixar "https://registry.npmjs.org/onnxruntime-web/-/onnxruntime-web-$ORT_VER.tgz" "$TMP/ort.tgz" "$ORT_SHA"
  for a in ort.wasm.bundle.min.mjs ort-wasm-simd-threaded.mjs ort-wasm-simd-threaded.wasm; do tar -xzf "$TMP/ort.tgz" -C "$TMP/r" "package/dist/$a"; mv "$TMP/r/package/dist/$a" "$TMP/rosto/"; done
  baixar "https://media.githubusercontent.com/media/opencv/opencv_zoo/$YUNET_COMMIT/models/face_detection_yunet/face_detection_yunet_2026may.onnx" "$TMP/rosto/yunet.onnx" "$YUNET_SHA"
  echo "$ROSTO_VERSAO" > "$TMP/rosto/.versao"
  mv "$TMP/rosto" "$DATA/rosto"
fi
[ "$FERRAMENTAS" = 0 ] && { echo "Editor Chefe: detector de rosto pronto."; exit 0; }

baixar "https://nodejs.org/dist/v$NODE_VER/$NODE_ARQ" "$TMP/$NODE_ARQ" "$NODE_SHA"
rm -rf "$DATA/node"; mkdir -p "$TMP/n"
case "$NODE_ARQ" in *.zip) extrair_zip "$TMP/$NODE_ARQ" "$TMP/n" ;; *) tar -xzf "$TMP/$NODE_ARQ" -C "$TMP/n" ;; esac
mv "$TMP/n/${NODE_ARQ%.tar.gz}" "$DATA/node" 2>/dev/null || mv "$TMP/n/${NODE_ARQ%.zip}" "$DATA/node"

mkdir -p "$DATA/ffmpeg"
FFB="https://github.com/eugeneware/ffmpeg-static/releases/download/$FF_TAG"
baixar "$FFB/ffmpeg-$PLAT" "$DATA/ffmpeg/ffmpeg$EXT" "$FF_SHA"
baixar "$FFB/ffprobe-$PLAT" "$DATA/ffmpeg/ffprobe$EXT" "$FP_SHA"
chmod +x "$DATA/ffmpeg/ffmpeg$EXT" "$DATA/ffmpeg/ffprobe$EXT"

echo "$VERSAO" > "$DATA/.versao"
echo "Editor Chefe: ferramentas prontas."
