// Capa do perfil: a imagem parada que aparece na grade do Instagram, feita depois do vídeo aprovado.
// Uso: node capa-perfil.mjs quadros <pasta do vídeo> [vídeo] [--de S] [--ate S]
//        Tira quadros do vídeo original (o de maior resolução, sem legenda), acha o rosto em cada um, dá uma nota ao ângulo
//        (rosto de frente, olhos abertos, boca fora do meio de uma palavra, rosto nítido, boa luz, rosto grande) e guarda os
//        6 melhores, do melhor para o pior, em capa-perfil/candidato-N.jpg, com a folha capa-perfil/candidatos.jpg (da
//        esquerda para a direita, de cima para baixo, 1 a 6) e o capa-perfil/candidatos.json (com a nota e as partes dela).
//        Só os trechos do trechos.json, se ele existir.
//      node capa-perfil.mjs montar <pasta do vídeo>
//        Lê o capa-perfil.json da pasta ({ "quadro": 1 a 6, "titulo": "Texto com uma *palavra forte*", "selo": true ou
//        "texto do selo" }) e a marca (padrão ../marca.json), monta a capa 1080x1920 pelo navegador do render da HyperFrames,
//        grava a capa e a prévia do corte 3:4 da grade, confere e só então copia as duas para ../prontos/.
// Termina com CAPA OK ou CAPA REPROVADA (e sai com erro), com o motivo de cada reprovação.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, copyFileSync, rmSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname, resolve, basename, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { detector, medidas } from "./rosto.mjs";
import { HDR_SDR } from "./fonte.mjs";
import { fontes } from "./montar.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const EC = createRequire(import.meta.url)(join(RAIZ, "estilos", "comum.js"));
const TEMPO_MAX = 600000;
const ffmpeg = () => process.env.HYPERFRAMES_FFMPEG_PATH ?? "ffmpeg", ffprobe = () => process.env.HYPERFRAMES_FFPROBE_PATH ?? "ffprobe";
export const AMOSTRAS = 36, CANDIDATOS = 6, MAX_PALAVRAS = 6, MAX_SELO = 32;
export const GRADE = [240, 1680]; // a faixa 3:4 (1080x1440) que a grade do perfil mostra
const ROSTO_ALT = 480, ROSTO_Y = 640; // altura da caixa do rosto e y do centro dela na capa
const TRAVESSAO = /[\u2013\u2014]/;

function rodar(cmd, args, oque) {
  const r = spawnSync(cmd, args, { encoding: "utf8", timeout: TEMPO_MAX, maxBuffer: 1 << 28 });
  if (r.error || r.status !== 0) throw new Error(`capa-perfil: ${oque}.\n${String(r.stderr ?? r.error?.message ?? "").trim().split("\n").slice(-5).join("\n")}`);
  return r;
}

// Quadro de imagem (jpg ou png) em BGR para o detector, reduzido a 384 de largura
function bgr(arq, W, H) {
  const largura = 384, altura = Math.round((H * largura) / W / 2) * 2, alt32 = Math.ceil(altura / 32) * 32;
  const r = spawnSync(ffmpeg(), ["-v", "error", "-i", arq, "-vf", `scale=${largura}:${altura},pad=${largura}:${alt32},format=bgr24`, "-f", "rawvideo", "-"], { timeout: TEMPO_MAX, maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`capa-perfil: não consegui ler a imagem ${arq}.`);
  return { px: r.stdout, largura, altura: alt32, escala: W / largura };
}
// O maior rosto da imagem, em px da imagem: { x, y, w, h } (centro e tamanho), a confiança q e os 5 pontos k, ou null
async function rosto(det, arq, W, H) {
  const q = bgr(arq, W, H), r = await det(q.px, q.largura, q.altura);
  const c = r.sort((a, b) => b.w * b.h - a.w * a.h)[0];
  return c ? { x: c.x * q.escala, y: c.y * q.escala, w: c.w * q.escala, h: c.h * q.escala, q: c.q, k: c.k.map((v) => v * q.escala) } : null;
}

// O ângulo do rosto pelos 5 pontos do YuNet (olho da esquerda, olho da direita, nariz, cantos da boca): 1 de frente, 0
// virado. Nariz fora do meio dos olhos (virado para o lado) e linha dos olhos inclinada (cabeça tombada) tiram nota.
export function frente(k) {
  const [lx, ly, rx, ry, nx] = k, d = Math.hypot(rx - lx, ry - ly);
  if (!(d > 0)) return 0;
  const lado = Math.abs(nx - (lx + rx) / 2) / d, tombo = Math.abs(Math.atan2(ry - ly, rx - lx));
  return +(Math.max(0, 1 - lado / 0.3) * Math.max(0, 1 - tombo / 0.35)).toFixed(3);
}
// Boca no instante t pelos tempos das palavras ([{ start, end }], do transcript.json): 0 no meio de uma palavra (boca
// torta, meio aberta), 0,5 na borda de uma, 1 fora de todas (pausa: boca fechada ou sorrindo). Sem as palavras, 0,5.
export function boca(t, palavras) {
  if (!palavras?.length) return 0.5;
  if (palavras.some((w) => t > w.start + 0.06 && t < w.end - 0.06)) return 0;
  return palavras.some((w) => t > w.start - 0.06 && t < w.end + 0.06) ? 0.5 : 1;
}
// Medidas do rosto na imagem, num recorte de 160x160 em cinza da caixa dele: olhos (a fração de pixels escuros em volta de
// cada olho: a íris e a pupila aparecem com o olho aberto e somem no piscar), nitidez (variância do laplaciano: borrão de
// movimento baixa) e luz (brilho médio perto de 135 e pouca área estourada)
const LADO = 160;
function medirRosto(arq, r) {
  const x = Math.max(0, Math.round(r.x - r.w / 2)), y = Math.max(0, Math.round(r.y - r.h / 2)), w = Math.max(16, Math.round(r.w)), h = Math.max(16, Math.round(r.h));
  const p = spawnSync(ffmpeg(), ["-v", "error", "-i", arq, "-vf", `crop=${w}:${h}:${x}:${y},scale=${LADO}:${LADO},format=gray`, "-f", "rawvideo", "-"], { timeout: TEMPO_MAX, maxBuffer: 1 << 24 });
  if (p.status !== 0 || p.stdout.length < LADO * LADO) return null;
  const g = p.stdout, v = (i, j) => g[j * LADO + i], sx = LADO / w, sy = LADO / h;
  const ord = [...g].sort((a, b) => a - b), med = ord[ord.length >> 1];
  // olhos: janela de 0,3 x 0,18 da distância entre os olhos em volta de cada um
  const d = Math.hypot((r.k[2] - r.k[0]) * sx, (r.k[3] - r.k[1]) * sy), hw = Math.max(3, Math.round(0.15 * d)), hh = Math.max(2, Math.round(0.09 * d));
  let escuros = 0, n = 0;
  for (const [ex, ey] of [[r.k[0], r.k[1]], [r.k[2], r.k[3]]]) {
    const cx = Math.round((ex - x) * sx), cy = Math.round((ey - y) * sy);
    for (let j = cy - hh; j <= cy + hh; j++) for (let i = cx - hw; i <= cx + hw; i++) if (i >= 0 && j >= 0 && i < LADO && j < LADO) { n++; if (v(i, j) < 0.6 * med) escuros++; }
  }
  // nitidez no miolo do rosto (sem as bordas do recorte, onde entra fundo)
  let s = 0, s2 = 0, m = 0;
  for (let j = 24; j < LADO - 24; j++) for (let i = 24; i < LADO - 24; i++) {
    const l = 4 * v(i, j) - v(i - 1, j) - v(i + 1, j) - v(i, j - 1) - v(i, j + 1);
    s += l; s2 += l * l; m++;
  }
  const media = g.reduce((a, b) => a + b, 0) / g.length, estouro = g.filter((b) => b >= 245).length / g.length;
  return { olhos: n ? escuros / n : 0, nitidez: s2 / m - (s / m) ** 2, luz: +Math.max(0, (1 - Math.abs(media - 135) / 90) * (1 - Math.min(1, estouro * 5))).toFixed(3) };
}
// Nota de cada quadro (0 a 1): olhos e nitidez valem em relação aos outros quadros do mesmo vídeo (a mesma pessoa e a
// mesma luz), pelo 90º percentil deles; o rosto maior ganha um pouco. Grava a nota e as partes em cada achado.
export function pontuar(achados) {
  const p90 = (k) => { const v = achados.map((a) => a.medidas?.[k] ?? 0).sort((x, y) => x - y); return v[Math.floor(0.9 * (v.length - 1))] || 1; };
  const ro = p90("olhos"), rn = p90("nitidez"), hmax = Math.max(...achados.map((a) => a.rosto.h));
  for (const a of achados) {
    const m = a.medidas ?? { olhos: 0, nitidez: 0, luz: 0.5 }, c = {
      frente: frente(a.rosto.k ?? []), olhos: +Math.min(1, m.olhos / ro).toFixed(3), nitidez: +Math.min(1, m.nitidez / rn).toFixed(3), boca: a.boca ?? 0.5, luz: m.luz,
    };
    const base = 0.3 * c.frente + 0.25 * c.olhos + 0.2 * c.nitidez + 0.15 * c.boca + 0.1 * c.luz;
    a.partes = c;
    a.nota = +(base * (0.75 + (0.25 * a.rosto.h) / hmax)).toFixed(3);
  }
  return achados;
}

// Instantes de amostra espalhados pelos trechos mantidos (sem os 0,3 s das pontas de cada trecho)
export function instantes(trechos, n = AMOSTRAS) {
  const t = trechos.map(([a, b]) => [a + 0.3, b - 0.3]).filter(([a, b]) => b > a), total = t.reduce((s, [a, b]) => s + b - a, 0);
  if (!total) return [];
  return Array.from({ length: n }, (_, i) => {
    let d = ((i + 0.5) * total) / n;
    for (const [a, b] of t) { if (d <= b - a) return +(a + d).toFixed(2); d -= b - a; }
    return t.at(-1)[1];
  });
}

// Os melhores: a nota maior primeiro (sem nota, o rosto maior), no máximo um a cada 1,5 s para não repetir a mesma cena
export function escolher(achados, n = CANDIDATOS) {
  const fica = [], v = (a) => a.nota ?? a.rosto.h * a.rosto.q;
  for (const a of [...achados].sort((x, y) => v(y) - v(x)))
    if (fica.length < n && fica.every((f) => Math.abs(f.t - a.t) >= 1.5)) fica.push(a);
  return fica;
}

export async function quadros(pasta, video, { de = 0, ate = Infinity, dados, avisar = (m) => console.log(m) } = {}) {
  video ??= readdirSync(pasta).filter((f) => /^original\.\w+$/i.test(f)).map((f) => join(pasta, f))[0];
  if (!video || !existsSync(video)) throw new Error("capa-perfil: não achei o vídeo original na pasta; passe o caminho do vídeo de maior resolução, sem legenda.");
  const det = await detector(dados);
  if (!det) throw new Error("capa-perfil: o detector de rosto não está na pasta de dados; rode o preparar.sh.");
  const { W, H, duracao } = medidas(video);
  let manter = [[0, duracao]];
  if (existsSync(join(pasta, "trechos.json"))) manter = JSON.parse(readFileSync(join(pasta, "trechos.json"), "utf8")).manter ?? manter;
  manter = manter.map(([a, b]) => [Math.max(a, de), Math.min(b, ate)]).filter(([a, b]) => b > a);
  let palavras = null;
  try { palavras = JSON.parse(readFileSync(join(pasta, "transcript.json"), "utf8")).filter((w) => Number.isFinite(w.start) && Number.isFinite(w.end)); } catch { /* sem transcrição: a boca fica neutra */ }
  const p = transfer(video), saida = join(pasta, "capa-perfil");
  rmSync(saida, { recursive: true, force: true });
  mkdirSync(saida, { recursive: true });
  const achados = [];
  for (const [i, t] of instantes(manter).entries()) {
    const arq = join(saida, `q${i}.jpg`);
    // Quadro em resolução cheia, girado como o celular gravou; HDR do celular vira cor comum
    rodar(ffmpeg(), ["-v", "error", "-y", "-ss", String(t), "-i", video, "-frames:v", "1", ...(p ? ["-vf", HDR_SDR] : []), "-q:v", "2", arq], `não consegui tirar o quadro de ${t} s`);
    const m = medidas(arq), r = await rosto(det, arq, m.W, m.H);
    if (r) achados.push({ t, arq, W: m.W, H: m.H, rosto: r, medidas: medirRosto(arq, r), boca: boca(t, palavras) });
  }
  const melhores = escolher(pontuar(achados));
  if (!melhores.length) { rmSync(saida, { recursive: true, force: true }); throw new Error("capa-perfil: nenhum rosto achado no vídeo. A capa do perfil pede um rosto em close; sem ele, siga sem capa do perfil."); }
  const lista = melhores.map((a, i) => {
    const nome = `candidato-${i + 1}.jpg`;
    copyFileSync(a.arq, join(saida, nome));
    const { k: _k, ...r } = a.rosto;
    return { n: i + 1, t: a.t, arquivo: `capa-perfil/${nome}`, W: a.W, H: a.H, nota: a.nota, partes: a.partes, rosto: Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Math.round(v * 100) / 100])) };
  });
  for (const f of readdirSync(saida)) if (/^q\d+\.jpg$/.test(f)) rmSync(join(saida, f));
  writeFileSync(join(saida, "candidatos.json"), JSON.stringify(lista, null, 1));
  const folha = join(saida, "candidatos.jpg");
  rodar(ffmpeg(), ["-v", "error", "-y", "-start_number", "1", "-i", join(saida, "candidato-%d.jpg"), "-vf", `scale=360:-2,tile=3x2`, "-frames:v", "1", folha], "não consegui montar a folha dos candidatos");
  avisar(`capa-perfil: ${lista.length} quadros com rosto (de ${AMOSTRAS} olhados), do melhor ângulo para o pior (o 1 é o recomendado); folha em ${folha}`);
  return lista;
}
const transfer = (v) => ["arib-std-b67", "smpte2084"].includes(rodar(ffprobe(), ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=color_transfer", "-of", "csv=p=0", v], "não consegui ler o vídeo").stdout.trim());

// Título: uma *palavra forte*, até 6 palavras, sem travessão. Selo: true (só a marca) ou texto curto (marca + texto).
export function validar(cfg) {
  const ruim = [], titulo = typeof cfg.titulo === "string" ? cfg.titulo.replace(/\s+/g, " ").trim() : "";
  if (!/^[^*]*\*[^*]+\*[^*]*$/.test(titulo)) ruim.push('o título precisa de exatamente uma palavra forte entre asteriscos, como "Seu *sábado* vale mais".');
  const n = titulo.replace(/\*/g, "").split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  if (n > MAX_PALAVRAS) ruim.push(`o título tem ${n} palavras; cabem até ${MAX_PALAVRAS}.`);
  const selo = cfg.selo === true ? "" : typeof cfg.selo === "string" ? cfg.selo.replace(/\s+/g, " ").trim() : null;
  if (selo && selo.length > MAX_SELO) ruim.push(`o selo tem ${selo.length} letras; cabem até ${MAX_SELO}.`);
  if (TRAVESSAO.test(titulo) || TRAVESSAO.test(selo ?? "")) ruim.push("o título ou o selo tem travessão; troque por vírgula, ponto ou dois pontos.");
  return { titulo, selo, ruim };
}

// Foto em escala e posição para o rosto ficar em close, no centro, com o centro em y 640 e a imagem cobrindo a largura
export function enquadrar({ W, H, rosto: r }) {
  const s = Math.max(ROSTO_ALT / r.h, 1080 / W);
  const left = Math.min(0, Math.max(1080 - W * s, 540 - r.x * s)), top = ROSTO_Y - r.y * s;
  return { s, left: Math.round(left), top: Math.round(top), largura: Math.round(W * s) };
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const hex = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");

function pagina({ titulo, selo, foto, q, marca, logo, css }) {
  const cor = marca.cores, escuro = cor.fundo_escuro;
  const claro = hex(EC.legivel(cor.fundo_claro, "#FFFFFF", escuro, 7)), forte = hex(EC.legivel(cor.destaque, "#FFFFFF", escuro, 4.6));
  const t = esc(titulo).replace(/\*([^*]+)\*/, '<em id="capa-forte">$1</em>');
  const marcaSelo = logo ? `<img id="selo-logo" src="${logo}" alt="${esc(marca.nome ?? "")}">` : `<span id="selo-nome">${esc(marca.nome ?? "")}</span>`;
  const seloHtml = selo == null ? "" : `<div id="selo">${marcaSelo}${selo ? `<div id="selo-sep"></div><span id="selo-texto">${esc(selo)}</span>` : ""}</div>`;
  const imgFoto = `src="${foto}" style="left:${q.left}px;top:${q.top}px;width:${q.largura}px"`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${css}
:root{--escuro:${escuro};--claro:${claro};--forte:${forte}}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;overflow:hidden;background:var(--escuro);font-family:"${esc(marca.fontes.titulo)}",sans-serif;-webkit-font-smoothing:antialiased}
#fundo,#foto{position:absolute;height:auto;max-width:none}
#fundo{filter:blur(30px) brightness(.55)}
#foto{filter:saturate(.95) contrast(1.04)${q.top > 0 ? ";-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 140px)" : ""}}
#sombra{position:absolute;inset:0;background:linear-gradient(180deg,
 color-mix(in srgb,var(--escuro) 80%,transparent) 0,color-mix(in srgb,var(--escuro) 12%,transparent) 420px,transparent 600px,
 transparent 860px,color-mix(in srgb,var(--escuro) 95%,transparent) 1100px,var(--escuro) 1260px)}
#bloco{position:absolute;left:80px;right:80px;bottom:280px;text-align:center}
#filete{width:120px;height:5px;background:var(--forte);margin:0 auto 34px}
#titulo{font-weight:800;font-size:120px;line-height:1.0;letter-spacing:-.035em;color:var(--claro);text-wrap:balance}
#capa-forte{font-style:normal;color:var(--forte)}
#selo{display:inline-flex;margin-top:44px;align-items:center;gap:24px;max-width:920px;white-space:nowrap;
 background:color-mix(in srgb,var(--escuro) 80%,transparent);border:2px solid color-mix(in srgb,var(--forte) 70%,transparent);border-radius:999px;padding:16px 36px}
#selo-logo{height:60px;width:auto;max-width:360px;object-fit:contain;display:block}
#selo-nome,#selo-texto{font-weight:800;font-size:38px;letter-spacing:-.01em;color:var(--claro)}
#selo-sep{width:2px;height:46px;background:color-mix(in srgb,var(--forte) 60%,transparent)}
</style></head><body>
${q.top > 0 ? `<img id="fundo" ${imgFoto.replace(`top:${q.top}px`, `top:${Math.round(q.top - 230)}px`)} alt="">` : ""}
<img id="foto" ${imgFoto} alt="">
<div id="sombra"></div>
<div id="bloco"><div id="filete"></div><div id="titulo">${t}</div>${seloHtml}</div>
<script>
// Título em até 3 linhas e sem palavra cortada: diminui a fonte até caber (de 120 a 84 px). Depois mede o que a conferência lê.
document.fonts.ready.then(() => {
  const t = document.getElementById("titulo"), linhas = () => Math.round(t.getBoundingClientRect().height / parseFloat(getComputedStyle(t).lineHeight));
  for (let f = 120; f >= 84 && (linhas() > 3 || t.scrollWidth > t.clientWidth + 1); f -= 6) t.style.fontSize = f + "px";
  const r = (id) => { const e = document.getElementById(id); if (!e) return null; const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom].map(Math.round); };
  document.documentElement.dataset.medidas = JSON.stringify({ bloco: r("bloco"), titulo: r("titulo"), selo: r("selo"), linhas: linhas(), fonte: parseFloat(t.style.fontSize || 120),
    largo: t.scrollWidth > t.clientWidth + 1, fontes: [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family) });
});
</script></body></html>`;
}

function navegador() {
  const r = rodar("bash", [join(RAIZ, "scripts", "hf").replace(/\\/g, "/"), "browser", "path"], "não achei o navegador do render; rode hf browser ensure");
  const p = r.stdout.trim().split(/\r?\n/).pop().trim();
  if (!existsSync(p)) throw new Error("capa-perfil: não achei o navegador do render; rode hf browser ensure.");
  return p;
}
const CHROME = ["--headless", "--hide-scrollbars", "--window-size=1080,1920", "--force-device-scale-factor=1", "--allow-file-access-from-files", "--virtual-time-budget=5000", "--default-background-color=000000ff"];

export async function montarCapa(pasta, { dados, avisar = (m) => console.log(m) } = {}) {
  const ler = (a, oque) => { if (!existsSync(a)) throw new Error(`capa-perfil: falta ${oque} (${a}).`); return JSON.parse(readFileSync(a, "utf8")); };
  const cfg = ler(join(pasta, "capa-perfil.json"), "o capa-perfil.json");
  const lista = ler(join(pasta, "capa-perfil", "candidatos.json"), "o capa-perfil/candidatos.json (rode antes o quadros)");
  const v = validar(cfg);
  if (v.ruim.length) throw new Error(`capa-perfil: ${v.ruim.join(" ")}`);
  const cand = lista.find((c) => c.n === cfg.quadro);
  if (!cand) throw new Error(`capa-perfil: "quadro" precisa ser um dos candidatos, de 1 a ${lista.length}.`);
  const escolhas = existsSync(join(pasta, "escolhas.json")) ? ler(join(pasta, "escolhas.json"), "o escolhas.json") : {};
  const arqMarca = resolve(pasta, cfg.marca ?? escolhas.marca ?? "../marca.json"), marca = ler(arqMarca, "o marca.json");
  if (!marca.cores?.fundo_escuro || !marca.cores?.fundo_claro || !marca.cores?.destaque || !marca.fontes?.titulo) throw new Error("capa-perfil: o marca.json precisa das cores fundo_escuro, fundo_claro e destaque e da fonte dos títulos.");
  let logo = null;
  if (v.selo != null && marca.logo) {
    const a = resolve(dirname(arqMarca), String(marca.logo)), ext = extname(a).toLowerCase();
    if (existsSync(a) && [".png", ".jpg", ".jpeg", ".webp", ".svg"].includes(ext)) { copyFileSync(a, join(pasta, "capa-perfil", "logo" + ext)); logo = "capa-perfil/logo" + ext; }
  }
  if (v.selo != null && !logo && !marca.nome) throw new Error('capa-perfil: o selo mostra o logo ou o "nome" do marca.json; falta os dois.');
  const q = enquadrar(cand);
  if (q.s > 1.6) avisar("capa-perfil: o rosto está pequeno neste quadro e a imagem foi ampliada; se a capa sair borrada, use o vídeo original de maior resolução ou outro candidato.");
  const css = fontes(join(pasta, "fonts"), { titulo: marca.fontes.titulo }, ["titulo"], avisar);
  const htmlArq = join(pasta, "capa-perfil.html");
  writeFileSync(htmlArq, pagina({ titulo: v.titulo, selo: v.selo, foto: cand.arquivo, q, marca, logo, css }));
  const url = pathToFileURL(htmlArq).href, chrome = navegador(), png = join(pasta, "capa-perfil", "capa.png");
  const dom = rodar(chrome, [...CHROME, "--dump-dom", url], "o navegador não abriu a capa").stdout;
  const med = JSON.parse((/data-medidas="([^"]*)"/.exec(dom)?.[1] ?? "null").replace(/&quot;/g, '"'));
  rodar(chrome, [...CHROME, `--screenshot=${png}`, url], "o navegador não gravou a capa");
  const capa = join(pasta, "capa-perfil", "capa.jpg"), grade = join(pasta, "capa-perfil", "capa-grade.jpg");
  rodar(ffmpeg(), ["-v", "error", "-y", "-i", png, "-q:v", "2", capa], "não consegui gravar a capa em JPG");
  rodar(ffmpeg(), ["-v", "error", "-y", "-i", png, "-vf", `crop=1080:${GRADE[1] - GRADE[0]}:0:${GRADE[0]}`, "-q:v", "2", grade], "não consegui gravar a prévia da grade");
  rmSync(png, { force: true });

  // Conferência: tamanho, título e rosto dentro do 3:4, rosto livre do título, sem travessão
  const ruim = [];
  const a = medidas(capa), b = medidas(grade);
  if (a.W !== 1080 || a.H !== 1920) ruim.push(`a capa saiu com ${a.W}x${a.H}, e não em 1080x1920.`);
  if (b.W !== 1080 || b.H !== 1440) ruim.push(`a prévia da grade saiu com ${b.W}x${b.H}, e não em 1080x1440.`);
  if (!med) ruim.push("não consegui medir o título na página da capa.");
  else {
    if (med.bloco[1] < GRADE[0] || med.bloco[3] > GRADE[1]) ruim.push("o título ou o selo sai da faixa 3:4 da grade.");
    if (med.linhas > 3 || med.largo) ruim.push("o título não coube em 3 linhas; encurte o texto.");
    if (!med.fontes.includes(marca.fontes.titulo)) ruim.push(`a fonte ${marca.fontes.titulo} não carregou; confira a pasta fonts/.`);
  }
  const det = await detector(dados);
  if (!det) avisar("capa-perfil: sem o detector de rosto nesta pasta de dados; olhe a capa para conferir o rosto.");
  else {
    const r = await rosto(det, capa, 1080, 1920);
    if (!r) ruim.push("não achei o rosto na capa pronta.");
    else {
      const topo = r.y - r.h / 2, base = r.y + r.h / 2;
      if (topo < GRADE[0] || base > GRADE[1]) ruim.push("o rosto sai da faixa 3:4 da grade.");
      if (med && base > med.bloco[1]) ruim.push("o título cobre o rosto.");
      else avisar(`capa-perfil: rosto entre y ${Math.round(topo)} e ${Math.round(base)}, título começa em ${med?.bloco[1]}`);
    }
  }
  if (TRAVESSAO.test(v.titulo) || TRAVESSAO.test(v.selo ?? "")) ruim.push("o título ou o selo tem travessão.");
  if (ruim.length) { avisar(`CAPA REPROVADA:\n- ${ruim.join("\n- ")}`); return { ok: false, ruim, capa, grade }; }
  const prontos = resolve(pasta, "..", "prontos"), nome = basename(pasta);
  mkdirSync(prontos, { recursive: true });
  const entrega = [join(prontos, `${nome}-capa.jpg`), join(prontos, `${nome}-capa-grade.jpg`)];
  copyFileSync(capa, entrega[0]);
  copyFileSync(grade, entrega[1]);
  avisar(`capa-perfil: capa em ${entrega[0]}\ncapa-perfil: prévia da grade em ${entrega[1]}\nCAPA OK`);
  return { ok: true, ruim, capa, grade, entrega, medidas: med };
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), opt = (n) => { const i = args.indexOf(n); return i >= 0 ? +args[i + 1] : undefined; };
  const livres = args.filter((x, i) => !x.startsWith("--") && !["--de", "--ate"].includes(args[i - 1])), [cmd, pasta, video] = livres;
  try {
    if (cmd === "quadros" && pasta) await quadros(resolve(pasta), video && resolve(video), { de: opt("--de"), ate: opt("--ate") });
    else if (cmd === "montar" && pasta) { const r = await montarCapa(resolve(pasta)); process.exit(r.ok ? 0 : 1); }
    else { console.error("Uso: node capa-perfil.mjs quadros <pasta do vídeo> [vídeo] [--de S] [--ate S]\n     node capa-perfil.mjs montar <pasta do vídeo>"); process.exit(1); }
  } catch (e) { console.error(e.message); process.exit(1); }
}
