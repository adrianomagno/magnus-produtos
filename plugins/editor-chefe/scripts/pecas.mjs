// Sugestão de peças para o estilo 11 (Destaques tipográficos): lê o transcript.json corrigido e sugere, por momento da
// fala, qual peça da biblioteca caberia ali. Só sugere: o Claude confere cada sugestão (só entra o que a fala pede, com
// as palavras da fala; na dúvida, fica de fora) e grava as que aceitar em "pecas" no escolhas.json.
// Uso: node pecas.mjs <pasta do vídeo>     grava pecas-sugeridas.json e imprime as sugestões
// O que ele procura: palavra concreta da biblioteca (objeto 3D), nome de aplicativo (ícone), "primeiro, segundo" ou
// "1, 2, 3" em duas partes ou mais (capítulo), lista falada ("três documentos: ...", "A, B e C", "primeiro... depois...")
// (cartão de lista), uma
// coisa que vira várias (esquema), certo e errado, alerta, novidade (selo), "comenta" (chamada para comentar) e menção a
// site, sistema ou planilha (janela, só se o dono mandar o print).
import { readFileSync, writeFileSync, realpathSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { naEdicao } from "./sigilo.mjs";
import { lerCatalogo, pastaBiblioteca } from "./banco.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const BIB = JSON.parse(readFileSync(join(RAIZ, "pecas", "manifest.json"), "utf8"));
const limpa = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const ORDINAIS = { primeiro: 1, primeira: 1, segundo: 2, segunda: 2, terceiro: 3, terceira: 3, quarto: 4, quarta: 4, quinto: 5, quinta: 5 };
const NUMEROS = { dois: 2, duas: 2, "três": 3, tres: 3, quatro: 4, cinco: 5, seis: 6 };
const COISAS = /^(coisas|passos|erros|documentos|dicas|motivos|sinais|formas|perguntas|pontos|etapas|regras|cuidados|itens|maneiras|razões|exames|direitos|caminhos|benefícios|mitos|segredos)$/;
const VIRA = /^(vira|viram|gera|geram|traz|trazem|vira|divide|abre|leva|libera)$/;
const SELO = [
  ["reprovado", ["errado", "errada", "reprova", "reprovado", "reprovada", "proibido", "não faça", "nunca faça", "isso não é", "não é"]],
  ["aprovado", ["certo", "correto", "aprovado", "aprovada", "faça assim", "isso sim"]],
  ["atencao", ["atenção", "cuidado", "alerta", "risco"]],
  ["novo", ["novidade", "lançamento", "acabou de sair"]],
];
const TELA = /^(site|sistema|planilha|painel|página|plataforma|tela|dashboard)$/;
const VAZIAS = new Set(["a", "o", "as", "os", "de", "do", "da", "dos", "das", "e", "é", "um", "uma", "que", "no", "na", "em", "pra", "para", "aqui", "aí", "palavra", "embaixo", "nos", "comentários"]);

// pal: as palavras da edição [{ txt, ini, fim }]. Devolve [{ t, tipo, gatilho, proposta }] na ordem do tempo; gatilho é o
// texto da fala que puxou a sugestão e proposta, a peça pronta para o escolhas.json (o Claude confere antes)
// extra: as peças da biblioteca local do cliente ({ objetos, apps }, nome e palavras), somadas às do plugin
export function sugerir(pal, extra = {}) {
  const OBJETOS = { ...BIB.objetos, ...extra.objetos }, APPS = { ...BIB.apps, ...extra.apps };
  const w = pal.map((p) => limpa(p.txt)), out = [], fimDeFrase = (i) => i < 0 || /[.?!:]$/.test(pal[i].txt);
  const texto = (a, b) => pal.slice(a, b + 1).map((p) => p.txt).join(" ").replace(/[.,;:!?…]+$/u, "");
  const achar = (frase, k) => { const f = frase.split(" ").map(limpa); return w.slice(k, k + f.length).join(" ") === f.join(" "); };
  const push = (i, tipo, gatilho, proposta, nota) => out.push({ t: +pal[i].ini.toFixed(2), tipo, gatilho, proposta, ...(nota ? { nota } : {}) });
  // Itens de uma lista falada a partir de k: pedaços curtos (até 4 palavras) separados por vírgula, com "e" ou "ou" antes
  // do último; termina no ponto. Devolve [[de, até], ...] ou []
  const serie = (k) => {
    const itens = [];
    let a = k;
    for (let i = k; i < pal.length && i < k + 24; i++) {
      const fim = /[,;]$/.test(pal[i].txt), ponto = /[.?!:]$/.test(pal[i].txt), liga = (w[i + 1] === "e" || w[i + 1] === "ou") && itens.length >= 1;
      if (fim || ponto || liga) {
        if (i - a + 1 > 4) return [];
        itens.push([a, i]);
        a = liga ? i + 2 : i + 1;
        if (liga) i++;
        if (ponto) break;
      }
    }
    return itens.length >= 3 && itens.length <= 4 ? itens : [];
  };

  for (let i = 0; i < pal.length; i++) {
    // objeto 3D: palavra da biblioteca (o mesmo objeto a menos de 10 s não se repete)
    for (const [obj, m] of Object.entries(OBJETOS))
      for (const g of m.palavras) if (achar(g, i) && !out.some((s) => s.tipo === "objeto" && s.proposta.objeto === obj && pal[i].ini - s.t < 10)) {
        const n = g.split(" ").length;
        push(i, "objeto", texto(i, i + n - 1), { tipo: "objeto", objeto: obj, fala: texto(i, i + n - 1) });
      }
    // ícone do aplicativo: o nome dele na fala; os outros citados nos 6 s seguintes entram na mesma peça
    for (const [app, m] of Object.entries(APPS))
      for (const g of m.palavras) if (achar(g, i) && !out.some((s) => s.tipo === "app" && pal[i].ini - s.t < 6)) {
        const apps = [app];
        for (let j = i + 1; j < pal.length && pal[j].ini - pal[i].ini < 6; j++)
          for (const [b, mb] of Object.entries(APPS)) if (!apps.includes(b) && mb.palavras.some((x) => achar(x, j))) apps.push(b);
        push(i, "app", texto(i, i + g.split(" ").length - 1), { tipo: "app", apps, fala: texto(i, i + g.split(" ").length - 1) });
      }
    // selo: certo e errado, alerta, novidade
    for (const [selo, gs] of SELO) for (const g of gs) if (achar(g, i) && !out.some((s) => s.tipo === "selo" && pal[i].ini - s.t < 4)) {
      const n = g.split(" ").length;
      push(i, "selo", texto(i, i + n - 1), { tipo: "selo", selo, fala: texto(i, i + n - 1) });
    }
    // Comenta: a palavra que vem depois de "comenta" (o dono confirma; sem ela, pergunte)
    if (/^coment(a|e|em|ar)$/.test(w[i])) {
      let j = i + 1;
      while (j < pal.length && VAZIAS.has(w[j])) j++;
      const palavra = j < pal.length && j - i <= 4 && !fimDeFrase(j - 1) ? pal[j].txt.replace(/[^\p{L}\p{N}]/gu, "").toLocaleUpperCase("pt-BR") : null;
      push(i, "comenta", texto(i, Math.min(pal.length - 1, j)), { tipo: "comenta", palavra, fala: texto(i, i) },
        palavra ? `confirme com o dono que a palavra é ${palavra}` : "a fala não diz a palavra: pergunte ao dono qual é, sem inventar");
    }
    // janela: a pessoa fala de uma tela (só com um print que o dono mandar)
    if (TELA.test(w[i]) && !out.some((s) => s.tipo === "janela" && pal[i].ini - s.t < 6)) push(i, "janela", texto(Math.max(0, i - 1), i), { tipo: "janela", print: null, fala: texto(Math.max(0, i - 1), i) }, "só entra com um print que o dono mandar, conferido pelo sigilo.mjs --print");
    // cartão de lista: "três documentos" com os itens logo depois
    if (NUMEROS[w[i]] && COISAS.test(w[i + 1] ?? "")) {
      const s = serie(i + 2);
      push(i, "lista", texto(i, i + 1), { tipo: "lista", titulo: texto(i, i + 1), itens: s.map(([a, b]) => texto(a, b)), fala: texto(i, i + 1) },
        s.length ? null : "os itens não vieram numa série clara: tire da fala os que a pessoa disse, ou deixe de fora");
    }
    // esquema: "X vira A, B e C" (o centro é a palavra antes do "vira", sem artigo)
    if (VIRA.test(w[i])) {
      const s = serie(i + 1);
      let h = i - 1;
      while (h > 0 && VAZIAS.has(w[h])) h--;
      if (s.length && h >= 0 && !fimDeFrase(h) && !VAZIAS.has(w[h]))
        push(h, "esquema", texto(h, s[s.length - 1][1]), { tipo: "esquema", centro: pal[h].txt.replace(/[^\p{L}\p{N}]/gu, ""), vagas: s.map(([a, b]) => texto(a, b)), fala: texto(h, h) });
    }
    // cartão de lista: uma série "A, B e C" no começo da frase ou depois de dois pontos, sem "vira" no meio
    if ((fimDeFrase(i - 1) || /:$/.test(pal[i - 1]?.txt ?? "")) && !out.some((x) => (x.tipo === "lista" || x.tipo === "esquema") && pal[i].ini - x.t < 12)) {
      const s = serie(i);
      if (s.length && !w.slice(s[0][0], s[s.length - 1][1] + 1).some((x) => VIRA.test(x)))
        push(i, "lista", texto(s[0][0], s[s.length - 1][1]), { tipo: "lista", itens: s.map(([a, b]) => texto(a, b)), fala: texto(s[0][0], s[0][1]) });
    }
  }
  // cartão de lista numa sequência falada: "primeiro" e, nos 15 s seguintes, "depois", "em seguida", "por fim", "por
  // último" ou "e só"; cada item são as até 3 palavras depois de cada marca (o Claude ajusta com as palavras da fala)
  const SEGUE = ["depois", "em seguida", "por fim", "por último", "e só", "segundo", "terceiro"];
  pal.forEach((p, i) => {
    if (!/^primeir[oa]$/.test(w[i]) || out.some((x) => x.tipo === "lista" && Math.abs(p.ini - x.t) < 15)) return;
    const marcas = [i];
    for (let j = i + 1; j < pal.length && pal[j].ini - p.ini < 15; j++) if (SEGUE.some((g) => achar(g, j))) { marcas.push(j + (SEGUE.find((g) => achar(g, j)).split(" ").length - 1)); j += 1; }
    if (marcas.length < 2) return;
    const itens = marcas.map((m) => { let f = m + 1; while (f < pal.length - 1 && f - m < 3 && !/[.,;:?!]$/.test(pal[f].txt)) f++; return texto(m + 1, f); });
    push(i, "lista", texto(i, i), { tipo: "lista", itens, fala: texto(i, i) }, "sequência falada: tire os itens da fala, com as palavras dela, e ponha a \"fala\" na frase que abre a lista");
  });
  // capítulo: "primeiro, segundo" (ou "1, 2") no começo de frase, com duas partes ou mais, em ordem
  const caps = [];
  pal.forEach((p, i) => {
    const n = ORDINAIS[w[i]] ?? (/^\d$/.test(w[i]) && /[.,:]$/.test(p.txt) ? +w[i] : null);
    if (n && fimDeFrase(i - 1) && n === (caps.length ? caps[caps.length - 1].n + 1 : 1)) caps.push({ i, n });
  });
  if (caps.length >= 2) for (const { i, n } of caps) {
    let f = i + 1;
    while (f < pal.length - 1 && f - i < 4 && !/[.?!:]$/.test(pal[f].txt)) f++;
    push(i, "capitulo", texto(i, f), { tipo: "capitulo", numero: n, titulo: texto(i + 1, f).slice(0, 28), fala: texto(i, i) });
  }
  return out.sort((a, b) => a.t - b.t);
}

// Família dos objetos: a 3D (Fluent Emoji) é o padrão; para clínica, consultório, escritório de advocacia ou de
// contabilidade, o Editor Chefe sugere a sóbria (Phosphor nas cores da marca), e o dono decide. Lê o nome e a assinatura do
// marca.json. Devolve "sobrio" com o motivo, ou null (sem sugestão: vale o padrão ou o que o dono já escolheu).
const SOBRIO = [[/advoca|advogad|jur[ií]dic|\bdireito\b/i, "escritório de advocacia"],
  [/cl[ií]nica|consult[oó]rio|\bm[eé]dic|odonto|\bdentist|\bdental\b|\bsa[uú]de\b|nutri[cç]|fisioter|psic[oó]log|dermato|ortoped|cardio|pediatr/i, "clínica ou consultório"],
  [/contab|cont[aá]bil|contador/i, "escritório de contabilidade"]];
export function familiaSugerida(marca) {
  const t = `${marca?.nome ?? ""} ${marca?.assinatura ?? ""}`, m = SOBRIO.find(([re]) => re.test(t));
  return m ? { icones: "sobrio", motivo: m[1] } : null;
}

const relogio = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
export function sugerirPasta(pasta) {
  const ler = (nome) => { try { return JSON.parse(readFileSync(join(pasta, nome), "utf8")); } catch { throw new Error(`pecas: falta o ${nome} na pasta do vídeo (passos 2 e 3 de references/audio-e-corte.md).`); } };
  const transcript = ler("transcript.json"), corte = ler("trechos.json"), manter = corte.manter ?? [], extras = corte.extras ?? [];
  // as palavras que ficam na edição (fora dos cortes extras), no tempo do vídeo editado
  const pal = transcript.filter((x) => !extras.some(([a, b]) => (x.start + x.end) / 2 > a && (x.start + x.end) / 2 < b))
    .map((x) => ({ txt: x.text, ini: naEdicao(x.start, manter), fim: naEdicao(x.end, manter) }));
  // as peças que o cliente já tem na biblioteca local (vindas do banco central em vídeos anteriores) também são sugeridas
  const extra = { objetos: {}, apps: {} };
  for (const e of lerCatalogo(pastaBiblioteca(pasta)).pecas)
    if (!e.cliente && e.palavras?.length && (e.tipo === "objeto" || e.tipo === "app")) extra[e.tipo === "objeto" ? "objetos" : "apps"][e.nome] = { palavras: e.palavras };
  const s = sugerir(pal, extra);
  writeFileSync(join(pasta, "pecas-sugeridas.json"), JSON.stringify(s, null, 1));
  return s;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pasta = process.argv[2];
  if (!pasta) { console.error("Uso: node pecas.mjs <pasta do vídeo>"); process.exit(1); }
  try {
    const s = sugerirPasta(resolve(pasta));
    let marca = null, icones = null;
    try { const esc = JSON.parse(readFileSync(join(resolve(pasta), "escolhas.json"), "utf8")); icones = esc.icones ?? null; marca = JSON.parse(readFileSync(resolve(pasta, esc.marca ?? "../marca.json"), "utf8")); }
    catch { try { marca = JSON.parse(readFileSync(resolve(pasta, "../marca.json"), "utf8")); } catch { /* sem marca: sem sugestão de família */ } }
    const fam = familiaSugerida(marca);
    if (fam && !icones && !marca?.icones) console.log(`pecas: o negócio parece ${fam.motivo}; sugira ao dono, numa frase, os objetos no estilo sóbrio ("icones": "sobrio", traço em duas cores da marca, sem cara de emoji). Ele decide; a 3D continua valendo.`);
    if (!s.length) console.log("pecas: nenhuma sugestão; o vídeo pode sair só com as frases em destaque e a legenda.");
    for (const x of s) console.log(`${relogio(x.t)} ${x.tipo}: "${x.gatilho}"${x.nota ? ` (${x.nota})` : ""}\n  ${JSON.stringify(x.proposta)}`);
    console.log(`pecas: ${s.length} sugestões em pecas-sugeridas.json. Confira cada uma: só entra o que a fala pede, com as palavras da fala; na dúvida, fica de fora. Uma peça a cada 4 a 10 s, uma de cada vez.`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
