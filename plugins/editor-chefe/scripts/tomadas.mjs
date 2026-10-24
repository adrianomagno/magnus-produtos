// Sugere cortes de tomada repetida pelo texto da fala. Uso: node tomadas.mjs transcript.json
// Só sugere; quem decide é o Claude, lendo cada sugestão (references/audio-e-corte.md, passo 3).
// (a) Falso começo: 2 palavras ou mais ditas de novo logo em seguida, sem nada no meio ou só com vício ("é", "né",
//     "tipo"): sai a primeira vez. Lista e repetição de efeito ("para o amigo, para o contador") têm palavra no meio e ficam.
// (b) Frase regravada: um bloco de 1 a 3 frases dito de novo com outras palavras, logo em seguida. Conta como regravada
//     quando as duas tomadas têm 3 ou mais palavras de conteúdo em comum (pelo começo da palavra, sem acento), essas são
//     pelo menos metade das da primeira e um terço das da segunda, e toda frase das duas tomadas tem alguma delas: sai a
//     primeira, fica a última.
// O corte vai do fim da palavra anterior à tomada que sai até o começo da tomada que fica (a regra dos vícios) e sai no
// formato dos cortes extras do trechos.mjs.
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const limpa = (s) => s.toLowerCase().normalize("NFD").replace(/[^\p{L}\p{N}]/gu, "");
// Palavras de 4 letras ou mais que não carregam o conteúdo da frase (as de 3 ou menos já ficam de fora)
const VAZIAS = new Set(("voce voces isso isto esse essa esses essas este esta estes estas aquele aquela aqui agora hoje mais " +
  "menos muito muita muitos muitas tudo todo toda todos todas entao quando como porque pois para pela pelo pelas pelos numa " +
  "dele dela deles delas nosso nossa minha seus suas qual quais onde quem ainda sempre nunca tambem mesmo mesma cada outro " +
  "outra depois antes assim sobre entre seria estao estava foram fazer tenho temos vamos sabe olha tipo coisa gente pode " +
  "podem deve nada algo alguem apenas").split(" "));
const VICIOS = new Set("é eh ah ahn hum hm tipo né então digo".split(" "));
const raiz = (w) => { const l = limpa(w); return l.length >= 4 && !VAZIAS.has(l) ? l.slice(0, 5) : null; };
const fimDeFrase = (w) => /[.?!]$/.test(w.text);

export function tomadas(transcript) {
  const pal = transcript.filter((w) => limpa(w.text));
  const sug = []; // { tipo, i, j, fim }: saem as palavras de i a j - 1; a tomada que fica vai de j a fim - 1

  // (b) frases regravadas
  const frases = [];
  pal.forEach((w, k) => { if (!k || fimDeFrase(pal[k - 1])) frases.push([]); frases.at(-1).push(k); });
  const raizes = frases.map((f) => new Set(f.map((k) => raiz(pal[k].text)).filter(Boolean)));
  const uniao = (a, b) => new Set(raizes.slice(a, b).flatMap((r) => [...r]));
  let livre = 0; // a tomada que sai não começa antes da última tomada que ficou
  for (let t = 1; t < frases.length; t++) {
    let melhor = null;
    for (let la = 1; la <= 3 && t - la >= livre; la++)
      for (let lb = 1; lb <= 3 && t + lb <= frases.length; lb++) {
        const A = uniao(t - la, t), B = uniao(t, t + lb), comum = new Set([...A].filter((r) => B.has(r)));
        const todas = (a, b) => raizes.slice(a, b).every((r) => [...r].some((x) => comum.has(x)));
        if (comum.size >= 3 && comum.size >= A.size / 2 && comum.size >= B.size / 3 && todas(t - la, t) && todas(t, t + lb) && (!melhor || comum.size > melhor.n))
          melhor = { n: comum.size, la, lb };
      }
    if (!melhor) continue;
    sug.push({ tipo: "frase regravada", i: frases[t - melhor.la][0], j: frases[t][0], fim: frases[t + melhor.lb - 1].at(-1) + 1 });
    livre = t;
  }

  // (a) falsos começos, fora das frases regravadas que já saem
  // aqui o acento conta ("e" não é "é")
  const tok = pal.map((w) => w.text.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")), igual = (i, j, n) => tok.slice(i, i + n).join(" ") === tok.slice(j, j + n).join(" ");
  const regravadas = [...sug];
  for (let i = 0; i < tok.length; i++) {
    let j = 0;
    for (let n = Math.min(8, Math.floor((tok.length - i) / 2)); n >= 2 && !j; n--)
      for (let g = 0; g <= 2 && !j; g++) if (i + 2 * n + g <= tok.length && tok.slice(i + n, i + n + g).every((w) => VICIOS.has(w)) && igual(i, i + n + g, n)) j = i + n + g;
    if (!j) continue;
    if (!regravadas.some((s) => i >= s.i && j <= s.j))
      sug.push({ tipo: "falso começo", i, j, fim: pal.findIndex((w, k) => k >= j && fimDeFrase(w)) + 1 || pal.length });
    i = j - 1;
  }

  const texto = (a, b) => pal.slice(a, b).map((w) => w.text).join(" "), fmt = (x) => +x.toFixed(2);
  return sug.sort((x, y) => x.i - y.i).map(({ tipo, i, j, fim }) =>
    ({ tipo, corte: `${fmt(i ? pal[i - 1].end : 0)}-${fmt(pal[j].start)}`, sai: texto(i, j), fica: texto(j, fim) }));
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) { console.error("Uso: node tomadas.mjs transcript.json"); process.exit(1); }
  let fala;
  try { fala = JSON.parse(readFileSync(process.argv[2], "utf8")); if (!Array.isArray(fala)) throw 0; } catch { console.error(`tomadas: não consegui ler ${process.argv[2]} (precisa ser o transcript.json).`); process.exit(1); }
  console.log(JSON.stringify(tomadas(fala), null, 2));
}
