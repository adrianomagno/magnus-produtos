// Mede as pausas do vídeo original e diz quais trechos ficam na edição.
// Uso: node trechos.mjs <vídeo original> ["início-fim,início-fim" cortes extras, em segundos] > trechos.json
// Pausa: mais de 0,6 s abaixo de (volume integrado da fala - 18 dB); ficam 0,08 s de folga antes e depois da fala.
import { execFileSync, spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FOLGA = 0.08, PAUSA = 0.6;

export function trechos(orig, extras = "") {
  const pedidos = extras.split(",").map((c) => c.trim()).filter(Boolean).map((c) => {
    const [a, b] = c.split("-").map(Number);
    if (!/^\d+(\.\d+)?-\d+(\.\d+)?$/.test(c) || !(a < b))
      throw new Error(`trechos: corte extra "${c}" inválido. Use início-fim em segundos, com ponto nos decimais e o início antes do fim, separados por vírgula (ex.: "12.31-12.58,20.10-20.40").`);
    return [a, b];
  });
  const ff = (...a) => spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", orig, ...a, "-f", "null", "-"], { encoding: "utf8" }).stderr;
  const duracao = +execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", orig], { encoding: "utf8" });
  const medida = /I:\s+(-?[\d.]+) LUFS/.exec(ff("-af", "ebur128=framelog=quiet"));
  if (!medida) throw new Error(`trechos: não consegui medir o volume de ${orig}.`);
  const limiar = Math.round(+medida[1] - 18);
  const log = ff("-af", `silencedetect=noise=${limiar}dB:d=${PAUSA}`);
  const ini = [...log.matchAll(/silence_start: (-?[\d.]+)/g)].map((m) => Math.max(0, +m[1]));
  const fim = [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1]);
  const cortes = ini.map((s, i) => [s <= 0.01 ? 0 : s + FOLGA, (fim[i] ?? duracao) >= duracao - 0.01 ? duracao : fim[i] - FOLGA]);
  cortes.push(...pedidos);
  cortes.sort((a, b) => a[0] - b[0]);
  const manter = [];
  let cursor = 0;
  for (const [a, b] of cortes) {
    if (b - a < 0.2) continue;
    if (a > cursor) manter.push([cursor, a]);
    cursor = Math.max(cursor, b);
  }
  if (duracao - cursor > 0.2) manter.push([cursor, duracao]);
  return { limiar, duracao, manter };
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) { console.error('Uso: node trechos.mjs <vídeo original> ["início-fim,..."] > trechos.json'); process.exit(1); }
  try {
    console.log(JSON.stringify(trechos(process.argv[2], process.argv[3])));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
