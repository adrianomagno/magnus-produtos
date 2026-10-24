// "Mesmo estilo do último vídeo": na entrega aprovada, guarda as escolhas de ESTILO do vídeo em Documentos/Editor Chefe/
// ultimo-estilo.json (ao lado do marca.json); no vídeo seguinte, monta a pergunta única com o nome do estilo do catálogo.
// Nunca guarda o conteúdo do vídeo (textos, palavras-chave, cartões, frases, foco): só o estilo, a identidade, os efeitos,
// o visual de cor e a limpeza de ruído (do fonte.json, que o fonte.mjs grava), a aproximação ligada ou não e o estilo da capa.
// Uso: node ultimo-estilo.mjs guardar <pasta do vídeo>     grava ../ultimo-estilo.json
//      node ultimo-estilo.mjs ler <pasta Editor Chefe>     imprime a pergunta e as escolhas, ou que não há estilo guardado
// Arquivo ausente ou estragado nunca para o fluxo: o "ler" diz que não há estilo guardado e o vídeo segue com as perguntas.
import { readFileSync, writeFileSync, realpathSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CORES } from "./fonte.mjs";

const ARQ = "ultimo-estilo.json";
// Os estilos e as capas, com o número e o nome, saem do catálogo (o único lugar com a lista)
const CAT = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "skills", "editor-chefe", "references", "catalogo.md"), "utf8");
const secao = (t) => CAT.split(/^## /m).find((s) => s.startsWith(t)) ?? "";
const lista = (s) => Object.fromEntries([...s.matchAll(/^(\d+)\. \*\*([^*]+)\*\* \(`([a-z0-9-]+)`\)/gm)].map((m) => [m[3], { n: +m[1], nome: m[2] }]));
export const ESTILOS = lista(secao("Estilos")), CAPAS = lista(secao("Capas"));
// O que cada estilo pergunta (catálogo e passo 2 da SKILL): efeitos e capa nos de 1 a 5 e de 7 a 9; aproximação em todo
// estilo com gravação menos o Corte seco; cor e ruído em todo estilo com gravação; identidade só na Palavra-chave
const COM_CAPA = (e) => !["caixinha-pergunta", "motion-narrado"].includes(e);
const GRAVADO = (e) => e !== "motion-narrado";
const APROXIMA = (e) => GRAVADO(e) && e !== "corte-seco-zoom";
const IDENTIDADES = ["keynote", "stomp"];

// As escolhas de estilo, só com os campos que o estilo usa; null se algum campo estiver fora do lugar (arquivo estragado)
export function normalizar(s) {
  const e = s?.estilo;
  if (!ESTILOS[e]) return null;
  const o = { estilo: e };
  if (e === "palavra-chave") { if (!IDENTIDADES.includes(s.identidade)) return null; o.identidade = s.identidade; }
  if (COM_CAPA(e)) {
    if (typeof s.efeitos !== "boolean" || !(s.capa === null || CAPAS[s.capa])) return null;
    o.efeitos = s.efeitos;
    o.capa = s.capa;
  }
  if (GRAVADO(e)) {
    if (!(s.cor === null || Object.hasOwn(CORES, s.cor ?? "")) || typeof s.ruido !== "boolean") return null;
    o.cor = s.cor;
    o.ruido = s.ruido;
  }
  if (APROXIMA(e)) { if (typeof s.aproximar !== "boolean") return null; o.aproximar = s.aproximar; }
  return o;
}

// Na entrega aprovada: lê o escolhas.json e o fonte.json da pasta do vídeo e grava o ultimo-estilo.json na pasta de cima
export function guardar(pasta) {
  let esc, f = {};
  try { esc = JSON.parse(readFileSync(join(pasta, "escolhas.json"), "utf8")); } catch { throw new Error(`ultimo-estilo: não consegui ler o escolhas.json em ${pasta}; nada foi guardado.`); }
  try { f = JSON.parse(readFileSync(join(pasta, "fonte.json"), "utf8")) ?? {}; } catch { /* sem fonte.json: sem visual de cor e sem limpeza */ }
  const s = normalizar({ estilo: esc?.estilo, identidade: esc?.identidade ?? "keynote", efeitos: esc?.efeitos !== false, capa: CAPAS[esc?.capa?.estilo] ? esc.capa.estilo : null,
    cor: Object.hasOwn(CORES, f.cor ?? "") ? f.cor : null, ruido: f.ruido === true, aproximar: Array.isArray(esc?.aproximar) && esc.aproximar.length > 0 });
  if (!s) throw new Error(`ultimo-estilo: o escolhas.json em ${pasta} não tem um estilo do catálogo; nada foi guardado.`);
  writeFileSync(join(pasta, "..", ARQ), JSON.stringify({ ...s, guardado: new Date().toISOString().slice(0, 10) }, null, 1) + "\n");
  return s;
}

// No vídeo seguinte: as escolhas guardadas, ou null (sem arquivo, ou estragado)
export function ler(pastaEditor) {
  try { return normalizar(JSON.parse(readFileSync(join(pastaEditor, ARQ), "utf8"))); } catch { return null; }
}

// A pergunta única ao dono, com o número e o nome do estilo e da capa do catálogo
export function pergunta(s) {
  const e = ESTILOS[s.estilo], p = [`Estilo ${e.n}, ${e.nome}`];
  if (s.identidade) p.push(`identidade ${s.identidade}`);
  if ("efeitos" in s) p.push(s.efeitos ? "com efeitos" : "sem efeitos");
  if ("cor" in s) p.push(s.cor ? `visual ${s.cor.replace(/-forte$/, " forte")}` : "sem visual de cor");
  if (s.ruido) p.push("limpeza de ruído");
  if ("aproximar" in s) p.push(s.aproximar ? "aproximação no rosto" : "sem aproximação no rosto");
  if ("capa" in s) p.push(s.capa ? `capa ${CAPAS[s.capa].n}, ${CAPAS[s.capa].nome}` : "sem gancho de capa");
  return `Quer o mesmo estilo do último vídeo: ${p.join(", ")}?`;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, pasta] = process.argv.slice(2);
  if (!["guardar", "ler"].includes(cmd) || !pasta) { console.error("Uso: node ultimo-estilo.mjs guardar <pasta do vídeo>  ou  node ultimo-estilo.mjs ler <pasta Editor Chefe>"); process.exit(1); }
  if (cmd === "ler") {
    const s = ler(resolve(pasta));
    console.log(s ? `${pergunta(s)}\n${JSON.stringify(s)}` : "ultimo-estilo: nenhum estilo guardado; siga as perguntas normais do passo 2.");
  } else {
    try { console.log(`ultimo-estilo: guardado (${pergunta(guardar(resolve(pasta))).replace(/^Quer o mesmo estilo do último vídeo: |\?$/g, "")}).`); }
    catch (e) { console.error(e.message); process.exit(1); }
  }
}
