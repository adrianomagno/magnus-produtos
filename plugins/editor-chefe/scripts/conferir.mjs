// Conferência automática do vídeo pronto, antes da prévia e antes da entrega: resolução 1080x1920, duração igual à da
// edição, áudio presente, perto de -16 LUFS e com o pico verdadeiro abaixo de -1 dBTP, nenhum quadro sem vídeo nas
// emendas dos trechos, e nenhum rosto embaixo da legenda, da caixinha, do gancho de capa ou das faixas com tempo que o
// montador grava nos dados (as frases em destaque, as peças e a pílula do capítulo).
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
export const ALVO_LUFS = -16, FOLGA_LUFS = 1.5, FOLGA_DURACAO = 0.2, TETO_DBTP = -1;
export const DENSO = 10; // quadros por segundo da procura do rosto enquanto há texto ou peça na tela
const ffmpeg = () => process.env.HYPERFRAMES_FFMPEG_PATH ?? "ffmpeg", ffprobe = () => process.env.HYPERFRAMES_FFPROBE_PATH ?? "ffprobe";
const seg = (x) => x.toFixed(1).replace(".", ",");

// Faixas de texto do projeto, no quadro 1080x1920: [{ nome, y0, y1, x0, x1, de, ate }]
export function zonas(html, duracao) {
  const z = [], r = /#(legenda|palavra|chaves) \{[^}]*?left: (\d+)(?:px)?; right: (\d+)(?:px)?; top: (\d+)px; height: (\d+)px;/.exec(html);
  if (r) z.push({ nome: r[1] === "legenda" ? "a legenda" : "a palavra na tela", y0: +r[4], y1: +r[4] + +r[5], x0: +r[2], x1: 1080 - +r[3], de: 0, ate: duracao });
  const d = /const D = (\{.*\});/.exec(html);
  let D = {};
  try { D = d ? JSON.parse(d[1]) : {}; } catch { /* molde ainda sem os dados */ }
  // Faixas com tempo que o montador calcula para o vídeo (as frases e as peças do estilo 11, acima da cabeça ou embaixo do queixo)
  if (Array.isArray(D.faixas)) z.push(...D.faixas.map(({ nome, y0, y1, x0, x1, de, ate }) => ({ nome, y0, y1, x0, x1, de, ate })));
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

// Volume integrado (LUFS) e pico verdadeiro (dBTP, com a sobreamostragem do ebur128) do áudio do vídeo
export function loudness(arq) {
  const r = spawnSync(ffmpeg(), ["-nostats", "-hide_banner", "-i", arq, "-vn", "-af", "ebur128=framelog=quiet:peak=true", "-f", "null", "-"], { encoding: "utf8", timeout: TEMPO_MAX, maxBuffer: 1 << 26 });
  const s = r.stderr ?? "", m = /I:\s+(-?[\d.]+) LUFS/.exec(s), p = /True peak:\s+Peak:\s+(-?[\d.]+|-inf) dBFS/.exec(s);
  return { lufs: m ? +m[1] : null, pico: p ? (p[1] === "-inf" ? -Infinity : +p[1]) : null };
}

// Emendas: o início de cada trecho do vídeo na edição (menos o primeiro), dos <video class="trecho"> do index.html
export const emendas = (html) => [...html.matchAll(/<video id="trecho-\d+" class="trecho clip"[^>]*?data-start="([\d.]+)"/g)].map((m) => +m[1]).filter((t) => t > 0);
// Quadro sem vídeo (só o fundo da página) numa emenda: em volta de cada emenda (2 quadros antes e 2 depois), o miolo de
// baixo da área do vídeo (regiao: [x, y, largura, altura] no quadro 1080x1920, abaixo da legenda) fica liso, sem imagem,
// enquanto os quadros vizinhos têm imagem. Liso: do 10º ao 90º percentil do brilho cabem 2 pontos ou menos. Devolve os
// instantes (s) desses quadros.
export function piscadas(video, ts, regiao = [0, 0, 1080, 1920]) {
  if (!ts.length) return [];
  const [x, y, w, h] = regiao, sel = ts.map((t) => `between(t\\,${(t - 0.07).toFixed(3)}\\,${(t + 0.07).toFixed(3)})`).join("+");
  const crop = `crop=${Math.round(w * 0.4)}:${Math.round(h * 0.15)}:${Math.round(x + w * 0.3)}:${Math.round(y + h * 0.8)}`;
  const r = spawnSync(ffmpeg(), ["-hide_banner", "-nostats", "-i", video, "-an", "-vf", `select=${sel},${crop},scale=96:-2,signalstats,metadata=print`, "-f", "null", "-"], { encoding: "utf8", timeout: TEMPO_MAX, maxBuffer: 1 << 28 });
  const q = [];
  for (const bloco of (r.stderr ?? "").split(/frame:\d+\s+pts:\S+\s+/).slice(1)) {
    const t = +(/pts_time:([\d.]+)/.exec(bloco)?.[1] ?? NaN), lo = +(/YLOW=([\d.]+)/.exec(bloco)?.[1] ?? NaN), hi = +(/YHIGH=([\d.]+)/.exec(bloco)?.[1] ?? NaN);
    if (Number.isFinite(t) && Number.isFinite(lo)) q.push({ t, faixa: hi - lo });
  }
  return q.filter((f, i) => f.faixa <= 2 && [q[i - 1], q[i + 1]].some((v) => v && Math.abs(v.t - f.t) < 0.05 && v.faixa >= 6)).map((f) => +f.t.toFixed(3));
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
  const { lufs, pico } = temAudio ? loudness(video) : { lufs: null, pico: null };
  if (!temAudio) ruim.push("o vídeo saiu sem áudio.");
  else if (lufs == null || lufs < -70) ruim.push("o áudio do vídeo está mudo.");
  else {
    const antes = ruim.length;
    if (Math.abs(lufs - ALVO_LUFS) > FOLGA_LUFS) ruim.push(`o volume está em ${lufs} LUFS; o certo é perto de ${ALVO_LUFS} (de ${ALVO_LUFS - FOLGA_LUFS} a ${ALVO_LUFS + FOLGA_LUFS}).`);
    if (pico == null) ruim.push("não consegui medir o pico verdadeiro do áudio.");
    else if (pico > TETO_DBTP) ruim.push(`o pico do áudio está em ${pico} dBTP; o certo é abaixo de ${TETO_DBTP} dBTP (o som passaria do limite no celular).`);
    if (ruim.length === antes) avisar(`conferir: áudio em ${lufs} LUFS, pico em ${pico} dBTP`);
  }
  // Quadro sem vídeo nas emendas (o fundo da página aparece entre dois trechos)
  const gravado = html.includes('class="trecho');
  // e no fim do vídeo (os 3 últimos quadros), onde a edição pode acabar depois do último trecho
  const j = /#janela \{[^}]*?left: (\d+)(?:px)?; top: (\d+)px; width: (\d+)px; height: (\d+)px;/.exec(html), ems = emendas(html).filter((t) => t < duracao - 0.05);
  const sem = gravado ? piscadas(video, [...ems, +(duracao - 0.034).toFixed(3)], j ? j.slice(1).map(Number) : undefined) : [];
  const noFim = sem.filter((t) => t > duracao - 0.15), nasEmendas = sem.filter((t) => t <= duracao - 0.15);
  if (nasEmendas.length) ruim.push(`quadro sem vídeo na emenda de ${nasEmendas.slice(0, 5).map(seg).join(" s, ")} s${nasEmendas.length > 5 ? ` (e mais ${nasEmendas.length - 5})` : ""}.`);
  if (noFim.length) ruim.push(`o último quadro do vídeo saiu sem vídeo, só com o fundo (${seg(noFim[0])} s).`);
  if (gravado && !sem.length) avisar(`conferir: nenhum quadro sem vídeo nas ${ems.length} emendas${previa ? " desta prévia" : ""} nem no fim`);

  // Rosto embaixo do texto, com o mesmo detector do reenquadramento: 10 quadros por segundo enquanto alguma faixa de texto
  // ou peça está na tela (cada quadro no instante real dele), para pegar o que cobre o rosto por menos de 1 s; no resto, 1 por
  // segundo, só para contar o rosto
  let rostos = 0, cobertos = [];
  if (gravado && W === 1080 && H === 1920) {
    const det = await detector(dados), z = zonas(html, Number.isFinite(esperado) ? esperado : duracao);
    // sem o detector, a conferência não sabe se o texto cobre o rosto: reprova (antes só avisava e dava OK). Com o detector e
    // nenhum rosto achado (gravação de tela), segue só com o aviso, abaixo
    if (!det) ruim.push("o detector de rosto não está neste computador, então ninguém conferiu se o texto cobre o rosto. Rode o Preparar do Editor Chefe (o preparar.sh baixa o detector) e confira de novo.");
    else {
      const ativa = (t) => z.some((a) => t >= a.de && t < a.ate), achados = new Map();
      let k = 0, n = 0;
      for await (const q of quadros(video, W, H, 384, DENSO)) {
        const t = k / DENSO, pula = !ativa(t) && k % DENSO;
        k++;
        if (pula) continue;
        n++;
        const r = (await det(q.px, q.largura, q.altura)).map((c) => ({ x: c.x * q.escala, y: c.y * q.escala, w: c.w * q.escala, h: c.h * q.escala }));
        rostos += r.length ? 1 : 0;
        for (const c of r) for (const a of cobre(c, t, z)) achados.set(a.nome, [...(achados.get(a.nome) ?? []), t]);
      }
      // os instantes de cada faixa viram intervalos ("de 2,6 a 3,3 s"), juntando os quadros seguidos
      for (const [nome, ts] of achados) {
        const u = [...new Set(ts)].sort((a, b) => a - b), ints = [];
        for (const x of u) if (ints.length && x - ints[ints.length - 1][1] <= 1.5 / DENSO) ints[ints.length - 1][1] = x; else ints.push([x, x]);
        for (const [a, b] of ints) cobertos.push(`${nome} cobre o rosto ${a === b ? `em ${seg(a)} s` : `de ${seg(a)} a ${seg(b)} s`}`);
      }
      if (cobertos.length) ruim.push(`${cobertos.slice(0, 5).join("; ")}${cobertos.length > 5 ? ` (e mais ${cobertos.length - 5})` : ""}.`);
      else avisar(`conferir: nenhum texto em cima do rosto (rosto achado em ${rostos} de ${n} quadros)`);
      if (!rostos) avisar("conferir: nenhum rosto achado no vídeo; olhe a folha de quadros para ver o enquadramento.");
    }
  }
  // Folha de quadros, para o Claude olhar antes de mostrar ao dono
  const folha = join(pasta, "conferencia.jpg");
  const f = spawnSync(ffmpeg(), ["-v", "error", "-y", "-i", video, "-vf", `fps=${(12 / duracao).toFixed(4)},scale=270:480,tile=6x2`, "-frames:v", "1", folha], { encoding: "utf8", timeout: TEMPO_MAX });
  if (f.status === 0) avisar(`conferir: folha de quadros em ${folha}`);
  if (ruim.length) avisar(`CONFERÊNCIA REPROVADA:\n- ${ruim.join("\n- ")}`);
  else avisar("CONFERÊNCIA OK");
  return { ok: !ruim.length, ruim, lufs, pico, duracao, W, H, rostos, folha, piscadas: sem };
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
