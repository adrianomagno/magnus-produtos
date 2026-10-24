// Mede as pausas do vídeo original e diz quais trechos ficam na edição.
// Uso: node trechos.mjs <vídeo original> ["início-fim,início-fim" cortes extras, em segundos] > trechos.json
// Pausa: PAUSA s ou mais abaixo de (volume integrado da fala - 18 dB), achada pelo silencedetect. As bordas são acertadas na
// onda, em janelas de 10 ms: a pausa só começa quando a energia chega ao fundo daquele silêncio (o fim fraco da palavra, como
// s, f ou vogal que morre, fica) e acaba antes de a energia subir de novo (a palavra seguinte e a respiração antes dela ficam).
// Pausa que, acertada, fica menor que PAUSA não sai. Da que sai ficam LADO s de silêncio de cada lado (a emenda).
// Os cortes extras (vícios, tomada repetida, trecho escolhido) entram como vieram e ficam anotados em "extras" no
// trechos.json: o montar.mjs tira da legenda as palavras que caem dentro deles.
import { execFileSync, spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Se a prova mostrar a emenda picotada, suba PAUSA para 0,3 ou 0,35 s
const PAUSA = 0.25, LADO = 0.06;
// Medida da onda: janelas de 10 ms; conta como fundo a janela até MARGEM dB acima do fundo do silêncio (a janela dos 10%
// mais baixos, fora o silêncio digital, abaixo de DIGITAL dB) ou mais de PISO dB abaixo do limiar; a borda só vale com
// SEGUIDAS janelas no fundo
const JANELA = 0.01, MARGEM = 6, PISO = 30, DIGITAL = -100, SEGUIDAS = 3, SR = 48000;

// Energia (dB) de cada janela de 10 ms do áudio em mono
function energia(amostras) {
  const n = Math.round(JANELA * SR), db = new Float64Array(Math.floor(amostras.length / n));
  for (let k = 0; k < db.length; k++) {
    let s = 0;
    for (let i = k * n; i < (k + 1) * n; i++) s += amostras[i] * amostras[i];
    db[k] = 10 * Math.log10(s / n + 1e-12);
  }
  return db;
}

// Silêncio [ini, fim] do silencedetect acertado na onda: [início, fim] onde a energia está de fato no fundo, ou null
function acertar(db, ini, fim, limiar) {
  const a = Math.max(0, Math.ceil(ini / JANELA - 1e-6)), b = Math.min(db.length, Math.floor(fim / JANELA + 1e-6));
  if (b - a < SEGUIDAS) return null;
  // o silêncio digital (o começo da gravação no celular, por exemplo) não entra na conta do fundo
  const v = Array.from(db.subarray(a, b)).filter((x) => x > DIGITAL).sort((x, y) => x - y);
  const fundo = Math.max((v.length ? v[Math.floor(v.length * 0.1)] : DIGITAL) + MARGEM, limiar - PISO);
  const noFundo = (k) => db.subarray(k, k + SEGUIDAS).every((x) => x <= fundo);
  let i = a; while (i + SEGUIDAS <= b && !noFundo(i)) i++;
  let j = b; while (j - SEGUIDAS >= i && !noFundo(j - SEGUIDAS)) j--;
  return j - i >= SEGUIDAS ? [i * JANELA, j * JANELA] : null;
}

export function trechos(orig, extras = "") {
  const pedidos = extras.split(",").map((c) => c.trim()).filter(Boolean).map((c) => {
    const [a, b] = c.split("-").map(Number);
    if (!/^\d+(\.\d+)?-\d+(\.\d+)?$/.test(c) || !(a < b))
      throw new Error(`trechos: corte extra "${c}" inválido. Use início-fim em segundos, com ponto nos decimais e o início antes do fim, separados por vírgula (ex.: "12.31-12.58,20.10-20.40").`);
    return [a, b];
  });
  const ff = (args, opc = {}) => spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", orig, "-vn", ...args], { maxBuffer: 2 ** 31, ...opc });
  const duracao = +execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", orig], { encoding: "utf8" });
  const medida = /I:\s+(-?[\d.]+) LUFS/.exec(ff(["-af", "ebur128=framelog=quiet", "-f", "null", "-"], { encoding: "utf8" }).stderr);
  if (!medida) throw new Error(`trechos: não consegui medir o volume de ${orig}.`);
  const limiar = Math.round(+medida[1] - 18);
  // Uma passada só: o silencedetect escreve as pausas no log e a saída é o áudio em mono, para medir a onda
  const r = ff(["-af", `silencedetect=noise=${limiar}dB:d=${PAUSA}`, "-ac", "1", "-ar", String(SR), "-f", "f32le", "-"]);
  if (r.status !== 0) throw new Error(`trechos: não consegui ler o áudio de ${orig}.`);
  const log = r.stderr.toString(), pcm = r.stdout;
  const db = energia(new Float32Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 4)));
  const ini = [...log.matchAll(/silence_start: (-?[\d.]+)/g)].map((m) => Math.max(0, +m[1]));
  const fim = [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1]);
  const cortes = [];
  ini.forEach((s, i) => {
    const comeco = s <= 0.01, final = (fim[i] ?? duracao) >= duracao - 0.01;
    const p = acertar(db, s, final ? duracao : fim[i], limiar);
    if (!p) return;
    const a = comeco ? 0 : p[0], b = final ? duracao : p[1];
    if (b - a >= PAUSA) cortes.push([comeco ? 0 : a + LADO, final ? duracao : b - LADO]);
  });
  cortes.push(...pedidos);
  cortes.sort((a, b) => a[0] - b[0]);
  const manter = [];
  let cursor = 0;
  for (const [a, b] of cortes) {
    if (a > cursor) manter.push([cursor, a]);
    cursor = Math.max(cursor, b);
  }
  if (duracao - cursor > 0.2) manter.push([cursor, duracao]);
  return { limiar, duracao, manter, extras: pedidos };
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
