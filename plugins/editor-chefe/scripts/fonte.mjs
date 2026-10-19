// Fonte de trabalho (passo 1 de references/audio-e-corte.md): 30 qps, um quadro-chave por segundo (com menos, a imagem
// congela no render), lado maior até 1920 px (vídeo menor não é ampliado), HDR do celular (HLG ou PQ) convertido para
// cor comum (SDR, BT.709) com mapeamento de tom e o áudio tratado em -16 LUFS. Opcionais: um visual de cor e a limpeza
// de ruído de fundo.
// Uso: node fonte.mjs <original> [--cor <visual>] [--ruido]   grava fonte.mp4 na pasta do original
//      node fonte.mjs <original> --medir                       só mede o ruído de fundo e diz se vale oferecer a limpeza
import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TEMPO_MAX = 600000;
// Visuais de cor, escritos para pele e fala: mudanças pequenas, que não estouram o branco nem deixam a pele laranja.
// Entram depois da conversão de HDR, já em cor comum, então não brigam com o mapeamento de tom.
export const CORES = {
  natural: "eq=contrast=1.04:saturation=1.06", // correção leve: um pouco mais de vida, sem cara de filtro
  claro: "eq=brightness=0.03:gamma=1.08:contrast=0.98:saturation=0.96", // claro e limpo: sombras abertas, cor contida
  quente: "colortemperature=temperature=5200:mix=0.55,eq=saturation=1.04", // tom de fim de tarde, pele mais quente
  contraste: "eq=contrast=1.12:gamma=0.97:saturation=1.08", // pretos mais firmes, imagem mais marcada
};
// Ruído: oferece a limpeza quando as pausas ficam a menos de 30 dB da fala (ventilador, ar-condicionado, chiado). Num
// microfone de lapela em sala quieta a distância passa de 45 dB; com ar-condicionado perto, cai para uns 20.
export const OFERECER_RUIDO = 30;
const ffmpeg = () => process.env.HYPERFRAMES_FFMPEG_PATH ?? "ffmpeg", ffprobe = () => process.env.HYPERFRAMES_FFPROBE_PATH ?? "ffprobe";
const ultima = (s) => String(s ?? "").trim().split("\n").pop();

// Volume de 0,1 em 0,1 s: o fundo é o 10º percentil (as pausas entre as palavras), a fala é o 90º
export function medirRuido(arq) {
  const r = spawnSync(ffmpeg(), ["-hide_banner", "-nostats", "-i", arq, "-vn", "-af", "aresample=48000,asetnsamples=n=4800:p=0,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level", "-f", "null", "-"],
    { encoding: "utf8", timeout: TEMPO_MAX, maxBuffer: 1 << 28 });
  if (r.error || r.status !== 0) throw new Error(`fonte: não consegui medir o áudio de ${arq} (${ultima(r.error?.message ?? r.stderr)}).`);
  const blocos = [...r.stderr.matchAll(/RMS_level=(\S+)/g)].map((m) => (Number.isFinite(+m[1]) ? +m[1] : -120));
  if (blocos.length < 10) throw new Error(`fonte: o vídeo ${arq} não tem áudio suficiente para medir (precisa de pelo menos 1 segundo).`);
  const v = [...blocos].sort((a, b) => a - b), fundo = v[Math.floor(v.length * 0.1)], fala = v[Math.floor(v.length * 0.9)], distancia = +(fala - fundo).toFixed(1);
  // O meio segundo mais quieto (5 blocos seguidos, sem o silêncio digital): é a amostra do ruído para a limpeza
  let quieto = 0, menor = Infinity;
  for (let i = 0; i + 5 <= blocos.length; i++) {
    const j = blocos.slice(i, i + 5);
    if (j.some((x) => x <= -119)) continue;
    const m = j.reduce((a, b) => a + b, 0) / 5;
    if (m < menor) { menor = m; quieto = +(i / 10).toFixed(1); }
  }
  return { fundo_db: +fundo.toFixed(1), fala_db: +fala.toFixed(1), distancia_db: distancia, oferecer: distancia < OFERECER_RUIDO, amostra_s: quieto };
}

export function filtros(arq, { cor, ruido } = {}) {
  if (cor != null && !Object.hasOwn(CORES, cor)) throw new Error(`fonte: o visual de cor "${cor}" não existe. Use: ${Object.keys(CORES).join(", ")}.`);
  const p = spawnSync(ffprobe(), ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=color_transfer", "-of", "csv=p=0", arq], { encoding: "utf8", timeout: TEMPO_MAX });
  if (p.error || p.status !== 0) throw new Error(`fonte: não consegui ler o vídeo ${arq}.`);
  const hdr = ["arib-std-b67", "smpte2084"].includes(p.stdout.trim());
  const vf = ["scale=w=min(iw\\,1920):h=min(ih\\,1920):force_original_aspect_ratio=decrease:force_divisible_by=2"];
  if (hdr) vf.push("zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p");
  if (cor) vf.push(CORES[cor]);
  // Limpeza: o afftdn aprende o ruído no meio segundo mais quieto do vídeo (colado antes do áudio e tirado depois) e o
  // reduz em 12 dB, o bastante para o chiado sumir sem a voz ficar metálica. Sem amostra, o afftdn quase não age.
  const amostra = ruido ? medirRuido(arq).amostra_s : null;
  const limpeza = ruido ? [`asplit[a][b];[a]atrim=${amostra}:${(amostra + 0.5).toFixed(1)},asetpts=PTS-STARTPTS[n];[n][b]concat=v=0:a=1`,
    "asendcmd=c='0.01 afftdn sn start;0.49 afftdn sn end'", "afftdn=nr=12:nf=-30", "atrim=start=0.5", "asetpts=PTS-STARTPTS"] : [];
  // Estéreo antes do loudnorm: fonte mono mede -16 sozinha, mas o render põe a mesma voz nos dois canais e o MP4 sairia
  // 3 dB mais alto (perto de -13 LUFS, medido no autoteste)
  const af = ["aformat=channel_layouts=stereo", "highpass=f=80", ...limpeza, "acompressor=ratio=3", "loudnorm=I=-16:TP=-1.5:LRA=11"];
  return { vf: vf.join(","), af: af.join(","), hdr, amostra };
}

export function fonte(arq, opcoes = {}) {
  const f = filtros(arq, opcoes), saida = join(dirname(arq), "fonte.mp4");
  const r = spawnSync(ffmpeg(), ["-v", "error", "-y", "-i", arq, "-vf", f.vf, "-r", "30", "-c:v", "libx264", "-crf", "18", "-g", "30", "-keyint_min", "30", "-pix_fmt", "yuv420p",
    "-filter_complex", `[0:a:0]${f.af}[som]`, "-map", "0:v:0", "-map", "[som]", "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", saida], { encoding: "utf8", timeout: TEMPO_MAX, maxBuffer: 1 << 26 });
  if (r.error || r.status !== 0) throw new Error(`fonte: o ffmpeg não gravou a fonte.mp4 (${ultima(r.error?.message ?? r.stderr)}).`);
  return { saida, ...f };
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), arq = args[0], i = args.indexOf("--cor");
  if (!arq || arq.startsWith("--")) { console.error("Uso: node fonte.mjs <original> [--cor <visual>] [--ruido]  ou  node fonte.mjs <original> --medir"); process.exit(1); }
  try {
    if (args.includes("--medir")) {
      const m = medirRuido(resolve(arq));
      console.log(JSON.stringify(m));
      console.log(m.oferecer ? `fonte: ruído de fundo a ${m.distancia_db} dB da fala; vale oferecer a limpeza de ruído.` : `fonte: ruído de fundo a ${m.distancia_db} dB da fala; não precisa de limpeza.`);
    } else {
      const r = fonte(resolve(arq), { cor: i >= 0 ? args[i + 1] : undefined, ruido: args.includes("--ruido") });
      console.log(`fonte: fonte.mp4 pronta${r.hdr ? ", HDR convertido para cor comum" : ""}${i >= 0 ? `, visual ${args[i + 1]}` : ""}${r.amostra != null ? `, limpeza de ruído (amostra do ruído em ${r.amostra} s)` : ""}.`);
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
