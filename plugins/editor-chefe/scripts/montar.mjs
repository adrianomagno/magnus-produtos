// Monta o projeto da HyperFrames de um vídeo a partir do molde do estilo.
// Uso: node montar.mjs <pasta do vídeo>
// Lê na pasta: escolhas.json (estilo e escolhas do vídeo), transcript.json (corrigido), trechos.json (do trechos.mjs),
// fonts/ (do baixar-fonte.mjs) e a marca (padrão ../marca.json). Grava index.html e comum.js na pasta e, com
// "efeitos" ligado (padrão), copia para efeitos/ os sons que o estilo usa (de sons/ ou do plugin hyperframes).
// No Motion narrado (sem gravação), lê words.json e audio/voz.wav (do voz-com-tempos.mjs) no lugar do vídeo e grava
// também audio/mix.wav (voz e efeitos já mixados, em -16 LUFS) e audio/mixagem.json.
import { readFileSync, writeFileSync, readdirSync, existsSync, copyFileSync, realpathSync, mkdirSync, statSync, mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, dirname, resolve, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { planejarAproximacao, medidas, rastroInvalido, rostoNaJanela, ZOOM, ZOOM_AMPLIADO } from "./rosto.mjs";
import { zonas } from "./conferir.mjs";
import { borrao } from "./fonte.mjs";
import { caminhoPrint, naFala } from "./sigilo.mjs";
import { abrirBanco, buscar, usar, guardarDoCliente, pedidoDePeca, nomeGenerico, problemasSvg } from "./banco.mjs";

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
  "caixinha-pergunta": ["titulo"], // a legenda; a caixinha usa a Inter 700 (FONTE_FIXA), não a fonte da marca
  "painel-escuro-dividido": ["titulo", "corpo"],
  "editorial-claro-dividido": ["titulo", "corpo", "destaque"],
  "motion-dividido": ["titulo"],
  "motion-narrado": ["titulo", "corpo"],
  "destaques-tipograficos": ["titulo"],
  papelaria: ["titulo", "corpo"], // a legenda e a assinatura; a letra de mão dos cartões é a Caveat 700 (FONTE_FIXA)
};
// Fonte fixa do estilo, que não é a da marca: a da caixinha (imita a do Instagram) e a letra de mão da Papelaria (Caveat,
// licença SIL OFL 1.1, do Google Fonts, baixada pelo baixar-fonte.mjs para a pasta do vídeo, como as fontes da marca)
const FONTE_FIXA = { "caixinha-pergunta": { familia: "Inter", peso: 700, oque: "a fonte da caixinha" }, papelaria: { familia: "Caveat", peso: 700, oque: "a letra de mão da Papelaria" } };
// Estilo 11: a legenda de uma palavra e os rótulos grandes das peças (selo, capítulo, "Comenta") pedem letra condensada e
// pesada. Se a fonte de título da marca já é condensada, vale ela; se não, a Anton (licença SIL OFL 1.1, do Google Fonts,
// baixada pelo baixar-fonte.mjs, como a Caveat)
const CONDENSADA = /condensed|narrow|compressed|^(anton|oswald|bebas neue|league gothic|fjalla one|antonio|archivo narrow|pathway gothic one|big shoulders)/i;
const condensada = (marca) => (CONDENSADA.test(marca.fontes?.titulo ?? "") ? null : { familia: "Anton", peso: 400, oque: "a letra condensada da legenda e das peças" });
// Papelaria: título do cartão (sem os asteriscos) e itens da lista, em caracteres, para caber no cartão em letra de mão;
// de 1 a 4 itens; cada item ganha o check ou é riscado quando é dito
const PAPEL = { titulo: 48, itens: [1, 4], item: 32, marcas: ["check", "risco"] };
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
const MAX_CHAMADA = 50, MAX_PERGUNTA = 110, CAIXA_TOPO = 920, CAIXA_TOPO_MAX = 1070;

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
// Nos estilos com a legenda corrida do Corte seco dentro da janela do vídeo (4, 7, 9, 12 e a opção do 8), a faixa clara não
// liga véu nem caixa: reforça o contorno e a sombra da legenda. JANELA_FAIXA: onde o vídeo está na tela, nesses estilos.
// Ali a medida é o 90º percentil da luma da faixa (YHIGH), não a média: no jaleco branco o meio da faixa (pescoço, cabelo)
// puxa a média para 97 a 110 e as pontas da legenda, no branco, ficam com 2,2 a 2,6:1 de contraste na borda; com o
// reforço, 13:1. Terno escuro dá 123 a 129 (contorno normal); jaleco, 194 a 200.
const FAIXA = { "legenda-viva": [1250, 1470, 70, 1010], "palavra-chave": [1220, 1520, 60, 1020], "corte-seco-zoom": [1270, 1470, 80, 1000], "caixinha-pergunta": [1250, 1500, 90, 990],
  "painel-escuro": [1262, 1380, 78, 1002], "painel-escuro-dividido": [1500, 1650, 60, 1020], "motion-dividido": [1500, 1650, 60, 1020], papelaria: [1500, 1650, 60, 1020], "editorial-claro-dividido": [1500, 1650, 60, 1020] };
const METADE = [0, 960, 1080, 960], JANELA_FAIXA = { "painel-escuro": [48, 790, 984, 600], "painel-escuro-dividido": METADE, "motion-dividido": METADE, papelaria: METADE, "editorial-claro-dividido": METADE };
// Estilos com a legenda corrida do Corte seco (e o 8 com "legenda": "corrida"): a ênfase sai do "enfase" ou da palavra forte de cada cartão
const CORRIDA = ["painel-escuro", "painel-escuro-dividido", "motion-dividido", "papelaria"];
// O #palavra do Editorial claro dividido, que a opção "corrida" troca pela faixa da legenda dentro do vídeo
const PALAVRA_8 = "      #palavra { position: absolute; left: 40px; right: 40px; top: 880px; height: 160px; }";
const LEGENDA_8 = "      #legenda { position: absolute; left: 60px; right: 60px; top: 1500px; height: 150px; }";
const CLARA = 130, CLARA_STOMP = 185; // luma média (0 a 255) da faixa, no 90º percentil dos quadros; acima disso, véu
const CLARA_CORRIDA = 160; // legenda corrida: 90º percentil da luma da faixa (YHIGH), no 90º percentil dos quadros; acima, reforço
// faixa: [y0, y1, x0, x1] na tela; janela: [x, y, largura, altura] do vídeo na tela (o vídeo cobre a janela, object-fit cover)
function claridade(arq, [y0, y1, x0, x1], foco, [jx, jy, jw, jh] = [0, 0, 1080, 1920], chave = "YAVG") {
  // Os binários do ambiente.sh (com .exe no Windows); sem eles e fora do PATH, devolve null e o montador avisa
  const sonda = spawnSync(process.env.HYPERFRAMES_FFPROBE_PATH ?? "ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", arq], { encoding: "utf8", timeout: TEMPO_MAX });
  if (sonda.error || !sonda.stdout) return null;
  const [W, H] = sonda.stdout.trim().split(",").map(Number);
  if (!(W > 0 && H > 0)) return null;
  const s = Math.max(jw / W, jh / H), [fx, fy] = foco.split(" ").map((v) => parseFloat(v) / 100);
  const x = Math.max(0, Math.round((x0 - jx + (W * s - jw) * fx) / s)), y = Math.max(0, Math.round((y0 - jy + (H * s - jh) * fy) / s));
  const w = Math.max(2, Math.min(W - x, Math.round((x1 - x0) / s))), h = Math.max(2, Math.min(H - y, Math.round((y1 - y0) / s)));
  const r = spawnSync(process.env.HYPERFRAMES_FFMPEG_PATH ?? "ffmpeg", ["-hide_banner", "-nostats", "-i", arq, "-vf", `fps=2,crop=${w}:${h}:${x}:${y},signalstats,metadata=print:key=lavfi.signalstats.${chave}`, "-an", "-f", "null", "-"], { encoding: "utf8", timeout: TEMPO_MAX });
  if (r.error || !r.stderr) return null;
  const v = [...r.stderr.matchAll(new RegExp(`${chave}=([\\d.]+)`, "g"))].map((m) => +m[1]).sort((a, b) => a - b);
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
// Papelaria: confere o título, a lista e a marca de um cartão e devolve o cartão limpo (texto colado numa linha só)
function papelCartao(c, n) {
  const titulo = umaLinha(c.titulo), letras = titulo.replace(/\*/g, "").trim().length;
  if (!letras) throw new Error(`montar: o cartão ${n} pede "titulo", o trecho da fala que vai escrito à mão no cartão.`);
  if (titulo.includes("*") && !/^[^*]*\*[^*]+\*[^*]*$/.test(titulo)) throw new Error(`montar: no título do cartão ${n}, ponha no máximo uma palavra forte entre asteriscos, como "Antes do *almoço*".`);
  if (letras > PAPEL.titulo) throw new Error(`montar: o título do cartão ${n} tem ${letras} caracteres; na Papelaria cabem até ${PAPEL.titulo}. Use menos palavras da fala.`);
  if (c.lista == null) return { de: c.de, titulo };
  const lista = Array.isArray(c.lista) ? c.lista.map(umaLinha) : [];
  if (lista.length < PAPEL.itens[0] || lista.length > PAPEL.itens[1] || lista.some((x) => !x))
    throw new Error(`montar: no cartão ${n}, "lista" é uma lista com ${PAPEL.itens[0]} a ${PAPEL.itens[1]} textos curtos tirados da fala, como "lista": ["chega de manhã", "antes do almoço"].`);
  const longo = lista.find((x) => x.length > PAPEL.item);
  if (longo) throw new Error(`montar: o item "${longo}" do cartão ${n} tem ${longo.length} caracteres; na lista cabem até ${PAPEL.item}. Use menos palavras da fala.`);
  const marca = c.marca ?? "check";
  if (!PAPEL.marcas.includes(marca)) throw new Error(`montar: no cartão ${n}, "marca" é "check" (cada item ganha o check quando é dito) ou "risco" (cada item é riscado quando é dito).`);
  return { de: c.de, titulo, lista, marca };
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

// ---------------------------------------------------------------------------------------------------------------------
// Destaques tipográficos (estilo 11): a frase forte da fala em letra grande acima da cabeça, palavra por palavra no tempo
// da fala, e embaixo a legenda pequena com as outras palavras. A frase fica numa faixa que começa em "topo" (abaixo do
// cabeçalho do Instagram) e termina "margem" px acima da cabeça (a caixa do rosto e mais um quarto da altura dela, o
// cabelo), a parte mais alta dela durante a frase, pelo rosto.json. O vídeo cobre a tela inteira o tempo todo, sem moldura:
// com a cabeça alta, ele aproxima ancorado no alto (a cabeça desce e cresce) até sobrar topo + alvo + margem acima dela em
// 85% do vídeo, sem passar do teto de aproximação nem levar o queixo até a legenda. Na selfie comum, com a cabeça colada no
// topo, nem assim sobra lugar: a frase e as peças vão para baixo do queixo, até folgaQueixo px acima da legenda, com o vídeo
// como foi gravado. Sem rastro do rosto, a faixa é fixa (topo a topo + padrao). A conferência lê as faixas (D.faixas) e
// reprova se uma delas cobrir o rosto. alvo: a frase em duas linhas de 112 px no cartão; alvoPecas cresceu com a letra da
// lista, do esquema e da janela (o esquema e a janela inteiros, a lista de 3 itens sem título).
const DESTAQUE = { topo: 240, margem: 30, min: 150, alvo: 270, alvoPecas: 360, max: 520, padrao: 400, palavras: [2, 10], letras: 48, fica: 1.5, folga: 0.55, x: [90, 990], escalaMin: 0.55, legenda: 1310, legendaFim: 1480, folgaQueixo: 20, piso: 1650 };

// Biblioteca de peças (estilo 11): cada peça do escolhas.json é { "tipo": ..., "fala": "<as palavras da fala em que ela
// entra>", e os campos do tipo }. Os textos vêm da fala (os itens da lista, as vagas do esquema, o título do capítulo); a
// PALAVRA do "Comenta" vem do dono. Os arquivos (objetos 3D e logos) estão em pecas/, com a licença em pecas/LICENCAS.md;
// o print da janela é do dono e passa antes pela conferência de dado pessoal (sigilo.mjs --print).
const PECAS = JSON.parse(readFileSync(join(RAIZ, "pecas", "manifest.json"), "utf8"));
const SELOS = ["aprovado", "reprovado", "atencao", "novo"], ICONES_OBJETO = ["3d", "sobrio"];
const LIM_PECA = { fala: 8, titulo: 30, item: 24, itens: [2, 4], capitulo: 28, numero: 9, palavra: 12, centro: 16, vaga: 24, apps: 4, endereco: 40 };
const ROTULO = { selo: "selo", lista: "cartão de lista", capitulo: "capítulo", comenta: "Comenta", objeto: "objeto 3D", app: "ícone do aplicativo", janela: "janela com o print", esquema: "esquema" };
const sha256 = (arq) => createHash("sha256").update(readFileSync(arq)).digest("hex");
// GSAP 3.14.2 que vem no plugin (estilos/gsap.min.js, do pacote gsap@3.14.2 do npm, sem alteração): o render não busca
// nada na internet. Conferido pelo SHA-256 antes de ir para a pasta do vídeo.
export const GSAP_SHA256 = "c174bfce53a729418d57a8ad8625e7247c793a22fef8e2851e3cfa3de9cd8280";
function copiarGsap(pasta) {
  const arq = join(RAIZ, "estilos", "gsap.min.js");
  if (!existsSync(arq) || sha256(arq) !== GSAP_SHA256) throw new Error("montar: o estilos/gsap.min.js do Editor Chefe sumiu ou mudou (o SHA-256 não confere com o registrado). Reinstale o plugin; o render não vai buscar o GSAP na internet.");
  copyFileSync(arq, join(pasta, "gsap.min.js"));
}
// Confere as peças do escolhas.json e devolve a lista limpa (texto colado numa linha só); erro em português no que faltar
export function lerPecas(lista, pasta) {
  if (lista == null || lista === false) return [];
  if (!Array.isArray(lista)) throw new Error('montar: "pecas" é a lista das peças animadas, como "pecas": [{ "tipo": "objeto", "objeto": "casa", "fala": "apartamento" }].');
  return lista.map((p, i) => {
    const n = i + 1, nome = `a peça ${n}`, txt = (x) => umaLinha(x), lim = (campo, s, max) => { if (s.length > max) throw new Error(`montar: ${campo} da peça ${n} ("${s}") tem ${s.length} caracteres; cabem até ${max}. Use menos palavras da fala.`); return s; };
    if (!p || typeof p !== "object" || !Object.hasOwn(ROTULO, p.tipo ?? "")) throw new Error(`montar: ${nome} pede "tipo", um destes: ${Object.keys(ROTULO).join(", ")}.`);
    const fala = txt(p.fala);
    if (!fala) throw new Error(`montar: ${nome} (${ROTULO[p.tipo]}) pede "fala", as palavras da fala em que ela entra, como estão no transcript.json.`);
    if (fala.split(" ").length > LIM_PECA.fala) throw new Error(`montar: a "fala" da peça ${n} tem mais de ${LIM_PECA.fala} palavras; use só as palavras em que a peça entra.`);
    const lista2 = (campo, x, [min, max], maxL) => {
      if (!Array.isArray(x) || x.length < min || x.length > max || x.some((s) => !txt(s))) throw new Error(`montar: ${nome} (${ROTULO[p.tipo]}) pede "${campo}", uma lista com ${min} a ${max} textos curtos tirados da fala.`);
      return x.map((s) => lim(`o item "${txt(s)}"`, txt(s), maxL));
    };
    const base = { tipo: p.tipo, fala };
    if (p.tipo === "selo") {
      if (!SELOS.includes(p.selo)) throw new Error(`montar: ${nome} (selo) pede "selo", um destes: ${SELOS.join(", ")}. Verde e vermelho só para certo e errado: aprovado e reprovado.`);
      return { ...base, selo: p.selo };
    }
    if (p.tipo === "lista") return { ...base, ...(txt(p.titulo) ? { titulo: lim("o título", txt(p.titulo), LIM_PECA.titulo) } : {}), itens: lista2("itens", p.itens, LIM_PECA.itens, LIM_PECA.item) };
    if (p.tipo === "esquema") {
      if (!txt(p.centro)) throw new Error(`montar: ${nome} (esquema) pede "centro", o texto curto da fala que fica no meio.`);
      return { ...base, centro: lim("o centro", txt(p.centro), LIM_PECA.centro), vagas: lista2("vagas", p.vagas, LIM_PECA.itens, LIM_PECA.vaga) };
    }
    if (p.tipo === "capitulo") {
      if (!Number.isInteger(p.numero) || p.numero < 1 || p.numero > LIM_PECA.numero) throw new Error(`montar: ${nome} (capítulo) pede "numero", de 1 a ${LIM_PECA.numero}, o número da parte que a fala diz.`);
      if (!txt(p.titulo)) throw new Error(`montar: ${nome} (capítulo) pede "titulo", o nome da parte, tirado da fala.`);
      return { ...base, numero: p.numero, titulo: lim("o título", txt(p.titulo), LIM_PECA.capitulo) };
    }
    if (p.tipo === "comenta") {
      const w = txt(p.palavra);
      if (!/^[\p{L}\p{N}]+$/u.test(w)) throw new Error(`montar: ${nome} (Comenta) pede "palavra", a palavra que o dono escolheu para as pessoas comentarem, uma só, sem espaço. Pergunte ao dono; não invente.`);
      return { ...base, palavra: lim("a palavra", w.toLocaleUpperCase("pt-BR"), LIM_PECA.palavra) };
    }
    // objeto e aplicativo: o nome da peça; o banco (banco.mjs) procura no plugin, na biblioteca local e no banco central
    if (p.tipo === "objeto") {
      if (!nomeGenerico(p.objeto)) throw new Error(`montar: o objeto ${JSON.stringify(p.objeto)} da peça ${n} precisa ser o nome de uma peça, em minúsculas e sem espaço. Os do plugin: ${Object.keys(PECAS.objetos).join(", ")}; outro nome é procurado na biblioteca local e no banco central e, sem ele, entra uma peça genérica com o pedido para o Magnus.`);
      return { ...base, objeto: p.objeto };
    }
    if (p.tipo === "app") {
      const apps = Array.isArray(p.apps) ? p.apps : [];
      if (!apps.length || apps.length > LIM_PECA.apps) throw new Error(`montar: ${nome} (ícone do aplicativo) pede "apps", de 1 a ${LIM_PECA.apps} aplicativos que a pessoa cita, na ordem da fala.`);
      const errado = apps.find((a) => !nomeGenerico(a));
      if (errado !== undefined) throw new Error(`montar: o aplicativo ${JSON.stringify(errado)} da peça ${n} precisa ser o nome de uma peça, em minúsculas e sem espaço. Os do plugin: ${Object.keys(PECAS.apps).join(", ")}; outro nome é procurado na biblioteca local e no banco central e, sem ele, entra um ícone genérico com o pedido para o Magnus.`);
      return { ...base, apps };
    }
    // janela: o print do dono, já conferido pelo sigilo.mjs --print, e o endereço opcional da barra
    const arq = txt(p.print);
    if (!arq) throw new Error(`montar: ${nome} (janela) pede "print", o caminho do print que o dono mandou, a partir da pasta do vídeo.`);
    const cam = caminhoPrint(pasta, arq, "montar");
    if (![".png", ".jpg", ".jpeg", ".webp"].includes(extname(cam).toLowerCase()) || !existsSync(cam)) throw new Error(`montar: o print "${arq}" da peça ${n} precisa ser um PNG, JPG ou WebP que exista, com o caminho a partir da pasta do vídeo.`);
    let sig = null;
    try { sig = JSON.parse(readFileSync(join(pasta, "sigilo.json"), "utf8")); } catch { /* sem conferência */ }
    const reg = sig?.prints?.find((x) => x.arquivo === arq);
    if (!reg) throw new Error(`montar: o print "${arq}" ainda não passou pela conferência de dado pessoal. Rode node sigilo.mjs . --print "${arq}" e leia o resumo antes de montar.`);
    if (!reg.lida) throw new Error(`montar: o texto do print "${arq}" não foi lido neste computador (${reg.motivo}); sem a conferência de dado pessoal a janela não entra. Tire a peça ${n} do escolhas.json.`);
    if (reg.sha256 !== sha256(cam)) throw new Error(`montar: o print "${arq}" mudou depois da conferência de dado pessoal. Rode de novo node sigilo.mjs . --print "${arq}".`);
    return { ...base, print: arq, ...(txt(p.endereco) ? { endereco: lim("o endereço", txt(p.endereco), LIM_PECA.endereco) } : {}) };
  });
}

// Tempo, sons e o que cada peça precisa no molde. pal: as palavras da edição; r: [primeira, última] da "fala" em pal;
// limite: até onde os itens da lista, as vagas do esquema e os aplicativos são procurados. Devolve
// { fim (sai sozinha), fimFala (depois disso o próximo pode entrar), sons, chaves, campos }.
function detalharPeca(p, t, r, pal, limite, avisar, n) {
  const P = EC.PECA, fimAnc = pal[r[1]].fim, faixa = Array.from({ length: r[1] - r[0] + 1 }, (_, k) => r[0] + k);
  const siga = "entra 0,5 s depois do anterior. Use as palavras da fala, seguidas e na ordem em que foram ditas.";
  const avisarItens = (bs, itens, oque) => bs.forEach((b, k) => b.achou || avisar(`montar: ${oque} "${itens[k]}" da peça ${n} não foi achado na fala depois da entrada dela; ${siga}`));
  if (p.tipo === "selo") return { fim: t + P.selo.fica, fimFala: fimAnc, sons: [{ t: t + P.selo.pousa, f: "apice" }], campos: { selo: p.selo } };
  if (p.tipo === "objeto") return { fim: t + P.objeto.fica, fimFala: fimAnc, sons: [{ t: t + P.objeto.pousa, f: "destaque" }], chaves: faixa, campos: { objeto: p.objeto } };
  if (p.tipo === "janela") return { fim: t + P.janela.fica, fimFala: fimAnc, sons: [{ t, f: "cartao" }], campos: { print: p.print, endereco: p.endereco } };
  if (p.tipo === "capitulo") return { fim: t + P.capitulo.grande + 0.4, fimFala: t + P.capitulo.grande, sons: [{ t, f: "cartao" }, { t: t + P.capitulo.grande, f: "frase" }], campos: { numero: p.numero, titulo: p.titulo } };
  if (p.tipo === "comenta") {
    const Q = P.comenta;
    return { fim: t + Q.fica, fimFala: t + Q.enche[1], sons: [{ t, f: "cartao" }, { t: t + Q.acende, f: "destaque" }, { t: t + Q.notifica, f: "notificacao" }, { t: t + Q.enche[1], f: "pronto" }], campos: { palavra: p.palavra } };
  }
  if (p.tipo === "lista") {
    const esc = EC.batidas(pal, p.itens, t, limite, { comTitulo: false }), mar = EC.batidas(pal, p.itens, t, limite, { comTitulo: false, naUltima: true });
    avisarItens(esc, p.itens, "o item");
    const escreve = esc.map((b) => b.t), marca = mar.map((b, k) => +Math.max(b.t, escreve[k] + 0.25).toFixed(3)), u = marca[marca.length - 1];
    return { fim: u + P.lista.fica, fimFala: u, sons: [{ t, f: "cartao" }, ...marca.map((m) => ({ t: m, f: "item" }))], campos: { titulo: p.titulo, itens: p.itens, escreve, marca } };
  }
  if (p.tipo === "esquema") {
    const bs = EC.batidas(pal, p.vagas, t, limite, { comTitulo: false });
    avisarItens(bs, p.vagas, "a vaga");
    const batidas = bs.map((b) => b.t), u = batidas[batidas.length - 1] + P.esquema.liga;
    return { fim: u + P.esquema.fica, fimFala: u, sons: [{ t, f: "frase" }, ...batidas.map((b) => ({ t: b + P.esquema.liga, f: "item" }))], campos: { centro: p.centro, vagas: p.vagas, batidas } };
  }
  // app: o primeiro aplicativo entra na "fala"; cada um dos outros, quando a fala diz o nome dele (pecas/manifest.json)
  let k = r[1] + 1, ant = t;
  const chaves = [...faixa], apps = p.apps.map((app, i) => {
    if (!i) return { app, t };
    const achado = (p.palavrasApps?.[app] ?? PECAS.apps[app]?.palavras ?? [app.replace(/-/g, " ")]).map((w) => acharTrecho(pal, w, k)).filter((x) => x && pal[x[0]].ini < limite).sort((a, b) => a[0] - b[0])[0];
    if (achado) { k = achado[1] + 1; chaves.push(...Array.from({ length: achado[1] - achado[0] + 1 }, (_, m) => achado[0] + m)); ant = Math.max(ant + 0.3, pal[achado[0]].ini); }
    else { avisar(`montar: o aplicativo "${app}" da peça ${n} não foi achado na fala depois da entrada dela; ${siga}`); ant += 0.5; }
    return { app, t: +ant.toFixed(3) };
  });
  return { fim: ant + P.app.fica, fimFala: ant, sons: apps.map((a, i) => ({ t: a.t + 0.12, f: i ? "item" : "destaque" })), chaves, campos: { apps } };
}

// lista: as frases do escolhas.json; pecas: as peças já conferidas (lerPecas); pal: as palavras da edição ({ txt, ini,
// fim }); caixa: (t) => caixa do rosto na tela (rostoNaJanela) ou null; desde: o fim do gancho de capa (0 sem capa); teto:
// a maior aproximação (a do rosto.mjs: menor em vídeo já ampliado). Frases e peças dividem a faixa, uma de cada vez: cada
// uma sai 0,35 s antes da seguinte, e a que entra antes de a anterior terminar a fala dela (mais meio segundo) fica de
// fora, com aviso. A pílula do capítulo fica no canto da faixa (pilulaY). Devolve { z, lado, abre, destaques, pecas,
// chaves, faixas }; cada destaque é { de, ate, chave: [primeira, última], t, sai, y0, y1 }, com índices de pal; cada
// peça, { tipo, t, sai, y1, h, s, sons, ... }.
export function planoDestaques(lista, pal, { caixa = null, total, desde = 0, pecas = [], teto = ZOOM }, avisar = () => {}) {
  const Q = DESTAQUE, P = EC.PECA, semFrases = lista == null || (Array.isArray(lista) && !lista.length);
  if ((semFrases && !pecas.length) || (!semFrases && (!Array.isArray(lista) || lista.some((f) => typeof f !== "string"))))
    throw new Error('montar: os Destaques tipográficos pedem "destaques", a lista das frases fortes como estão na fala, na ordem, cada uma com a palavra-chave entre asteriscos: "destaques": ["todo cliente recebe *resposta* no mesmo dia"], ou "pecas", a lista das peças animadas.');
  // O alto da cabeça (y) em cada 0,1 s de a a b em que o rosto aparece
  const alto = (a, b) => { const v = []; if (caixa) for (let t = Math.max(0, a); t <= Math.min(total, b); t += 0.1) { const c = caixa(t); if (c) v.push(c[1] - 0.75 * c[3]); } return v; };
  const todos = alto(0, total).sort((a, b) => a - b), q = todos.length >= 3 ? todos[Math.floor(todos.length * 0.15)] : null;
  // Sem moldura: o vídeo cobre 1080x1920 o tempo todo. Com uma frase ou peça na tela ele aproxima (z, de 1 até teto,
  // ancorado no alto: um ponto y do vídeo vai para y * z, e nenhuma borda dele entra na tela) até sobrar o alvo acima da
  // cabeça em 85% do vídeo, sem o queixo (85º percentil) passar de folgaQueixo px acima da legenda. Nunca diminuir nem
  // descer o vídeo: isso abre faixa ou barra de cor em volta dele.
  const queixo = (a, b) => { const v = []; if (caixa) for (let t = Math.max(0, a); t <= Math.min(total, b); t += 0.1) { const c = caixa(t); if (c) v.push(c[1] + c[3] / 2); } return v; };
  const queixos = queixo(0, total).sort((a, b) => a - b), chao = Q.legenda - Q.folgaQueixo;
  const c0 = queixos.length >= 3 ? queixos[Math.floor(queixos.length * 0.85)] : null, alvo = pecas.length ? Q.alvoPecas : Q.alvo;
  let z = 1;
  if (q != null) {
    const ate = c0 == null ? teto : Math.min(teto, chao / c0), quer = q > 0 ? (Q.topo + alvo + Q.margem) / q : Infinity;
    z = Math.max(1, Math.floor(Math.min(ate, quer) * 1000) / 1000);
  }
  // A faixa de cada frase ou peça (o caminho 2, escolhido em 2026-10-27):
  // - em cima: de topo até margem px acima da cabeça (a mais alta durante ela, com o vídeo aproximado em zz); a legenda fica;
  // - embaixo do queixo (o mais baixo durante ela, aproximado em zq quando o vídeo aproxima por perto), encostada nele, até o
  //   piso (o mesmo da legenda corrida dos estilos 7, 9 e 12): a legenda sai da tela enquanto ela está ali, porque a frase e
  //   a peça já mostram as palavras da fala;
  // - a janela (o print) não mostra a fala, então a legenda fica: entre o queixo e a legenda ("baixo", até folgaQueixo px
  //   acima dela) ou embaixo da legenda ("rodape", de legendaFim + folgaQueixo até o piso).
  // Fica em cima (o desenho aprovado) se ali couber inteira (a frase, o alvo: duas linhas de 112 px no cartão; a peça, a
  // altura dela); senão, no lugar maior. semCima: só os de baixo (a vizinha de um trecho aproximado, que não aproxima ela).
  const banda = (o, zz, zq, semCima = false) => {
    const vc = alto(o.t - 0.2, o.sai), cabeca = vc.length ? Math.min(...vc) : q, vq = queixo(o.t - 0.2, o.sai), qx = vq.length ? Math.max(...vq) : c0;
    const precisa = o.p ? Math.min(EC.alturaPeca(o.p), Q.max) : Q.alvo, janela = o.p?.tipo === "janela";
    const cima = cabeca == null ? Q.padrao : cabeca * zz - Q.margem - Q.topo, embaixo = qx == null ? null : Math.max(Q.topo, qx * zq + Q.margem);
    const opcoes = semCima ? [] : [{ lado: "cima", y0: Q.topo, lim: Q.topo + cima }];
    if (embaixo != null) opcoes.push({ lado: "baixo", y0: embaixo, lim: janela ? chao : Q.piso });
    if (janela && embaixo != null && embaixo <= Q.legendaFim + Q.folgaQueixo) opcoes.push({ lado: "rodape", y0: Q.legendaFim + Q.folgaQueixo, lim: Q.piso });
    if (!opcoes.length) opcoes.push({ lado: "cima", y0: Q.topo, lim: Q.topo + cima });
    const alt = (x) => x.lim - x.y0, maior = Math.max(...opcoes.map(alt));
    // A janela que não cabe inteira em nenhum desses lugares (a gravação de cabeça baixa e rosto grande): embaixo do queixo
    // até o piso, se ali ela ficar maior, com a legenda subindo para acima da cabeça enquanto ela fica. A caixa da legenda
    // (a mesma altura de hoje) vai para o alto da área segura (começa em topo), o mais longe possível do cabelo, e só sobe se
    // ali ela acabar folgaQueixo px acima da cabeça mais alta durante a janela (sem aproximar, a posição mais alta dela).
    // ponytail: o rastro do rosto tem 2 amostras por segundo e a cabeça sobe entre elas (na gravação de prova, 21 px além do
    // rastro, medido no detector a 30 quadros por segundo); por isso a caixa não encosta na conta, fica no topo
    if (janela && embaixo != null && cabeca != null && maior < precisa && Q.piso - embaixo > maior) {
      const vl = alto(o.t - 0.2, o.sai + 0.3), fimLegenda = Q.topo + Q.legendaFim - Q.legenda;
      if ((vl.length ? Math.min(...vl) : cabeca) - Q.folgaQueixo >= fimLegenda) opcoes.push({ lado: "baixo", y0: embaixo, lim: Q.piso, legendaY: Q.topo });
    }
    const esc = !semCima && cima >= precisa ? opcoes[0] : opcoes.reduce((a, b) => (alt(b) > alt(a) ? b : a));
    const apertada = alt(esc) < Q.min, legenda = esc.lado === "cima" || janela;
    if (esc.lado === "cima") return { lado: "cima", y0: Q.topo, y1: Q.topo + Math.min(Q.max, Math.max(Q.min, alt(esc))), apertada, legenda };
    if (apertada) return { lado: esc.lado, y0: esc.lim - Q.min, y1: esc.lim, apertada, legenda };
    return { lado: esc.lado, y0: esc.y0, y1: esc.y0 + Math.min(Q.max, precisa, alt(esc)), apertada, legenda, ...(esc.legendaY != null ? { legendaY: esc.legendaY } : {}) };
  };
  const conta = (s) => s.split(/\s+/).map(limpaPal).filter(Boolean).length, frases = [];
  let k = 0;
  for (const bruto of semFrases ? [] : lista) {
    const texto = umaLinha(bruto), limpo = texto.replace(/\*/g, ""), n = conta(limpo);
    if (!/^[^*]*\*[^*]+\*[^*]*$/.test(texto))
      throw new Error(`montar: a frase em destaque "${texto}" precisa de exatamente uma palavra-chave entre asteriscos, como "todo cliente recebe *resposta* no mesmo dia".`);
    if (n < Q.palavras[0] || n > Q.palavras[1] || limpo.length > Q.letras)
      throw new Error(`montar: a frase em destaque "${limpo}" tem ${n} ${n === 1 ? "palavra" : "palavras"} e ${limpo.length} caracteres; use de ${Q.palavras[0]} a ${Q.palavras[1]} palavras da fala e até ${Q.letras} caracteres.`);
    const r = acharTrecho(pal, limpo, k);
    if (!r) { avisar(`montar: a frase em destaque "${limpo}" não foi achada na fala, na ordem; ficou de fora. Use as palavras como estão no transcript.json, seguidas.`); continue; }
    k = r[1] + 1;
    const t = pal[r[0]].ini, ant = frases[frases.length - 1];
    if (t < desde) { avisar(`montar: a frase em destaque "${limpo}" cai no gancho de capa (os primeiros ${desde} s); ficou de fora.`); continue; }
    if (ant && t - pal[ant.ate].fim < Q.folga) { avisar(`montar: a frase em destaque "${limpo}" começa menos de meio segundo depois da anterior; ficou de fora. Junte as duas numa frase só ou escolha outra.`); continue; }
    const [antes, chave] = texto.split("*"), c0 = r[0] + conta(antes);
    frases.push({ de: r[0], ate: r[1], chave: [c0, c0 + conta(chave) - 1], t, texto: limpo, nome: `a frase em destaque "${limpo}"`, fimFala: pal[r[1]].fim });
  }
  if (!semFrases && !frases.length) avisar(`montar: nenhuma frase em destaque ficou; o vídeo sai só com ${pecas.length ? "as peças e " : ""}a legenda.`);
  // As peças, cada uma na "fala" dela, na ordem da lista
  const achadas = [];
  let kp = 0;
  pecas.forEach((p, i) => {
    const nome = `a peça ${i + 1} (${ROTULO[p.tipo]})`, r = acharTrecho(pal, p.fala, kp);
    if (!r) return avisar(`montar: ${nome} entra em "${p.fala}", que não foi achada na fala, na ordem; ficou de fora. Use as palavras como estão no transcript.json, seguidas.`);
    kp = r[1] + 1;
    const t = pal[r[0]].ini;
    if (t < desde) return avisar(`montar: ${nome} cai no gancho de capa (os primeiros ${desde} s); ficou de fora.`);
    achadas.push({ p, n: i + 1, r, t, nome });
  });
  // Frases e peças na ordem do tempo, uma de cada vez na faixa de cima
  const todas = [...frases, ...achadas].sort((a, b) => a.t - b.t), fica = [];
  todas.forEach((o) => {
    // os itens (da lista, do esquema, os aplicativos) são procurados até 15 s depois da entrada; quem entrar antes de eles
    // terminarem fica de fora, pela regra abaixo
    if (o.p) Object.assign(o, detalharPeca(o.p, o.t, o.r, pal, Math.min(total, o.t + 15), avisar, o.n));
    else o.fim = o.fimFala + Q.fica;
    const ant = fica[fica.length - 1];
    if (ant && !o.p && !ant.p) { if (o.t - ant.fimFala >= Q.folga) fica.push(o); return; } // entre frases, a regra de antes (já avisada acima)
    if (ant && (o.t - ant.fimFala < Q.folga || (ant.p && o.t - ant.t < 1.2)))
      return avisar(`montar: ${o.nome} começa logo depois de ${ant.nome} (antes de ela terminar na tela); ficou de fora. Escolha outro momento da fala.`);
    fica.push(o);
  });
  fica.forEach((o, i) => {
    const prox = fica[i + 1], sai = Math.min(o.fim, prox ? prox.t - 0.35 : total);
    o.sai = +(o.p ? Math.max(o.t + 0.3, sai) : sai).toFixed(3);
  });
  // A pílula de cada capítulo: do fim do cartão grande até o próximo capítulo (ou o fim do vídeo). Enquanto outra peça ou
  // frase está na faixa de cima, ela encolhe para só o número (os intervalos em "encolhe") e quem está na faixa fica com
  // até larguraComPilula de largura
  const caps = fica.filter((o) => o.p?.tipo === "capitulo");
  caps.forEach((o, i) => (o.pilula = [+(o.t + P.capitulo.grande + 0.3).toFixed(3), +(caps[i + 1] ? caps[i + 1].t - 0.05 : total).toFixed(3)]));
  // O vídeo aproxima só em volta das que ficam em cima: de 0,4 s antes de cada uma entrar até ela sair (nunca antes do fim
  // do gancho de capa); duas seguidas em cima a menos de 1,2 s uma da outra deixam o vídeo aproximado entre elas. A de baixo
  // que cai na entrada (0,4 s) ou na volta (0,45 s) de um trecho aproximado conta o queixo aproximado.
  let bandas = fica.map((o) => banda(o, z, 1));
  const abreDe = () => {
    const r = [];
    fica.forEach((o, i) => {
      if (bandas[i].lado !== "cima") return;
      const a = +Math.max(desde, o.t - 0.4).toFixed(3), b = +Math.min(total, o.sai + 0.25).toFixed(3), u = r[r.length - 1];
      if (u && a - u[1] < 1.2 && bandas[i - 1]?.lado === "cima") u[1] = b; else r.push([a, b]);
    });
    return r;
  };
  let abre = z > 1 ? abreDe() : [];
  if (!abre.length) z = 1;
  else bandas = fica.map((o, i) => (bandas[i].lado !== "cima" && abre.some(([a, b]) => a < o.sai + 0.25 && b + 0.45 > o.t - 0.15) ? banda(o, z, z, true) : bandas[i]));
  const faixas = [], xPilula = (1080 - P.larguraComPilula) / 2, altPilula = P.pilula[1] - P.pilula[0];
  fica.forEach((o, i) => {
    const b = bandas[i], onde = { cima: "acima da cabeça", baixo: "embaixo do queixo", rodape: "embaixo da legenda" }[b.lado];
    if (b.apertada) avisar(`montar: ${o.nome} ficou apertada ${onde} (a pessoa ${b.lado === "cima" ? "sobe" : "desce"} no quadro nesse trecho) e pode encostar no rosto. Confira na prévia ou escolha outro momento.`);
    Object.assign(o, { lado: b.lado, onde, legenda: b.legenda, y0: Math.round(b.y0), y1: Math.round(b.y1), ...(b.legendaY != null ? { legendaY: b.legendaY } : {}) });
  });
  // A pílula de cada capítulo: no canto de cima se a cabeça (a mais alta enquanto ela fica) deixa, senão logo acima da
  // legenda se o queixo (o mais baixo, aproximado) deixa; sem lugar nos dois, onde sobra mais, com aviso
  for (const c of caps) {
    const vc = alto(c.pilula[0], c.pilula[1]), vq = queixo(c.pilula[0], c.pilula[1]);
    const folgaCima = vc.length ? Math.min(...vc) - Q.margem - P.pilula[1] : Infinity, folgaBaixo = vq.length ? chao - altPilula - Math.max(...vq) * z - Q.margem : Infinity;
    c.pilulaY = folgaCima >= 0 || folgaCima >= folgaBaixo ? P.pilula[0] : chao - altPilula;
    if (folgaCima < 0 && folgaBaixo < 0) avisar(`montar: a pílula do capítulo ${c.p.numero} pode encostar no rosto (a pessoa ocupa o alto e o baixo do quadro enquanto ela fica). Confira na prévia.`);
  }
  for (const o of fica) {
    const de = +Math.max(0, o.t - 0.15).toFixed(3), ate = +(o.sai + 0.25).toFixed(3), pil = o.p?.tipo === "capitulo" ? null : caps.find((c) => c.pilula[0] < ate && c.pilula[1] > de);
    if (pil) { const e = (pil.encolhe ??= []), u = e[e.length - 1]; if (u && de - u[1] < 0.6) u[1] = ate; else e.push([de, ate]); }
    const y0 = o.y0, onde = o.onde;
    if (!o.p) {
      const x = pil ? [xPilula, 1080 - xPilula] : Q.x;
      if (pil) o.x = x;
      faixas.push({ nome: o.nome, y0, y1: o.y1, x0: x[0], x1: x[1], de, ate, lado: o.lado, legenda: o.legenda });
      continue;
    }
    const W = P[o.p.tipo].w, h = EC.alturaPeca(o.p), s = +Math.min(1, (o.y1 - y0) / h, pil ? P.larguraComPilula / W : 1).toFixed(3);
    if (s < Q.escalaMin) avisar(`montar: ${o.nome} ficou pequena ${onde} (${Math.round(s * 100)}% do tamanho); confira na prévia se ela ainda se lê ou escolha outro momento.`);
    if (o.lado !== "cima") o.y1 = Math.round(y0 + h * s); // embaixo, a peça encosta no alto da faixa (no queixo ou na legenda)
    Object.assign(o, { h, s });
    faixas.push({ nome: o.nome, y0: Math.round(o.y1 - h * s), y1: o.y1, x0: Math.round(540 - (W * s) / 2), x1: Math.round(540 + (W * s) / 2), de, ate, lado: o.lado, legenda: o.legenda, ...(o.legendaY != null ? { legendaY: o.legendaY } : {}) });
    // a legenda que sobe para acima da cabeça durante a janela também é faixa: a conferência reprova o rosto embaixo dela
    if (o.legendaY != null) faixas.push({ nome: "a legenda acima da cabeça", y0: o.legendaY, y1: o.legendaY + Q.legendaFim - Q.legenda, x0: Q.x[0], x1: Q.x[1], de, ate });
    if (o.pilula) faixas.push({ nome: `a pílula do capítulo ${o.p.numero}`, y0: o.pilulaY, y1: o.pilulaY + altPilula, x0: 90, x1: Math.min(990, 200 + 19 * o.p.titulo.length), de: o.pilula[0], ate: +(o.pilula[1] + 0.25).toFixed(3) });
  }
  // Os intervalos sem legenda: o tempo na tela (o da faixa) de cada frase ou peça embaixo do queixo, menos a janela
  const semLegenda = [];
  for (const o of fica) if (!o.legenda) {
    const a = +Math.max(0, o.t - 0.15).toFixed(3), b = +(o.sai + 0.25).toFixed(3), u = semLegenda[semLegenda.length - 1];
    if (u && a <= u[1]) u[1] = Math.max(u[1], b); else semLegenda.push([a, b]);
  }
  // Os intervalos com a legenda no alto: [de, ate, y] da janela embaixo do queixo, y o alto da caixa da legenda
  const legendaNoAlto = fica.filter((o) => o.legendaY != null).map((o) => [+Math.max(0, o.t - 0.15).toFixed(3), +(o.sai + 0.25).toFixed(3), o.legendaY]);
  const peca = fica.filter((o) => o.p), arred = (s) => ({ t: +s.t.toFixed(3), f: s.f });
  return {
    z, abre, semLegenda, ...(legendaNoAlto.length ? { legendaNoAlto } : {}),
    destaques: fica.filter((o) => !o.p).map(({ de, ate, chave, t, sai, y0, y1, x, lado }) => ({ de, ate, chave, t: +t.toFixed(3), sai, y0, y1, lado, ...(x ? { x } : {}) })),
    pecas: peca.map((o) => ({ tipo: o.p.tipo, t: +o.t.toFixed(3), sai: o.sai, y1: o.y1, h: o.h, s: o.s, lado: o.lado, ...o.campos, ...(o.pilula ? { pilula: o.pilula, encolhe: o.encolhe ?? [], pilulaY: o.pilulaY } : {}), sons: o.sons.filter((x) => x.t < o.sai).map(arred) })),
    chaves: [...new Set(peca.flatMap((o) => o.chaves ?? []))].sort((a, b) => a - b),
    faixas,
  };
}

// Banco de peças: cada objeto e aplicativo sai do plugin, da biblioteca local ou do banco central (banco.mjs, nessa ordem);
// sem a peça nos três, entra uma genérica (o desenho neutro abaixo, ou o ícone neutro de celular no aplicativo) e o pedido
// em formato fechado, para o dono colar no Magnus dele. proibidos: os nomes possíveis da fala e o nome do negócio, que o
// pedido não pode levar.
const GENERICO = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><rect x="48" y="48" width="160" height="160" rx="36" opacity="0.2"/><path d="M84 40h88a44 44 0 0 1 44 44v88a44 44 0 0 1-44 44H84a44 44 0 0 1-44-44V84a44 44 0 0 1 44-44Zm0 16a28 28 0 0 0-28 28v88a28 28 0 0 0 28 28h88a28 28 0 0 0 28-28V84a28 28 0 0 0-28-28Z"/></svg>';
function resolverPecas(pecas, icones, ctx, proibidos, avisar) {
  const achados = new Map(), pedidos = [];
  const um = (tipo, nome, familia) => {
    const k = `${tipo}:${nome}`;
    if (achados.has(k)) return achados.get(k);
    const r = buscar({ tipo, nome, familia }, ctx);
    if (!r) {
      let frase = null;
      try { frase = pedidoDePeca({ tipo, nome, familia }, proibidos); } catch (e) { avisar(`montar: ${e.message.replace(/^banco: /, "")} A peça genérica entra mesmo assim; peça ao dono para descrever a peça com outras palavras.`); }
      avisar(`montar: ${tipo === "objeto" ? "o objeto" : "o aplicativo"} "${nome}" não está no plugin, na biblioteca local nem no banco central; entrou uma peça genérica.${frase ? ` Mande ao dono esta frase, para ele colar no Magnus dele: ${frase}` : ""}`);
      if (frase) pedidos.push(frase);
    }
    achados.set(k, r);
    return r;
  };
  for (const p of pecas) {
    if (p.tipo === "objeto") um("objeto", p.objeto, icones);
    if (p.tipo === "app") p.palavrasApps = Object.fromEntries(p.apps.map((a) => [a, um("app", a, "logo")?.entrada.palavras ?? [a.replace(/-/g, " ")]]));
  }
  return { ctx, achados, pedidos };
}

// Copia para pecas/ da pasta do vídeo só os arquivos que as peças do plano usam: os objetos 3D e os logos da biblioteca e,
// na janela, o print do dono, com as áreas do borrar.json ("prints", do sigilo.mjs --borrar) já borradas e reduzido a
// 1640 px de largura (o dobro da janela). Grava em cada peça o caminho que o molde usa. No estilo sóbrio, o objeto vai
// como o SVG do Phosphor dentro dos dados (svg), para a cor da marca entrar pelo CSS.
function copiarPecas(pasta, pecas, icones, banco) {
  if (!pecas.length) return;
  const dir = join(pasta, "pecas");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  let nPrint = 0, borrar = {};
  try { borrar = JSON.parse(readFileSync(join(pasta, "borrar.json"), "utf8")).prints ?? {}; } catch { /* sem borrão */ }
  // o arquivo vem do banco local (onde o banco.mjs guardou a peça do plugin ou do banco central); o vídeo entra no catálogo
  const doBanco = (r) => { const nome = basename(r.arquivo); copyFileSync(r.arquivo, join(dir, nome)); usar(banco.ctx, r.entrada); return `pecas/${nome}`; };
  for (const p of pecas) {
    if (p.tipo === "objeto") {
      const r = banco.achados.get(`objeto:${p.objeto}`), svg = r && icones === "sobrio" ? readFileSync(r.arquivo, "utf8").trim() : null;
      if (!r || (svg && problemasSvg(svg).length)) { p.svg = GENERICO; p.generico = true; }
      else if (svg) { p.svg = svg; usar(banco.ctx, r.entrada); }
      else p.arquivo = doBanco(r);
    }
    if (p.tipo === "app") p.apps.forEach((a) => { const r = banco.achados.get(`app:${a.app}`); if (r) a.arquivo = doBanco(r); else a.desenho = "celular"; });
    if (p.tipo === "janela") {
      const caixas = borrar[p.print] ?? [], saida = `pecas/print-${++nPrint}.png`;
      const vf = [caixas.length ? borrao(caixas.map((caixa) => ({ de: 0, ate: 1, caixa }))) : null, "scale='min(iw,1640)':-2"].filter(Boolean).join(",");
      const r = spawnSync(ffmpeg(), ["-v", "error", "-y", "-i", resolve(pasta, p.print), "-vf", vf, "-frames:v", "1", join(pasta, saida)], { encoding: "utf8", timeout: TEMPO_MAX });
      if (r.error || r.status !== 0) throw new Error(`montar: o ffmpeg não preparou o print "${p.print}" (${String(r.error?.message ?? r.stderr).trim().split("\n").pop()}).`);
      p.arquivo = saida;
      p.borradas = caixas.length;
      guardarDoCliente(banco.ctx, join(pasta, saida), "print"); // o print do cliente fica só na biblioteca local, em cliente/
    }
  }
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
// -nostdin: o ffmpeg não lê a entrada padrão (nenhuma chamada daqui manda dados por ela)
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
// O áudio vai por um arquivo temporário ao lado do WAV, e não pela entrada padrão: pela entrada padrão o ffmpeg travou até o
// tempo máximo (10 min) em 2 de 6 rodadas da suíte com a máquina carregada (spawnSync ETIMEDOUT em gravar, 2026-10-25 e 26)
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
    guardarDoCliente(abrirBanco(pasta, avisar), arq, "logo"); // o logo do cliente fica só na biblioteca local, em cliente/
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
  copiarGsap(pasta);
  return { narrado: true, duracao: plano.fim, cenas: plano.cenas.length, palavras: words.length, efeitos: mix.efeitos.length, integrado: mix.integrado_lufs, pico: mix.pico_dbtp };
}

export function montar(pasta, avisar = (m) => console.error(m)) {
  let dadosBanco = null; // o que o banco de peças fez neste vídeo (banco.mjs)
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
  // Duração da edição no milésimo de baixo: arredondada para cima (2786 quadros / 30 = 92,86667 virava 92,867), a
  // HyperFrames gravava um quadro a mais, depois do fim do último trecho, só com o fundo (achado no último quadro das provas
  // de uma gravação real, da 0.7.0 à 0.9.0)
  const total = Math.floor((pos * 1000) / F + 1e-6) / 1000;
  if (capa && total < 4) throw new Error(`montar: o vídeo editado tem ${total.toFixed(2).replace(".", ",")} s, curto demais para gancho de capa (precisa de 4 s ou mais).`);
  if (!existsSync(join(pasta, "fonte.mp4"))) avisar("montar: falta fonte.mp4 na pasta (passo 1 de references/audio-e-corte.md).");

  const foco = /^\d{1,3}% \d{1,3}%$/.test(esc.foco ?? "") ? esc.foco : "50% 40%", fonte = join(pasta, "fonte.mp4"), arqRosto = join(pasta, "rosto.json");
  // O rosto.json desta fonte.mp4, lido uma vez: null se falta, se a fonte foi gravada de novo depois dele ou se está estragado
  let rosto;
  const lerRosto = () => {
    if (rosto === undefined) {
      rosto = null;
      if (existsSync(arqRosto) && existsSync(fonte) && statSync(fonte).mtimeMs <= statSync(arqRosto).mtimeMs) try { rosto = JSON.parse(readFileSync(arqRosto, "utf8")); } catch { /* rosto.json estragado: segue sem */ }
    }
    return rosto;
  };

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
    if (esc.estilo === "papelaria") { // título e item que não estão na fala daquele cartão são avisados
      cartoes = esc.cartoes.map((c, i) => papelCartao(c, i + 1));
      const PAL = EC.mapear(palavras, trechos, total), em = (s) => EC.naEdicao(s, "ini", trechos, total), siga = "Use as palavras da fala, seguidas e na ordem em que foram ditas.";
      cartoes.forEach((c, i) => {
        const ini = em(c.de), fim = cartoes[i + 1] ? em(cartoes[i + 1].de) : total, tit = c.titulo.replace(/\*/g, "");
        if (!EC.batidas(PAL, [tit], ini, fim)[0].achou) avisar(`montar: o título "${tit}" do cartão ${i + 1} não aparece igual na fala desse cartão. ${siga}`);
        if (c.lista) EC.batidas(PAL, c.lista, ini, fim, { comTitulo: false, naUltima: true }).forEach((b, k) => b.achou ||
          avisar(`montar: o item "${c.lista[k]}" do cartão ${i + 1} não aparece igual na fala desse cartão; ${c.marca === "risco" ? "o risco" : "o check"} entra 0,5 s depois do anterior. ${siga}`));
      });
    }
    if (esc.estilo === "motion-dividido") { // item que não está na fala daquela ideia é avisado (ele entra sem acompanhar a fala)
      cartoes = esc.cartoes.map((c, i) => motionCartao(c, i + 1));
      const PAL = EC.mapear(palavras, trechos, total), em = (s) => EC.naEdicao(s, "ini", trechos, total);
      cartoes.forEach((c, i) => EC.batidas(PAL, c.itens, em(c.de), cartoes[i + 1] ? em(cartoes[i + 1].de) : total).forEach((b, k) => b.achou ||
        avisar(`montar: o item "${c.itens[k]}" do cartão ${i + 1} não aparece igual na fala desse cartão; ${k ? "ele entra 0,5 s depois do anterior" : "ele entra junto com o título, mas o texto precisa ser da fala"}. Use as palavras da fala, seguidas e na ordem em que foram ditas.`)));
    }
    Object.assign(dados, { nome: marca.nome ?? "", cartoes });
  }
  // Legenda corrida do Corte seco nos estilos com cartões (4, 7, 9, 12 e, como opção de teste, o 8): as palavras de ênfase
  // são as de "enfase" (como no Corte seco) ou, sem ele, a palavra forte (*assim*) de cada cartão, dita no tempo dele
  if (esc.estilo === "editorial-claro-dividido") {
    if (esc.legenda != null && !["palavra", "corrida"].includes(esc.legenda)) throw new Error('montar: "legenda" no Editorial claro dividido é "palavra" (a palavra grande na emenda, o padrão) ou "corrida" (a legenda do Corte seco dentro do vídeo, opção de teste).');
    if (esc.legenda === "corrida") dados.legenda = "corrida";
  }
  if (CORRIDA.includes(esc.estilo) || dados.legenda === "corrida") {
    if (esc.enfase != null && (!Array.isArray(esc.enfase) || esc.enfase.some((w) => typeof w !== "string"))) throw new Error('montar: "enfase" é a lista das palavras da fala que ganham o traço na legenda, como "enfase": ["cláusula", "calma"].');
    if (esc.enfase) { conferir("enfase", esc.enfase); dados.fortes = EC.marcar(pal, esc.enfase).filter((i) => i >= 0); }
    else {
      const PALM = EC.mapear(palavras, trechos, total), fortes = [];
      dados.cartoes.forEach((c, i) => {
        const m = /\*([^*]+)\*/.exec(c.titulo ?? ""), w = m ? m[1].split(/\s+/).map(limpaPal).filter(Boolean) : [];
        const ini = EC.naEdicao(c.de, "ini", trechos, total), fim = dados.cartoes[i + 1] ? EC.naEdicao(dados.cartoes[i + 1].de, "ini", trechos, total) : total;
        const k = w.length ? PALM.findIndex((p, j) => p.ini >= ini - 0.5 && p.ini < fim && w.every((x, n) => limpaPal(PALM[j + n]?.txt ?? "") === x)) : -1;
        if (k >= 0) fortes.push(...w.map((_, n) => k + n));
      });
      dados.fortes = fortes;
    }
  }
  if (esc.estilo === "destaques-tipograficos") { // a faixa de cada frase sai do rastro do rosto; sem ele, faixa fixa, com aviso
    let naJanela = null, teto = ZOOM;
    const r = lerRosto();
    if (r) {
      const f = medidas(fonte), ruim = rastroInvalido(r, f);
      if (ruim) avisar(`montar: ${ruim}; as frases em destaque ficam numa faixa fixa no alto, de ${DESTAQUE.topo} a ${DESTAQUE.topo + DESTAQUE.padrao} px.`);
      else { naJanela = rostoNaJanela(r, f, [0, 0, 1080, 1920], foco, trechos); teto = Math.max(1080 / f.W, 1920 / f.H) > 1.5 ? ZOOM_AMPLIADO : ZOOM; }
    } else if (existsSync(fonte) && statSync(fonte).size > 0)
      avisar(`montar: falta o rosto.json desta fonte.mp4 (rode o rosto.mjs, passo 1b de references/audio-e-corte.md); as frases em destaque ficam numa faixa fixa no alto, de ${DESTAQUE.topo} a ${DESTAQUE.topo + DESTAQUE.padrao} px. Confira na prévia se elas não cobrem o rosto.`);
    // Estilo dos objetos: "3d" (Fluent Emoji, o padrão) ou "sobrio" (Phosphor em duas cores da marca), do escolhas.json ou,
    // sem ele, do marca.json (o padrão do negócio)
    const icones = esc.icones ?? marca.icones ?? "3d";
    if (!ICONES_OBJETO.includes(icones)) throw new Error(`montar: "icones" (no ${esc.icones != null ? "escolhas.json" : "marca.json"}) é "3d" (objetos 3D, mais animados) ou "sobrio" (ícone de traço em duas cores da marca, num disco branco).`);
    const pecas = lerPecas(esc.pecas, pasta);
    const banco = pecas.some((p) => p.tipo === "objeto" || p.tipo === "app" || p.tipo === "janela")
      ? resolverPecas(pecas, icones, abrirBanco(pasta, avisar), { nomes: naFala(palavras.map(([text, start, end]) => ({ text, start, end }))).nomes.map((x) => x.nome), cliente: [marca.nome, marca.assinatura].filter(Boolean) }, avisar) : null;
    Object.assign(dados, planoDestaques(esc.destaques, EC.mapear(palavras, trechos, total), { caixa: naJanela, total, desde: capa ? capa.fim : 0, pecas, teto }, avisar));
    // palavras-chave da legenda: as da fala de cada peça (objeto e aplicativo) e as de "chaves", que não foram achadas, com aviso
    if (esc.chaves != null && (!Array.isArray(esc.chaves) || esc.chaves.some((w) => typeof w !== "string"))) throw new Error('montar: "chaves" é a lista das palavras da fala que saem na cor de destaque na legenda, como "chaves": ["contrato", "prazo"].');
    if (esc.chaves) conferir("chaves", esc.chaves);
    dados.chaves = [...new Set([...dados.chaves, ...(esc.chaves ? EC.marcar(pal, esc.chaves).filter((i) => i >= 0) : [])])].sort((a, b) => a - b);
    copiarPecas(pasta, dados.pecas, icones, banco);
    if (banco) dadosBanco = { relatorio: banco.ctx.relatorio, pedidos: banco.pedidos, biblioteca: banco.ctx.bib };
    dados.icones = icones;
    dados.nome = marca.nome ?? ""; // a notificação do "Comenta" leva o nome do negócio
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
  let veu = 0;
  if (FAIXA[esc.estilo] && (esc.estilo !== "editorial-claro-dividido" || dados.legenda === "corrida") && existsSync(fonte) && statSync(fonte).size > 0) {
    const corrida = !!JANELA_FAIXA[esc.estilo], c = claridade(fonte, FAIXA[esc.estilo], foco, JANELA_FAIXA[esc.estilo], corrida ? "YHIGH" : "YAVG");
    if (c == null) avisar(`montar: não consegui medir a claridade da faixa do texto na fonte.mp4; ${corrida ? "a legenda fica com o contorno normal" : "o véu atrás do texto fica desligado"}.`);
    else if (c > (corrida ? CLARA_CORRIDA : dados.identidade === "stomp" ? CLARA_STOMP : CLARA)) veu = 1;
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
      .capa-trecho { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: ${foco}; transform: translateY(var(--desce, 0px)); }
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

  // Fonte fixa do estilo (a da caixinha, a letra de mão da Papelaria), conferida como as da marca
  let fonteFixa = "";
  const fixa = esc.estilo === "destaques-tipograficos" ? condensada(marca) : FONTE_FIXA[esc.estilo];
  if (fixa) {
    const fonts = join(pasta, "fonts"), arq = `${fixa.familia}-${fixa.peso}.woff2`;
    if (!existsSync(join(fonts, arq))) throw new Error(`montar: falta ${fixa.oque} (fonts/${arq}). Baixe com: node "${join(RAIZ, "scripts", "baixar-fonte.mjs")}" "${fixa.familia}" "${fixa.peso}" "${fonts}"`);
    conferirWoff2(fonts, arq);
    fonteFixa = `\n      @font-face { font-family: "${fixa.familia}"; src: url("fonts/${arq}") format("woff2"); font-weight: ${fixa.peso}; font-display: block; }`;
  }

  // Aproximação no rosto (opcional): "aproximar": ["frase da fala", ...], as frases de ênfase, na ordem da fala. O plano sai
  // do rastro do rosto (rosto.json, do passo 1b) e das faixas de texto do molde; o que não cabe fica de fora, com aviso.
  let molde = readFileSync(join(RAIZ, "estilos", `${esc.estilo}.html`), "utf8");
  if (dados.legenda === "corrida") molde = molde.replace(PALAVRA_8, LEGENDA_8).replace('<div id="palavra"></div>', '<div id="legenda"></div>');
  let trechosHtml = videos.join("\n");
  if (esc.aproximar != null && esc.aproximar !== false) {
    if (!Array.isArray(esc.aproximar) || esc.aproximar.some((f) => typeof f !== "string" || !f.trim()))
      throw new Error('montar: "aproximar" é a lista das frases de ênfase, como estão na fala: "aproximar": ["isso muda tudo", "o segredo é a constância"] (ou false, para desligar).');
    if (esc.estilo === "corte-seco-zoom") avisar("montar: no Corte seco o enquadramento já aproxima a cada frase; o \"aproximar\" ficou de fora.");
    else {
      if (!lerRosto()) avisar("montar: falta o rosto.json desta fonte.mp4 (rode o rosto.mjs, passo 1b de references/audio-e-corte.md); segue sem aproximar.");
      else {
        const j = /#janela \{[^}]*?left: (\d+)(?:px)?; top: (\d+)px; width: (\d+)px; height: (\d+)px;/.exec(molde), janela = j ? j.slice(1).map(Number) : [0, 0, 1080, 1920];
        // nos Destaques tipográficos, com o vídeo aproximado para a frase ou peça (dados.abre) não se aproxima no rosto; sem
        // essa aproximação, a frase e a peça ficam com o vídeo como foi gravado e as faixas delas valem
        const faixas = [...zonas(molde, total), ...(dados.abre?.length ? [] : dados.faixas ?? [])];
        if (caixa) faixas.push({ y0: caixa.topo, y1: 1500, x0: 90, x1: 990 });
        // nos Destaques tipográficos a aproximação só acontece com o enquadramento fechado (o vídeo como foi gravado)
        const { W, H } = medidas(fonte);
        const r = planejarAproximacao({ frases: esc.aproximar, pal: EC.mapear(palavras, trechos, total), trechos, total, rosto, fonte: { W, H }, janela, faixas, foco, desde: capa ? capa.fim : 0 });
        r.avisos.forEach((m) => avisar(`montar: ${m}`));
        // nos Destaques tipográficos, com o vídeo aproximado para a frase ou peça não se aproxima no rosto
        if (dados.abre) r.lista = r.lista.filter((a) => {
          const cai = dados.abre.some(([x, y]) => a.de < y && a.fim > x);
          if (cai) avisar(`montar: a aproximação em ${a.de.toFixed(1).replace(".", ",")} s cai com uma frase ou peça acima da cabeça (o vídeo já está aproximado para ela ali); ficou de fora.`);
          return !cai;
        });
        if (r.lista.length) {
          dados.aproximar = r.lista;
          trechosHtml = `${recuo}<div id="aproximar" data-layout-allow-overflow style="position: absolute; inset: 0;">\n${videos.map((v) => "  " + v).join("\n")}\n${recuo}</div>`;
        }
      }
    }
  }

  const valores = {
    FONTES: fontes(join(pasta, "fonts"), marca.fontes ?? {}, usa, avisar) + fonteFixa,
    FUNDO_CLARO: marca.cores.fundo_claro, FUNDO_ESCURO: marca.cores.fundo_escuro, TEXTO: marca.cores.texto, DESTAQUE: marca.cores.destaque,
    TITULO: html(marca.fontes.titulo), CORPO: html(marca.fontes.corpo ?? ""), FONTE_DESTAQUE: html(marca.fontes.destaque ?? ""),
    FOCO: foco, VEU: String(veu),
    DURACAO: total.toFixed(3), TRECHOS: trechosHtml,
    DADOS: JSON.stringify(dados).replace(/</g, "\\u003c"),
    ASSINATURA: html(marca.assinatura ?? marca.nome ?? ""),
    CONDENSADA: html(fixa?.familia ?? marca.fontes.titulo), PESO_CONDENSADA: String(fixa?.peso ?? 800),
    EFEITOS: efeitos.join("\n"), CAPA: camada,
  };
  if (esc.foco && valores.FOCO !== esc.foco) avisar(`montar: foco "${esc.foco}" fora do formato "50% 40%"; usando 50% 40%.`);
  const sobra = [...molde.matchAll(/\{\{([A-Z_]+)\}\}/g)].map((m) => m[1]).filter((k) => !(k in valores));
  if (sobra.length) throw new Error(`montar: marcador sem valor no molde: ${sobra.join(", ")}.`);
  const saida = molde.replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => valores[k]);
  writeFileSync(join(pasta, "index.html"), saida);
  copyFileSync(join(RAIZ, "estilos", "comum.js"), join(pasta, "comum.js"));
  copiarGsap(pasta);
  if (molde.includes('src="pecas.js"')) copyFileSync(join(RAIZ, "estilos", "pecas.js"), join(pasta, "pecas.js"));
  return { duracao: total, pecas: dados.pecas?.length, trechos: manter.length, palavras: palavras.length, efeitos: efeitos.length, sons, veu: !!veu, reforco: !!veu && !!JANELA_FAIXA[esc.estilo] && (esc.estilo !== "editorial-claro-dividido" || dados.legenda === "corrida"), aproximacoes: dados.aproximar?.length ?? 0, destaques: dados.destaques?.length, ...(dadosBanco ? { banco: dadosBanco } : {}) };
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const r = montar(resolve(process.argv[2] ?? "."));
    for (const l of r.banco?.relatorio ?? []) console.log(`montar: ${l.replace(/^banco: /, "")}`);
    if (r.narrado) console.log(`montar: index.html pronto (Motion narrado: ${r.cenas} palavras-chave, ${r.efeitos} efeitos sonoros, ${r.duracao.toFixed(3)} s; áudio em ${r.integrado} LUFS, pico de ${r.pico} dBTP).`);
    else console.log(`montar: index.html pronto (${r.trechos} trechos, ${r.palavras} palavras, ${r.efeitos} efeitos sonoros, ${r.duracao.toFixed(3)} s de edição${r.reforco ? ", contorno da legenda reforçado (faixa clara no vídeo)" : r.veu ? ", véu atrás do texto" : ""}${r.aproximacoes ? `, ${r.aproximacoes} aproximações no rosto` : ""}${r.destaques != null ? `, ${r.destaques} frases em destaque` : ""}).`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
