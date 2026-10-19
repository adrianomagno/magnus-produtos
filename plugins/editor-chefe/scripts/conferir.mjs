// Conferência automática do vídeo pronto, antes da prévia e antes da entrega: resolução 1080x1920, duração igual à da
// edição, áudio presente e perto de -16 LUFS, e nenhum rosto embaixo da legenda, da caixinha ou do gancho de capa.
// Uso: node conferir.mjs <pasta do vídeo> <vídeo pronto> [--previa]
// --previa: o vídeo é só o começo da edição; a duração pode ser menor que a do index.html.
// Lê o index.html da pasta (a duração, a faixa do texto do estilo e os dados da capa e da caixinha). Grava na pasta a
// conferencia.jpg, uma folha com 12 quadros do vídeo para olhar. Termina com CONFERÊNCIA OK ou CONFERÊNCIA REPROVADA
// (e sai com erro), com o motivo de cada reprovação.
import { readFileSync, existsSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { detector, quadros, medidas } from "./rosto.mjs";

const TEMPO_MAX = 600000;
export const ALVO_LUFS = -16, FOLGA_LUFS = 1.5, FOLGA_DURACAO = 0.2;
const ffmpeg = () => process.env.HYPERFRAMES_FFMPEG_PATH ?? "ffmpeg", ffprobe = () => process.env.HYPERFRAMES_FFPROBE_PATH ?? "ffprobe";
const seg = (x) => x.toFixed(1).replace(".", ",");

// Faixas de texto do projeto, no quadro 1080x1920: [{ nome, y0, y1, x0, x1, de, ate }]
export function zonas(html, duracao) {
  const z = [], r = /#(legenda|palavra|chaves) \{[^}]*?left: (\d+)(?:px)?; right: (\d+)(?:px)?; top: (\d+)px; height: (\d+)px;/.exec(html);
  if (r) z.push({ nome: r[1] === "legenda" ? "a legenda" : "a palavra na tela", y0: +r[4], y1: +r[4] + +r[5], x0: +r[2], x1: 1080 - +r[3], de: 0, ate: duracao });
  const d = /const D = (\{.*\});/.exec(html);
  let D = {};
  try { D = d ? JSON.parse(d[1]) : {}; } catch { /* molde ainda sem os dados */ }
  if (D.caixinha) z.push({ nome: "a caixinha", y0: D.caixinha.topo, y1: 1500, x0: 90, x1: 990, de: 0, ate: duracao });
  if (D.capa) {
    const { estilo, queixo, fim } = D.capa, topo = Math.max(1000, queixo + 160);
    const y = { faixa: [0, 550], manchete: [topo, topo + 345], editorial: [1200, 1480] }[estilo];
    if (y) z.push({ nome: "o gancho de capa", y0: y[0], y1: y[1], x0: 90, x1: 990, de: 0, ate: fim });
  }
  return z;
}

// Rosto (caixa no quadro 1080x1920, no instante t) que fica embaixo de alguma faixa: a faixa cobre ao menos um quarto da altura dele
export const cobre = (r, t, z) => z.filter((a) => t >= a.de && t < a.ate
  && Math.min(r.y + r.h / 2, a.y1) - Math.max(r.y - r.h / 2, a.y0) >= 0.25 * r.h
  && Math.min(r.x + r.w / 2, a.x1) - Math.max(r.x - r.w / 2, a.x0) > 0);

function loudness(arq) {
  const r = spawnSync(ffmpeg(), ["-nostats", "-hide_banner", "-i", arq, "-vn", "-af", "ebur128=framelog=quiet", "-f", "null", "-"], { encoding: "utf8", timeout: TEMPO_MAX, maxBuffer: 1 << 26 });
  const m = /I:\s+(-?[\d.]+) LUFS/.exec(r.stderr ?? "");
  return m ? +m[1] : null;
}

export async function conferir(pasta, video, { previa = false, dados, avisar = (m) => console.log(m) } = {}) {
  const ruim = [];
  if (!existsSync(video)) throw new Error(`conferir: não achei o vídeo ${video}.`);
  const html = readFileSync(join(pasta, "index.html"), "utf8");
  const esperado = +(/data-composition-id="editor-chefe"[^>]*?data-duration="([\d.]+)"/.exec(html)?.[1] ?? NaN);
  const { W, H, duracao } = medidas(video);
  if (W !== 1080 || H !== 1920) ruim.push(`o vídeo saiu com ${W}x${H}, e não em 1080x1920.`);
  else avisar("conferir: 1080x1920");
  if (!Number.isFinite(esperado)) ruim.push("não achei a duração da edição no index.html.");
  else if (previa ? duracao > esperado + FOLGA_DURACAO : Math.abs(duracao - esperado) > FOLGA_DURACAO)
    ruim.push(`o vídeo tem ${seg(duracao)} s e a edição tem ${seg(esperado)} s.`);
  else avisar(`conferir: ${seg(duracao)} s${previa ? ` (prévia de uma edição de ${seg(esperado)} s)` : ""}`);
  const temAudio = spawnSync(ffprobe(), ["-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", video], { encoding: "utf8", timeout: TEMPO_MAX }).stdout?.trim();
  const lufs = temAudio ? loudness(video) : null;
  if (!temAudio) ruim.push("o vídeo saiu sem áudio.");
  else if (lufs == null || lufs < -70) ruim.push("o áudio do vídeo está mudo.");
  else if (Math.abs(lufs - ALVO_LUFS) > FOLGA_LUFS) ruim.push(`o volume está em ${lufs} LUFS; o certo é perto de ${ALVO_LUFS} (de ${ALVO_LUFS - FOLGA_LUFS} a ${ALVO_LUFS + FOLGA_LUFS}).`);
  else avisar(`conferir: áudio em ${lufs} LUFS`);

  // Rosto embaixo do texto: um quadro por segundo (no máximo 60), com o mesmo detector do reenquadramento
  const gravado = html.includes('class="trecho');
  let rostos = 0, cobertos = [];
  if (gravado && W === 1080 && H === 1920) {
    const det = await detector(dados), z = zonas(html, Number.isFinite(esperado) ? esperado : duracao);
    if (!det) avisar("conferir: o detector de rosto não está nesta pasta de dados (rode o preparar.sh); rosto e texto não foram conferidos, olhe a folha de quadros.");
    else {
      const qps = Math.min(1, 60 / duracao);
      let k = 0;
      for await (const q of quadros(video, W, H, 384, qps)) {
        const t = (k++ + 0.5) / qps, r = (await det(q.px, q.largura, q.altura)).map((c) => ({ x: c.x * q.escala, y: c.y * q.escala, w: c.w * q.escala, h: c.h * q.escala }));
        rostos += r.length ? 1 : 0;
        for (const c of r) for (const a of cobre(c, t, z)) cobertos.push(`${a.nome} cobre o rosto em ${seg(t)} s`);
      }
      cobertos = [...new Set(cobertos)];
      if (cobertos.length) ruim.push(`${cobertos.slice(0, 5).join("; ")}${cobertos.length > 5 ? ` (e mais ${cobertos.length - 5})` : ""}.`);
      else avisar(`conferir: nenhum texto em cima do rosto (rosto achado em ${rostos} de ${k} quadros)`);
      if (!rostos) avisar("conferir: nenhum rosto achado no vídeo; olhe a folha de quadros para ver o enquadramento.");
    }
  }
  // Folha de quadros, para o Claude olhar antes de mostrar ao dono
  const folha = join(pasta, "conferencia.jpg");
  const f = spawnSync(ffmpeg(), ["-v", "error", "-y", "-i", video, "-vf", `fps=${(12 / duracao).toFixed(4)},scale=270:480,tile=6x2`, "-frames:v", "1", folha], { encoding: "utf8", timeout: TEMPO_MAX });
  if (f.status === 0) avisar(`conferir: folha de quadros em ${folha}`);
  if (ruim.length) avisar(`CONFERÊNCIA REPROVADA:\n- ${ruim.join("\n- ")}`);
  else avisar("CONFERÊNCIA OK");
  return { ok: !ruim.length, ruim, lufs, duracao, W, H, rostos, folha };
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), [pasta, video] = args.filter((a) => !a.startsWith("--"));
  if (!pasta || !video) { console.error("Uso: node conferir.mjs <pasta do vídeo> <vídeo pronto> [--previa]"); process.exit(1); }
  try {
    const r = await conferir(resolve(pasta), resolve(video), { previa: args.includes("--previa") });
    process.exit(r.ok ? 0 : 1);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
