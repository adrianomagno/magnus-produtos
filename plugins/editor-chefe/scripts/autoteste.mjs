// Autoteste do Editor Chefe: prova, neste computador, que tudo o que um vídeo usa funciona, sem arquivo nenhum do dono.
// Uso: node autoteste.mjs <pasta de teste> [--sem-render]    (rode com o prefixo eval do ambiente.sh)
//      node autoteste.mjs --conferir                          (diz se o autoteste já passou nesta versão do plugin)
// Monta na pasta um projeto sintético na Legenda viva, com os efeitos sonoros ligados (um da hyperframes e um CC0 do
// pacote, de sons/): original.mp4 de 2 s deitado (16:9,
// cor, tom e chiado, do ffmpeg), transcript.json e trechos.json escritos aqui, escolhas.json, marca.json de exemplo e a
// fonte baixada pelo baixar-fonte.mjs. No Mac, o vídeo leva um CPF de mentira na tela, desenhado na hora pelo próprio
// macOS: a conferência de dado pessoal (sigilo.mjs) precisa achá-lo pela leitura de texto da tela e a fonte precisa sair com
// ele borrado; fora do Mac ela confere só a fala e diz que a leitura da tela não está disponível. Passa pelos recursos da
// 0.6.0 e da 0.6.1: a fonte de trabalho com visual de cor
// forte e limpeza de ruído (fonte.mjs, cada visual de cor no ffmpeg e os fortes nas amostras de pele e de branco), o
// detector de rosto (rosto.mjs: sem rosto no vídeo sintético, o fluxo segue com o foco fixo), o recorte vertical que segue
// um caminho dado e a aproximação no rosto, num rastro de rosto de mentira junto com esse caminho. Roda o montar.mjs e, sem --sem-render, o
// render da HyperFrames pelo hf (o mesmo lançador do fluxo normal) e a conferência automática (conferir.mjs: 1080x1920,
// duração, áudio perto de -16 LUFS). No sucesso, grava <pasta de dados>/pronto com a versão do plugin e a data. A pasta de teste precisa ser nova: o autoteste recusa pasta que já existe e, no fim, com sucesso
// ou com erro, apaga só a pasta que ele mesmo criou. Cada programa chamado para em 10 minutos.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { montar } from "./montar.mjs";
import { fonte, medirRuido, conferirForte, CORES } from "./fonte.mjs";
import { trajetoria, recortar, medidas } from "./rosto.mjs";
import { conferirDados, escolherBorrar, imagemComTexto, lerTela, procurar, resumo, telaDisponivel } from "./sigilo.mjs";

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

// tela: false faz o caminho de fora do Mac (só a fala, sem a leitura da tela) também num Mac. tempo: o máximo de cada
// programa chamado, em ms, ou { etapa: ms } só para as etapas dadas (as outras ficam com os 10 minutos)
export function autoteste(pasta, { render = true, baixarFonte = baixarDoGoogle, dados = dadosPadrao(), tempo = TEMPO, tela = telaDisponivel(), avisar = (m) => console.log(m) } = {}) {
  const ms = (etapa) => (typeof tempo === "number" ? tempo : tempo?.[etapa] ?? TEMPO);
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
  const ffmpeg = process.env.HYPERFRAMES_FFMPEG_PATH ?? "ffmpeg", ffprobe = process.env.HYPERFRAMES_FFPROBE_PATH ?? "ffprobe", mac = tela;
  // No Mac em que o desenho ou a leitura de texto do sistema não roda (macOS antigo), segue conferindo só a fala, como fora do Mac
  let comCpf = false, telaLida = false, semTela = "";
  try {
    if (render) rmSync(join(dados, "pronto"), { force: true }); // "pronto" só existe enquanto o último teste completo passou
    etapa("projeto", () => {
      // No Mac, o CPF de mentira na tela, o vídeo inteiro
      if (mac) try { imagemComTexto(join(pasta, "cpf.png"), 1920, 1080, "CPF 123.456.789-09", { x: 0.1, y: 0.1, tamanho: 0.05 }); comCpf = true; } catch (e) { semTela = e.message; }
      const r = rodar(ffmpeg, ["-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0x1f4e5f:s=1920x1080:r=30:d=2", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=2",
        "-f", "lavfi", "-i", "anoisesrc=color=pink:amplitude=0.01:r=48000:d=2", ...(comCpf ? ["-i", join(pasta, "cpf.png")] : []),
        "-filter_complex", `[1:a][2:a]amix=inputs=2:normalize=0[a]${comCpf ? ";[0:v][3:v]overlay[v]" : ""}`, "-map", comCpf ? "[v]" : "0:v", "-map", "[a]",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-g", "30", "-c:a", "aac", "-shortest", join(pasta, "original.mp4")], ms("projeto"));
      if (r.status !== 0) throw new Error(`o ffmpeg não gerou o vídeo de teste.\n${ultimas(r.stderr || r.error?.message)}`);
      // Fala de 2 frases com uma pausa entre elas, cortada pelos 2 trechos: o whoosh de começo de frase toca duas vezes
      const fala = [["Teste", 0.1, 0.35], ["do", 0.38, 0.48], ["Editor", 0.5, 0.72], ["Chefe.", 0.74, 0.9], ["Tudo", 1.1, 1.4], ["certo.", 1.45, 1.85]];
      writeFileSync(join(pasta, "transcript.json"), JSON.stringify(fala.map(([text, start, end]) => ({ text, start, end }))));
      writeFileSync(join(pasta, "trechos.json"), JSON.stringify({ limiar: -30, duracao: 2, manter: [[0, 0.95], [1.05, 2]] }));
      // A marca fica dentro da pasta de teste: o padrão do montar (../marca.json) seria a marca do dono
      writeFileSync(join(pasta, "marca.json"), JSON.stringify({ nome: "Negócio Exemplo", assinatura: "Negócio Exemplo",
        cores: { fundo_claro: "#F5F1EA", fundo_escuro: "#141414", texto: "#141414", destaque: "#9A6A5A" }, fontes: { titulo: "Montserrat", corpo: "Inter" } }));
      writeFileSync(join(pasta, "escolhas.json"), JSON.stringify({ estilo: "legenda-viva", foco: "50% 40%", efeitos: true, marca: "marca.json", aproximar: ["Teste do Editor"] }));
    });
    avisar("autoteste: projeto de teste criado (vídeo de 2 s, fala, trechos e marca)");
    etapa("dado pessoal", () => {
      const r = conferirDados(pasta, { tela: mac }), cpf = r.itens.find((i) => i.tipo === "CPF");
      if (r.fala.length) throw new Error(`a conferência da fala alarmou sem dado nenhum na fala.\n${resumo(r)}`);
      if (!comCpf) return;
      if (!r.tela.lida) { semTela = r.tela.motivo; return; }
      if (!cpf) throw new Error(`a leitura da tela não achou o CPF de teste.\n${resumo(r)}`);
      escolherBorrar(pasta, [cpf.n]); // a fonte do próximo passo sai com o CPF borrado
      telaLida = true;
    });
    avisar(telaLida ? "autoteste: dado pessoal: a leitura da tela achou o CPF de teste; a fala foi conferida"
      : mac ? `autoteste: dado pessoal: a fala foi conferida; a leitura da tela não rodou neste Mac (${semTela}), o Editor Chefe confere só a fala`
      : "autoteste: dado pessoal: a fala foi conferida; a leitura da tela não está disponível neste computador (só no Mac)");
    etapa("cor e ruído", () => {
      for (const [nome, filtro] of Object.entries(CORES)) {
        const r = rodar(ffmpeg, ["-v", "error", "-f", "lavfi", "-i", "testsrc2=s=320x240:d=0.1", "-vf", filtro, "-f", "null", "-"], ms("cor e ruído"));
        if (r.status !== 0) throw new Error(`o visual de cor "${nome}" não roda no ffmpeg deste computador.\n${ultimas(r.stderr)}`);
      }
      // Os visuais fortes, nas amostras de pele e de branco: a pele não muda de tom nem fica laranja, o branco não estoura
      for (const nome of Object.keys(CORES).filter((n) => n.endsWith("-forte"))) {
        const ruim = conferirForte(nome);
        if (ruim.length) throw new Error(`o visual "${nome}" não passou: ${ruim.join("; ")}.`);
      }
      const m = medirRuido(join(pasta, "original.mp4"));
      if (!Number.isFinite(m.distancia_db)) throw new Error("a medida do ruído de fundo não saiu.");
      fonte(join(pasta, "original.mp4"), { cor: "quente-forte", ruido: true });
    });
    avisar(`autoteste: fonte de trabalho com visual de cor forte e limpeza de ruído (${Object.keys(CORES).length} visuais conferidos)`);
    if (telaLida) {
      etapa("borrão", () => {
        const q = join(pasta, "quadro-borrado.png"), r = rodar(ffmpeg, ["-v", "error", "-y", "-ss", "0.5", "-i", join(pasta, "fonte.mp4"), "-frames:v", "1", q], ms("borrão"));
        if (r.status !== 0) throw new Error(`o ffmpeg não tirou o quadro da fonte.\n${ultimas(r.stderr)}`);
        const lido = lerTela([q])[0].map((l) => l.texto).join(" ");
        if (procurar(lido).length) throw new Error(`o CPF de teste ainda se lê na fonte.mp4 depois do borrão ("${lido}").`);
      });
      avisar("autoteste: borrão ok (o CPF de teste não se lê mais na fonte)");
    }
    etapa("rosto", () => {
      // O detector de verdade, pelo mesmo comando do fluxo: no vídeo sintético não há rosto e a fonte fica inteira
      const r = rodar(process.execPath, [join(RAIZ, "scripts", "rosto.mjs"), pasta, "legenda-viva"], ms("rosto"), { env: { ...process.env, EDITOR_CHEFE_DATA: dados ?? "" } });
      const estado = existsSync(join(pasta, "rosto.json")) ? JSON.parse(readFileSync(join(pasta, "rosto.json"), "utf8")).estado : null;
      if (r.status !== 0 || estado !== "sem rosto") throw new Error(estado === "sem detector" ? "o detector de rosto não está na pasta de dados; rode o preparar.sh de novo." : `o detector de rosto não rodou (${estado ?? "sem resultado"}).\n${ultimas(`${r.stdout}\n${r.stderr}`)}`);
      // O recorte que acompanha um caminho: o rosto de mentira anda da esquerda para a direita
      const { W, H, duracao } = medidas(join(pasta, "fonte-inteira.mp4")), cw = Math.round((H * 9) / 16 / 2) * 2;
      const t = trajetoria(Array.from({ length: 10 }, (_, i) => 500 + i * 100), W, cw);
      if (t.parado || !recortar(pasta, t.x, 5, cw, H, duracao)) throw new Error("o recorte que segue o rosto não saiu.");
      const v = medidas(join(pasta, "fonte.mp4"));
      if (v.W !== cw || v.H !== H) throw new Error(`o recorte saiu com ${v.W}x${v.H}, e não em ${cw}x${H}.`);
      // O rastro do rosto de mentira, junto com o recorte, para a montagem aproximar no rosto em "Teste do Editor"
      writeFileSync(join(pasta, "rosto.json"), JSON.stringify({ estado: "seguindo", estilo: "legenda-viva", recorte: [cw, H], corte_x: t.x,
        rastro: { qps: 5, W, H, caixas: t.x.map((x) => [x + cw / 2, Math.round(H * 0.42), Math.round(H * 0.19), Math.round(H * 0.23)]) } })); // o rosto no meio do recorte
    });
    avisar("autoteste: detector de rosto e recorte que segue o rosto ok");
    etapa("fonte", () => baixarFonte("Montserrat", "800", join(pasta, "fonts"), ms("fonte")));
    avisar("autoteste: fonte baixada");
    const montagem = etapa("montagem", () => {
      const avisos = [], r = montar(pasta, (m) => avisos.push(m));
      if (avisos.length) throw new Error(avisos.join("\n"));
      if (!(r.efeitos > 0)) throw new Error("os efeitos sonoros não entraram na montagem.");
      // A segunda frase da fala de teste reveza para um whoosh do pacote (sons/, CC0), que o render precisa tocar
      const sons = JSON.parse(readFileSync(join(RAIZ, "sons", "manifest.json"), "utf8"));
      if (!r.sons.some((s) => sons[s].origem !== "hyperframes")) throw new Error("nenhum som CC0 do pacote (pasta sons/) entrou na montagem.");
      if (r.aproximacoes !== 1) throw new Error("a aproximação no rosto não entrou na montagem.");
      return r;
    });
    avisar(`autoteste: montagem ok (${montagem.trechos} trechos, ${montagem.efeitos} efeitos sonoros: ${montagem.sons.join(", ")}; ${montagem.aproximacoes} aproximação no rosto)`);
    if (!render) { avisar("AUTOTESTE SEM RENDER OK"); return { montagem }; }
    etapa("render", () => {
      // O render vai pelo próprio hf, que acha a HyperFrames (HYPERFRAMES_PLUGIN_ROOT ou o cache de plugins) como no fluxo normal
      const r = rodar("bash", [join(RAIZ, "scripts", "hf").replace(/\\/g, "/"), "render", ".", "-o", "autoteste.mp4"], ms("render"), { cwd: pasta });
      if (r.status !== 0 || !existsSync(join(pasta, "autoteste.mp4"))) throw new Error(`a HyperFrames não renderizou o vídeo de teste.\n${ultimas(`${r.stdout ?? ""}\n${r.stderr ?? ""}\n${r.error?.message ?? ""}`)}`);
    });
    avisar("autoteste: render ok");
    etapa("conferência", () => {
      const r = rodar(process.execPath, [join(RAIZ, "scripts", "conferir.mjs"), pasta, join(pasta, "autoteste.mp4")], ms("conferência"), { env: { ...process.env, EDITOR_CHEFE_DATA: dados } });
      if (r.status !== 0) throw new Error(`o vídeo de teste não passou na conferência.\n${ultimas(`${r.stdout}\n${r.stderr}`)}`);
    });
    avisar("autoteste: conferência ok (1080x1920, duração, áudio perto de -16 LUFS)");
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
