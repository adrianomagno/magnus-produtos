// Reenquadramento que segue o rosto: acha o rosto ao longo da fonte.mp4, suaviza o caminho e recorta a fonte na
// proporção da janela do estilo, com o recorte acompanhando a pessoa. Roda só com o processador, sem placa de vídeo.
// Uso: node rosto.mjs <pasta do vídeo> <estilo>      (depois do passo 1 de references/audio-e-corte.md)
//      node rosto.mjs <pasta do vídeo> --desligar   (volta a fonte inteira, com o "foco" fixo do escolhas.json)
// A primeira vez guarda a fonte como fonte-inteira.mp4 e grava o recorte em fonte.mp4; rodar de novo (outro estilo)
// recorta de novo a partir da inteira. Se a fonte.mp4 for mais nova que o rosto.json (o passo 1 rodou de novo), ela
// vira a nova inteira. Sem rosto, sem detector ou sem sobra dos lados, a fonte.mp4 fica igual à inteira e o molde usa o
// "foco" fixo, como antes: este script nunca para o fluxo por causa do rosto.
// Detector: YuNet (modelo de 230 KB da OpenCV, licença MIT) no ONNX Runtime Web (licença MIT), em WebAssembly, pelo Node
// portátil do plugin: sem binário nativo, sem Python e sem placa de vídeo, igual no Mac e no Windows. O preparar.sh baixa
// os quatro arquivos (cerca de 15 MB) em <pasta de dados>/rosto.
import { readFileSync, writeFileSync, existsSync, renameSync, copyFileSync, statSync, rmSync, realpathSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const TEMPO_MAX = 600000;
const F = 30;
// Janela do vídeo em cada estilo (largura x altura em px no quadro 1080x1920), medida nos moldes de estilos/
export const JANELA = {
  "legenda-viva": [1080, 1920], "palavra-chave": [1080, 1920], "corte-seco-zoom": [1080, 1920], "caixinha-pergunta": [1080, 1920],
  "destaques-tipograficos": [1080, 1920],
  "painel-escuro": [984, 600], "editorial-claro": [960, 540],
  "painel-escuro-dividido": [1080, 960], "editorial-claro-dividido": [1080, 960], "motion-dividido": [1080, 960], papelaria: [1080, 960],
};
// Confiança mínima do YuNet para contar como rosto (0 a 1) e sobreposição acima da qual duas caixas são o mesmo rosto
export const LIMIAR = 0.7;
const MESMO = 0.3;
const ffmpeg = () => process.env.HYPERFRAMES_FFMPEG_PATH ?? "ffmpeg", ffprobe = () => process.env.HYPERFRAMES_FFPROBE_PATH ?? "ffprobe";

export function medidas(arq) {
  const r = spawnSync(ffprobe(), ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", arq], { encoding: "utf8", timeout: TEMPO_MAX });
  if (r.error || r.status !== 0) throw new Error(`não consegui ler o vídeo ${arq}.`);
  const j = JSON.parse(r.stdout), v = j.streams?.[0];
  return { W: v?.width, H: v?.height, duracao: +j.format?.duration };
}

// Detector de rosto: devolve async (quadro BGR de largura x altura, as duas múltiplas de 32) => [{ x, y, w, h, q }] (centro,
// tamanho e confiança, em px do quadro), ou null se o preparar.sh ainda não baixou o detector
export async function detector(dados = process.env.EDITOR_CHEFE_DATA || process.env.CLAUDE_PLUGIN_DATA) {
  const pasta = dados && join(dados, "rosto");
  const arqs = ["ort.wasm.bundle.min.mjs", "ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm", "yunet.onnx"];
  if (!pasta || arqs.some((a) => !existsSync(join(pasta, a)))) return null;
  const ort = await import(pathToFileURL(join(pasta, arqs[0])).href);
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.wasmPaths = pathToFileURL(pasta).href + "/";
  const sessao = await ort.InferenceSession.create(new Uint8Array(readFileSync(join(pasta, "yunet.onnx"))));
  return async (bgr, largura, altura) => {
    const n = largura * altura, plano = new Float32Array(3 * n);
    for (let i = 0; i < n; i++) { plano[i] = bgr[3 * i]; plano[n + i] = bgr[3 * i + 1]; plano[2 * n + i] = bgr[3 * i + 2]; }
    const o = await sessao.run({ [sessao.inputNames[0]]: new ort.Tensor("float32", plano, [1, 3, altura, largura]) });
    const caixas = [];
    for (const passo of [8, 16, 32]) {
      const cls = o[`cls_${passo}`].data, obj = o[`obj_${passo}`].data, bb = o[`bbox_${passo}`].data, cols = largura / passo;
      for (let i = 0; i < cls.length; i++) {
        const q = Math.sqrt(Math.min(1, Math.max(0, cls[i])) * Math.min(1, Math.max(0, obj[i])));
        if (q < LIMIAR) continue;
        caixas.push({ x: ((i % cols) + bb[4 * i]) * passo, y: (Math.floor(i / cols) + bb[4 * i + 1]) * passo, w: Math.exp(bb[4 * i + 2]) * passo, h: Math.exp(bb[4 * i + 3]) * passo, q });
      }
    }
    // Uma caixa por rosto: fica a de maior confiança entre as que se sobrepõem
    const iou = (a, b) => {
      const ix = Math.max(0, Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2));
      const iy = Math.max(0, Math.min(a.y + a.h / 2, b.y + b.h / 2) - Math.max(a.y - a.h / 2, b.y - b.h / 2));
      return (ix * iy) / (a.w * a.h + b.w * b.h - ix * iy);
    };
    return caixas.sort((a, b) => b.q - a.q).reduce((f, c) => (f.some((x) => iou(x, c) > MESMO) ? f : [...f, c]), []);
  };
}

// Quadros em BGR, reduzidos para a largura dada (múltipla de 32; altura proporcional, com faixa preta embaixo até a múltipla de 32 que o
// YuNet pede), qps por segundo. Lê um quadro por vez: vídeo longo não enche a memória.
export async function* quadros(arq, W, H, largura, qps) {
  const altura = Math.round((H * largura) / W / 2) * 2, alt32 = Math.ceil(altura / 32) * 32, tam = largura * alt32 * 3;
  const p = spawn(ffmpeg(), ["-v", "error", "-i", arq, "-vf", `fps=${qps},scale=${largura}:${altura},pad=${largura}:${alt32},format=bgr24`, "-f", "rawvideo", "-"]);
  const relogio = setTimeout(() => p.kill(), TEMPO_MAX);
  let erro = "", buf = Buffer.alloc(0);
  p.stderr.on("data", (d) => (erro += d));
  const fim = new Promise((ok) => p.on("close", ok));
  try {
    for await (const d of p.stdout) {
      buf = Buffer.concat([buf, d]);
      while (buf.length >= tam) { yield { px: buf.subarray(0, tam), largura, altura: alt32, escala: W / largura }; buf = buf.subarray(tam); }
    }
    if ((await fim) !== 0) throw new Error(`o ffmpeg não leu os quadros de ${arq}.\n${erro.trim().split("\n").pop()}`);
  } finally { clearTimeout(relogio); }
}

const mediana = (a) => { const b = [...a].sort((x, y) => x - y); return b[b.length >> 1]; };
const media = (a, r) => a.map((_, i) => { const j = a.slice(Math.max(0, i - r), i + r + 1); return j.reduce((s, x) => s + x, 0) / j.length; });

// Centros x do rosto (null onde não achou) viram a posição x do recorte em cada amostra: lacunas preenchidas pela reta
// entre os vizinhos, mediana de 7 amostras (tira o pulo de um quadro errado) e média de 5 duas vezes (pan macio, sem atraso).
// Se o rosto anda menos que 12% da largura do recorte, a câmera fica parada na mediana: tremidinha incomoda mais que nada.
export function trajetoria(centros, W, cw) {
  const achados = centros.map((c, i) => [i, c]).filter(([, c]) => c != null);
  if (!achados.length) return null;
  const v = centros.map((c, i) => {
    if (c != null) return c;
    const a = achados.filter(([j]) => j < i).pop(), b = achados.find(([j]) => j > i);
    if (!a) return b[1];
    if (!b) return a[1];
    return a[1] + ((b[1] - a[1]) * (i - a[0])) / (b[0] - a[0]);
  });
  let s = media(media(v.map((_, i) => mediana(v.slice(Math.max(0, i - 3), i + 4))), 2), 2);
  const parado = Math.max(...s) - Math.min(...s) < 0.12 * cw;
  if (parado) s = s.map(() => mediana(s));
  return { parado, x: s.map((c) => Math.min(W - cw, Math.max(0, Math.round(c - cw / 2)))) };
}

export async function reenquadrar(pasta, estilo, { dados, avisar = () => {} } = {}) {
  if (!JANELA[estilo]) throw new Error(`rosto: o estilo "${estilo}" não tem vídeo gravado para enquadrar. Use: ${Object.keys(JANELA).join(", ")}.`);
  const fonte = join(pasta, "fonte.mp4"), inteira = join(pasta, "fonte-inteira.mp4"), rel = join(pasta, "rosto.json");
  const nova = existsSync(fonte) && (!existsSync(rel) || !existsSync(inteira) || statSync(fonte).mtimeMs > statSync(rel).mtimeMs);
  if (nova) renameSync(fonte, inteira);
  if (!existsSync(inteira)) throw new Error(`rosto: falta a fonte.mp4 em ${pasta} (passo 1 de references/audio-e-corte.md).`);
  const { W, H, duracao } = medidas(inteira), [bw, bh] = JANELA[estilo];
  const fim = (estado, extra = {}) => {
    if (estado !== "seguindo" && estado !== "parado") copyFileSync(inteira, fonte);
    const r = { estado, estilo, janela: [bw, bh], ...extra };
    writeFileSync(rel, JSON.stringify(r)); // depois da fonte.mp4: é a marca de que ela já é a saída deste script
    return r;
  };
  const sobra = W / H > (bw / bh) * 1.02; // vídeo mais largo que a janela: dá para seguir o rosto dos lados
  const det = await detector(dados);
  if (!det) {
    if (!sobra) return fim("sem sobra");
    avisar("rosto: o detector de rosto não está nesta pasta de dados (rode o preparar.sh); segue com o foco fixo.");
    return fim("sem detector");
  }
  // O rastro do rosto (centro, largura e altura do maior rosto em cada amostra, em px da fonte inteira) fica no rosto.json
  // mesmo sem recorte: é dele que o montar.mjs tira a aproximação no rosto. Sem sobra, 2 amostras por segundo bastam.
  // ponytail: no vídeo em pé, com sobra zero, o rastro é só para a aproximação; 2 por segundo deixa de pegar movimento rápido
  const cw = Math.round((H * bw) / bh / 2) * 2, qps = !sobra || duracao > 180 ? 2 : 5, centros = [], caixas = [];
  for await (const q of quadros(inteira, W, H, 480, qps)) {
    const r = (await det(q.px, q.largura, q.altura)).sort((a, b) => b.w * b.h - a.w * a.h)[0]; // o maior rosto: quem fala, perto da câmera
    centros.push(r ? r.x * q.escala : null);
    caixas.push(r ? [r.x, r.y, r.w, r.h].map((v) => Math.round(v * q.escala)) : null);
  }
  const achados = centros.filter((c) => c != null).length, rastro = { qps, W, H, caixas };
  if (!sobra) return fim("sem sobra", { amostras: centros.length, achados, rastro });
  if (achados < 0.3 * centros.length) return fim("sem rosto", { amostras: centros.length, achados, rastro });
  const t = trajetoria(centros, W, cw);
  if (!recortar(pasta, t.x, qps, cw, H, duracao, avisar)) return fim("falhou", { rastro });
  return fim(t.parado ? "parado" : "seguindo", { amostras: centros.length, achados, recorte: [cw, H], x_min: Math.min(...t.x), x_max: Math.max(...t.x), rastro, corte_x: t.x });
}

// Aproximação no rosto: nas frases de ênfase que o Claude escolheu, o vídeo cresce devagar até ZOOM com o centro no rosto,
// fica assim durante a frase e volta. Regras: nunca durante o gancho de capa; no máximo uma a cada 8 s de vídeo e 4 s sem
// aproximação entre uma e outra; a cabeça (a caixa do rosto e mais um quarto da altura dela para o cabelo) fica inteira
// dentro da janela e fora de toda faixa de texto em todas as amostras do trecho; a força desce até caber e, abaixo de
// ZOOM_MIN, a aproximação fica de fora (com aviso). Vídeo já ampliado mais de 1,5 vez para caber na janela (deitado em
// tela cheia) vai só até ZOOM_AMPLIADO, para não perder nitidez.
export const ZOOM = 1.25, ZOOM_MIN = 1.1, ZOOM_AMPLIADO = 1.15, SOBE = 0.45, DESCE = 0.6, SEGURA_MAX = 5, A_CADA = 8, INTERVALO = 4;
const limpa = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
// frases: textos da fala; pal: palavras da edição [{ txt, ini, fim }]; trechos: [{ ini, dur, src }]; rosto: o rosto.json;
// fonte: { W, H } da fonte.mp4; janela: [x, y, largura, altura] no quadro 1080x1920; faixas: [{ y0, y1, x0, x1, de?, ate? }] do texto no
// quadro; foco: o "foco" do escolhas.json; desde: fim do gancho de capa (0 sem capa). Devolve { lista, avisos }, com cada
// item { de, ate, volta, fim, z, ox, oy }: cresce de "de" a "ate", segura, volta de "volta" a "fim"; centro (ox, oy) em px da janela.
// O rastro do rosto.json serve para esta fonte.mp4 ({ W, H })? null se serve; se não, o motivo
export function rastroInvalido(rosto, fonte) {
  const r = rosto?.rastro;
  if (!r?.caixas?.length) return "não há rastro do rosto (rode o rosto.mjs, passo 1b)";
  if (fonte.W !== (rosto.corte_x ? rosto.recorte?.[0] : r.W) || fonte.H !== r.H) return "o rastro do rosto é de outra fonte.mp4 (rode o rosto.mjs de novo, passo 1b)";
  return null;
}
// Caixa do rosto (centro x, centro y, largura, altura) em px da janela no instante t da edição, ou null: o rastro levado ao
// recorte da fonte.mp4 e ao enquadramento do molde (cover com o "foco"). Rastro conferido antes com rastroInvalido.
export function rostoNaJanela(rosto, fonte, [, , bw, bh], foco, trechos) {
  const r = rosto.rastro, corte = rosto.corte_x, s = Math.max(bw / fonte.W, bh / fonte.H), [fx, fy] = foco.split(" ").map((v) => parseFloat(v) / 100);
  const dx = (fonte.W * s - bw) * fx, dy = (fonte.H * s - bh) * fy;
  return (t) => {
    const p = trechos.find((x) => t >= x.ini && t < x.ini + x.dur);
    if (!p) return null;
    const i = Math.min(r.caixas.length - 1, Math.max(0, Math.round((p.src + t - p.ini) * r.qps))), c = r.caixas[i];
    return c && [(c[0] - (corte?.[i] ?? 0)) * s - dx, c[1] * s - dy, c[2] * s, c[3] * s];
  };
}

export function planejarAproximacao({ frases, pal, trechos, total, rosto, fonte, janela, faixas = [], foco = "50% 40%", desde = 0 }) {
  const avisos = [], lista = [], ruim = rastroInvalido(rosto, fonte);
  if (ruim) return { lista, avisos: [`aproximar: ${ruim}; segue sem aproximar.`] };
  const [jx, jy, bw, bh] = janela, s = Math.max(bw / fonte.W, bh / fonte.H), teto = s > 1.5 ? ZOOM_AMPLIADO : ZOOM;
  const caixa = rostoNaJanela(rosto, fonte, janela, foco, trechos);
  const maximo = Math.max(1, Math.floor(total / A_CADA));
  let k = 0, livre = desde > 0 ? desde + 0.3 : 0;
  for (const frase of frases) {
    const w = String(frase).split(/\s+/).map(limpa).filter(Boolean);
    let j = k;
    while (w.length && j + w.length <= pal.length && !w.every((x, m) => limpa(pal[j + m].txt) === x)) j++;
    if (!w.length || j + w.length > pal.length) { avisos.push(`aproximar: "${frase}" não foi achada na fala, na ordem; ficou de fora.`); continue; }
    k = j + w.length;
    const de = +Math.max(0, pal[j].ini - 0.15).toFixed(3), ate = +(de + SOBE).toFixed(3);
    const volta = +Math.min(Math.max(ate, pal[k - 1].fim + 0.2), de + SOBE + SEGURA_MAX, total - DESCE).toFixed(3), fim = +(volta + DESCE).toFixed(3);
    const nao = (m) => avisos.push(`aproximar: "${frase}" ficou sem aproximação (${m}).`);
    if (lista.length >= maximo) { nao(`no máximo ${maximo} neste vídeo, uma a cada ${A_CADA} s`); continue; }
    if (de < livre) { nao(desde > 0 && de < desde + 0.3 ? "cai no gancho de capa" : `menos de ${INTERVALO} s depois da anterior`); continue; }
    if (volta <= ate) { nao("perto demais do fim do vídeo"); continue; }
    const amostras = [];
    for (let t = de; t <= fim; t += 0.2) amostras.push(caixa(t));
    const vistos = amostras.filter(Boolean), naTela = faixas.filter((f) => !(f.ate <= de) && !(f.de >= fim)); // faixa sem de e ate vale o vídeo inteiro
    if (vistos.length < 0.6 * amostras.length) { nao("o rosto não aparece bem nesse trecho"); continue; }
    // A cabeça em cada amostra: [esquerda, direita, topo (um quarto da altura acima da caixa, o cabelo), queixo], em px da janela
    const cabecas = vistos.map(([cx, cy, cw, ch]) => [cx - cw / 2, cx + cw / 2, cy - 0.75 * ch, cy + ch / 2]);
    // O rosto (só a caixa, a mesma regra da conferir.mjs) já está embaixo do texto: aproximar não conserta
    if (vistos.some(([cx, cy, cw, ch]) => naTela.some((f) => Math.min(cy + ch / 2 + jy, f.y1) - Math.max(cy - ch / 2 + jy, f.y0) >= 0.25 * ch
      && cx + cw / 2 + jx > f.x0 && cx - cw / 2 + jx < f.x1))) { nao("o rosto já está embaixo do texto"); continue; }
    // Com o centro (ox, oy) e a força z, nenhuma borda da cabeça sai mais da janela nem entra mais no texto do que sem aproximar
    const sobre = (e, d, a, b) => naTela.reduce((n, f) => n + (d + jx > f.x0 && e + jx < f.x1 ? Math.max(0, Math.min(b + jy, f.y1) - Math.max(a + jy, f.y0)) : 0), 0);
    const cabe = (z, ox, oy) => cabecas.every(([e1, d1, a1, b1]) => {
      const e = ox + z * (e1 - ox), d = ox + z * (d1 - ox), a = oy + z * (a1 - oy), b = oy + z * (b1 - oy);
      return e >= Math.min(0, e1) && d <= Math.max(bw, d1) && a >= Math.min(0, a1) && b <= Math.max(bh, b1) && sobre(e, d, a, b) <= sobre(e1, d1, a1, b1) + 0.5;
    });
    // O centro da aproximação: o meio do rosto; se ele não deixa aproximar o bastante (rosto perto da borda ou do texto),
    // a borda da cabeça que está perto (topo, queixo, um lado), que fica parada enquanto o resto cresce para o outro lado
    // (a borda mais extrema entre as amostras: ela é a que encosta primeiro)
    const med = (a) => [...a].sort((x, y) => x - y)[a.length >> 1], col = (k) => (k % 2 ? Math.max : Math.min)(...cabecas.map((c) => c[k]));
    const cx = med(vistos.map((c) => c[0])), cy = med(vistos.map((c) => c[1]));
    let z = 0, ox = cx, oy = cy;
    // O centro fica dentro da janela: fora dela, o vídeo aproximado deixaria uma faixa vazia na borda
    const dentro = ([x, y]) => [Math.min(bw, Math.max(0, x)), Math.min(bh, Math.max(0, y))];
    for (const [x, y] of [[cx, cy], [cx, col(2)], [cx, col(3)], [col(0), cy], [col(1), cy], [col(0), col(2)], [col(1), col(2)], [col(0), col(3)], [col(1), col(3)]].map(dentro)) {
      let t = teto;
      while (t >= ZOOM_MIN && t > z && !cabe(t, x, y)) t = +(t - 0.01).toFixed(2);
      if (t >= ZOOM_MIN && t > z) [z, ox, oy] = [t, x, y];
      if (z === teto) break;
    }
    if (!z) { nao("o rosto está perto da borda ou do texto e não cabe aproximar"); continue; }
    lista.push({ de, ate, volta, fim, z, ox: Math.round(ox), oy: Math.round(oy) });
    livre = fim + INTERVALO;
  }
  return { lista, avisos };
}

// Recorta a fonte-inteira.mp4 da pasta em fonte.mp4 (largura cw, altura H), com o x de cada amostra (qps por segundo)
// levado a cada quadro de 30 qps pela reta entre as amostras vizinhas. Devolve false se o ffmpeg falhar.
export function recortar(pasta, x, qps, cw, H, duracao, avisar = () => {}) {
  const n = Math.round(duracao * F), linhas = [];
  for (let q = 0; q < n; q++) {
    const p = Math.min(x.length - 1, (q / F) * qps), a = Math.floor(p), b = Math.min(a + 1, x.length - 1);
    linhas.push(`${(q / F).toFixed(4)} crop x ${Math.round(x[a] + (x[b] - x[a]) * (p - a))};`);
  }
  writeFileSync(join(pasta, "rosto-comandos.txt"), linhas.join("\n") + "\n");
  // Arquivo de comandos pelo nome, com a pasta do vídeo como pasta atual: caminho com espaço ou "C:" quebraria o filtro
  const r = spawnSync(ffmpeg(), ["-v", "error", "-y", "-i", "fonte-inteira.mp4", "-vf", `sendcmd=f=rosto-comandos.txt,crop=w=${cw}:h=${H}:x=${x[0]}:y=0`,
    "-r", String(F), "-c:v", "libx264", "-crf", "18", "-g", "30", "-keyint_min", "30", "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", "fonte.mp4"],
    { cwd: pasta, encoding: "utf8", timeout: TEMPO_MAX, maxBuffer: 1 << 26 });
  rmSync(join(pasta, "rosto-comandos.txt"), { force: true });
  if (r.error || r.status !== 0) { avisar(`rosto: o recorte falhou (${String(r.error?.message ?? r.stderr).trim().split("\n").pop()}); segue com o foco fixo.`); return false; }
  return true;
}

// Volta a fonte inteira. O rastro do rosto fica no rosto.json (estado "desligado", sem recorte), para a aproximação no rosto
// continuar valendo com o enquadramento parado.
export function desligar(pasta) {
  const inteira = join(pasta, "fonte-inteira.mp4"), rel = join(pasta, "rosto.json");
  let antes = null;
  try { antes = JSON.parse(readFileSync(rel, "utf8")); } catch { /* sem rosto.json */ }
  if (existsSync(inteira)) renameSync(inteira, join(pasta, "fonte.mp4"));
  rmSync(rel, { force: true });
  if (antes?.rastro) writeFileSync(rel, JSON.stringify({ estado: "desligado", estilo: antes.estilo, janela: antes.janela, rastro: antes.rastro }));
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [pasta, estilo] = process.argv.slice(2);
  if (!pasta || !estilo) { console.error("Uso: node rosto.mjs <pasta do vídeo> <estilo>  ou  node rosto.mjs <pasta do vídeo> --desligar"); process.exit(1); }
  try {
    if (estilo === "--desligar") { desligar(resolve(pasta)); console.log("rosto: fonte inteira de volta; o molde usa o foco fixo do escolhas.json."); }
    else {
      const r = await reenquadrar(resolve(pasta), estilo, { avisar: (m) => console.error(m) });
      const msg = { seguindo: `o recorte segue o rosto (achado em ${r.achados} de ${r.amostras} amostras)`, parado: `o rosto quase não anda; recorte parado nele (achado em ${r.achados} de ${r.amostras} amostras)`,
        "sem rosto": `rosto achado em só ${r.achados} de ${r.amostras} amostras; segue com o foco fixo`, "sem sobra": "o vídeo já tem a proporção da janela; segue com o foco fixo",
        "sem detector": "sem detector; segue com o foco fixo", falhou: "o recorte falhou; segue com o foco fixo" }[r.estado];
      console.log(`rosto: ${msg}.`);
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
