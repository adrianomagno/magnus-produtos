// Autoteste do Editor Chefe: prova, neste computador, que tudo o que um vídeo usa funciona, sem arquivo nenhum do dono.
// Uso: node autoteste.mjs <pasta de teste> [--sem-render]    (rode com o prefixo eval do ambiente.sh)
//      node autoteste.mjs --conferir                          (diz se o autoteste já passou nesta versão do plugin)
// Monta na pasta um projeto sintético na Legenda viva, com os efeitos sonoros ligados: fonte.mp4 de 2 s (cor e tom, do
// ffmpeg), transcript.json e trechos.json escritos aqui, escolhas.json, marca.json de exemplo e a fonte baixada pelo
// baixar-fonte.mjs. Roda o montar.mjs e, sem --sem-render, o render da HyperFrames pelo hf (o mesmo lançador do fluxo
// normal) e o ffprobe, que confere o MP4 em 1080x1920 com áudio. No sucesso, grava <pasta de dados>/pronto com a versão
// do plugin e a data. A pasta de teste precisa ser nova: o autoteste recusa pasta que já existe e, no fim, com sucesso
// ou com erro, apaga só a pasta que ele mesmo criou. Cada programa chamado para em 10 minutos.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { montar } from "./montar.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const VERSAO = JSON.parse(readFileSync(join(RAIZ, ".claude-plugin", "plugin.json"), "utf8")).version;
const TEMPO = 600000; // 10 minutos por programa chamado, o mesmo tempo máximo da ferramenta de terminal
const ultimas = (s, n = 10) => String(s ?? "").split(/\r?\n/).filter((l) => l.trim()).slice(-n).join("\n");
const dadosPadrao = () => process.env.EDITOR_CHEFE_DATA || process.env.CLAUDE_PLUGIN_DATA;

// spawnSync com o tempo máximo; o programa que passa dele é interrompido e vira erro da etapa
function rodar(cmd, args, tempo, opcoes = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 1 << 26, timeout: tempo, ...opcoes });
  if (r.error?.code === "ETIMEDOUT") throw new Error(`passou do tempo máximo de ${Math.round(tempo / 1000)} segundos e foi interrompido.`);
  return r;
}

function baixarDoGoogle(familia, pesos, pasta, tempo = TEMPO) {
  const r = rodar(process.execPath, [join(RAIZ, "scripts", "baixar-fonte.mjs"), familia, pesos, pasta], tempo);
  if (r.status !== 0) throw new Error(`não consegui baixar a fonte ${familia} do Google Fonts; confira a internet.\n${ultimas(r.stderr)}`);
}

export function estaPronto(dados = dadosPadrao()) {
  const arq = dados && join(dados, "pronto");
  return !!arq && existsSync(arq) && readFileSync(arq, "utf8").split(/\s+/)[0] === `versao=${VERSAO}`;
}

export function autoteste(pasta, { render = true, baixarFonte = baixarDoGoogle, dados = dadosPadrao(), tempo = TEMPO, avisar = (m) => console.log(m) } = {}) {
  if (render && !dados) throw new Error("autoteste: falta a pasta de dados do plugin. Rode com o prefixo eval do ambiente.sh, como manda a SKILL.");
  // A pasta de teste nasce aqui (mkdir sem recursive falha se ela já existe): só ela é apagada no fim
  mkdirSync(dirname(pasta), { recursive: true });
  try { mkdirSync(pasta); } catch (e) {
    if (e.code === "EEXIST") throw new Error(`autoteste: a pasta ${pasta} já existe; nada foi apagado. Apague essa pasta ou escolha outro caminho para o teste.`);
    throw new Error(`autoteste: não consegui criar a pasta de teste ${pasta} (${e.message}).`);
  }
  const etapa = (nome, fn) => {
    try { return fn(); } catch (e) { throw new Error(`autoteste falhou na etapa "${nome}": ${e.message}`); }
  };
  const ffmpeg = process.env.HYPERFRAMES_FFMPEG_PATH ?? "ffmpeg", ffprobe = process.env.HYPERFRAMES_FFPROBE_PATH ?? "ffprobe";
  try {
    if (render) rmSync(join(dados, "pronto"), { force: true }); // "pronto" só existe enquanto o último teste completo passou
    etapa("projeto", () => {
      const r = rodar(ffmpeg, ["-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0x1f4e5f:s=1080x1920:r=30:d=2", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=2",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-g", "30", "-c:a", "aac", "-shortest", join(pasta, "fonte.mp4")], tempo);
      if (r.status !== 0) throw new Error(`o ffmpeg não gerou o vídeo de teste.\n${ultimas(r.stderr || r.error?.message)}`);
      // Fala de 2 frases com uma pausa entre elas, cortada pelos 2 trechos: o whoosh de começo de frase toca duas vezes
      const fala = [["Teste", 0.1, 0.35], ["do", 0.38, 0.48], ["Editor", 0.5, 0.72], ["Chefe.", 0.74, 0.9], ["Tudo", 1.1, 1.4], ["certo.", 1.45, 1.85]];
      writeFileSync(join(pasta, "transcript.json"), JSON.stringify(fala.map(([text, start, end]) => ({ text, start, end }))));
      writeFileSync(join(pasta, "trechos.json"), JSON.stringify({ limiar: -30, duracao: 2, manter: [[0, 0.95], [1.05, 2]] }));
      // A marca fica dentro da pasta de teste: o padrão do montar (../marca.json) seria a marca do dono
      writeFileSync(join(pasta, "marca.json"), JSON.stringify({ nome: "Negócio Exemplo", assinatura: "Negócio Exemplo",
        cores: { fundo_claro: "#F5F1EA", fundo_escuro: "#141414", texto: "#141414", destaque: "#9A6A5A" }, fontes: { titulo: "Montserrat", corpo: "Inter" } }));
      writeFileSync(join(pasta, "escolhas.json"), JSON.stringify({ estilo: "legenda-viva", foco: "50% 40%", efeitos: true, marca: "marca.json" }));
    });
    avisar("autoteste: projeto de teste criado (vídeo de 2 s, fala, trechos e marca)");
    etapa("fonte", () => baixarFonte("Montserrat", "800", join(pasta, "fonts"), tempo));
    avisar("autoteste: fonte baixada");
    const montagem = etapa("montagem", () => {
      const avisos = [], r = montar(pasta, (m) => avisos.push(m));
      if (avisos.length) throw new Error(avisos.join("\n"));
      if (!(r.efeitos > 0)) throw new Error("os efeitos sonoros da HyperFrames não entraram na montagem.");
      return r;
    });
    avisar(`autoteste: montagem ok (${montagem.trechos} trechos, ${montagem.efeitos} efeitos sonoros)`);
    if (!render) { avisar("AUTOTESTE SEM RENDER OK"); return { montagem }; }
    etapa("render", () => {
      // O render vai pelo próprio hf, que acha a HyperFrames (HYPERFRAMES_PLUGIN_ROOT ou o cache de plugins) como no fluxo normal
      const r = rodar("bash", [join(RAIZ, "scripts", "hf").replace(/\\/g, "/"), "render", ".", "-o", "autoteste.mp4"], tempo, { cwd: pasta });
      if (r.status !== 0 || !existsSync(join(pasta, "autoteste.mp4"))) throw new Error(`a HyperFrames não renderizou o vídeo de teste.\n${ultimas(`${r.stdout ?? ""}\n${r.stderr ?? ""}\n${r.error?.message ?? ""}`)}`);
    });
    avisar("autoteste: render ok");
    etapa("conferência do MP4", () => {
      const r = rodar(ffprobe, ["-v", "error", "-show_entries", "stream=codec_type,width,height", "-of", "json", join(pasta, "autoteste.mp4")], tempo);
      const s = r.status === 0 ? JSON.parse(r.stdout).streams ?? [] : [], v = s.find((x) => x.codec_type === "video");
      if (!v || v.width !== 1080 || v.height !== 1920) throw new Error(`o vídeo de teste saiu com ${v ? `${v.width}x${v.height}` : "nenhuma imagem"}, e não em 1080x1920.\n${ultimas(r.stderr)}`);
      if (!s.some((x) => x.codec_type === "audio")) throw new Error("o vídeo de teste saiu sem áudio.");
    });
    avisar("autoteste: MP4 em 1080x1920 com áudio");
    mkdirSync(dados, { recursive: true });
    writeFileSync(join(dados, "pronto"), `versao=${VERSAO} data=${new Date().toISOString()}\n`);
    avisar("AUTOTESTE OK");
    return { montagem };
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), pasta = args.find((a) => !a.startsWith("--"));
  if (args.includes("--conferir")) {
    const ok = estaPronto();
    console.log(ok ? `Editor Chefe pronto nesta versão (${VERSAO}).` : `Falta preparar o Editor Chefe nesta versão (${VERSAO}): rode o Preparar da SKILL.`);
    process.exit(ok ? 0 : 1);
  }
  if (!pasta) { console.error("Uso: node autoteste.mjs <pasta de teste> [--sem-render]  ou  node autoteste.mjs --conferir"); process.exit(1); }
  try {
    autoteste(resolve(pasta), { render: !args.includes("--sem-render") });
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
