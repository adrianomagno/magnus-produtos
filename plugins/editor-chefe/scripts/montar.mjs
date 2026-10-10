// Monta o projeto da HyperFrames de um vídeo a partir do molde do estilo.
// Uso: node montar.mjs <pasta do vídeo>
// Lê na pasta: escolhas.json (estilo e escolhas do vídeo), transcript.json (corrigido), trechos.json (do trechos.mjs),
// fonts/ (do baixar-fonte.mjs) e a marca (padrão ../marca.json). Grava index.html e comum.js na pasta e, com
// "efeitos" ligado (padrão), copia para efeitos/ os sons do plugin hyperframes que o estilo usa.
import { readFileSync, writeFileSync, readdirSync, existsSync, copyFileSync, realpathSync, mkdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const EC = createRequire(import.meta.url)(join(RAIZ, "estilos", "comum.js"));
const F = 30;
// Fontes que cada estilo usa
const USA = {
  "legenda-viva": ["titulo"],
  "palavra-chave": ["titulo"],
  "corte-seco-zoom": ["titulo"],
  "painel-escuro": ["titulo", "corpo"],
  "editorial-claro": ["titulo", "corpo", "destaque"],
};

// Efeitos sonoros: volume por baixo da voz (0,35; o impacto grave é 9 dB mais alto que os outros arquivos, vai a 0,2)
// e antecipação para o pico do som cair no instante em que o elemento aparece.
const SOM = { "whoosh-short": { volume: 0.35, antes: 0.12 }, pop: { volume: 0.35, antes: 0.08 }, "impact-bass-1": { volume: 0.2, antes: 0.04 } };

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
const FAIXA = { "legenda-viva": [1250, 1470, 70, 1010], "palavra-chave": [1220, 1520, 60, 1020], "corte-seco-zoom": [1270, 1470, 80, 1000] };
const CLARA = 130, CLARA_STOMP = 185; // luma média (0 a 255) da faixa, no 90º percentil dos quadros; acima disso, véu
function claridade(arq, [y0, y1, x0, x1], foco) {
  // Os binários do ambiente.sh (com .exe no Windows); sem eles e fora do PATH, devolve null e o montador avisa
  const sonda = spawnSync(process.env.HYPERFRAMES_FFPROBE_PATH ?? "ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", arq], { encoding: "utf8" });
  if (sonda.error || !sonda.stdout) return null;
  const [W, H] = sonda.stdout.trim().split(",").map(Number);
  if (!(W > 0 && H > 0)) return null;
  const s = Math.max(1080 / W, 1920 / H), [fx, fy] = foco.split(" ").map((v) => parseFloat(v) / 100);
  const x = Math.max(0, Math.round((x0 + (W * s - 1080) * fx) / s)), y = Math.max(0, Math.round((y0 + (H * s - 1920) * fy) / s));
  const w = Math.max(2, Math.min(W - x, Math.round((x1 - x0) / s))), h = Math.max(2, Math.min(H - y, Math.round((y1 - y0) / s)));
  const r = spawnSync(process.env.HYPERFRAMES_FFMPEG_PATH ?? "ffmpeg", ["-hide_banner", "-nostats", "-i", arq, "-vf", `fps=2,crop=${w}:${h}:${x}:${y},signalstats,metadata=print:key=lavfi.signalstats.YAVG`, "-an", "-f", "null", "-"], { encoding: "utf8" });
  if (r.error || !r.stderr) return null;
  const v = [...r.stderr.matchAll(/YAVG=([\d.]+)/g)].map((m) => +m[1]).sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length * 0.9)] : null;
}

const ler = (arq, oque) => {
  if (!existsSync(arq)) throw new Error(`montar: falta ${oque} (${arq}).`);
  try { return JSON.parse(readFileSync(arq, "utf8")); }
  catch (e) { throw new Error(`montar: ${oque} (${arq}) não é um JSON válido (${e.message}).`); }
};
const html = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// @font-face dos arquivos que existem em fonts/: título no peso mais perto de 800, corpo de 400, destaque em itálico
// (sem o itálico, declara a normal e o navegador inclina a fonte da marca).
function fontes(pasta, f, usa, avisar) {
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
    if (readFileSync(join(pasta, x.arq)).subarray(0, 4).toString("latin1") !== "wOF2")
      throw new Error(`montar: fonts/${x.arq} não é uma fonte woff2 (pode ser uma página de erro salva no lugar). Apague o arquivo e baixe de novo com baixar-fonte.mjs.`);
    if (x.italico !== italico) { avisar(`montar: "${fam}" sem itálico em fonts/; o navegador vai inclinar a fonte normal.`); linhas.push(face(fam, x, alvo, false)); continue; }
    if (x.peso !== alvo) avisar(`montar: "${fam}" sem peso ${alvo} em fonts/; usando ${x.arq}.`);
    linhas.push(face(fam, x, alvo, italico));
  }
  return linhas.join("\n");
}

export function montar(pasta, avisar = (m) => console.error(m)) {
  const esc = ler(join(pasta, "escolhas.json"), "o escolhas.json");
  if (!USA[esc.estilo]) throw new Error(`montar: estilo "${esc.estilo}" não existe. Use: ${Object.keys(USA).join(", ")}.`);
  const marca = ler(resolve(pasta, esc.marca ?? "../marca.json"), "o marca.json");
  for (const k of ["fundo_claro", "fundo_escuro", "texto", "destaque"])
    if (!/^#[0-9a-fA-F]{6}$/.test(marca.cores?.[k] ?? "")) throw new Error(`montar: cores.${k} do marca.json precisa estar no formato #RRGGBB.`);
  // O nome da fonte vai para o CSS e para o JS do molde: só letras, números e espaço
  for (const k of ["titulo", "corpo", "destaque"])
    if ((USA[esc.estilo].includes(k) || marca.fontes?.[k] !== undefined) && !/^[\p{L}\p{N} ]+$/u.test(marca.fontes?.[k] ?? ""))
      throw new Error(`montar: fontes.${k} do marca.json ("${marca.fontes?.[k] ?? ""}") precisa ser o nome de uma fonte, só com letras, números e espaço.`);
  const palavras = ler(resolve(pasta, esc.transcricao ?? "transcript.json"), "o transcript.json")
    .map((w) => [w.text, +w.start.toFixed(2), +w.end.toFixed(2)]);
  const manter = ler(resolve(pasta, esc.trechos ?? "trechos.json"), "o trechos.json").manter;
  if (!Array.isArray(manter) || !manter.length) throw new Error('montar: o trechos.json não tem nenhum trecho em "manter". Rode o trechos.mjs de novo e confira se o vídeo tem fala.');

  // Um <video> por trecho mantido (receitas Hard cut e Trim in/out da hyperframes-core)
  let pos = 0;
  const recuo = esc.estilo === "painel-escuro" || esc.estilo === "editorial-claro" ? "          " : "        ";
  const videos = manter.map(([a, b], i) => {
    const fa = Math.round(a * F), n = Math.round(b * F) - fa;
    if (!(n >= 1)) throw new Error(`montar: o trecho ${i + 1} do trechos.json (${a} a ${b} s) tem menos de 1 quadro. Confira o início e o fim dele.`);
    const tag = `${recuo}<video id="trecho-${i + 1}" class="trecho clip" src="fonte.mp4" data-start="${(pos / F).toFixed(3)}" data-duration="${(n / F - 0.001).toFixed(3)}" data-media-start="${(fa / F).toFixed(3)}" data-track-index="0" playsinline data-has-audio="true"></video>`;
    pos += n;
    return tag;
  });
  const total = +(pos / F).toFixed(3);
  // Os trechos como o molde os lê na página (os números já arredondados das marcas do <video>)
  const trechos = manter.map(([a, b], i, m) => {
    const ini = m.slice(0, i).reduce((s, [x, y]) => s + Math.round(y * F) - Math.round(x * F), 0), fa = Math.round(a * F), n = Math.round(b * F) - fa;
    return { ini: +(ini / F).toFixed(3), dur: +(n / F - 0.001).toFixed(3), src: +(fa / F).toFixed(3) };
  });
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
  if (esc.estilo === "painel-escuro" || esc.estilo === "editorial-claro") {
    if (!Array.isArray(esc.cartoes) || !esc.cartoes.length || esc.cartoes.some((c) => typeof c.de !== "number" || typeof c.titulo !== "string"))
      throw new Error('montar: este estilo pede "cartoes": [{ "de": segundo do original, "titulo": "..." }].');
    esc.cartoes.forEach((c, i) => {
      if (i && !(c.de > esc.cartoes[i - 1].de)) throw new Error(`montar: os cartões precisam estar na ordem da fala: o cartão ${i + 1} ("de": ${c.de}) não vem depois do cartão ${i} ("de": ${esc.cartoes[i - 1].de}).`);
    });
    Object.assign(dados, { nome: marca.nome ?? "", cartoes: esc.cartoes });
  }

  // Efeitos sonoros (padrão: ligados), um <audio> por efeito, cortado no fim da edição
  if (esc.efeitos !== undefined && typeof esc.efeitos !== "boolean") throw new Error('montar: "efeitos" é true (ligados) ou false (desligados).');
  let efeitos = [];
  if (esc.efeitos !== false) {
    const sfx = pastaEfeitos(), lista = ler(join(sfx, "manifest.json"), "o manifest.json dos efeitos");
    const ev = EC.efeitos(esc.estilo, dados, trechos, total);
    mkdirSync(join(pasta, "efeitos"), { recursive: true });
    for (const som of new Set(ev.map((e) => e.som))) {
      if (!lista[som] || !existsSync(join(sfx, lista[som].file))) throw new Error(`montar: o efeito "${som}" não está na pasta de efeitos da HyperFrames (${sfx}).`);
      copyFileSync(join(sfx, lista[som].file), join(pasta, "efeitos", lista[som].file));
    }
    const fimDaFaixa = []; // efeitos que se sobrepõem vão para faixas diferentes (a 0 é do vídeo)
    efeitos = ev.map((e, i) => {
      const ini = +Math.max(0, e.t - SOM[e.som].antes).toFixed(3), dur = +Math.min(lista[e.som].duration, total - ini).toFixed(3);
      if (dur < 0.1) return "";
      let f = fimDaFaixa.findIndex((fim) => fim <= ini);
      if (f < 0) f = fimDaFaixa.push(0) - 1;
      fimDaFaixa[f] = ini + dur;
      return `      <audio id="efeito-${i + 1}" class="clip" src="efeitos/${lista[e.som].file}" data-start="${ini.toFixed(3)}" data-duration="${dur.toFixed(3)}" data-track-index="${f + 1}" data-volume="${SOM[e.som].volume}"></audio>`;
    }).filter(Boolean);
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

  const valores = {
    FONTES: fontes(join(pasta, "fonts"), marca.fontes ?? {}, USA[esc.estilo], avisar),
    FUNDO_CLARO: marca.cores.fundo_claro, FUNDO_ESCURO: marca.cores.fundo_escuro, TEXTO: marca.cores.texto, DESTAQUE: marca.cores.destaque,
    TITULO: html(marca.fontes.titulo), CORPO: html(marca.fontes.corpo ?? ""), FONTE_DESTAQUE: html(marca.fontes.destaque ?? ""),
    FOCO: foco, VEU: String(veu),
    DURACAO: (pos / F).toFixed(3), TRECHOS: videos.join("\n"),
    DADOS: JSON.stringify(dados).replace(/</g, "\\u003c"),
    ASSINATURA: html(marca.assinatura ?? marca.nome ?? ""),
    EFEITOS: efeitos.join("\n"),
  };
  if (esc.foco && valores.FOCO !== esc.foco) avisar(`montar: foco "${esc.foco}" fora do formato "50% 40%"; usando 50% 40%.`);
  const molde = readFileSync(join(RAIZ, "estilos", `${esc.estilo}.html`), "utf8");
  const sobra = [...molde.matchAll(/\{\{([A-Z_]+)\}\}/g)].map((m) => m[1]).filter((k) => !(k in valores));
  if (sobra.length) throw new Error(`montar: marcador sem valor no molde: ${sobra.join(", ")}.`);
  const saida = molde.replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => valores[k]);
  writeFileSync(join(pasta, "index.html"), saida);
  copyFileSync(join(RAIZ, "estilos", "comum.js"), join(pasta, "comum.js"));
  return { duracao: pos / F, trechos: manter.length, palavras: palavras.length, efeitos: efeitos.length, veu: !!veu };
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const r = montar(resolve(process.argv[2] ?? "."));
    console.log(`montar: index.html pronto (${r.trechos} trechos, ${r.palavras} palavras, ${r.efeitos} efeitos sonoros, ${r.duracao.toFixed(3)} s de edição${r.veu ? ", véu atrás do texto" : ""}).`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
