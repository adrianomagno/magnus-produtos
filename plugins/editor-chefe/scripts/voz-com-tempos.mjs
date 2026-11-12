// Motion narrado: a voz do roteiro e o tempo de cada palavra.
// Uso: node voz-com-tempos.mjs <pasta do vídeo> [marca.json] [--confirmado] [--elevenlabs]
// Lê <pasta>/roteiro.txt (o texto aprovado pelo dono) e a voz do marca.json (padrão ../marca.json): voz.ultravoice_perfil
// (o UltraVoice, nosso caminho sem custo, no computador do dono) e/ou voz.elevenlabs_voice_id (o caminho pago); voz.ritmo
// é opcional. Com o perfil do UltraVoice e o app respondendo, a voz sai dele; sem o perfil, sai da ElevenLabs; --elevenlabs
// força a ElevenLabs. Grava audio/voz.wav (48 kHz, acelerada de 1,00 a 1,10x pelo ritmo) e words.json, e guarda a voz crua
// (audio/voz-crua.mp3 da ElevenLabs ou audio/voz-crua.wav do UltraVoice).
// Os dois caminhos passam o texto pelo mesmo dicionário de pronúncia (pronuncia.txt) antes de gerar; o words.json fica com
// as palavras do roteiro. O tempo de cada palavra: na ElevenLabs, do alinhamento do próprio texto (endpoint with-timestamps,
// modelo eleven_v3); no UltraVoice, que não devolve tempos, da transcrição da voz gerada (a mesma do hf transcribe que legenda
// os vídeos gravados) alinhada com o texto, palavra por palavra.
// Antes de gerar, procura no roteiro o que parece dado pessoal (a mesma procura do sigilo.mjs) e para, se achar, até o
// dono confirmar (--confirmado) ou tirar.
// A chave da ElevenLabs: variável ELEVENLABS_API_KEY ou o arquivo chave-elevenlabs na pasta de dados do Editor Chefe (600).
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, chmodSync, realpathSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { naFala } from "./sigilo.mjs";

export const RITMO = 2.54; // palavras por segundo do Reel de referência, já acelerado
export const ARQUIVO_CHAVE = "chave-elevenlabs";
export const ULTRAVOICE = "http://127.0.0.1:3900"; // API local do VoiceStudio (o app do UltraVoice)
const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const MIN_IGUAIS = 0.7; // abaixo disso a voz do UltraVoice não disse o roteiro: melhor gerar de novo do que legendar errado
const MAX_PALAVRAS = 100; // bem acima dos 70 de um Reel de 30 s: protege os créditos de um arquivo errado
const AJUSTES = { stability: 0.5, similarity_boost: 0.85, style: 0.4, use_speaker_boost: true };

export function lerTexto(pasta) {
  const arq = join(pasta, "roteiro.txt");
  if (!existsSync(arq)) throw new Error(`voz-com-tempos: falta o roteiro.txt na pasta do vídeo (${arq}). Salve nele o texto aprovado pelo dono.`);
  return readFileSync(arq, "utf8").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).join(" ").replace(/\s+/g, " ");
}

// Letras do alinhamento viram palavras (o espaço separa); a pontuação fica grudada na palavra, como no roteiro.
export function palavras(a) {
  const out = [];
  let atual = null;
  a.characters.forEach((c, i) => {
    const ini = a.character_start_times_seconds[i], fim = a.character_end_times_seconds[i];
    if (/\s/.test(c)) { if (atual) out.push(atual); atual = null; }
    else if (!atual) atual = { text: c, start: ini, end: fim };
    else { atual.text += c; atual.end = fim; }
  });
  if (atual) out.push(atual);
  return out;
}

// A voz crua varia de take para take: acelera até o ritmo-alvo, de 1,00 a 1,10x (mais que isso soa apressado).
export function aceleracao(pal, ritmo = RITMO) {
  const cru = pal.length / pal[pal.length - 1].end;
  return { cru, fator: +Math.min(1.1, Math.max(1, ritmo / cru)).toFixed(3) };
}

export function conferir(pal, texto) {
  const esperado = texto.split(/\s+/).filter(Boolean);
  const n = Math.max(esperado.length, pal.length);
  for (let i = 0; i < n; i++)
    if (pal[i]?.text !== esperado[i])
      throw new Error(`voz-com-tempos: as palavras da voz não batem com o roteiro na palavra ${i + 1} (roteiro: "${esperado[i] ?? "(fim)"}", voz: "${pal[i]?.text ?? "(fim)"}"). Número com algarismo, sigla e símbolo podem virar outra grafia na voz: escreva por extenso no roteiro.txt e rode de novo.`);
}

export function lerChave(env = process.env) {
  if (env.ELEVENLABS_API_KEY?.trim()) return env.ELEVENLABS_API_KEY.trim();
  const dados = env.EDITOR_CHEFE_DATA || env.CLAUDE_PLUGIN_DATA;
  const arq = dados && join(dados, ARQUIVO_CHAVE);
  if (!arq || !existsSync(arq))
    throw new Error('voz-com-tempos: falta a chave da ElevenLabs neste computador. Peça ao dono para guardar a chave com o comando de references/marca.md (seção "Voz"), no Terminal dele; a chave nunca vai na conversa.');
  if (process.platform !== "win32" && statSync(arq).mode & 0o077) {
    chmodSync(arq, 0o600);
    console.error("voz-com-tempos: o arquivo da chave podia ser lido por outros usuários do computador; agora só o dono lê (permissão 600).");
  }
  const chave = readFileSync(arq, "utf8").trim();
  if (!chave) throw new Error('voz-com-tempos: o arquivo da chave está vazio. Peça ao dono para guardar a chave de novo (references/marca.md, seção "Voz").');
  return chave;
}

function lerVoz(arqMarca) {
  if (!existsSync(arqMarca)) throw new Error(`voz-com-tempos: falta o marca.json (${arqMarca}).`);
  const { voz } = JSON.parse(readFileSync(arqMarca, "utf8"));
  const ritmo = voz?.ritmo ?? RITMO;
  if (typeof ritmo !== "number" || !(ritmo >= 1.5 && ritmo <= 4)) throw new Error("voz-com-tempos: voz.ritmo do marca.json é um número de palavras por segundo, de 1,5 a 4 (padrão 2,54).");
  const perfil = voz?.ultravoice_perfil;
  if (perfil !== undefined && (typeof perfil !== "string" || !/^[A-Za-z0-9_-]+$/.test(perfil)))
    throw new Error('voz-com-tempos: voz.ultravoice_perfil do marca.json é o id do perfil aprovado no UltraVoice (letras, números, "-" e "_"), como manda references/marca.md (seção "Voz").');
  const id = typeof voz?.elevenlabs_voice_id === "string" && /^[A-Za-z0-9]+$/.test(voz.elevenlabs_voice_id) ? voz.elevenlabs_voice_id : null;
  return { id, perfil, ritmo };
}

// Qual voz usar: o UltraVoice quando o dono tem um perfil aprovado nele (padrão, sem custo); senão a ElevenLabs; sem nenhum
// dos dois, para e pede um. Perfil no marca.json com o app fechado também para: trocar sozinho para a ElevenLabs gastaria
// créditos que o dono não esperava.
export async function escolherVoz(voz, { fetch = globalThis.fetch, elevenlabs = false } = {}) {
  if (elevenlabs) {
    if (!voz.id) throw new Error('voz-com-tempos: pediram a ElevenLabs, mas o marca.json não tem "voz": { "elevenlabs_voice_id": "<id da voz na ElevenLabs>" } (references/marca.md, seção "Voz").');
    return "elevenlabs";
  }
  if (voz.perfil) {
    let ok = false;
    try { const h = await fetch(`${ULTRAVOICE}/health`, { signal: AbortSignal.timeout(10000) }); ok = h.ok && (await h.text()).includes('"ok"'); } catch { /* fechado */ }
    if (!ok) throw new Error(`voz-com-tempos: o marca.json pede a voz do UltraVoice, mas ele não respondeu em ${ULTRAVOICE}. Abra o app VoiceStudio (no Mac: open -g /Applications/VoiceStudio.app), espere um minuto e rode de novo.${voz.id ? " Para gerar desta vez pela ElevenLabs, que gasta créditos da conta do dono, pergunte a ele e, com o sim, rode com --elevenlabs." : ""}`);
    const p = await fetch(`${ULTRAVOICE}/profiles/${voz.perfil}`, { signal: AbortSignal.timeout(10000) });
    if (p.status === 404) throw new Error(`voz-com-tempos: o perfil "${voz.perfil}" não existe no UltraVoice deste computador. Confira voz.ultravoice_perfil no marca.json (o id da voz aprovada pelo dono).`);
    if (!p.ok) throw new Error(`voz-com-tempos: o UltraVoice não leu o perfil "${voz.perfil}" (HTTP ${p.status}).`);
    return "ultravoice";
  }
  if (voz.id) return "elevenlabs";
  throw new Error('voz-com-tempos: o marca.json não tem a voz. Ponha "voz": { "ultravoice_perfil": "<id do perfil aprovado no UltraVoice>" } (o nosso caminho, sem custo, no computador do dono) ou "voz": { "elevenlabs_voice_id": "<id da voz na ElevenLabs>" } (pago, pela conta do dono), como manda references/marca.md (seção "Voz"). Se o dono ainda não tem o UltraVoice e quer a voz sem custo: https://ultracerebro.com.br/ultravoice/ (o Magnus dele conduz a instalação).');
}

// Dicionário de pronúncia (pronuncia.txt): o texto que a voz recebe. O roteiro e a legenda ficam como o dono escreveu.
export function lerPronuncia(arq = join(RAIZ, "scripts", "pronuncia.txt")) {
  return readFileSync(arq, "utf8").split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("#")).map((l) => {
    const [de, para] = l.split(" => ");
    return [new RegExp(de, "gu"), para];
  });
}
export const pronunciar = (texto, regras = lerPronuncia()) => regras.reduce((t, [de, para]) => t.replace(de, para), texto);

// Dá a cada palavra de `alvo` (texto) o tempo das `ouvidas` ({ text, start, end }). As iguais (sem acento, caixa e
// pontuação) casam pela maior sequência comum; cada trecho diferente entre duas iguais (palavra trocada, troca do
// dicionário) leva o tempo do trecho ouvido no mesmo lugar, repartido pelo tamanho das palavras. Palavra que a transcrição
// pulou fica no vão entre as vizinhas; palavra a mais na transcrição vai junto com a igual seguinte.
const norma = (w) => w.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
export function alinhar(alvo, ouvidas) {
  const a = alvo.map(norma), b = ouvidas.map((w) => norma(w.text)), n = a.length, m = b.length;
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] && a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const pares = [];
  for (let i = 0, j = 0; i < n && j < m;) {
    if (a[i] && a[i] === b[j]) pares.push([i++, j++]);
    else if (L[i + 1][j] >= L[i][j + 1]) i++;
    else j++;
  }
  const out = [], trocas = [];
  let pi = 0, pj = 0;
  for (const [ci, cj] of [...pares, [n, m]]) {
    if (ci > pi || cj > pj) trocas.push({ roteiro: alvo.slice(pi, ci).join(" "), ouvido: ouvidas.slice(pj, cj).map((w) => w.text).join(" ") });
    if (ci > pi) {
      const s = cj > pj ? ouvidas[pj].start : pj ? ouvidas[pj - 1].end : 0;
      const e = cj > pj ? ouvidas[cj - 1].end : cj < m ? ouvidas[cj].start : s + 0.3 * (ci - pi);
      const pesos = alvo.slice(pi, ci).map((w) => Math.max(1, norma(w).length)), total = pesos.reduce((x, y) => x + y, 0);
      let t = s;
      pesos.forEach((p, k) => { const d = (Math.max(e, s) - s) * p / total; out.push({ text: alvo[pi + k], start: +t.toFixed(3), end: +(t + d).toFixed(3) }); t += d; });
    }
    // palavra ouvida a mais logo antes de uma igual vai junto com ela ("Ei Ai" falado no lugar de "A.I." começa no "Ei")
    if (ci < n) out.push({ text: alvo[ci], start: ci === pi && cj > pj ? ouvidas[pj].start : ouvidas[cj].start, end: ouvidas[cj].end });
    pi = ci + 1; pj = cj + 1;
  }
  out.forEach((w, i) => { if (i && w.start < out[i - 1].start) w.start = out[i - 1].start; if (w.end < w.start) w.end = w.start; });
  return { palavras: out, trocas, iguais: pares.length };
}

// A transcrição da voz gerada, pela mesma CLI que legenda os vídeos gravados: Parakeet e, se ele não rodar, Whisper small.
export function transcreverHf(arq, env = process.env) {
  const dir = dirname(arq), saida = join(dir, "transcript.json");
  for (const motor of [["--engine", "parakeet"], ["--engine", "whisper", "--model", "small"]]) {
    rmSync(saida, { force: true });
    const r = spawnSync("bash", [join(RAIZ, "scripts", "hf"), "transcribe", arq, "-d", dir, ...motor, "--language", "pt"], { encoding: "utf8", env, timeout: 900000 });
    if (r.status === 0 && existsSync(saida)) { const w = JSON.parse(readFileSync(saida, "utf8")); rmSync(saida); return w; } // fica só o transcricao.json
  }
  throw new Error('voz-com-tempos: não consegui transcrever a voz gerada para achar o tempo de cada palavra. Rode "hf models install parakeet" (references/audio-e-corte.md, passo 2) e rode de novo.');
}

// O que parece dado pessoal no roteiro: CPF, CNPJ, telefone e e-mail (também ditos em pedaços) e nomes possíveis de pessoa,
// a mesma procura do sigilo.mjs. O nome do negócio e os aplicativos do banco de peças não contam como pessoa.
const APPS = Object.values(JSON.parse(readFileSync(join(fileURLToPath(new URL("..", import.meta.url)), "pecas", "manifest.json"), "utf8")).apps).flatMap((a) => a.palavras);
export function dadosNoRoteiro(texto, negocio = []) {
  const r = naFala(texto.split(" ").map((text, i) => ({ text, start: i, end: i + 0.5 })));
  const fora = new Set([...negocio, ...APPS].flatMap((n) => String(n).toLowerCase().split(/[^\p{L}\p{N}]+/u)).filter(Boolean));
  const nomes = r.nomes.map((x) => x.nome).filter((n) => !n.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean).every((w) => fora.has(w)));
  return [...r.achados.map((a) => `${a.tipo} ${a.valor}`), ...nomes.map((n) => `nome possível "${n}"`)];
}

const DICA = { 401: "A chave não vale ou faltam créditos na conta da ElevenLabs.", 404: "A voz não existe nesta conta: confira voz.elevenlabs_voice_id no marca.json." };

// ElevenLabs: o alinhamento por letra do próprio texto enviado. Devolve as palavras faladas com o tempo da voz crua.
async function gerarElevenLabs(falado, voz, pasta, { env, fetch }) {
  const chave = lerChave(env);
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voz.id}/with-timestamps?output_format=mp3_44100_128`;
  const corpo = JSON.stringify({ text: falado, model_id: "eleven_v3", voice_settings: AJUSTES });
  let r;
  try { r = await fetch(url, { method: "POST", headers: { "xi-api-key": chave, "Content-Type": "application/json" }, body: corpo, signal: AbortSignal.timeout(300000) }); }
  catch (e) { throw new Error(`voz-com-tempos: não consegui falar com a ElevenLabs (${e.name === "TimeoutError" ? "passou de 5 minutos" : e.message}). Confira a internet e rode de novo.`); }
  if (!r.ok) {
    const msg = (await r.text()).split(chave).join("***").slice(0, 400); // a resposta nunca devolve a chave para a tela
    throw new Error(`voz-com-tempos: a ElevenLabs recusou o pedido (HTTP ${r.status}): ${msg} ${DICA[r.status] ?? ""}`.trim());
  }
  const res = await r.json(), a = res.alignment ?? res.normalized_alignment, crua = join(pasta, "audio", "voz-crua.mp3");
  writeFileSync(crua, Buffer.from(res.audio_base64, "base64"));
  writeFileSync(join(pasta, "audio", "alinhamento-caracteres.json"), JSON.stringify(a));
  const pal = palavras(a);
  conferir(pal, falado);
  return { crua, pal, trocas: [] };
}

// UltraVoice (VoiceStudio local, motor OmniVoice, a mesma receita do fala.sh): o áudio vem sem tempos, então a voz gerada
// é transcrita e alinhada com o texto enviado.
async function gerarUltraVoice(falado, voz, pasta, { env, fetch, transcrever }) {
  const corpo = new FormData();
  for (const [k, v] of Object.entries({ text: falado, profile_id: voz.perfil, language: "Portuguese", engine: "omnivoice", seed: "23", speed: "1.0", effect_preset: "raw" })) corpo.append(k, v);
  let r;
  try { r = await fetch(`${ULTRAVOICE}/generate`, { method: "POST", body: corpo, signal: AbortSignal.timeout(1200000) }); }
  catch (e) { throw new Error(`voz-com-tempos: o UltraVoice não gerou a voz (${e.name === "TimeoutError" ? "passou de 20 minutos" : e.message}). Confira se o app VoiceStudio está aberto e rode de novo.`); }
  const audio = Buffer.from(await r.arrayBuffer());
  if (!r.ok || audio.subarray(0, 4).toString("latin1") !== "RIFF")
    throw new Error(`voz-com-tempos: o UltraVoice recusou o pedido (HTTP ${r.status}): ${audio.subarray(0, 300).toString("utf8")}`);
  if (r.headers.get("x-omnivoice-dropped-chunks")) // o VoiceStudio avisa por cabeçalho quando um pedaço do texto saiu sem voz
    throw new Error(`voz-com-tempos: o UltraVoice gerou a voz sem um pedaço do texto (${r.headers.get("x-omnivoice-dropped-text") ?? "trecho não informado"}). Rode de novo; se repetir, encurte ou reescreva esse trecho.`);
  const crua = join(pasta, "audio", "voz-crua.wav");
  writeFileSync(crua, audio);
  const ouvidas = transcrever(crua, env);
  writeFileSync(join(pasta, "audio", "transcricao.json"), JSON.stringify(ouvidas, null, 1));
  const ditas = falado.split(" "), { palavras: pal, trocas, iguais } = alinhar(ditas, ouvidas);
  if (iguais < MIN_IGUAIS * ditas.length)
    throw new Error(`voz-com-tempos: a voz do UltraVoice não parece dizer o roteiro (a transcrição reconheceu ${iguais} de ${ditas.length} palavras). Ouça audio/voz-crua.wav: se a voz pulou ou trocou trechos, rode de novo; se uma palavra sai sempre errada, acrescente uma linha no dicionário de pronúncia (scripts/pronuncia.txt).`);
  return { crua, pal, trocas };
}

export async function vozComTempos(pasta, { marca = resolve(pasta, "..", "marca.json"), env = process.env, fetch = globalThis.fetch, confirmado = false, elevenlabs = false, transcrever = transcreverHf } = {}) {
  const texto = lerTexto(pasta), n = texto.split(" ").length;
  if (!texto) throw new Error("voz-com-tempos: o roteiro.txt está vazio.");
  if (n > MAX_PALAVRAS) throw new Error(`voz-com-tempos: o roteiro tem ${n} palavras; o Motion narrado é de 20 a 30 s (55 a 70 palavras). Encurte o texto.`);
  const voz = lerVoz(marca), caminho = await escolherVoz(voz, { fetch, elevenlabs });
  let negocio = [];
  try { const m = JSON.parse(readFileSync(marca, "utf8")); negocio = [m.nome, m.assinatura].filter(Boolean); } catch { /* o lerVoz já leu */ }
  const dados = dadosNoRoteiro(texto, negocio);
  const destino = caminho === "ultravoice" ? "o texto vira voz no UltraVoice, neste computador, e vai ao ar no Reel" : "o texto vai para a ElevenLabs virar voz";
  if (dados.length && !confirmado) throw new Error(`voz-com-tempos: o roteiro tem o que parece dado pessoal (${dados.join("; ")}), e ${destino}. Diga isso ao dono numa frase e espere: se ele tirar, salve o roteiro.txt novo e rode de novo; se ele confirmar que pode ir assim, rode com --confirmado.`);

  mkdirSync(join(pasta, "audio"), { recursive: true });
  const falado = pronunciar(texto);
  const g = await (caminho === "ultravoice" ? gerarUltraVoice : gerarElevenLabs)(falado, voz, pasta, { env, fetch, transcrever });
  // as palavras do roteiro (a legenda) com o tempo das faladas: "OAB" fica com o tempo de "Óabê", "A.I." com o de "Ei Ai"
  const pal = alinhar(texto.split(" "), g.pal).palavras, { cru, fator } = aceleracao(pal, voz.ritmo);
  const ff = spawnSync(env.HYPERFRAMES_FFMPEG_PATH ?? "ffmpeg", ["-v", "error", "-y", "-i", g.crua,
    "-filter:a", `atempo=${fator}`, "-ar", "48000", "-c:a", "pcm_s16le", join(pasta, "audio", "voz.wav")], { encoding: "utf8" });
  if (ff.error || ff.status !== 0) throw new Error(`voz-com-tempos: o ffmpeg não gravou a voz.wav (${(ff.error?.message ?? ff.stderr).trim()}).`);
  for (const p of pal) { p.start = +(p.start / fator).toFixed(3); p.end = +(p.end / fator).toFixed(3); } // tempo da voz já acelerada
  writeFileSync(join(pasta, "words.json"), JSON.stringify(pal, null, 1));
  return { caminho, palavras: pal.length, cru, fator, fim: pal[pal.length - 1].end, trocas: g.trocas };
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), [arg, arqMarca] = args.filter((a) => !a.startsWith("--"));
  if (!arg) { console.error("Uso: node voz-com-tempos.mjs <pasta do vídeo> [marca.json] [--confirmado] [--elevenlabs]"); process.exit(1); }
  const pasta = resolve(arg);
  vozComTempos(pasta, { ...(arqMarca ? { marca: resolve(arqMarca) } : {}), confirmado: args.includes("--confirmado"), elevenlabs: args.includes("--elevenlabs") }).then((r) => {
    console.log(`voz-com-tempos: voz ${r.caminho === "ultravoice" ? "do UltraVoice" : "da ElevenLabs"}; ritmo cru ${r.cru.toFixed(2)} palavras/s, acelerado ${r.fator}x; ${r.palavras} palavras, a última termina em ${r.fim} s.`);
    if (r.trocas.length) console.log(`voz-com-tempos: a transcrição ouviu diferente do roteiro em ${r.trocas.length} ${r.trocas.length > 1 ? "trechos" : "trecho"} (${r.trocas.slice(0, 6).map((t) => `"${t.roteiro || "(nada)"}" ouvido como "${t.ouvido || "(nada)"}"`).join("; ")}). O tempo veio da vizinhança; ouça esses trechos na prévia.`);
  }, (e) => { console.error(e.message); process.exit(1); });
}
