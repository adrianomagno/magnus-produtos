// Monta o projeto da HyperFrames de um vídeo a partir do molde do estilo.
// Uso: node montar.mjs <pasta do vídeo>
// Lê na pasta: escolhas.json (estilo e escolhas do vídeo), transcript.json (corrigido), trechos.json (do trechos.mjs),
// fonts/ (do baixar-fonte.mjs) e a marca (padrão ../marca.json). Grava index.html e comum.js na pasta e, com
// "efeitos" ligado (padrão), copia para efeitos/ os sons que o estilo usa (de sons/ ou do plugin hyperframes).
// No Motion narrado (sem gravação), lê words.json e audio/voz.wav (do voz-com-tempos.mjs) no lugar do vídeo e grava
// também audio/mix.wav (voz e efeitos já mixados, em -16 LUFS) e audio/mixagem.json.
import { readFileSync, writeFileSync, readdirSync, existsSync, copyFileSync, realpathSync, mkdirSync, statSync, mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { planejarAproximacao, medidas } from "./rosto.mjs";
import { zonas } from "./conferir.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const EC = createRequire(import.meta.url)(join(RAIZ, "estilos", "comum.js"));
const F = 30;
// Rampa de volume (s) em cada ponta de trecho: a emenda no meio da fala (corte extra) não estala
const RAMPA = 0.005;
// Tempo máximo de cada ffmpeg/ffprobe (10 min, o mesmo do autoteste). No estouro o spawnSync devolve erro e cada chamada
// já trata erro; no Windows um processo filho preso pode segurar o retorno mesmo assim (limite do spawnSync).
const TEMPO_MAX = 600000;
// Fontes que cada estilo usa
const USA = {
  "legenda-viva": ["titulo"],
  "palavra-chave": ["titulo"],
  "corte-seco-zoom": ["titulo"],
  "painel-escuro": ["titulo", "corpo"],
  "editorial-claro": ["titulo", "corpo", "destaque"],
  "caixinha-pergunta": ["titulo"], // a legenda; a caixinha usa a Inter 700 (CAIXINHA_FONTE), não a fonte da marca
  "painel-escuro-dividido": ["titulo", "corpo"],
  "editorial-claro-dividido": ["titulo", "corpo", "destaque"],
  "motion-dividido": ["titulo"],
  "motion-narrado": ["titulo", "corpo"],
};
// Motion dividido: a biblioteca de animações. Cada uma pede [mínimo, máximo] de itens e o tamanho de cada item, em
// caracteres (rótulo curto, para caber nas caixas da animação); no número que cresce, o primeiro item é o número.
const ANIMACOES = { etapas: [2, 3, 28], "antes-depois": [2, 2, 28], lista: [2, 4, 28], numero: [1, 2, 40], pergunta: [1, 2, 70], comparacao: [2, 2, 28] };
const MAX_NUMERO = 14, MAX_TITULO_IDEIA = 40; // o título da ideia cabe em 2 linhas no alto do painel
// Item com ícone: { "texto": "...", "icone": "<nome da biblioteca EC.ICONES>" }. Na fileira e na lista, ícone em todos os
// itens ou em nenhum (figura ao lado de caixa fica desigual); no número e na pergunta, cada item tem ou não o seu.
const ICONE_EM_TODOS = ["etapas", "antes-depois", "lista", "comparacao"];
// Caixinha de pergunta: a caixa imita a do Instagram, com letra fixa. Limites medidos na maquete aprovada: a chamada cabe
// numa linha de 32 px até umas 40 letras e encolhe depois (27 px com 50); a pergunta cabe em 3 linhas de 46 px até umas
// 65 letras e encolhe depois (34 px com 110). Acima disso a letra ficaria pequena demais para ler no celular.
// Topo da caixa: 920, ou 60 px abaixo do queixo, se ele for dado. A menor caixa possível (chamada de 27 px e uma linha de
// pergunta em 30 px, 207 px), mais 40 px de folga e duas linhas de legenda (181 px), só cabe acima de 1500 com o topo até 1070;
// entre 920 e 1070 o molde encolhe a pergunta até caber e, se não couber, avisa no hf check.
const CAIXINHA_FONTE = "Inter-700.woff2", MAX_CHAMADA = 50, MAX_PERGUNTA = 110, CAIXA_TOPO = 920, CAIXA_TOPO_MAX = 1070;

// Gancho de capa: CSS de cada estilo (o desenho aprovado), numa camada por cima de tudo com cópias mudas dos trechos.
// O comum.js (capa) monta o texto, mede e anima. Estilo novo de capa: um bloco de CSS aqui e um ramo lá.
// A capa fica na tela até 2,6 s (Manchete 2,7 s) e a camada termina de sumir em FIM_CAPA.
const FIM_CAPA = 3;
// Manchete: o texto começa em max(1000, queixo + 160) e tem 2 linhas de 170 px com altura de linha 0,98 (333 px; as letras
// chegam a uns 340 px, medido num quadro com o queixo em 1300). Com o queixo até 1000 ele termina perto de 1500, acima dos
// botões do Instagram; passando disso, o montador para.
const MANCHETE_QUEIXO_MAX = 1000;
const CAPA = {
  faixa: () => `
      #capa { --capa-sai: 0; }
      #capa-enquadramento { transform: translateY(calc(var(--capa-alt, 550px) * (1 - var(--capa-sai)))); } /* o quadro desce a altura da tarja */
      #capa-faixa { left: 0; right: 0; top: 0; height: var(--capa-alt, 550px); background: var(--capa-tarja); transform: translateY(calc(-100% * var(--capa-sai))); }
      #capa-gancho { top: 292px; text-align: center; text-transform: uppercase; color: var(--fundo-claro); letter-spacing: 0.005em; }
      .capa-linha { margin: 0 auto; }
      #capa-linha-1 { font-size: 78px; }
      #capa-linha-2 { font-size: 120px; margin-top: 8px; }`,
  manchete: () => `
      #capa-veu { inset: 0; background: linear-gradient(to bottom,
          color-mix(in srgb, var(--fundo-escuro) 18%, transparent) 0px,
          color-mix(in srgb, var(--fundo-escuro) 18%, transparent) calc(var(--capa-queixo) - 60px),
          color-mix(in srgb, var(--fundo-escuro) 90%, transparent) calc(var(--capa-topo) - 40px),
          color-mix(in srgb, var(--fundo-escuro) 90%, transparent) 1600px,
          color-mix(in srgb, var(--fundo-escuro) 75%, transparent) 1920px); }
      #capa-gancho { top: var(--capa-topo); text-align: center; color: var(--fundo-claro); letter-spacing: -0.03em; line-height: 0.98; }
      .capa-linha { margin: 0 auto; font-size: 170px; }
      #capa-forte { color: var(--capa-forte); }`,
  editorial: (destaque) => `
      #capa-veu { inset: 0; background: linear-gradient(to bottom,
          transparent calc(var(--capa-topo, 1100px) - 300px),
          color-mix(in srgb, var(--fundo-claro) 93%, transparent) calc(var(--capa-topo, 1100px) - 80px),
          color-mix(in srgb, var(--fundo-claro) 93%, transparent) 1920px); }
      #capa-filete { left: 90px; top: calc(var(--capa-topo, 1100px) - 44px); width: 150px; height: 7px; border-radius: 4px; background: var(--capa-forte); }
      #capa-gancho { bottom: 440px; color: var(--texto); }
      #capa-linha-1 { font-size: 88px; letter-spacing: -0.02em; }
      #capa-linha-2 { font-size: 168px; line-height: 1.02; }
      #capa-forte { font-family: "${destaque}", serif; font-style: italic; font-weight: 400; color: var(--capa-forte); letter-spacing: -0.01em; }`,
};

// Efeitos sonoros dos estilos 1 a 9: sons/manifest.json, com os sons CC0 do pacote (arquivos em sons/, licença em
// sons/LICENCAS.md) e os 3 do plugin hyperframes (origem "hyperframes", licença Pixabay, não copiados para cá). Cada som
// tem a medida do arquivo (medirSom): o pico, em segundos desde o começo, e o volume. O efeito começa no instante do
// movimento menos o pico, para o pico cair nele. Volume: todos no mesmo nível, por baixo da voz (que fica em -16 LUFS):
// o menor entre 1, o que leva o momentâneo máximo do som a ALVO_LUFS e o que leva o pico a TETO_DBFS (os sons curtos,
// cliques e estalos, param no teto do pico). O whoosh-short, a 0,35 aprovado na 0.7.0, sai a 0,363.
const SONS = JSON.parse(readFileSync(join(RAIZ, "sons", "manifest.json"), "utf8"));
const ALVO_LUFS = -24, TETO_DBFS = -10;
export const volumeDoSom = (s) => +Math.min(1, 10 ** ((ALVO_LUFS - s.momentaneo_lufs) / 20), 10 ** ((TETO_DBFS - s.pico_dbfs) / 20)).toFixed(3);

// Pasta de efeitos do plugin hyperframes, achada pelo mesmo critério do hf: HYPERFRAMES_PLUGIN_ROOT ou a versão mais
// alta ao lado deste plugin no cache do Claude Code (<cache>/<marketplace>/hyperframes/<versão>/) que tenha o lançador
// skills/hyperframes/scripts/plugin-cli.mjs (pasta de versão sem ele, de instalação pela metade, fica de fora).
const versao = (a, b) => { const x = a.split(/\D+/).map(Number), y = b.split(/\D+/).map(Number); for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; };
function pastaEfeitos() {
  let raiz = process.env.HYPERFRAMES_PLUGIN_ROOT;
  if (!raiz) {
    const cache = join(RAIZ, "..", "..", "hyperframes");
    const v = existsSync(cache) ? readdirSync(cache).filter((n) => existsSync(join(cache, n, "skills", "hyperframes", "scripts", "plugin-cli.mjs"))).sort(versao).pop() : undefined;
    if (v) raiz = join(cache, v);
  }
  const sfx = raiz && join(raiz, "skills", "media-use", "audio", "assets", "sfx");
  if (!sfx || !existsSync(join(sfx, "manifest.json")))
    throw new Error('montar: não achei os efeitos sonoros do plugin hyperframes (skills/media-use/audio/assets/sfx). Instale o plugin hyperframes do mesmo marketplace do Editor Chefe e abra uma conversa nova, ou monte sem efeitos com "efeitos": false no escolhas.json.');
  return sfx;
}

// Faixa do texto na tela cheia [y0, y1, x0, x1] em 1080x1920. Com a faixa clara no vídeo (jaleco, parede branca), o texto
// claro perde contraste (no teste, 2,1:1 a 2,9:1): o molde liga um véu escuro atrás dela. O stomp já escurece o vídeo
// inteiro e só pede o véu com a faixa muito clara (com luma de 190, a sobreposição dele dá 2,3 a 2,8:1).
// Na caixinha, a legenda sobe ou desce com a altura da caixa: a faixa fixa de 1250 a 1500 cobre a pergunta curta e a de 3 linhas.
const FAIXA = { "legenda-viva": [1250, 1470, 70, 1010], "palavra-chave": [1220, 1520, 60, 1020], "corte-seco-zoom": [1270, 1470, 80, 1000], "caixinha-pergunta": [1250, 1500, 90, 990] };
const CLARA = 130, CLARA_STOMP = 185; // luma média (0 a 255) da faixa, no 90º percentil dos quadros; acima disso, véu
function claridade(arq, [y0, y1, x0, x1], foco) {
  // Os binários do ambiente.sh (com .exe no Windows); sem eles e fora do PATH, devolve null e o montador avisa
  const sonda = spawnSync(process.env.HYPERFRAMES_FFPROBE_PATH ?? "ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", arq], { encoding: "utf8", timeout: TEMPO_MAX });
  if (sonda.error || !sonda.stdout) return null;
  const [W, H] = sonda.stdout.trim().split(",").map(Number);
  if (!(W > 0 && H > 0)) return null;
  const s = Math.max(1080 / W, 1920 / H), [fx, fy] = foco.split(" ").map((v) => parseFloat(v) / 100);
  const x = Math.max(0, Math.round((x0 + (W * s - 1080) * fx) / s)), y = Math.max(0, Math.round((y0 + (H * s - 1920) * fy) / s));
  const w = Math.max(2, Math.min(W - x, Math.round((x1 - x0) / s))), h = Math.max(2, Math.min(H - y, Math.round((y1 - y0) / s)));
  const r = spawnSync(process.env.HYPERFRAMES_FFMPEG_PATH ?? "ffmpeg", ["-hide_banner", "-nostats", "-i", arq, "-vf", `fps=2,crop=${w}:${h}:${x}:${y},signalstats,metadata=print:key=lavfi.signalstats.YAVG`, "-an", "-f", "null", "-"], { encoding: "utf8", timeout: TEMPO_MAX });
  if (r.error || !r.stderr) return null;
  const v = [...r.stderr.matchAll(/YAVG=([\d.]+)/g)].map((m) => +m[1]).sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length * 0.9)] : null;
}

const ler = (arq, oque) => {
  if (!existsSync(arq)) throw new Error(`montar: falta ${oque} (${arq}).`);
  try { return JSON.parse(readFileSync(arq, "utf8")); }
  catch (e) { throw new Error(`montar: ${oque} (${arq}) não é um JSON válido (${e.message}).`); }
};
// y do queixo (espaço 1080x1920), na capa e na caixinha
const conferirQueixo = (q, campo, quadro) => {
  if (typeof q !== "number" || !(q >= 0 && q <= 1920)) throw new Error(`montar: ${campo} é o y do queixo no ${quadro}, de 0 a 1920 (espaço 1080x1920).`);
};
// O arquivo de fonte precisa ser woff2 de verdade (o download pode ter salvo uma página de erro no lugar)
const conferirWoff2 = (fonts, arq) => {
  if (readFileSync(join(fonts, arq)).subarray(0, 4).toString("latin1") !== "wOF2")
    throw new Error(`montar: fonts/${arq} não é uma fonte woff2 (pode ser uma página de erro salva no lugar). Apague o arquivo e baixe de novo com baixar-fonte.mjs.`);
};
const umaLinha = (s) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim() : ""); // texto colado: espaços e quebras viram um espaço
// Motion dividido: confere a animação e os itens de um cartão e devolve o cartão limpo (texto colado numa linha só;
// "icones" só entra quando algum item tem ícone)
function motionCartao(c, n) {
  if (!Object.hasOwn(ANIMACOES, c.animacao ?? "")) throw new Error(`montar: o cartão ${n} pede "animacao", uma destas: ${Object.keys(ANIMACOES).join(", ")}.`);
  const [min, max, letras] = ANIMACOES[c.animacao], texto = (x) => umaLinha(typeof x === "string" ? x : x?.texto);
  if (!Array.isArray(c.itens) || c.itens.length < min || c.itens.length > max || c.itens.some((x) => !texto(x)))
    throw new Error(`montar: o cartão ${n} (${c.animacao}) pede "itens", uma lista com ${min === max ? min : `${min} a ${max}`} textos curtos tirados da fala (cada um como "texto" ou { "texto": "...", "icone": "..." }).`);
  const itens = c.itens.map(texto), icones = c.itens.map((x) => (x && typeof x === "object" && x.icone != null ? x.icone : null));
  const errado = icones.find((x) => x !== null && !Object.hasOwn(EC.ICONES, x));
  if (errado !== undefined) throw new Error(`montar: o ícone ${JSON.stringify(errado)} do cartão ${n} não existe. Use um destes: ${Object.keys(EC.ICONES).join(", ")}.`);
  const comIcone = icones.filter(Boolean).length;
  if (comIcone && comIcone < itens.length && ICONE_EM_TODOS.includes(c.animacao))
    throw new Error(`montar: no cartão ${n} (${c.animacao}), ponha ícone em todos os itens ou em nenhum: com ícone em só alguns, a animação fica desigual.`);
  const titulo = umaLinha(c.titulo), letrasTitulo = titulo.replace(/\*/g, "").length;
  itens.forEach((x, k) => {
    const lim = c.animacao === "numero" && k === 0 ? MAX_NUMERO : letras;
    if (x.length > lim) throw new Error(`montar: o item "${x}" do cartão ${n} tem ${x.length} caracteres; em ${c.animacao} cabem até ${lim}. Use menos palavras da fala.`);
  });
  if (c.animacao === "numero" && !EC.numero(itens[0])) throw new Error(`montar: no cartão ${n} (numero), o primeiro item é o número dito na fala, com algarismos, como "30%" ou "R$ 2.000".`);
  if (letrasTitulo > MAX_TITULO_IDEIA) throw new Error(`montar: o título do cartão ${n} tem ${letrasTitulo} caracteres; no Motion dividido cabem até ${MAX_TITULO_IDEIA}. Use menos palavras da fala.`);
  return { de: c.de, titulo, animacao: c.animacao, itens, ...(comIcone ? { icones } : {}) };
}
const html =(s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// @font-face dos arquivos que existem em fonts/: título no peso mais perto de 800, corpo de 400, destaque em itálico
// (sem o itálico, declara a normal e o navegador inclina a fonte da marca).
export function fontes(pasta, f, usa, avisar) {
  const arquivos = existsSync(pasta) ? readdirSync(pasta) : [];
  const de = (fam) => arquivos
    .map((n) => new RegExp(`^${fam.replace(/\s+/g, "")}-(\\d+)(-italic)?\\.woff2$`).exec(n))
    .filter(Boolean).map((m) => ({ arq: m[0], peso: +m[1], italico: !!m[2] }));
  const perto = (lista, alvo) => [...lista].sort((a, b) => Math.abs(a.peso - alvo) - Math.abs(b.peso - alvo))[0];
  const face = (fam, x, peso, italico) => `      @font-face { font-family: "${fam}"; src: url("fonts/${x.arq}") format("woff2"); font-weight: ${peso};${italico ? " font-style: italic;" : ""} font-display: block; }`;
  const linhas = [];
  const pede = { titulo: [800, false], corpo: [400, false], destaque: [400, true] };
  for (const chave of usa) {
    const fam = f[chave], [alvo, italico] = pede[chave], todos = de(fam);
    if (!todos.length) throw new Error(`montar: nenhum arquivo da fonte "${fam}" (fontes.${chave}) em fonts/. Baixe com baixar-fonte.mjs, como manda references/marca.md.`);
    const x = perto(todos.filter((t) => t.italico === italico), alvo) ?? perto(todos, alvo);
    conferirWoff2(pasta, x.arq);
    if (x.italico !== italico) { avisar(`montar: "${fam}" sem itálico em fonts/; o navegador vai inclinar a fonte normal.`); linhas.push(face(fam, x, alvo, false)); continue; }
    if (x.peso !== alvo) avisar(`montar: "${fam}" sem peso ${alvo} em fonts/; usando ${x.arq}.`);
    linhas.push(face(fam, x, alvo, italico));
  }
  return linhas.join("\n");
}

// ---------------------------------------------------------------------------------------------------------------------
// Motion narrado (sem gravação): cenas pelas palavras-chave, legenda da narração e a mixagem com os efeitos.
// Uma palavra-chave (até 3 palavras) grande no meio e, embaixo, a legenda da narração em grupos que se escrevem no instante
// de cada palavra; a legenda leva só as palavras de fora das chaves, e o grupo cabe no que sobra de 6 palavras na tela.
// Os instantes ficam todos aqui; o molde só anima o que este plano diz.
const NARRADO = { minChaves: 3, maxChaves: 9, palavrasChave: 3, letrasChave: 24, letrasLegenda: 30, troca: [1, 4.5], duracao: [20, 30] };
const limpaPal = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
// Trecho de 1 ou mais palavras seguidas na fala, a partir de k: [primeira, última] ou null
function acharTrecho(pal, texto, k) {
  const w = texto.split(/\s+/).map(limpaPal).filter(Boolean);
  if (!w.length) return null;
  for (let j = k; j + w.length <= pal.length; j++) if (w.every((x, m) => limpaPal(pal[j + m].txt) === x)) return [j, j + w.length - 1];
  return null;
}
// Frase longa vira linhas equilibradas: o menor número de linhas que cabe (palavras e letras) e, entre elas, a divisão
// em que a linha mais comprida é a menor possível
function partir(f, pal, maxPal, maxLetras) {
  const letras = (a, b) => f.slice(a, b).reduce((s, i) => s + pal[i].txt.length + 1, -1);
  const custo = (a, b) => (b - a > maxPal ? Infinity : letras(a, b));
  for (let n = Math.ceil(f.length / maxPal); n <= f.length; n++) {
    const M = Array.from({ length: n + 1 }, () => Array(f.length + 1).fill(Infinity)), C = M.map((l) => l.map(() => 0));
    M[0][0] = 0;
    for (let k = 1; k <= n; k++)
      for (let j = k; j <= f.length; j++)
        for (let a = k - 1; a < j; a++) { const v = Math.max(M[k - 1][a], custo(a, j)); if (v < M[k][j]) { M[k][j] = v; C[k][j] = a; } }
    if (M[n][f.length] <= maxLetras) {
      const out = [];
      for (let k = n, j = f.length; k > 0; j = C[k][j], k--) out.unshift(f.slice(C[k][j], j));
      return out;
    }
  }
  return f.map((i) => [i]);
}

export function planoNarrado(words, esc, avisar = () => {}) {
  const pal = words.map((w) => ({ txt: w.text, ini: w.start, fim: w.end })), fimFala = pal[pal.length - 1].fim;
  const { chaves, apice, fecho, quebras = [] } = esc;
  if (!Array.isArray(chaves) || chaves.length < NARRADO.minChaves || chaves.length > NARRADO.maxChaves)
    throw new Error(`montar: o Motion narrado pede "chaves", de ${NARRADO.minChaves} a ${NARRADO.maxChaves} palavras-chave tiradas da fala, na ordem em que são ditas (a primeira é a capa).`);
  let k = 0;
  const cenas = chaves.map((c) => {
    const texto = umaLinha(typeof c === "string" ? c : c?.texto), icone = c && typeof c === "object" ? c.icone ?? null : null;
    if (!texto) throw new Error('montar: cada palavra-chave é um texto da fala, como "agenda" ou { "texto": "agenda", "icone": "calendario" }.');
    if (texto.split(" ").length > NARRADO.palavrasChave || texto.length > NARRADO.letrasChave)
      throw new Error(`montar: a palavra-chave "${texto}" é longa demais; use até ${NARRADO.palavrasChave} palavras e ${NARRADO.letrasChave} caracteres.`);
    if (icone !== null && !Object.hasOwn(EC.ICONES, icone)) throw new Error(`montar: o ícone ${JSON.stringify(icone)} da palavra-chave "${texto}" não existe. Use um destes: ${Object.keys(EC.ICONES).join(", ")}.`);
    const r = acharTrecho(pal, texto, k);
    if (!r) throw new Error(`montar: a palavra-chave "${texto}" não foi achada na fala depois da anterior. Use as palavras como estão no words.json, na ordem em que são ditas.`);
    k = r[1] + 1;
    return { texto, de: r[0], ate: r[1], t: pal[r[0]].ini, apice: false, icone };
  });
  if (apice != null) {
    const a = cenas.findIndex((c) => limpaPal(c.texto) === limpaPal(String(apice)));
    if (a < 0) throw new Error('montar: "apice" precisa ser uma das "chaves".');
    cenas[a].apice = true;
  }
  // Fecho: com "fecho" (a primeira palavra da assinatura falada), começa nela; sem, logo depois da última palavra
  let F = fimFala + 0.25, semLegenda = pal.length;
  if (fecho != null) {
    const r = acharTrecho(pal, umaLinha(String(fecho)), cenas[cenas.length - 1].ate + 1);
    if (!r) throw new Error(`montar: "fecho" ("${fecho}") precisa ser palavra da fala depois da última palavra-chave: a primeira da assinatura falada.`);
    [semLegenda] = r; F = pal[r[0]].ini;
  }
  const depoisDoPonto = pal.findIndex((p, i) => i > semLegenda && /[.?!]$/.test(pal[i - 1].txt));
  const fim = Math.ceil(Math.max(fimFala + 0.9, F + 1.5) * 60) / 60;

  // Legenda: as palavras de fora das chaves, em frases (pontuação, pausa de mais de 0,35 s, "quebras") e linhas equilibradas
  const forcar = new Set();
  let q = 0;
  for (const txt of quebras) {
    const r = acharTrecho(pal, umaLinha(String(txt)), q);
    if (r) { forcar.add(r[0]); q = r[0] + 1; } else avisar(`montar: a quebra "${txt}" não foi achada na fala, na ordem; ficou de fora.`);
  }
  const legenda = [];
  const limites = [{ ate: -1, n: cenas[0].ate - cenas[0].de + 1 }, ...cenas.map((c) => ({ de: c.de, ate: c.ate, n: c.ate - c.de + 1 })), { de: semLegenda, n: 0 }];
  for (let s = 0; s + 1 < limites.length; s++) {
    const de = limites[s].ate + 1, ate = Math.min(limites[s + 1].de, semLegenda) - 1, frases = [];
    // na tela, junto da legenda: a palavra-chave anterior (antes da primeira, a capa) ou a seguinte
    const maxPal = 6 - Math.max(limites[s].n, limites[s + 1].n);
    for (let i = de; i <= ate; i++) {
      const ant = pal[i - 1];
      if (i === de || /[.?!,;:…]$/.test(ant.txt) || pal[i].ini - ant.fim > 0.35 || forcar.has(i)) frases.push([i]);
      else frases[frases.length - 1].push(i);
    }
    // o grupo não passa da palavra-chave que vem depois da seguinte (a conta das 6 palavras só vale com as duas vizinhas)
    const teto = cenas[s + 1] ? cenas[s + 1].t - 0.2 : Infinity;
    for (const f of frases) for (const g of partir(f, pal, maxPal, NARRADO.letrasLegenda)) legenda.push({ de: g[0], ate: g[g.length - 1], ini: pal[g[0]].ini, teto });
  }
  // Cada grupo sai 0,2 s antes do seguinte (no mesmo lugar), no máximo 1,2 s depois da última palavra dele, ou no fecho
  legenda.forEach((g, i) => {
    g.sai = +Math.max(g.ini, Math.min(legenda[i + 1] ? legenda[i + 1].ini - 0.2 : F - 0.25, pal[g.ate].fim + 1.2, g.teto)).toFixed(3);
    delete g.teto;
  });
  // Cada palavra-chave sai 0,25 s antes da seguinte bater (ou do fecho)
  cenas.forEach((c, i) => (c.sai = +Math.max(c.t, (cenas[i + 1] ? cenas[i + 1].t : F) - 0.25).toFixed(3)));

  // Troca de cena a cada 1 a 4,5 s (a capa conta desde o quadro 0) e duração de 20 a 30 s: avisos, não erros
  const fmt = (x) => x.toFixed(1).replace(".", ","), batidas = [0, ...cenas.slice(1).map((c) => c.t), F];
  batidas.slice(1).forEach((b, i) => {
    const c = cenas[i + 1]?.texto;
    if (b - batidas[i] > NARRADO.troca[1]) avisar(`montar: ${fmt(b - batidas[i])} s com a mesma palavra-chave na tela ("${cenas[i].texto}"${c ? `, até "${c}"` : ", até o fecho"}); escolha mais uma palavra-chave nesse trecho para a cena trocar a cada 2 a 4 s.`);
  });
  cenas.slice(1).forEach((c, i) => c.t - cenas[i].t < NARRADO.troca[0] &&
    avisar(`montar: as palavras-chave "${cenas[i].texto}" e "${c.texto}" estão a ${fmt(c.t - cenas[i].t)} s uma da outra; a primeira mal aparece. Troque uma delas.`));
  if (fim - F > NARRADO.troca[1]) avisar(`montar: o fecho fica ${(fim - F).toFixed(1).replace(".", ",")} s parado na tela; a assinatura falada é longa. Ponha o "fecho" numa palavra mais perto do fim ou encurte a assinatura no roteiro.`);
  if (fim < NARRADO.duracao[0] || fim > NARRADO.duracao[1]) avisar(`montar: o vídeo vai ter ${fim.toFixed(1).replace(".", ",")} s; o Motion narrado é de ${NARRADO.duracao[0]} a ${NARRADO.duracao[1]} s (55 a 70 palavras no roteiro).`);

  // Efeitos: impacto grave na capa e no ápice, curtos com camada grave nas outras chaves, carrilhão longo no fecho.
  // Dois a menos de 0,5 s um do outro: fica o mais forte.
  const CURTOS = ["click", "pop", "ping"], FORCA = { principal: 3, longo: 2, curto: 1 };
  let n = 0;
  const ev = [...cenas.map((c, i) => (!i ? { t: c.t, som: "impact-bass-2", classe: "principal" } : c.apice ? { t: c.t, som: "impact-bass-1", classe: "principal" } : { t: c.t, som: CURTOS[n++ % CURTOS.length], classe: "curto" })),
    { t: F, som: "chime", classe: "longo" }];
  const efeitos = [];
  for (const e of ev) {
    const ant = efeitos[efeitos.length - 1];
    if (!ant || e.t - ant.t >= 0.5) efeitos.push(e);
    else if (FORCA[e.classe] > FORCA[ant.classe]) efeitos[efeitos.length - 1] = e;
  }
  return {
    palavras: pal.map((p) => [p.txt, p.ini, p.fim]), fim: +fim.toFixed(3), efeitos,
    cenas: cenas.map(({ de, ate, t, sai, apice, icone }) => ({ de, ate, t, sai, apice, icone })), legenda,
    fecho: { t: +F.toFixed(3), assinatura: +(depoisDoPonto > 0 ? pal[depoisDoPonto].ini : F + 0.35).toFixed(3) },
  };
}

// Áudio do Motion narrado, todo pelo ffmpeg do ambiente.sh: estéreo em 48 kHz, em Float32Array intercalado
const SR = 48000;
const ALVO_DB = { principal: -2, curto: -6, longo: -8 }; // em relação à voz: o principal ao máximo dela; os outros ao instante
const COM_CORPO = ["click", "pop", "ping"]; // curtos que ganham a camada de impacto grave por baixo
const ffmpeg = () => process.env.HYPERFRAMES_FFMPEG_PATH ?? "ffmpeg";
// -nostdin e o áudio por arquivo: pela entrada padrão o ffmpeg chegou a travar até o tempo máximo com a máquina carregada
function ff(args) {
  const r = spawnSync(ffmpeg(), ["-v", "error", "-nostdin", "-y", ...args], { stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 30, timeout: TEMPO_MAX });
  if (r.error || r.status !== 0) throw new Error(`montar: o ffmpeg falhou ao preparar o áudio (${String(r.error?.message ?? r.stderr).trim().split("\n").pop()}).`);
  return r.stdout;
}
// Mono vai inteiro para os dois canais, como na mixagem da HyperFrames (o -ac 2 do ffmpeg baixaria 3 dB)
function pcm(arq, filtro = "") {
  const r = spawnSync(process.env.HYPERFRAMES_FFPROBE_PATH ?? "ffprobe", ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=channels", "-of", "csv=p=0", arq], { encoding: "utf8", timeout: TEMPO_MAX });
  if (r.error || r.status !== 0) throw new Error(`montar: o ffprobe não leu o áudio ${arq}.`);
  const af = [parseInt(r.stdout) === 1 ? "pan=stereo|c0=c0|c1=c0" : "aformat=channel_layouts=stereo", filtro].filter(Boolean).join(",");
  const b = ff(["-i", arq, "-af", af, "-ar", String(SR), "-f", "f32le", "-"]);
  return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}
const gravar = (x, arq) => {
  const raw = `${arq}.f32`;
  writeFileSync(raw, Buffer.from(x.buffer, x.byteOffset, x.byteLength));
  try { ff(["-f", "f32le", "-ar", String(SR), "-ac", "2", "-i", raw, "-c:a", "pcm_s24le", arq]); } finally { rmSync(raw, { force: true }); }
};
const pico = (x) => { let m = 0, k = 0; for (let i = 0; i < x.length; i++) if (Math.abs(x[i]) > m) { m = Math.abs(x[i]); k = i; } return { m, k: k >> 1 }; };
const aoPico = (x, db) => { const g = 10 ** (db / 20) / (pico(x).m || 1); return x.map((v) => v * g); };
// ebur128: momentâneo de 100 em 100 ms (janela de 400 ms que termina em t), integrado e pico verdadeiro
function loudness(arq, folga = false) {
  const r = spawnSync(ffmpeg(), ["-nostats", "-hide_banner", "-i", arq, "-af", `${folga ? "apad=pad_dur=1," : ""}ebur128=peak=true`, "-f", "null", "-"], { encoding: "utf8", maxBuffer: 1 << 28, timeout: TEMPO_MAX });
  if (r.error || r.status !== 0) throw new Error(`montar: o ffmpeg não mediu o volume de ${arq}.`);
  const M = [...r.stderr.matchAll(/t:\s*([\d.]+)\s+TARGET:\S+ LUFS\s+M:\s*(\S+)/g)].map((m) => [+m[1], Number.isFinite(+m[2]) ? +m[2] : -120]);
  const resumo = r.stderr.slice(r.stderr.lastIndexOf("Summary:"));
  return { M, I: +/I:\s*(\S+) LUFS/.exec(resumo)?.[1], TP: +/Peak:\s*(\S+) dBFS/.exec(resumo)?.[1] };
}
const maxM = (arq) => Math.max(...loudness(arq, true).M.map((m) => m[1]));

// Medida de um som como a HyperFrames toca (mono nos dois canais, em nível cheio): duração, instante do pico, nível do
// pico (a maior amostra) e momentâneo máximo. É a medida gravada no sons/manifest.json e conferida pelos testes.
// O instante do pico é o centro da janela de 10 ms com mais energia nos dois canais: nos sons de pico largo, a maior
// amostra sozinha muda de lugar com a compressão do MP4 final (medido: 121 ms no whoosh-grave).
export function medirSom(arq) {
  const x = pcm(arq), p = pico(x), n = x.length / 2, J = SR / 100, tmp = mkdtempSync(join(tmpdir(), "som-"));
  let soma = 0, max = -1, k = 0;
  for (let i = 0; i < n; i++) {
    soma += x[2 * i] ** 2 + x[2 * i + 1] ** 2;
    if (i >= J) soma -= x[2 * (i - J)] ** 2 + x[2 * (i - J) + 1] ** 2;
    if (soma > max) { max = soma; k = Math.max(0, i - J / 2); }
  }
  try {
    gravar(x, join(tmp, "som.wav"));
    return { duracao: +(n / SR).toFixed(3), pico: +(k / SR).toFixed(3), pico_dbfs: +(20 * Math.log10(p.m)).toFixed(1), momentaneo_lufs: +maxM(join(tmp, "som.wav")).toFixed(1) };
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

// Efeito pronto para mixar: pico em -1 dBFS; o curto ganha a camada grave alinhada pelo pico; se nem com volume 1 ele
// alcança o volume preciso, o limitador empurra de 1 em 1 dB (até 15) sem passar o pico
function prepararEfeito(sfx, lista, som, preciso, pasta) {
  let x = aoPico(pcm(join(sfx, lista[som].file)), -1);
  if (COM_CORPO.includes(som)) {
    const cam = aoPico(pcm(join(sfx, lista["impact-bass-1"].file), "atrim=0:0.45,lowpass=f=180,lowpass=f=180,afade=t=out:st=0.15:d=0.3"), -4);
    const d = pico(x).k - pico(cam).k, ox = Math.max(0, -d), oc = Math.max(0, d);
    const y = new Float32Array(2 * Math.max(ox + x.length / 2, oc + cam.length / 2));
    y.set(x, 2 * ox);
    for (let i = 0; i < cam.length; i++) y[2 * oc + i] += cam[i];
    x = aoPico(y, -1);
  }
  const base = join(pasta, "efeitos", `_${som}.wav`), arq = join(pasta, "efeitos", `${som}.wav`);
  gravar(x, base);
  copyFileSync(base, arq);
  let empurrao = 0, m = maxM(arq);
  while (m < preciso && empurrao < 15) {
    empurrao++;
    ff(["-i", base, "-af", `volume=${empurrao}dB,alimiter=limit=0.891:level=disabled:attack=1:release=40:latency=1`, "-c:a", "pcm_s24le", arq]);
    m = maxM(arq);
  }
  rmSync(base);
  if (empurrao) x = pcm(arq);
  return { x, m, empurrao, imp: pico(x).k };
}

// Voz e efeitos somados aqui, masterizados em -16 LUFS com o pico abaixo de -1 dBTP (limitador em -2 dBFS, sem atraso):
// o render da HyperFrames só baixa o áudio que passa de -1 dBTP, então o MP4 sai no volume certo, sem passo depois
function mixarNarrado(pasta, plano, comEfeitos) {
  const voz = pcm(join(pasta, "audio", "voz.wav")), N = Math.round(plano.fim * SR), mix = new Float32Array(2 * N);
  mix.set(voz.subarray(0, 2 * N));
  const tmp = mkdtempSync(join(tmpdir(), "narrado-"));
  try {
    gravar(voz, join(tmp, "voz.wav"));
    // com 1 s de folga no fim: o efeito do fecho, depois da última palavra, mede o silêncio, não a última janela da voz
    const mv = loudness(join(tmp, "voz.wav"), true).M, vozMax = Math.max(...mv.map((m) => m[1]));
    // voz no instante t: a janela de 400 ms de t - 0,1 a t + 0,3 s, a mesma medida da calibragem aprovada
    const noInstante = (t) => mv.reduce((a, b) => (Math.abs(b[0] - t - 0.3) < Math.abs(a[0] - t - 0.3) ? b : a))[1];
    let efeitos = [];
    if (comEfeitos) {
      const sfx = pastaEfeitos(), lista = ler(join(sfx, "manifest.json"), "o manifest.json dos efeitos");
      mkdirSync(join(pasta, "efeitos"), { recursive: true });
      // efeito numa pausa da voz (ou depois dela) mede contra o máximo da voz, senão sumiria
      const ev = plano.efeitos.map((e) => { const mi = noInstante(e.t); return { ...e, m_voz: mi, alvo: (e.classe === "principal" || mi < vozMax - 20 ? vozMax : mi) + ALVO_DB[e.classe] }; });
      const prep = {};
      for (const som of new Set(ev.map((e) => e.som))) {
        for (const s of [som, ...(COM_CORPO.includes(som) ? ["impact-bass-1"] : [])])
          if (!lista[s] || !existsSync(join(sfx, lista[s].file))) throw new Error(`montar: o efeito "${s}" não está na pasta de efeitos da HyperFrames (${sfx}).`);
        prep[som] = prepararEfeito(sfx, lista, som, Math.max(...ev.filter((e) => e.som === som).map((e) => e.alvo)) + 0.3, pasta);
      }
      efeitos = ev.map((e) => {
        const p = prep[e.som], v = 10 ** ((e.alvo - p.m) / 20), vol = Math.min(1, v), ini = Math.round(e.t * SR) - p.imp;
        for (let i = Math.max(0, -ini); i < p.x.length / 2 && ini + i < N; i++) { mix[2 * (ini + i)] += p.x[2 * i] * vol; mix[2 * (ini + i) + 1] += p.x[2 * i + 1] * vol; }
        return { som: e.som, classe: e.classe, impacto: +e.t.toFixed(3), inicio: +(ini / SR).toFixed(5), voz_no_instante: +e.m_voz.toFixed(1), alvo: +e.alvo.toFixed(1), efeito_max: +p.m.toFixed(1), volume: +vol.toFixed(3), empurrao_db: p.empurrao, no_teto: v > 1.0005 };
      });
    }
    gravar(mix, join(tmp, "soma.wav"));
    let ganho = -16 - loudness(join(tmp, "soma.wav")).I, med;
    for (let passo = 0; passo < 3; passo++) {
      ff(["-i", join(tmp, "soma.wav"), "-af", `volume=${ganho.toFixed(2)}dB,alimiter=limit=0.794:level=disabled:attack=1:release=40:latency=1`, "-c:a", "pcm_s24le", join(pasta, "audio", "mix.wav")]);
      med = loudness(join(pasta, "audio", "mix.wav"));
      if (Math.abs(med.I + 16) <= 0.2) break;
      ganho += -16 - med.I;
    }
    const rel = { voz_momentaneo_max: +vozMax.toFixed(1), ganho_db: +ganho.toFixed(2), integrado_lufs: med.I, pico_dbtp: med.TP, efeitos };
    writeFileSync(join(pasta, "audio", "mixagem.json"), JSON.stringify(rel, null, 1));
    return rel;
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

function montarNarrado(pasta, esc, marca, arqMarca, usa, avisar) {
  const words = ler(join(pasta, "words.json"), "o words.json (do voz-com-tempos.mjs)");
  if (!Array.isArray(words) || !words.length || words.some((w, i) => typeof w?.text !== "string" || !(w.end >= w.start) || (i && w.start < words[i - 1].start)))
    throw new Error("montar: o words.json precisa ser a lista do voz-com-tempos.mjs ({ text, start, end }, na ordem da fala). Rode o voz-com-tempos.mjs de novo.");
  if (!existsSync(join(pasta, "audio", "voz.wav"))) throw new Error(`montar: falta a voz (${join(pasta, "audio", "voz.wav")}). Rode o voz-com-tempos.mjs na pasta do vídeo.`);
  if (esc.efeitos !== undefined && typeof esc.efeitos !== "boolean") throw new Error('montar: "efeitos" é true (ligados) ou false (desligados).');
  const plano = planoNarrado(words, esc, avisar);
  // Fecho: o logo do dono (marca.logo, caminho a partir do marca.json), ou o nome; a assinatura embaixo, se for outra frase
  let principal = `<div id="fecho-nome"><span id="fecho-nome-texto">${html(marca.nome ?? "")}</span></div>`;
  if (marca.logo != null) {
    const arq = resolve(dirname(arqMarca), String(marca.logo)), ext = extname(arq).toLowerCase();
    if (![".png", ".jpg", ".jpeg", ".webp", ".svg"].includes(ext) || !existsSync(arq))
      throw new Error(`montar: o logo do marca.json (${marca.logo}) precisa ser um arquivo PNG, JPG, WebP ou SVG que exista, com o caminho a partir da pasta do marca.json.`);
    copyFileSync(arq, join(pasta, "logo" + ext));
    principal = `<img id="fecho-logo" src="logo${ext}" alt="${html(marca.nome ?? "")}" />`;
  } else if (!umaLinha(marca.nome)) throw new Error('montar: o fecho do Motion narrado mostra o "nome" do marca.json (ou o "logo"); falta o nome.');
  const ass = umaLinha(marca.assinatura) && umaLinha(marca.assinatura) !== umaLinha(marca.nome) ? `\n        <div id="fecho-assinatura">${html(umaLinha(marca.assinatura))}</div>` : "";
  const mix = mixarNarrado(pasta, plano, esc.efeitos !== false);
  const { efeitos: _ef, ...dados } = plano;
  const valores = {
    FONTES: fontes(join(pasta, "fonts"), marca.fontes ?? {}, usa, avisar),
    FUNDO_CLARO: marca.cores.fundo_claro, FUNDO_ESCURO: marca.cores.fundo_escuro, TEXTO: marca.cores.texto, DESTAQUE: marca.cores.destaque,
    TITULO: html(marca.fontes.titulo), CORPO: html(marca.fontes.corpo), DURACAO: plano.fim.toFixed(3),
    DADOS: JSON.stringify(dados).replace(/</g, "\\u003c"), FECHO: `        ${principal}${ass}`,
    AUDIO: `      <audio id="narracao" class="clip" src="audio/mix.wav" data-start="0" data-duration="${plano.fim.toFixed(3)}" data-track-index="1" data-volume="1"></audio>`,
  };
  const molde = readFileSync(join(RAIZ, "estilos", "motion-narrado.html"), "utf8");
  const sobra = [...molde.matchAll(/\{\{([A-Z_]+)\}\}/g)].map((m) => m[1]).filter((k) => !(k in valores));
  if (sobra.length) throw new Error(`montar: marcador sem valor no molde: ${sobra.join(", ")}.`);
  writeFileSync(join(pasta, "index.html"), molde.replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => valores[k]));
  copyFileSync(join(RAIZ, "estilos", "comum.js"), join(pasta, "comum.js"));
  return { narrado: true, duracao: plano.fim, cenas: plano.cenas.length, palavras: words.length, efeitos: mix.efeitos.length, integrado: mix.integrado_lufs, pico: mix.pico_dbtp };
}

export function montar(pasta, avisar = (m) => console.error(m)) {
  const esc = ler(join(pasta, "escolhas.json"), "o escolhas.json");
  if (!esc || typeof esc !== "object" || Array.isArray(esc)) throw new Error('montar: o escolhas.json precisa ser um objeto entre chaves, como { "estilo": "legenda-viva" }.');
  if (!USA[esc.estilo]) throw new Error(`montar: estilo "${esc.estilo}" não existe. Use: ${Object.keys(USA).join(", ")}.`);
  const caixinha = esc.estilo === "caixinha-pergunta", narrado = esc.estilo === "motion-narrado";
  if (narrado && esc.capa != null && esc.capa !== false)
    throw new Error('montar: o Motion narrado já abre com a primeira palavra-chave como capa (ela está na tela desde o primeiro quadro); tire o campo "capa" do escolhas.json.');
  if (caixinha && esc.capa != null && esc.capa !== false)
    throw new Error('montar: a Caixinha de pergunta já é a capa do vídeo (a caixinha aparece desde o primeiro quadro); tire o campo "capa" do escolhas.json.');
  // Gancho de capa (opcional): { estilo, texto com uma *palavra forte*, até 8 palavras, queixo (y no quadro 0, padrão 840) }.
  // "capa": null ou false é o mesmo que sem capa. Espaços e quebras de linha do texto colado viram um espaço só.
  let capa;
  if (esc.capa != null && esc.capa !== false) {
    if (typeof esc.capa !== "object" || Array.isArray(esc.capa))
      throw new Error('montar: "capa" precisa ser { "estilo": ..., "texto": ... }, como "capa": { "estilo": "faixa", "texto": "Emagrecer é só *comer menos*?" }.');
    const { estilo, queixo = 840 } = esc.capa, texto = umaLinha(esc.capa.texto);
    if (!Object.hasOwn(CAPA, estilo ?? "")) throw new Error(`montar: capa.estilo "${estilo}" não existe. Use: ${Object.keys(CAPA).join(", ")}.`);
    if (!/^[^*]*\*[^*]+\*[^*]*$/.test(texto))
      throw new Error('montar: capa.texto precisa de exatamente uma palavra forte entre asteriscos, como "Emagrecer é só *comer menos*?".');
    const n = texto.replace(/\*/g, "").split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
    if (n > 8) throw new Error(`montar: o gancho de capa tem ${n} palavras; cabem até 8. Encurte o texto.`);
    conferirQueixo(queixo, "capa.queixo", "quadro 0");
    if (estilo === "manchete" && queixo > MANCHETE_QUEIXO_MAX)
      throw new Error(`montar: com o queixo em ${queixo}, o texto da Manchete começaria em ${queixo + 160} e passaria de 1500, embaixo dos botões do Instagram (na Manchete o queixo pode ir até ${MANCHETE_QUEIXO_MAX}). O rosto está baixo demais para a Manchete: use a Faixa ou a Editorial, ou siga sem capa.`);
    capa = { estilo, texto, queixo, fim: FIM_CAPA };
  }
  // Fontes do estilo e da capa (todo estilo já usa o título, que é a fonte das capas; a Editorial pede também a de destaque, em itálico)
  const usa = [...new Set([...USA[esc.estilo], ...(capa?.estilo === "editorial" ? ["destaque"] : [])])];
  const arqMarca = resolve(pasta, esc.marca ?? "../marca.json"), marca = ler(arqMarca, "o marca.json");
  // Caixinha: pergunta do escolhas.json; chamada do escolhas.json ou, sem ela, a chamada_caixinha guardada no marca.json;
  // queixo opcional (y do queixo no quadro, como na capa Manchete) baixa a caixa para não cobrir a boca
  let caixa;
  if (caixinha) {
    const { pergunta: p, chamada: c, queixo } = esc.caixinha ?? {}, pergunta = umaLinha(p), daqui = umaLinha(c);
    const chamada = daqui || umaLinha(marca.chamada_caixinha);
    if (p !== undefined && typeof p !== "string") throw new Error('montar: caixinha.pergunta precisa ser um texto, entre aspas, no escolhas.json.');
    if (!pergunta) throw new Error('montar: a Caixinha de pergunta pede a pergunta: "caixinha": { "pergunta": "..." } no escolhas.json (falta caixinha.pergunta).');
    if (!chamada) throw new Error('montar: falta a chamada da caixinha (a frase da faixa escura): ponha "chamada" em "caixinha" no escolhas.json ou guarde "chamada_caixinha" no marca.json.');
    if (pergunta.length > MAX_PERGUNTA) throw new Error(`montar: a pergunta da caixinha tem ${pergunta.length} caracteres; cabem até ${MAX_PERGUNTA}. Encurte o texto.`);
    if (chamada.length > MAX_CHAMADA)
      throw new Error(`montar: a chamada da caixinha (${daqui ? "caixinha.chamada, no escolhas.json" : "chamada_caixinha, no marca.json"}) tem ${chamada.length} caracteres; cabem até ${MAX_CHAMADA}. Encurte o texto.`);
    if (queixo !== undefined) conferirQueixo(queixo, "caixinha.queixo", "quadro");
    const topo = Math.max(CAIXA_TOPO, Math.round((queixo ?? 0) + 60));
    if (topo > CAIXA_TOPO_MAX)
      throw new Error(`montar: com o queixo em ${queixo}, a caixinha começaria em ${topo} e não sobra lugar para ela e a legenda acima dos botões do Instagram (o queixo pode ir até ${CAIXA_TOPO_MAX - 60}). O rosto está baixo demais para este estilo: ofereça outro estilo ao dono.`);
    caixa = { chamada, pergunta, topo };
  }
  for (const k of ["fundo_claro", "fundo_escuro", "texto", "destaque"])
    if (!/^#[0-9a-fA-F]{6}$/.test(marca.cores?.[k] ?? "")) throw new Error(`montar: cores.${k} do marca.json precisa estar no formato #RRGGBB.`);
  // O nome da fonte vai para o CSS e para o JS do molde: só letras, números e espaço
  for (const k of ["titulo", "corpo", "destaque"])
    if ((usa.includes(k) || marca.fontes?.[k] !== undefined) && !/^[\p{L}\p{N} ]+$/u.test(marca.fontes?.[k] ?? ""))
      throw new Error(`montar: fontes.${k} do marca.json ("${marca.fontes?.[k] ?? ""}") precisa ser o nome de uma fonte, só com letras, números e espaço.`);
  if (narrado) return montarNarrado(pasta, esc, marca, arqMarca, usa, avisar);
  const corte = ler(resolve(pasta, esc.trechos ?? "trechos.json"), "o trechos.json"), manter = corte.manter, extras = corte.extras ?? [];
  if (!Array.isArray(manter) || !manter.length) throw new Error('montar: o trechos.json não tem nenhum trecho em "manter". Rode o trechos.mjs de novo e confira se o vídeo tem fala.');
  if (!Array.isArray(extras) || extras.some((c) => !Array.isArray(c) || c.length !== 2 || !c.every(Number.isFinite)))
    throw new Error('montar: "extras" do trechos.json precisa ser a lista de cortes extras do trechos.mjs ([início, fim] em segundos). Rode o trechos.mjs de novo.');
  // Palavra dentro de um corte extra (vício, tomada repetida, fora do trecho escolhido) sai da legenda, com aviso. Corte de
  // pausa não tira palavra: perto das pausas o tempo do reconhecedor erra alguns centésimos.
  const fora = [];
  const palavras = ler(resolve(pasta, esc.transcricao ?? "transcript.json"), "o transcript.json")
    .map((w) => [w.text, +w.start.toFixed(2), +w.end.toFixed(2)])
    .filter(([txt, a, b]) => {
      const sai = extras.some(([x, y]) => (a + b) / 2 > x && (a + b) / 2 < y);
      if (sai) fora.push(txt);
      return !sai;
    });
  if (fora.length) avisar(`montar: ${fora.length} ${fora.length > 1 ? "palavras dentro dos cortes extras saíram" : "palavra dentro de um corte extra saiu"} da legenda: "${fora.slice(0, 12).join(" ")}${fora.length > 12 ? " ..." : ""}". Confira se são as que você cortou.`);

  // Um <video> por trecho mantido (receitas Hard cut e Trim in/out da hyperframes-core). O início arredonda para o quadro de
  // antes e o fim para o quadro de depois (o fim fraco da palavra não se perde), sem repetir quadro do trecho anterior.
  let pos = 0, fimAnt = 0;
  const recuo = EC.COM_CARTOES.includes(esc.estilo) ? "          " : "        ";
  const trechos = manter.map(([a, b], i) => {
    const fa = Math.max(Math.floor(a * F + 1e-6), fimAnt), n = Math.ceil(b * F - 1e-6) - fa;
    if (!(n >= 1)) throw new Error(`montar: o trecho ${i + 1} do trechos.json (${a} a ${b} s) tem menos de 1 quadro. Confira o início e o fim dele.`);
    // como o molde os lê na página (os números já arredondados das marcas do <video>). Início e duração em milissegundos
    // inteiros, a duração até 1 ms antes do início do trecho seguinte: arredondar os dois em separado deixava a soma passar
    // do início seguinte no ponto flutuante (84.367 + 1.266 > 85.633), e o lint acusa duplicate_audio_track. O milésimo da
    // emenda arredonda para baixo: arredondado para cima (13,4667 s virava 13,467), o quadro caía no milésimo vazio entre os
    // dois trechos e saía sem vídeo, em 1 de cada 3 emendas
    const ms = (q) => Math.floor((q * 1000) / F + 1e-6);
    const t = { ini: ms(pos) / 1000, dur: (ms(pos + n) - ms(pos) - 1) / 1000, src: +(fa / F).toFixed(3) };
    pos += n; fimAnt = fa + n;
    return t;
  });
  const videos = trechos.map((t, i) => `${recuo}<video id="trecho-${i + 1}" class="trecho clip" src="fonte.mp4" data-start="${t.ini.toFixed(3)}" data-duration="${t.dur.toFixed(3)}" data-media-start="${t.src.toFixed(3)}" data-track-index="0" playsinline data-has-audio="true" data-fade-in="${RAMPA}" data-fade-out="${RAMPA}"></video>`);
  const total = +(pos / F).toFixed(3);
  if (capa && total < 4) throw new Error(`montar: o vídeo editado tem ${total.toFixed(2).replace(".", ",")} s, curto demais para gancho de capa (precisa de 4 s ou mais).`);
  if (!existsSync(join(pasta, "fonte.mp4"))) avisar("montar: falta fonte.mp4 na pasta (passo 1 de references/audio-e-corte.md).");

  // Escolhas do vídeo; palavra escolhida que não aparece na fala, na ordem, é avisada e fica de fora
  const pal = palavras.map(([txt]) => ({ txt }));
  const conferir = (campo, lista) => EC.marcar(pal, lista).forEach((i, n) => i < 0 && avisar(`montar: "${lista[n]}" (${campo}) não foi achada na fala, na ordem; ficou de fora.`));
  const dados = { palavras };
  if (esc.estilo === "palavra-chave") {
    if (!Array.isArray(esc.chaves) || !esc.chaves.length) throw new Error('montar: palavra-chave pede "chaves", a lista de palavras fortes.');
    if (!esc.chaves.includes(esc.apice)) throw new Error('montar: "apice" precisa ser uma das "chaves".');
    if (!["keynote", "stomp"].includes(esc.identidade ?? "keynote")) throw new Error('montar: "identidade" é keynote ou stomp.');
    conferir("chaves", esc.chaves);
    Object.assign(dados, { identidade: esc.identidade ?? "keynote", chaves: esc.chaves, apice: esc.apice });
  }
  if (esc.estilo === "corte-seco-zoom") {
    dados.enfase = esc.enfase ?? [];
    conferir("enfase", dados.enfase);
  }
  if (EC.COM_CARTOES.includes(esc.estilo)) {
    if (!Array.isArray(esc.cartoes) || !esc.cartoes.length || esc.cartoes.some((c) => !c || typeof c.de !== "number" || typeof c.titulo !== "string"))
      throw new Error('montar: este estilo pede "cartoes": [{ "de": segundo do original, "titulo": "..." }].');
    esc.cartoes.forEach((c, i) => {
      if (i && !(c.de > esc.cartoes[i - 1].de)) throw new Error(`montar: os cartões precisam estar na ordem da fala: o cartão ${i + 1} ("de": ${c.de}) não vem depois do cartão ${i} ("de": ${esc.cartoes[i - 1].de}).`);
    });
    let cartoes = esc.cartoes;
    if (esc.estilo === "motion-dividido") { // item que não está na fala daquela ideia é avisado (ele entra sem acompanhar a fala)
      cartoes = esc.cartoes.map((c, i) => motionCartao(c, i + 1));
      const PAL = EC.mapear(palavras, trechos, total), em = (s) => EC.naEdicao(s, "ini", trechos, total);
      cartoes.forEach((c, i) => EC.batidas(PAL, c.itens, em(c.de), cartoes[i + 1] ? em(cartoes[i + 1].de) : total).forEach((b, k) => b.achou ||
        avisar(`montar: o item "${c.itens[k]}" do cartão ${i + 1} não aparece igual na fala desse cartão; ${k ? "ele entra 0,5 s depois do anterior" : "ele entra junto com o título, mas o texto precisa ser da fala"}. Use as palavras da fala, seguidas e na ordem em que foram ditas.`)));
    }
    Object.assign(dados, { nome: marca.nome ?? "", cartoes });
  }
  if (capa) dados.capa = capa;
  if (caixa) dados.caixinha = caixa;

  // Efeitos sonoros (padrão: ligados), um <audio> por efeito, cortado no fim da edição
  if (esc.efeitos !== undefined && typeof esc.efeitos !== "boolean") throw new Error('montar: "efeitos" é true (ligados) ou false (desligados).');
  let efeitos = [], faixas = 0;
  const sons = [];
  const ev = esc.efeitos === false ? [] : EC.efeitos(esc.estilo, dados, trechos, total);
  if (ev.length) { // estilo sem efeito nenhum (a caixinha) não precisa de som nenhum
    mkdirSync(join(pasta, "efeitos"), { recursive: true });
    for (const som of new Set(ev.map((e) => e.som))) {
      const s = SONS[som];
      if (!s) throw new Error(`montar: o efeito "${som}" não está no sons/manifest.json do Editor Chefe.`);
      // os sons do plugin hyperframes só são procurados quando o vídeo usa um deles
      const dir = s.origem === "hyperframes" ? pastaEfeitos() : join(RAIZ, "sons");
      if (!existsSync(join(dir, s.arquivo))) throw new Error(`montar: o efeito "${som}" (${s.arquivo}) não está em ${dir}.`);
      copyFileSync(join(dir, s.arquivo), join(pasta, "efeitos", s.arquivo));
    }
    const fimDaFaixa = []; // efeitos que se sobrepõem vão para faixas diferentes (a 0 é do vídeo)
    efeitos = ev.map((e, i) => {
      const s = SONS[e.som], ini = +Math.max(0, e.t - s.pico).toFixed(3), dur = +Math.min(s.duracao, total - ini).toFixed(3);
      if (dur < Math.min(0.1, s.duracao)) return ""; // pedaço curto demais no fim do vídeo (o som curto entra inteiro)
      let f = fimDaFaixa.findIndex((fim) => fim <= ini);
      if (f < 0) f = fimDaFaixa.push(0) - 1;
      fimDaFaixa[f] = ini + dur;
      sons.push(e.som);
      return `      <audio id="efeito-${i + 1}" class="clip" src="efeitos/${s.arquivo}" data-start="${ini.toFixed(3)}" data-duration="${dur.toFixed(3)}" data-track-index="${f + 1}" data-volume="${s.volume}"></audio>`;
    }).filter(Boolean);
    faixas = fimDaFaixa.length;
  }

  // Véu atrás do texto quando a faixa dele é clara no vídeo
  const foco = /^\d{1,3}% \d{1,3}%$/.test(esc.foco ?? "") ? esc.foco : "50% 40%";
  let veu = 0;
  const fonte = join(pasta, "fonte.mp4");
  if (FAIXA[esc.estilo] && existsSync(fonte) && statSync(fonte).size > 0) {
    const c = claridade(fonte, FAIXA[esc.estilo], foco);
    if (c == null) avisar("montar: não consegui medir a claridade da faixa do texto na fonte.mp4; o véu atrás do texto fica desligado.");
    else if (c > (dados.identidade === "stomp" ? CLARA_STOMP : CLARA)) veu = 1;
  }

  // Camada da capa: o CSS do estilo e uma cópia muda, em tela cheia, de cada trecho que começa antes do fim da capa
  // (mesmo quadro do trecho, cortada no fim da capa), numa faixa da linha do tempo depois das dos efeitos.
  // ponytail: a cópia de um trecho que cabe inteiro na capa termina 1 ms antes dele, ainda dentro do último quadro
  // (mesma imagem), só para não repetir início e duração do trecho: o lint acusa duplicate_media_discovery_risk e o check --strict reprova
  let camada = "";
  if (capa) {
    const copias = trechos.filter((s) => s.ini < capa.fim).map((s, i) =>
      `          <video id="capa-trecho-${i + 1}" class="capa-trecho" src="fonte.mp4" data-start="${s.ini.toFixed(3)}" data-duration="${Math.min(s.dur - 0.001, capa.fim - s.ini).toFixed(3)}" data-media-start="${s.src.toFixed(3)}" data-track-index="${faixas + 1}" muted playsinline></video>`);
    camada = `      <style>
      #capa { position: absolute; inset: 0; overflow: hidden; }
      #capa-enquadramento { position: absolute; inset: 0; overflow: hidden; transform-origin: ${foco}; }
      .capa-trecho { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: ${foco}; }
      #capa-veu, #capa-faixa, #capa-filete { position: absolute; }
      #capa-gancho { position: absolute; left: 90px; right: 90px; margin: 0; font-family: "${html(marca.fontes.titulo)}", sans-serif; font-weight: 800; line-height: 1; }
      .capa-linha { display: block; width: max-content; white-space: nowrap; }${CAPA[capa.estilo](html(marca.fontes.destaque ?? ""))}
      </style>
      <div id="capa">
        <div id="capa-enquadramento" data-layout-allow-overflow>
${copias.join("\n")}
        </div>
      </div>`;
  }

  // Fonte fixa da caixinha, conferida como as da marca
  let fonteCaixa = "";
  if (caixinha) {
    const fonts = join(pasta, "fonts");
    if (!existsSync(join(fonts, CAIXINHA_FONTE))) throw new Error(`montar: falta a fonte da caixinha (fonts/${CAIXINHA_FONTE}). Baixe com: node "${join(RAIZ, "scripts", "baixar-fonte.mjs")}" "Inter" "700" "${fonts}"`);
    conferirWoff2(fonts, CAIXINHA_FONTE);
    fonteCaixa = `\n      @font-face { font-family: "Inter"; src: url("fonts/${CAIXINHA_FONTE}") format("woff2"); font-weight: 700; font-display: block; }`;
  }

  // Aproximação no rosto (opcional): "aproximar": ["frase da fala", ...], as frases de ênfase, na ordem da fala. O plano sai
  // do rastro do rosto (rosto.json, do passo 1b) e das faixas de texto do molde; o que não cabe fica de fora, com aviso.
  const molde = readFileSync(join(RAIZ, "estilos", `${esc.estilo}.html`), "utf8");
  let trechosHtml = videos.join("\n");
  if (esc.aproximar != null && esc.aproximar !== false) {
    if (!Array.isArray(esc.aproximar) || esc.aproximar.some((f) => typeof f !== "string" || !f.trim()))
      throw new Error('montar: "aproximar" é a lista das frases de ênfase, como estão na fala: "aproximar": ["isso muda tudo", "o segredo é a constância"] (ou false, para desligar).');
    if (esc.estilo === "corte-seco-zoom") avisar("montar: no Corte seco o enquadramento já aproxima a cada frase; o \"aproximar\" ficou de fora.");
    else {
      const arqRosto = join(pasta, "rosto.json");
      let rosto = null;
      if (existsSync(arqRosto) && existsSync(fonte) && statSync(fonte).mtimeMs <= statSync(arqRosto).mtimeMs) try { rosto = JSON.parse(readFileSync(arqRosto, "utf8")); } catch { /* rosto.json estragado: segue sem */ }
      if (!rosto) avisar("montar: falta o rosto.json desta fonte.mp4 (rode o rosto.mjs, passo 1b de references/audio-e-corte.md); segue sem aproximar.");
      else {
        const j = /#janela \{[^}]*?left: (\d+)(?:px)?; top: (\d+)px; width: (\d+)px; height: (\d+)px;/.exec(molde), janela = j ? j.slice(1).map(Number) : [0, 0, 1080, 1920];
        const faixas = zonas(molde, total);
        if (caixa) faixas.push({ y0: caixa.topo, y1: 1500, x0: 90, x1: 990 });
        const { W, H } = medidas(fonte);
        const r = planejarAproximacao({ frases: esc.aproximar, pal: EC.mapear(palavras, trechos, total), trechos, total, rosto, fonte: { W, H }, janela, faixas, foco, desde: capa ? capa.fim : 0 });
        r.avisos.forEach((m) => avisar(`montar: ${m}`));
        if (r.lista.length) {
          dados.aproximar = r.lista;
          trechosHtml = `${recuo}<div id="aproximar" data-layout-allow-overflow style="position: absolute; inset: 0;">\n${videos.map((v) => "  " + v).join("\n")}\n${recuo}</div>`;
        }
      }
    }
  }

  const valores = {
    FONTES: fontes(join(pasta, "fonts"), marca.fontes ?? {}, usa, avisar) + fonteCaixa,
    FUNDO_CLARO: marca.cores.fundo_claro, FUNDO_ESCURO: marca.cores.fundo_escuro, TEXTO: marca.cores.texto, DESTAQUE: marca.cores.destaque,
    TITULO: html(marca.fontes.titulo), CORPO: html(marca.fontes.corpo ?? ""), FONTE_DESTAQUE: html(marca.fontes.destaque ?? ""),
    FOCO: foco, VEU: String(veu),
    // no milésimo de baixo: arredondada para cima (2786 / 30 = 92,86667 virava 92,867), a HyperFrames gravava um quadro a mais, só com o fundo
    DURACAO: (Math.floor((pos * 1000) / F + 1e-6) / 1000).toFixed(3), TRECHOS: trechosHtml,
    DADOS: JSON.stringify(dados).replace(/</g, "\\u003c"),
    ASSINATURA: html(marca.assinatura ?? marca.nome ?? ""),
    EFEITOS: efeitos.join("\n"), CAPA: camada,
  };
  if (esc.foco && valores.FOCO !== esc.foco) avisar(`montar: foco "${esc.foco}" fora do formato "50% 40%"; usando 50% 40%.`);
  const sobra = [...molde.matchAll(/\{\{([A-Z_]+)\}\}/g)].map((m) => m[1]).filter((k) => !(k in valores));
  if (sobra.length) throw new Error(`montar: marcador sem valor no molde: ${sobra.join(", ")}.`);
  const saida = molde.replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => valores[k]);
  writeFileSync(join(pasta, "index.html"), saida);
  copyFileSync(join(RAIZ, "estilos", "comum.js"), join(pasta, "comum.js"));
  return { duracao: pos / F, trechos: manter.length, palavras: palavras.length, efeitos: efeitos.length, sons, veu: !!veu, aproximacoes: dados.aproximar?.length ?? 0 };
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const r = montar(resolve(process.argv[2] ?? "."));
    if (r.narrado) console.log(`montar: index.html pronto (Motion narrado: ${r.cenas} palavras-chave, ${r.efeitos} efeitos sonoros, ${r.duracao.toFixed(3)} s; áudio em ${r.integrado} LUFS, pico de ${r.pico} dBTP).`);
    else console.log(`montar: index.html pronto (${r.trechos} trechos, ${r.palavras} palavras, ${r.efeitos} efeitos sonoros, ${r.duracao.toFixed(3)} s de edição${r.veu ? ", véu atrás do texto" : ""}${r.aproximacoes ? `, ${r.aproximacoes} aproximações no rosto` : ""}).`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
