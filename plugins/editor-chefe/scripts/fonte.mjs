// Fonte de trabalho (passo 1 de references/audio-e-corte.md): 30 qps, um quadro-chave por segundo (com menos, a imagem
// congela no render), lado maior até 1920 px (vídeo menor não é ampliado), HDR do celular (HLG ou PQ) convertido para
// cor comum (SDR, BT.709) com mapeamento de tom e o áudio tratado em -16 LUFS. Opcionais: um visual de cor e a limpeza
// de ruído de fundo. Se a pasta tem um borrar.json (do sigilo.mjs, passo 3b), as áreas dele saem borradas, toda vez.
// As opções usadas ficam no fonte.json da pasta (o ultimo-estilo.mjs guarda o visual de cor e a limpeza de lá).
// Uso: node fonte.mjs <original> [--cor <visual>] [--ruido]   grava fonte.mp4 na pasta do original
//      node fonte.mjs <original> --medir                       só mede o ruído de fundo e diz se vale oferecer a limpeza
import { spawnSync } from "node:child_process";
import { realpathSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TEMPO_MAX = 600000;
const ffmpeg = () => process.env.HYPERFRAMES_FFMPEG_PATH ?? "ffmpeg", ffprobe = () => process.env.HYPERFRAMES_FFPROBE_PATH ?? "ffprobe";
const ultima = (s) => String(s ?? "").trim().split("\n").pop();
// Visuais de cor, escritos para pele e fala: mudanças pequenas, que não estouram o branco nem deixam a pele laranja.
// Entram depois da conversão de HDR, já em cor comum, então não brigam com o mapeamento de tom.
export const CORES = {
  natural: "eq=contrast=1.04:saturation=1.06", // correção leve: um pouco mais de vida, sem cara de filtro
  claro: "eq=brightness=0.03:gamma=1.08:contrast=0.98:saturation=0.96", // claro e limpo: sombras abertas, cor contida
  quente: "colortemperature=temperature=5200:mix=0.55,eq=saturation=1.04", // tom de fim de tarde, pele mais quente
  contraste: "eq=contrast=1.12:gamma=0.97:saturation=1.08", // pretos mais firmes, imagem mais marcada
  // Nível forte: mais luz e vida no rosto. A luz vem do gamma (ou de uma curva só no brilho), que sobe os tons do meio e
  // deixa o branco e o preto no lugar, sem mexer no tom da cor: a pele clareia sem puxar para o laranja. Uma curva de cor
  // em RGB faria o contrário (testado: a pele foi para o amarelo). Medidas em amostrarCor e nos testes.
  "natural-forte": "eq=gamma=1.15:saturation=1.12",
  "claro-forte": "eq=brightness=0.02:gamma=1.3:contrast=0.97",
  "quente-forte": "colortemperature=temperature=5000:mix=0.6,eq=gamma=1.28:contrast=0.97:saturation=1.03",
  "contraste-forte": "lutyuv=y=16+219*pow(clip((val-16)/219\\,0\\,1)-0.05*sin(2*PI*clip((val-16)/219\\,0\\,1))\\,1/1.12),eq=saturation=1.1", // curva em S só no brilho: sombra mais funda, meio mais claro, branco no lugar
};
// Amostras para conferir um visual: três tons de pele (clara, média, escura), o cinza médio, uma parede clara, um quase
// branco e uma sombra. amostrarCor(filtro) devolve o RGB de cada uma depois do filtro, pelo mesmo ffmpeg do fluxo.
export const AMOSTRAS = { pele1: "E0AC8C", pele2: "C68642", pele3: "8D5524", cinza: "808080", parede: "E6E6E6", quase: "F5F5F5", sombra: "303030" };
export function amostrarCor(filtro) {
  const o = {};
  for (const [k, c] of Object.entries(AMOSTRAS)) {
    const r = spawnSync(ffmpeg(), ["-v", "error", "-f", "lavfi", "-i", `color=c=0x${c}:s=16x16:d=0.04`, "-vf", `format=yuv420p,${filtro ? filtro + "," : ""}format=rgb24`, "-frames:v", "1", "-f", "rawvideo", "-"], { timeout: TEMPO_MAX, maxBuffer: 1 << 20 });
    if (r.error || r.status !== 0 || r.stdout.length < 768) throw new Error(`fonte: o visual de cor não roda no ffmpeg (${ultima(r.error?.message ?? r.stderr)}).`);
    const i = (8 * 16 + 8) * 3; // o pixel do meio
    o[k] = [r.stdout[i], r.stdout[i + 1], r.stdout[i + 2]];
  }
  return o;
}
// Confere um visual forte nas amostras; devolve a lista do que deu errado (vazia: ok). Branco: o quase branco não chega
// a 254 e fica pelo menos 7 pontos acima da parede clara (o detalhe perto do branco não some). Pele: nenhum dos três tons
// muda mais que 3 graus de matiz nem ganha mais que 0,08 de saturação (o "laranja"). Luz: a pele clara fica pelo menos 8
// pontos de brilho acima do vídeo sem visual e 4 acima do mesmo visual no nível de hoje.
const brilho = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const matiz = ([r, g, b]) => { const mx = Math.max(r, g, b), d = mx - Math.min(r, g, b); if (!d) return 0; const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (h * 60 + 360) % 360; };
const saturacao = ([r, g, b]) => { const mx = Math.max(r, g, b); return mx ? (mx - Math.min(r, g, b)) / mx : 0; };
export function conferirForte(nome, filtro = CORES[nome]) {
  if (!nome.endsWith("-forte") || !Object.hasOwn(CORES, nome)) throw new Error(`fonte: "${nome}" não é um visual forte.`);
  const sem = amostrarCor(""), leve = amostrarCor(CORES[nome.replace(/-forte$/, "")]), a = amostrarCor(filtro), ruim = [];
  if (Math.max(...a.quase) > 253 || a.quase[1] - a.parede[1] < 7) ruim.push(`o branco estoura (quase branco em ${a.quase.join("/")}, parede em ${a.parede.join("/")})`);
  for (const k of ["pele1", "pele2", "pele3"]) {
    if (Math.abs(matiz(a[k]) - matiz(sem[k])) > 3) ruim.push(`a pele muda de tom (${k}: ${sem[k].join("/")} vira ${a[k].join("/")})`);
    if (saturacao(a[k]) - saturacao(sem[k]) > 0.08) ruim.push(`a pele fica laranja (${k}: ${sem[k].join("/")} vira ${a[k].join("/")})`);
  }
  if (brilho(a.pele1) < brilho(sem.pele1) + 8 || brilho(a.pele1) < brilho(leve.pele1) + 4) ruim.push("o rosto não ganha luz");
  return ruim;
}

// Ruído: oferece a limpeza quando as pausas ficam a menos de 30 dB da fala (ventilador, ar-condicionado, chiado). Num
// microfone de lapela em sala quieta a distância passa de 45 dB; com ar-condicionado perto, cai para uns 20.
export const OFERECER_RUIDO = 30;

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

// HDR do celular (HLG ou PQ) para cor comum (SDR, BT.709), com mapeamento de tom; a capa do perfil usa o mesmo
export const HDR_SDR = "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p";
// Borrão das áreas do borrar.json: cada uma { de, ate, caixa: [x, y, largura, altura] }, em segundos do original e em
// fração do quadro já girado (o ffmpeg gira o vídeo do celular antes dos filtros, aqui e no sigilo.mjs). O pedaço é
// recortado, borrado e colado de volta no mesmo lugar, só entre "de" e "ate"; a conta em px pares é a mesma no recorte e
// na colagem (o mesmo quadro), então ele não escorrega. A força cresce com a altura da área: a letra some.
export function borrao(areas) {
  const par = (d, v) => `trunc(${d}*${v}/2)*2`;
  return areas.map(({ de, ate, caixa: [x, y, w, h] }, i) => `split[b${i}][c${i}];[c${i}]crop=w=max(2\\,${par("iw", w)}):h=max(2\\,${par("ih", h)}):x=${par("iw", x)}:y=${par("ih", y)},` +
    `boxblur=luma_radius=min(w\\,h)/5:luma_power=3[d${i}];[b${i}][d${i}]overlay=x=${par("W", x)}:y=${par("H", y)}:enable=between(t\\,${de}\\,${ate})`).join(",");
}
// Lê o borrar.json; arquivo estragado para a fonte (melhor parar que entregar o dado sem borrão)
export function lerBorrar(arq) {
  let j;
  try { j = JSON.parse(readFileSync(arq, "utf8")); } catch { j = null; }
  const ok = (a) => a && Number.isFinite(a.de) && Number.isFinite(a.ate) && a.de < a.ate && Array.isArray(a.caixa) && a.caixa.length === 4
    && a.caixa.every((v) => Number.isFinite(v) && v >= 0 && v <= 1) && a.caixa[2] > 0 && a.caixa[3] > 0 && a.caixa[0] + a.caixa[2] <= 1 && a.caixa[1] + a.caixa[3] <= 1;
  if (!Array.isArray(j?.areas) || !j.areas.every(ok))
    throw new Error(`fonte: o ${arq} está estragado. Grave de novo com o sigilo.mjs --borrar (passo 3b de references/audio-e-corte.md) ou, para tirar o borrão, apague o arquivo.`);
  return j.areas;
}

export function filtros(arq, { cor, ruido, borrar } = {}) {
  if (cor != null && !Object.hasOwn(CORES, cor)) throw new Error(`fonte: o visual de cor "${cor}" não existe. Use: ${Object.keys(CORES).join(", ")}.`);
  const p = spawnSync(ffprobe(), ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=color_transfer", "-of", "csv=p=0", arq], { encoding: "utf8", timeout: TEMPO_MAX });
  if (p.error || p.status !== 0) throw new Error(`fonte: não consegui ler o vídeo ${arq}.`);
  const hdr = ["arib-std-b67", "smpte2084"].includes(p.stdout.trim());
  const vf = ["scale=w=min(iw\\,1920):h=min(ih\\,1920):force_original_aspect_ratio=decrease:force_divisible_by=2"];
  if (hdr) vf.push(HDR_SDR);
  if (borrar?.length) vf.push(borrao(borrar));
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
  const arqB = join(dirname(arq), "borrar.json"), borrar = existsSync(arqB) ? lerBorrar(arqB) : [];
  const f = filtros(arq, { ...opcoes, borrar }), saida = join(dirname(arq), "fonte.mp4");
  const r = spawnSync(ffmpeg(), ["-v", "error", "-y", "-i", arq, "-vf", f.vf, "-r", "30", "-c:v", "libx264", "-crf", "18", "-g", "30", "-keyint_min", "30", "-pix_fmt", "yuv420p",
    "-filter_complex", `[0:a:0]${f.af}[som]`, "-map", "0:v:0", "-map", "[som]", "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", saida], { encoding: "utf8", timeout: TEMPO_MAX, maxBuffer: 1 << 26 });
  if (r.error || r.status !== 0) throw new Error(`fonte: o ffmpeg não gravou a fonte.mp4 (${ultima(r.error?.message ?? r.stderr)}).`);
  writeFileSync(join(dirname(arq), "fonte.json"), JSON.stringify({ cor: opcoes.cor ?? null, ruido: !!opcoes.ruido }) + "\n");
  return { saida, ...f, borradas: borrar.length };
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
      console.log(`fonte: fonte.mp4 pronta${r.hdr ? ", HDR convertido para cor comum" : ""}${i >= 0 ? `, visual ${args[i + 1]}` : ""}${r.amostra != null ? `, limpeza de ruído (amostra do ruído em ${r.amostra} s)` : ""}${r.borradas ? `, ${r.borradas} ${r.borradas > 1 ? "áreas borradas" : "área borrada"} (borrar.json)` : ""}.`);
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
