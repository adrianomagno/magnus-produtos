// Conferência de dado pessoal (passo 3b de references/audio-e-corte.md), antes da prévia: procura CPF e CNPJ (com o dígito
// verificador certo, também o CNPJ com letras), telefone no formato brasileiro e e-mail no texto falado que fica na edição
// e, no Mac, no texto que aparece na tela da gravação. A tela é lida pela leitura de texto do próprio macOS (Vision, pelo
// osascript), sem instalar nada e sem mandar o vídeo para fora do computador. Lista também os nomes possíveis da fala e
// todo o outro texto da tela, sem repetir, para o Claude julgar nome de cliente ou paciente, processo e prontuário.
// Uso: node sigilo.mjs <pasta do vídeo>                 grava sigilo.json e imprime o resumo
//      node sigilo.mjs <pasta do vídeo> --borrar 1,3    junta ao borrar.json as áreas da tela com esses números do resumo;
//                                                       o fonte.mjs borra essas áreas toda vez que grava a fonte.mp4
// Fora do Mac confere só o texto falado e diz que não leu a tela.
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, rmSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { filtros } from "./fonte.mjs";

const TEMPO_MAX = 600000;
// Um quadro por segundo de cada trecho que fica, mais o início de cada trecho. A área borra MARGEM s antes do primeiro
// quadro em que o texto aparece e depois do último.
// ponytail: texto que fica menos de 1 s na tela pode escapar, e texto que rola na tela borra só onde foi visto; se a prova
// mostrar, suba para 2 quadros por segundo ou siga a área quadro a quadro
const A_CADA = 1, MARGEM = 1, LOTE = 100, MAX_OUTROS = 150;
const ffmpeg = () => process.env.HYPERFRAMES_FFMPEG_PATH ?? "ffmpeg";
const ultima = (s) => String(s ?? "").trim().split("\n").pop();

// Dígito verificador da Receita (CPF e CNPJ, também o CNPJ com letras: cada letra vale o código dela menos 48)
const dv = (s, pesos) => { const r = pesos.reduce((t, p, i) => t + (s.charCodeAt(i) - 48) * p, 0) % 11; return r < 2 ? 0 : 11 - r; };
const P = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2], C = [10, 9, 8, 7, 6, 5, 4, 3, 2];
export function cpfValido(s) {
  const d = String(s).replace(/\D/g, "");
  return d.length === 11 && !/^(\d)\1+$/.test(d) && dv(d, C) === +d[9] && dv(d, [11, ...C]) === +d[10];
}
export function cnpjValido(s) {
  const d = String(s).toUpperCase().replace(/[^0-9A-Z]/g, "");
  return /^[0-9A-Z]{12}\d{2}$/.test(d) && !/^(\d)\1+$/.test(d) && dv(d, P) === +d[12] && dv(d, [6, ...P]) === +d[13];
}
// Telefone: celular com DDD (11 dígitos, o terceiro é 9), fixo com DDD (10 dígitos, separado em blocos) ou celular sem
// DDD com hífen; com +55 na frente também. Fixo sem DDD fica de fora: "2025-2026" seria telefone.
export function telefoneValido(s) {
  let d = String(s).replace(/\D/g, "");
  if (/^\s*\+?55/.test(s) && d.length >= 12) d = d.slice(2);
  const ddd = /^[1-9][1-9]/.test(d), blocos = /[\s().-]/.test(String(s).trim());
  return (d.length === 11 && ddd && d[2] === "9") || (d.length === 10 && ddd && /[2-5]/.test(d[2]) && blocos) || (d.length === 9 && d[0] === "9" && /-/.test(s));
}
const HIFEN = "-\\u2010-\\u2015"; // o leitor da tela às vezes devolve o hífen como traço
const SEP = `(?<![\\p{L}\\p{N}@])`, FIM = `(?![\\p{L}\\p{N}])`;
const PADROES = [
  ["CNPJ", new RegExp(`${SEP}(?:\\d{2}\\.?\\d{3}\\.?\\d{3}\\/?\\d{4}[${HIFEN}]?\\d{2}|[0-9A-Z]{2}\\.[0-9A-Z]{3}\\.[0-9A-Z]{3}\\/[0-9A-Z]{4}[${HIFEN}]\\d{2})${FIM}`, "gu"), cnpjValido],
  ["CPF", new RegExp(`${SEP}\\d{3}\\.?\\d{3}\\.?\\d{3}[${HIFEN}]?\\d{2}${FIM}`, "gu"), cpfValido],
  ["telefone", new RegExp(`${SEP}(?:\\+?55\\s?)?(?:\\(\\d{2}\\)\\s?|\\d{2}[${HIFEN}\\s.]?)?9?\\d{4}[${HIFEN}\\s.]?\\d{4}${FIM}`, "gu"), telefoneValido],
  ["e-mail", /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}/gu, () => true],
];

// Dados pessoais num texto: [{ tipo, valor, inicio, fim }]. Cada achado é apagado do texto antes do próximo padrão
// (o CPF não volta como telefone).
export function procurar(texto) {
  let t = String(texto);
  const achados = [];
  for (const [tipo, re, valido] of PADROES)
    for (const m of [...t.matchAll(re)]) {
      if (!valido(m[0])) continue;
      achados.push({ tipo, valor: m[0], inicio: m.index, fim: m.index + m[0].length });
      t = t.slice(0, m.index) + " ".repeat(m[0].length) + t.slice(m.index + m[0].length);
    }
  return achados.sort((a, b) => a.inicio - b.inicio);
}

// O texto falado que fica na edição: as palavras fora dos cortes extras (a mesma regra do montar.mjs, pelo meio da palavra)
const naEdicaoFala = (transcript, extras = []) => transcript.filter((w) => !extras.some(([x, y]) => (w.start + w.end) / 2 > x && (w.start + w.end) / 2 < y));

// Na fala: os padrões no texto corrido e nos números ditos em pedaços ("123 456 789 09"), com o tempo; e os nomes
// possíveis (palavras com maiúscula fora do começo da frase, ou duas ou mais seguidas, com "da", "de", "dos" no meio)
export function naFala(transcript, extras = []) {
  const pal = naEdicaoFala(transcript, extras), pos = [];
  let texto = "";
  for (const w of pal) { pos.push(texto.length); texto += `${w.text} `; }
  const palavra = (c) => pos.findLastIndex((p) => p <= c);
  const achados = procurar(texto).map((a) => ({ tipo: a.tipo, valor: a.valor, de: pal[palavra(a.inicio)].start, ate: pal[palavra(a.fim - 1)].end }));
  const num = (w) => /^\(?\+?\d[\d.\/()\u2010-\u2015-]*[,;:!?.]?$/u.test(w.text);
  for (let i = 0; i < pal.length; i++) {
    for (let j = Math.min(pal.length, i + 8); j >= i + 2; j--) {
      if (!pal.slice(i, j).every(num)) continue;
      const d = pal.slice(i, j).map((w) => w.text.replace(/\D/g, "")).join("");
      const tipo = d.length === 11 && cpfValido(d) ? "CPF" : d.length === 14 && cnpjValido(d) ? "CNPJ" : telefoneValido(pal.slice(i, j).map((w) => w.text).join(" ")) ? "telefone" : null;
      if (!tipo) continue;
      if (!achados.some((a) => a.de === pal[i].start)) achados.push({ tipo, valor: pal.slice(i, j).map((w) => w.text).join(" "), de: pal[i].start, ate: pal[j - 1].end });
      i = j - 1;
      break;
    }
  }
  // sigla toda em maiúscula (CPF, OAB, SUS) não é nome
  const limpa = (s) => s.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, ""), maiuscula = (k) => /^\p{Lu}(?!\p{Lu}*$)/u.test(limpa(pal[k]?.text ?? ""));
  const comeco = (k) => k === 0 || /[.?!:]["')]*$/.test(pal[k - 1].text), LIGA = new Set(["da", "de", "do", "das", "dos", "e"]);
  const nomes = [];
  for (let k = 0; k < pal.length; k++) {
    if (!maiuscula(k)) continue;
    let f = k + 1;
    while (f < pal.length && !comeco(f) && (maiuscula(f) || (LIGA.has(limpa(pal[f].text)) && maiuscula(f + 1) && !comeco(f + 1)))) f++;
    const n = pal.slice(k, f).filter((w) => /^\p{Lu}/u.test(limpa(w.text))).length;
    if (!comeco(k) || n >= 2) {
      const nome = pal.slice(k, f).map((w) => limpa(w.text)).join(" ");
      if (!nomes.some((x) => x.nome === nome)) nomes.push({ nome, de: pal[k].start });
    }
    k = f - 1;
  }
  return { achados: achados.sort((a, b) => a.de - b.de), nomes };
}

// A leitura de texto do macOS (Vision): para cada imagem, as linhas achadas { texto, q, caixa: [x, y, largura, altura] }, em
// fração da imagem, com o topo em cima. Um osascript para cada LOTE de imagens.
const LER = `ObjC.import('Vision');
function run(argv) {
  return JSON.stringify(argv.map((arq) => {
    const req = $.VNRecognizeTextRequest.alloc.init;
    req.recognitionLevel = 0;
    req.usesLanguageCorrection = false;
    req.recognitionLanguages = $(['pt-BR', 'en-US']);
    const h = $.VNImageRequestHandler.alloc.initWithURLOptions($.NSURL.fileURLWithPath(arq), $({}));
    if (!h.performRequestsError($([req]), null)) throw new Error('a leitura de texto falhou em ' + arq);
    const r = req.results, linhas = [];
    for (let i = 0; i < r.count; i++) {
      const o = r.objectAtIndex(i), c = o.topCandidates(1).objectAtIndex(0), b = o.boundingBox;
      linhas.push({ texto: c.string.js, q: Math.round(c.confidence * 100) / 100, caixa: [b.origin.x, 1 - b.origin.y - b.size.height, b.size.width, b.size.height].map((v) => Math.round(v * 10000) / 10000) });
    }
    return linhas;
  }));
}`;
export const telaDisponivel = () => process.platform === "darwin";
export function lerTela(imagens) {
  if (!telaDisponivel()) throw new Error("sigilo: a leitura de texto da tela só existe no Mac.");
  const saida = [];
  for (let i = 0; i < imagens.length; i += LOTE) {
    const r = spawnSync("osascript", ["-l", "JavaScript", "-e", LER, ...imagens.slice(i, i + LOTE)], { encoding: "utf8", timeout: TEMPO_MAX, maxBuffer: 1 << 26 });
    if (r.error || r.status !== 0) throw new Error(`sigilo: a leitura de texto do macOS não rodou (${ultima(r.error?.message ?? r.stderr)}).`);
    saida.push(...JSON.parse(r.stdout));
  }
  return saida;
}

// Imagem com um texto escuro sobre um retângulo branco (o resto transparente), desenhada pelo próprio macOS: é o "dado
// de mentira" do autoteste e dos testes, sem arquivo do dono. x e y (fração da imagem) são o canto de cima do texto.
export function imagemComTexto(arq, largura, altura, texto, { x = 0.08, y = 0.12, tamanho = 0.03 } = {}) {
  const js = `ObjC.import('AppKit');
function run(a) {
  const W = +a[1], H = +a[2], f = Math.round(H * +a[6]);
  const rep = $.NSBitmapImageRep.alloc.initWithBitmapDataPlanesPixelsWidePixelsHighBitsPerSampleSamplesPerPixelHasAlphaIsPlanarColorSpaceNameBytesPerRowBitsPerPixel(null, W, H, 8, 4, true, false, $.NSDeviceRGBColorSpace, 0, 0);
  $.NSGraphicsContext.saveGraphicsState;
  $.NSGraphicsContext.setCurrentContext($.NSGraphicsContext.graphicsContextWithBitmapImageRep(rep));
  const at = $.NSDictionary.dictionaryWithObjectsForKeys($([$.NSFont.boldSystemFontOfSize(f), $.NSColor.blackColor]), $(['NSFont', 'NSColor']));
  const s = $(a[3]), t = s.sizeWithAttributes(at), x = W * +a[4], y = H - H * +a[5] - t.height;
  $.NSColor.whiteColor.setFill;
  $.NSRectFill($.NSMakeRect(x - f * 0.4, y - f * 0.3, t.width + f * 0.8, t.height + f * 0.6));
  s.drawAtPointWithAttributes($.NSMakePoint(x, y), at);
  $.NSGraphicsContext.restoreGraphicsState;
  return rep.representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $({})).writeToFileAtomically(a[0], true) ? 'ok' : 'falhou';
}`;
  const r = spawnSync("osascript", ["-l", "JavaScript", "-e", js, arq, String(largura), String(altura), texto, String(x), String(y), String(tamanho)], { encoding: "utf8", timeout: TEMPO_MAX });
  if (r.error || r.status !== 0 || r.stdout.trim() !== "ok") throw new Error(`sigilo: o macOS não desenhou a imagem de teste (${ultima(r.error?.message ?? r.stderr)}).`);
}

// Os quadros que a leitura da tela olha: o início de cada trecho mantido e um a cada A_CADA s dentro dele, do original
// girado como o ffmpeg gira e com a mesma redução e conversão de HDR da fonte.mp4 (sem visual de cor, sem borrão).
export function tirarQuadros(original, manter, pasta) {
  const tempos = [];
  for (const [a, b] of manter) for (let t = a; t < b; t += A_CADA) if (!tempos.length || t - tempos.at(-1) >= 0.3) tempos.push(+t.toFixed(2));
  rmSync(pasta, { recursive: true, force: true });
  mkdirSync(pasta, { recursive: true });
  // Com 10 quadros por segundo antes (a gravação de tela muda de ritmo), cada janela de 0,1 s tem exatamente um quadro
  const sel = tempos.map((t) => `between(t\\,${t}\\,${(t + 0.099).toFixed(3)})`).join("+");
  const r = spawnSync(ffmpeg(), ["-hide_banner", "-nostats", "-i", original, "-an", "-vf", `fps=10,select=${sel},${filtros(original).vf},showinfo`, "-fps_mode", "passthrough", "-q:v", "2", join(pasta, "q%05d.jpg")],
    { encoding: "utf8", timeout: TEMPO_MAX, maxBuffer: 1 << 26 });
  if (r.error || r.status !== 0) throw new Error(`sigilo: o ffmpeg não tirou os quadros de ${original} (${ultima(r.error?.message ?? r.stderr)}).`);
  const ts = [...r.stderr.matchAll(/Parsed_showinfo.*?pts_time:\s*([\d.]+)/g)].map((m) => +m[1]);
  return ts.map((t, i) => ({ t, arq: join(pasta, `q${String(i + 1).padStart(5, "0")}.jpg`) })).filter((q) => existsSync(q.arq));
}

const cruza = (a, b) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];
const uniao = (a, b) => { const x = Math.min(a[0], b[0]), y = Math.min(a[1], b[1]); return [x, y, Math.max(a[0] + a[2], b[0] + b[2]) - x, Math.max(a[1] + a[3], b[1] + b[3]) - y]; };
// Folga em volta da linha lida: um terço da altura em cima e embaixo, meia altura dos lados (a letra inteira some)
const folga = ([x, y, w, h]) => {
  const x0 = Math.max(0, x - h / 2), y0 = Math.max(0, y - h / 3), x1 = Math.min(1, x + w + h / 2), y1 = Math.min(1, y + h + h / 3);
  return [x0, y0, x1 - x0, y1 - y0].map((v) => +v.toFixed(4));
};

// Junta o texto lido em cada quadro: um item por dado achado (tipo e valor) ou por linha de outro texto (sem repetir),
// cada um com as aparições (quadros seguidos), o tempo em que foi visto e as áreas a borrar (as caixas que se cruzam
// viram uma só)
export function agrupar(amostras, duracao) {
  const grupos = new Map();
  amostras.forEach(({ linhas }, k) => linhas.forEach(({ texto, caixa }) => {
    const achados = procurar(texto), chaves = achados.length ? achados.map((a) => [`${a.tipo}:${a.valor.toLowerCase().replace(/[^0-9a-z@]/g, "")}`, a.tipo, a.valor])
      : [[`texto:${texto.replace(/\s+/g, " ").trim().toLowerCase()}`, "texto", null]];
    for (const [chave, tipo, valor] of chaves) {
      if (!grupos.has(chave)) grupos.set(chave, { tipo, valor, texto: texto.replace(/\s+/g, " ").trim(), vistos: [] });
      grupos.get(chave).vistos.push([k, folga(caixa)]);
    }
  }));
  const itens = [...grupos.values()].map(({ vistos, ...g }) => {
    const aparicoes = [];
    for (const [k, c] of vistos) {
      const ult = aparicoes.at(-1);
      if (ult && k - ult.k1 <= 1) { ult.k1 = k; ult.caixas.push(c); } else aparicoes.push({ k0: k, k1: k, caixas: [c] });
    }
    return { ...g, aparicoes: aparicoes.map(({ k0, k1, caixas }) => {
      const juntas = [];
      for (const c of caixas) { const i = juntas.findIndex((j) => cruza(j, c)); if (i < 0) juntas.push(c); else juntas[i] = uniao(juntas[i], c); }
      const t0 = amostras[k0].t, t1 = amostras[k1].t;
      return { visto: [t0, t1], de: +Math.max(0, t0 - MARGEM).toFixed(2), ate: +Math.min(duracao ?? Infinity, t1 + MARGEM).toFixed(2), caixas: juntas.map((c) => c.map((v) => +v.toFixed(4))) };
    }) };
  });
  // Os dados primeiro, depois o outro texto, cada grupo na ordem em que aparece; o número é o que o --borrar usa
  const ordem = (a, b) => (a.tipo === "texto") - (b.tipo === "texto") || a.aparicoes[0].visto[0] - b.aparicoes[0].visto[0];
  return itens.sort(ordem).map((it, i) => ({ n: i + 1, ...it }));
}

// Segundo do original para o segundo do vídeo editado (parte cortada vira o ponto da emenda)
export function naEdicao(t, manter) {
  let pos = 0;
  for (const [a, b] of manter) { if (t < a) return pos; if (t <= b) return pos + t - a; pos += b - a; }
  return pos;
}
const relogio = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// A conferência inteira da pasta do vídeo: grava sigilo.json e devolve o mesmo objeto
export function conferirDados(pasta, { tela = telaDisponivel() } = {}) {
  const ler = (nome) => { try { return JSON.parse(readFileSync(join(pasta, nome), "utf8")); } catch { throw new Error(`sigilo: falta o ${nome} na pasta do vídeo (passos 2 e 3 de references/audio-e-corte.md).`); } };
  const transcript = ler("transcript.json"), corte = ler("trechos.json"), manter = corte.manter ?? [];
  const fala = naFala(transcript, corte.extras ?? []);
  const r = { tela: { lida: false }, fala: fala.achados, nomes: fala.nomes, itens: [], manter };
  if (!tela) r.tela.motivo = "fora do Mac";
  else {
    const original = readdirSync(pasta).find((a) => /^original\.[^.]+$/i.test(a));
    if (!original) throw new Error("sigilo: falta o original (original.mp4 ou a extensão do vídeo do dono) na pasta do vídeo.");
    const dir = join(pasta, "sigilo-quadros");
    try {
      const q = tirarQuadros(join(pasta, original), manter, dir), linhas = lerTela(q.map((x) => x.arq));
      r.itens = agrupar(q.map((x, i) => ({ t: x.t, linhas: linhas[i] })), corte.duracao);
      r.tela = { lida: true, quadros: q.length };
    } catch (e) {
      r.tela.motivo = e.message;
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
  writeFileSync(join(pasta, "sigilo.json"), JSON.stringify(r, null, 1));
  return r;
}

// O resumo para o Claude: os dados achados primeiro, com o tempo no vídeo editado; depois o que ele precisa julgar
export function resumo(r) {
  const ed = (t) => relogio(naEdicao(t, r.manter)), l = [], dados = r.itens.filter((i) => i.tipo !== "texto"), outros = r.itens.filter((i) => i.tipo === "texto");
  const quando = (it) => it.aparicoes.map((a) => (ed(a.visto[0]) === ed(a.visto[1]) ? `em ${ed(a.visto[0])}` : `de ${ed(a.visto[0])} a ${ed(a.visto[1])}`)).join(", ");
  l.push(r.tela.lida ? `sigilo: tela lida em ${r.tela.quadros} quadros.` : r.tela.motivo === "fora do Mac"
    ? "sigilo: a tela não foi lida neste computador (a leitura de texto da tela só existe no Mac); conferido só o texto falado."
    : `sigilo: a tela não foi lida (${r.tela.motivo}); conferido só o texto falado.`);
  for (const a of r.fala) l.push(`NA FALA: ${a.tipo} "${a.valor}" em ${ed(a.de)} do vídeo editado (${a.de.toFixed(2)} a ${a.ate.toFixed(2)} s do original).`);
  for (const it of dados) l.push(`NA TELA [${it.n}]: ${it.tipo} na linha "${it.texto}", ${quando(it)} do vídeo editado.`);
  if (!r.fala.length && !dados.length) l.push("sigilo: nenhum CPF, CNPJ, telefone ou e-mail achado.");
  if (r.nomes.length) l.push(`Nomes possíveis na fala (julgue): ${r.nomes.map((n) => `${n.nome} (${ed(n.de)})`).join("; ")}.`);
  if (outros.length) {
    l.push("Outro texto da tela (julgue nome de cliente ou paciente, processo, prontuário):");
    for (const it of outros.slice(0, MAX_OUTROS)) l.push(`  [${it.n}] "${it.texto}", ${quando(it)}`);
    if (outros.length > MAX_OUTROS) l.push(`  ... e mais ${outros.length - MAX_OUTROS} no sigilo.json.`);
  }
  return l.join("\n");
}

// Junta ao borrar.json as áreas dos itens escolhidos (sem repetir as que já estão lá); devolve o total de áreas
export function escolherBorrar(pasta, numeros) {
  let r;
  try { r = JSON.parse(readFileSync(join(pasta, "sigilo.json"), "utf8")); } catch { throw new Error("sigilo: falta o sigilo.json; rode antes node sigilo.mjs <pasta do vídeo>."); }
  const arq = join(pasta, "borrar.json"), areas = existsSync(arq) ? JSON.parse(readFileSync(arq, "utf8")).areas ?? [] : [], ja = new Set(areas.map((a) => JSON.stringify([a.de, a.ate, a.caixa])));
  for (const n of numeros) {
    const it = r.itens.find((i) => i.n === n);
    if (!it) throw new Error(`sigilo: não há item ${n} da tela no sigilo.json (os números são os de [n] do resumo).`);
    for (const a of it.aparicoes) for (const caixa of a.caixas) {
      const chave = JSON.stringify([a.de, a.ate, caixa]);
      if (!ja.has(chave)) { ja.add(chave); areas.push({ de: a.de, ate: a.ate, caixa, texto: it.texto }); }
    }
  }
  writeFileSync(arq, JSON.stringify({ areas }, null, 1));
  return areas.length;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), pasta = args[0], i = args.indexOf("--borrar");
  if (!pasta || pasta.startsWith("--")) { console.error("Uso: node sigilo.mjs <pasta do vídeo>  ou  node sigilo.mjs <pasta do vídeo> --borrar 1,3"); process.exit(1); }
  try {
    if (i >= 0) {
      const nums = String(args[i + 1] ?? "").split(",").map((x) => +x.trim());
      if (!nums.length || nums.some((n) => !Number.isInteger(n) || n < 1)) throw new Error("sigilo: --borrar pede os números do resumo, separados por vírgula, como --borrar 1,3.");
      const n = escolherBorrar(resolve(pasta), nums);
      console.log(`sigilo: borrar.json com ${n} ${n > 1 ? "áreas" : "área"}. Grave a fonte de novo (passo 1, com as mesmas opções) e rode o passo 1b.`);
    } else console.log(resumo(conferirDados(resolve(pasta))));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
