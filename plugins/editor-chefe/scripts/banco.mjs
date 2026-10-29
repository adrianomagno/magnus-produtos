// Banco de peças do Editor Chefe (objetos 3D, ícones sóbrios e logos de aplicativo), procurado nesta ordem:
// 1. o conjunto que vem no plugin (pecas/ e o manifest.json), que funciona sem internet;
// 2. o banco local do cliente, a pasta biblioteca/ ao lado das pastas dos vídeos (Documentos/Editor Chefe/biblioteca/),
//    com o catalogo.json: toda peça que entra num vídeo fica guardada ali, por tipo, sem repetir (mesmo nome ou mesmo
//    SHA-256), com o vídeo em que foi usada. O que é do cliente (o logo dele, os prints) fica em cliente/ e não sai dali;
// 3. o banco central do MAGNUS: a pasta biblioteca/ do repositório magnus-produtos no GitHub, lida pelo commit que o
//    plugin fixa por versão (pecas/banco-central.json, com o SHA-256 do catálogo). O endereço não muda com o commit, e o
//    catálogo e cada arquivo são conferidos pelo SHA-256 antes de usar; a peça baixada vai para o banco local.
// Sem a peça nos três, o montador usa uma genérica e o pedidoDePeca() monta a frase para o dono pedir a peça ao Magnus.
// Para testes e provas, EDITOR_CHEFE_BIBLIOTECA troca a pasta do banco local, EDITOR_CHEFE_BANCO_PINO o pino (o commit
// e o SHA-256 do catálogo) e EDITOR_CHEFE_BANCO_CENTRAL uma pasta local que faz o papel do repositório naquele commit.
// Uso (curadoria, só do MAGNUS): node banco.mjs propor <imagem> --nome <nome> --tipo objeto --familia 3d --origem
//   fluent-emoji --licenca MIT --fonte <https://...> --palavras "a,b" --motivo "..." --para <biblioteca/propostas>
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, realpathSync } from "node:fs";
import { join, dirname, resolve, extname, basename, sep } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { procurar } from "./sigilo.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const PECAS = JSON.parse(readFileSync(join(RAIZ, "pecas", "manifest.json"), "utf8"));
const sha256 = (b) => createHash("sha256").update(b).digest("hex");
const MAX = 2 * 1024 * 1024;
export const FAMILIAS = { objeto: ["3d", "sobrio"], app: ["logo"] };
const PASTA = { "objeto/3d": "objetos", "objeto/sobrio": "icones", "app/logo": "apps" };
const ROTULO = { "3d": "3D", sobrio: "sóbria", logo: "logo" };
// Nome genérico de peça: minúsculas e números, até 4 partes com hífen, até 30 letras ("comida", "google-meet")
export const nomeGenerico = (s) => typeof s === "string" && s.length <= 30 && /^[a-z0-9]+(?:-[a-z0-9]+){0,3}$/.test(s);

// SVG de terceiro: só o que é permitido, elementos e atributos de desenho (forma, geometria e cor). Nada de style, CSS,
// use, url(, script, evento, link, imagem, declaração (DOCTYPE, ENTITY, CDATA) nem texto solto: o SVG sóbrio entra no
// vídeo pelo innerHTML, e o logo, como imagem. Devolve a lista do que achou de proibido ([] = pode entrar).
const ELEMENTOS = new Set(["svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "title", "desc"]);
const ATRIBUTOS = new Set(["xmlns", "version", "viewBox", "width", "height", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "d", "points",
  "fill", "fill-rule", "fill-opacity", "clip-rule", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-opacity",
  "opacity", "transform", "id", "data-name", "xml:space"]);
export function problemasSvg(s) {
  const ruim = [], pilha = [], t = String(s).replace(/^\uFEFF/, "").replace(/^\s*<\?xml\s[^?<>]*\?>/, "").replace(/<!--[\s\S]*?-->/g, "");
  const tag = /<(\/?)([A-Za-z][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"<>]*"|'[^'<>]*'))*)\s*(\/?)>/g;
  let fim = 0, m, primeiro = true;
  while ((m = tag.exec(t))) {
    const antes = t.slice(fim, m.index);
    fim = tag.lastIndex;
    if (/[<>]/.test(antes)) ruim.push("marcação fora do que é permitido");
    else if (antes.trim() && !["title", "desc"].includes(pilha[pilha.length - 1])) ruim.push("texto fora de title ou desc");
    const [, fecha, nome, atrs, sozinho] = m;
    if (primeiro && nome !== "svg") ruim.push("não começa por <svg>");
    primeiro = false;
    if (!ELEMENTOS.has(nome)) { ruim.push(`elemento <${nome}>`); continue; }
    if (fecha) { pilha.pop(); continue; }
    if (!sozinho) pilha.push(nome);
    for (const a of atrs.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      const nomeA = a[1], v = a[2] ?? a[3];
      if (!ATRIBUTOS.has(nomeA)) ruim.push(`atributo ${nomeA}`);
      else if (/url\s*\(|expression|javascript|[@\\&]/i.test(v)) ruim.push(`valor do atributo ${nomeA}`);
      else if (nomeA === "xmlns" && v !== "http://www.w3.org/2000/svg") ruim.push("xmlns que não é o do SVG");
    }
  }
  if (primeiro) ruim.push("não é um SVG");
  if (/[<>]/.test(t.slice(fim)) || t.slice(fim).trim()) ruim.push("marcação fora do que é permitido");
  return [...new Set(ruim)];
}
export function problemasImagem(buf, arquivo) {
  const ext = extname(arquivo).toLowerCase();
  if (buf.length > MAX) return ["passa de 2 MB"];
  if (ext === ".png") return buf.subarray(1, 4).toString() === "PNG" ? [] : ["não é um PNG de verdade"];
  if (ext === ".svg") { const s = buf.toString("utf8"); return /<svg[\s>]/i.test(s) ? problemasSvg(s) : ["não é um SVG"]; }
  return ["só entra PNG ou SVG"];
}

// Banco local: a pasta biblioteca/ ao lado da pasta do vídeo (Documentos/Editor Chefe/biblioteca/)
export const pastaBiblioteca = (pastaVideo) => resolve(process.env.EDITOR_CHEFE_BIBLIOTECA || join(dirname(resolve(pastaVideo)), "biblioteca"));
export function lerCatalogo(bib) {
  const arq = join(bib, "catalogo.json");
  if (!existsSync(arq)) return { versao: 1, pecas: [] };
  let c;
  try { c = JSON.parse(readFileSync(arq, "utf8")); } catch (e) { throw new Error(`banco: o catálogo da biblioteca (${arq}) não é um JSON válido (${e.message}). Conserte ou apague o catalogo.json; as peças da pasta continuam lá e voltam para o catálogo quando forem usadas.`); }
  if (!c || !Array.isArray(c.pecas)) throw new Error(`banco: o catálogo da biblioteca (${arq}) precisa ter a lista "pecas".`);
  return c;
}
function gravarCatalogo(ctx) {
  mkdirSync(ctx.bib, { recursive: true });
  const arq = join(ctx.bib, "catalogo.json");
  writeFileSync(arq + ".tmp", JSON.stringify(ctx.catalogo, null, 1) + "\n");
  renameSync(arq + ".tmp", arq);
}
// ctx de uma montagem: o banco local, o vídeo e a data, para o catálogo
export function abrirBanco(pastaVideo, avisar = () => {}) {
  const bib = pastaBiblioteca(pastaVideo);
  return { bib, catalogo: lerCatalogo(bib), video: basename(resolve(pastaVideo)), data: new Date().toISOString().slice(0, 10), avisar, central: undefined, relatorio: [] };
}

// Banco central: o pino do plugin (o commit e o SHA-256 do catálogo, fixos por versão)
export const lerPino = () => JSON.parse(readFileSync(process.env.EDITOR_CHEFE_BANCO_PINO || join(RAIZ, "pecas", "banco-central.json"), "utf8"));
export function enderecoCentral(pino, caminho) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(pino?.repositorio ?? "")) throw new Error("banco: o pino do banco central não tem o repositório (dono/nome).");
  if (!/^[0-9a-f]{40}$/.test(pino?.commit ?? "")) throw new Error("banco: o banco central só é lido por um commit fixo (40 letras e números), nunca por ramo.");
  if (!/^[\w-]+$/.test(pino.pasta ?? "")) throw new Error("banco: o pino do banco central não tem a pasta.");
  if (!String(caminho).split("/").every((p) => /^[\w.-]+$/.test(p) && p !== "." && p !== "..")) throw new Error(`banco: caminho inválido no banco central: ${caminho}`);
  return `https://raw.githubusercontent.com/${pino.repositorio}/${pino.commit}/${pino.pasta}/${caminho}`;
}
// ponytail: download síncrono por um node filho (o montador é síncrono); até 2 MB por arquivo, 30 s
const BAIXAR = "fetch(process.argv[1]).then(async(r)=>{if(!r.ok)throw new Error('HTTP '+r.status);process.stdout.write(Buffer.from(await r.arrayBuffer()))}).catch((e)=>{process.stderr.write(String(e.message));process.exit(1)})";
function doCentral(pino, caminho) {
  const url = enderecoCentral(pino, caminho), dir = process.env.EDITOR_CHEFE_BANCO_CENTRAL;
  if (dir) return readFileSync(join(dir, pino.pasta, caminho));
  const r = spawnSync(process.execPath, ["-e", BAIXAR, url], { maxBuffer: MAX + 1024, timeout: 30000 });
  if (r.error || r.status !== 0) throw new Error(String(r.stderr || r.error?.message || "falhou").trim() || "sem resposta");
  return r.stdout;
}
function abrirCentral(avisar) {
  let pino;
  try { pino = lerPino(); } catch { return null; }
  if (!pino.commit || !pino.catalogo_sha256) return null; // banco central ainda não publicado nesta versão do plugin
  try {
    const b = doCentral(pino, "catalogo.json");
    if (sha256(b) !== pino.catalogo_sha256) { avisar("banco: o catálogo do banco central não confere com o SHA-256 fixado no plugin; ele ficou de fora deste vídeo. Avise o Magnus."); return null; }
    const cat = JSON.parse(b.toString("utf8"));
    return { pino, pecas: Array.isArray(cat.pecas) ? cat.pecas : [] };
  } catch (e) {
    avisar(`banco: não consegui ler o banco central (${String(e.message).split("\n")[0]}); segui com as peças do plugin e as da biblioteca local.`);
    return null;
  }
}

// Guarda a peça no banco local, sem repetir: mesmo nome (do mesmo tipo e família) atualiza; mesmo SHA-256 vira outro
// nome da mesma peça. Devolve a entrada do catálogo.
function guardar(ctx, info, buf, ext) {
  const s = sha256(buf), cat = ctx.catalogo.pecas;
  let e = cat.find((x) => !x.cliente && x.tipo === info.tipo && x.familia === info.familia && x.nome === info.nome);
  const igual = cat.find((x) => !x.cliente && x.tipo === info.tipo && x.familia === info.familia && x.sha256 === s);
  if (!e && igual) { igual.nomes = [...new Set([...(igual.nomes ?? []), info.nome])]; gravarCatalogo(ctx); return igual; }
  const rel = `${PASTA[`${info.tipo}/${info.familia}`]}/${info.nome}${ext}`, arq = join(ctx.bib, rel);
  if (!e || e.sha256 !== s || !existsSync(arq)) { mkdirSync(dirname(arq), { recursive: true }); writeFileSync(arq, buf); }
  const dados = { nome: info.nome, tipo: info.tipo, familia: info.familia, palavras: info.palavras ?? [], origem: info.origem, licenca: info.licenca, ...(info.fonte ? { fonte: info.fonte } : {}), sha256: s, arquivo: rel, data: ctx.data };
  if (e) Object.assign(e, dados, { videos: e.videos ?? [] });
  else cat.push(e = { ...dados, videos: [] });
  gravarCatalogo(ctx);
  return e;
}
// Marca no catálogo o vídeo em que a peça foi usada
export function usar(ctx, entrada) {
  if (!entrada.videos.includes(ctx.video)) { entrada.videos.push(ctx.video); gravarCatalogo(ctx); }
}
const doPlugin = (tipo, nome, familia) => {
  const m = tipo === "objeto" ? PECAS.objetos[nome] : PECAS.apps[nome];
  if (!m) return null;
  const f = tipo === "objeto" && familia === "sobrio" ? m.sobrio : m;
  return f?.arquivo ? { rel: f.arquivo, origem: f.origem, licenca: tipo === "app" ? "logo do kit de marca" : "MIT", palavras: m.palavras } : null;
};

// Uma peça { tipo, nome, familia }: devolve { de: "plugin" | "local" | "central", arquivo (no banco local), entrada }, ou
// null quando não há a peça (o montador usa uma genérica e o pedido)
export function buscar({ tipo, nome, familia }, ctx) {
  const p = doPlugin(tipo, nome, familia);
  if (p) { const rel = p.rel; const e = guardar(ctx, { tipo, nome, familia, palavras: p.palavras, origem: `plugin (${p.origem})`, licenca: p.licenca }, readFileSync(join(RAIZ, "pecas", rel)), extname(rel)); return { de: "plugin", arquivo: join(ctx.bib, e.arquivo), entrada: e }; }
  const e = ctx.catalogo.pecas.find((x) => !x.cliente && x.tipo === tipo && x.familia === familia && (x.nome === nome || x.nomes?.includes(nome)));
  if (e) {
    const arq = join(ctx.bib, e.arquivo);
    if (existsSync(arq) && sha256(readFileSync(arq)) === e.sha256) { ctx.relatorio.push(`banco: "${nome}" (${tipo} ${ROTULO[familia]}) saiu da biblioteca local, sem baixar de novo.`); return { de: "local", arquivo: arq, entrada: e }; }
    ctx.avisar(`banco: o arquivo de "${nome}" na biblioteca local mudou ou sumiu; vou procurar no banco central.`);
  }
  if (ctx.central === undefined) ctx.central = abrirCentral(ctx.avisar);
  const c = ctx.central?.pecas.find((x) => x.tipo === tipo && x.familia === familia && x.nome === nome);
  if (!c) return null;
  try {
    const b = doCentral(ctx.central.pino, c.arquivo);
    if (sha256(b) !== c.sha256) throw new Error("o SHA-256 do arquivo não confere com o catálogo");
    const ruim = problemasImagem(b, c.arquivo);
    if (ruim.length) throw new Error(ruim.join(", "));
    const e2 = guardar(ctx, { tipo, nome, familia, palavras: c.palavras, origem: `banco central ${ctx.central.pino.commit.slice(0, 7)} (${c.origem})`, licenca: c.licenca, fonte: c.fonte }, b, extname(c.arquivo));
    ctx.relatorio.push(`banco: "${nome}" (${tipo} ${ROTULO[familia]}) veio do banco central (commit ${ctx.central.pino.commit.slice(0, 7)}), conferida pelo SHA-256 e guardada na biblioteca local.`);
    return { de: "central", arquivo: join(ctx.bib, e2.arquivo), entrada: e2 };
  } catch (err) {
    ctx.avisar(`banco: a peça "${nome}" do banco central ficou de fora (${String(err.message).split("\n")[0]}).`);
    return null;
  }
}

// Logo e print do cliente: ficam só no banco local, em cliente/, marcados como do cliente (nunca vão para proposta)
export function guardarDoCliente(ctx, arquivo, tipo) {
  const b = readFileSync(arquivo), s = sha256(b);
  let e = ctx.catalogo.pecas.find((x) => x.cliente && x.sha256 === s);
  if (!e) {
    const rel = `cliente/${tipo === "logo" ? "logos" : "prints"}/${tipo}-${s.slice(0, 12)}${extname(arquivo).toLowerCase()}`;
    mkdirSync(dirname(join(ctx.bib, rel)), { recursive: true });
    writeFileSync(join(ctx.bib, rel), b);
    ctx.catalogo.pecas.push(e = { nome: basename(rel, extname(rel)), tipo: tipo === "logo" ? "logo-do-cliente" : "print", cliente: true, sha256: s, arquivo: rel, data: ctx.data, videos: [] });
  }
  usar(ctx, e);
  return e;
}

// Texto que pode sair do computador do cliente: nada de número de documento, telefone ou e-mail (a procura do sigilo.mjs),
// nem nome de pessoa dita na fala ou do negócio do cliente
const semAcento = (s) => String(s).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
function conferirTexto(texto, proibidos, oque) {
  const achado = procurar(texto)[0];
  if (achado) throw new Error(`banco: ${oque}: o texto tem ${achado.tipo}.`);
  const palavras = new Set(semAcento(texto).split(/[^\p{L}\p{N}]+/u));
  const bate = proibidos.flatMap((n) => semAcento(n).split(/[^\p{L}\p{N}]+/u)).find((w) => w.length >= 3 && palavras.has(w));
  if (bate) throw new Error(`banco: ${oque}: "${bate}" é nome de pessoa da fala ou do negócio do cliente; ele leva só o nome genérico da peça.`);
}
const motivoOk = (m) => /^[\p{Ll} ,]{3,60}$/u.test(m);

// Pedido de peça que faltou: formato fechado (tipo, nome genérico, família e o motivo em poucas palavras), para o dono
// colar no Magnus dele. nomes: os nomes possíveis da fala (sigilo.naFala); cliente: o nome e a assinatura do negócio.
// Num aplicativo, o nome dele é nome próprio na fala, então só o nome do negócio barra.
export function pedidoDePeca({ tipo, nome, familia, motivo = "a fala pede e o banco não tem" }, { nomes = [], cliente = [] } = {}) {
  if (!FAMILIAS[tipo]?.includes(familia)) throw new Error(`banco: pedido recusado: tipo e família de peça desconhecidos (${tipo}, ${familia}).`);
  if (!nomeGenerico(nome)) throw new Error(`banco: pedido recusado: "${nome}" não é um nome genérico de peça (minúsculas, sem espaço, até 30 letras).`);
  if (!motivoOk(motivo)) throw new Error("banco: pedido recusado: o motivo vai em poucas palavras, em minúsculas, sem número nem símbolo.");
  const frase = `Pedido de peça para o banco do Editor Chefe: tipo ${tipo}, nome "${nome}", família ${ROTULO[familia]}, motivo: ${motivo}.`;
  conferirTexto(frase, [...(tipo === "app" ? [] : nomes), ...cliente], "pedido recusado");
  return frase;
}

// Proposta de peça genérica para o banco central (curadoria do MAGNUS; só sobe com a aprovação da curadoria). Formato fechado:
// nome, tipo, família, arquivo, SHA-256, palavras, origem, licença, fonte, motivo e data. Peça do cliente, print e logo
// do cliente são recusados.
const ORIGENS = new Set(["fluent-emoji", "phosphor", "desenho-proprio", "pagina-de-marca", "site-oficial", "wikimedia-commons", "simple-icons"]);
export const CAMPOS_PROPOSTA = ["nome", "tipo", "familia", "arquivo", "sha256", "palavras", "origem", "licenca", "fonte", "motivo", "data"];
export function propor(item, destino, { proibidos = [] } = {}) {
  if (!item || item.cliente) throw new Error("banco: proposta recusada: peça do cliente (o logo dele, um print, uma foto) não sai do computador dele.");
  const arq = resolve(String(item.arquivo ?? "")), real = existsSync(arq) ? realpathSync(arq) : arq;
  const partes = real.split(sep);
  if (partes.includes("prints") || partes.includes("cliente") || /^(logo|print)([-.]|$)/i.test(basename(real))) throw new Error("banco: proposta recusada: print, logo e arquivo do cliente não vão para o banco central.");
  if (!FAMILIAS[item.tipo]?.includes(item.familia) || !nomeGenerico(item.nome)) throw new Error("banco: proposta recusada: falta o nome genérico, o tipo ou a família da peça.");
  if (!ORIGENS.has(item.origem) || !item.licenca || !/^https:\/\/\S+$/.test(item.fonte ?? "")) throw new Error(`banco: proposta recusada: a origem precisa ser uma destas (${[...ORIGENS].join(", ")}), com a licença e o endereço https da fonte.`);
  const palavras = Array.isArray(item.palavras) ? item.palavras : [];
  if (!palavras.length || palavras.some((w) => !/^[\p{Ll} ]{2,30}$/u.test(w))) throw new Error("banco: proposta recusada: as palavras que chamam a peça vão em minúsculas, sem número.");
  if (!motivoOk(item.motivo ?? "")) throw new Error("banco: proposta recusada: o motivo vai em poucas palavras, em minúsculas, sem número nem símbolo.");
  conferirTexto([item.nome, ...palavras, item.motivo].join(" "), proibidos, "proposta recusada");
  if (!existsSync(real)) throw new Error(`banco: proposta recusada: o arquivo ${item.arquivo} não existe.`);
  const b = readFileSync(real), ruim = problemasImagem(b, real);
  if (ruim.length) throw new Error(`banco: proposta recusada: ${ruim.join(", ")}.`);
  const base = `${item.nome}-${item.familia}`, ext = extname(real).toLowerCase();
  mkdirSync(destino, { recursive: true });
  writeFileSync(join(destino, base + ext), b);
  const prop = { nome: item.nome, tipo: item.tipo, familia: item.familia, arquivo: base + ext, sha256: sha256(b), palavras, origem: item.origem, licenca: item.licenca, fonte: item.fonte, motivo: item.motivo, data: new Date().toISOString().slice(0, 10) };
  writeFileSync(join(destino, base + ".json"), JSON.stringify(prop, null, 1) + "\n");
  return prop;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, arquivo, ...resto] = process.argv.slice(2), op = {};
  for (let i = 0; i < resto.length; i += 2) op[resto[i].replace(/^--/, "")] = resto[i + 1];
  try {
    if (cmd !== "propor" || !arquivo || !op.para) throw new Error("Uso: node banco.mjs propor <imagem> --nome <nome> --tipo objeto --familia 3d --origem fluent-emoji --licenca MIT --fonte <https://...> --palavras \"a,b\" --motivo \"...\" --para <biblioteca/propostas>");
    const p = propor({ ...op, arquivo, palavras: String(op.palavras ?? "").split(",").map((s) => s.trim()).filter(Boolean) }, op.para);
    console.log(`banco: proposta gravada em ${join(op.para, p.nome + "-" + p.familia + ".json")} (SHA-256 ${p.sha256}).`);
  } catch (e) { console.error(e.message); process.exit(1); }
}
