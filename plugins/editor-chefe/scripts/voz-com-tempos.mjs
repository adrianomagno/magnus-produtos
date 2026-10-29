// Motion narrado: a voz do roteiro e o tempo de cada palavra.
// Uso: node voz-com-tempos.mjs <pasta do vídeo> [marca.json] [--confirmado]
// Lê <pasta>/roteiro.txt (o texto aprovado pelo dono) e a voz do marca.json (padrão ../marca.json, campo
// voz.elevenlabs_voice_id; voz.ritmo é opcional). Grava audio/voz-crua.mp3, audio/alinhamento-caracteres.json,
// audio/voz.wav (48 kHz, acelerada de 1,00 a 1,10x pelo ritmo) e words.json.
// O tempo de cada palavra vem do alinhamento do próprio texto pela ElevenLabs (endpoint with-timestamps, modelo eleven_v3),
// então não há erro de transcrição; o script para se as palavras da voz não baterem com o roteiro.
// Antes de mandar o texto, procura nele o que parece dado pessoal (a mesma procura do sigilo.mjs) e para, se achar, até o
// dono confirmar (--confirmado) ou tirar.
// A chave: variável ELEVENLABS_API_KEY ou o arquivo chave-elevenlabs na pasta de dados do Editor Chefe (permissão 600).
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, chmodSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { naFala } from "./sigilo.mjs";

export const RITMO = 2.54; // palavras por segundo do Reel de referência, já acelerado
export const ARQUIVO_CHAVE = "chave-elevenlabs";
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
  if (typeof voz?.elevenlabs_voice_id !== "string" || !/^[A-Za-z0-9]+$/.test(voz.elevenlabs_voice_id))
    throw new Error('voz-com-tempos: o marca.json não tem a voz. Ponha "voz": { "elevenlabs_voice_id": "<id da voz na ElevenLabs>" }, como manda references/marca.md (seção "Voz").');
  const ritmo = voz.ritmo ?? RITMO;
  if (typeof ritmo !== "number" || !(ritmo >= 1.5 && ritmo <= 4)) throw new Error("voz-com-tempos: voz.ritmo do marca.json é um número de palavras por segundo, de 1,5 a 4 (padrão 2,54).");
  return { id: voz.elevenlabs_voice_id, ritmo };
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

export async function vozComTempos(pasta, { marca = resolve(pasta, "..", "marca.json"), env = process.env, fetch = globalThis.fetch, confirmado = false } = {}) {
  const texto = lerTexto(pasta), n = texto.split(" ").length;
  if (!texto) throw new Error("voz-com-tempos: o roteiro.txt está vazio.");
  if (n > MAX_PALAVRAS) throw new Error(`voz-com-tempos: o roteiro tem ${n} palavras; o Motion narrado é de 20 a 30 s (55 a 70 palavras). Encurte o texto.`);
  let negocio = [];
  try { const m = JSON.parse(readFileSync(marca, "utf8")); negocio = [m.nome, m.assinatura].filter(Boolean); } catch { /* o lerVoz diz o que falta */ }
  const dados = dadosNoRoteiro(texto, negocio);
  if (dados.length && !confirmado) throw new Error(`voz-com-tempos: o roteiro tem o que parece dado pessoal (${dados.join("; ")}), e o texto vai para a ElevenLabs virar voz. Diga isso ao dono numa frase e espere: se ele tirar, salve o roteiro.txt novo e rode de novo; se ele confirmar que pode ir assim, rode com --confirmado.`);
  const voz = lerVoz(marca), chave = lerChave(env);
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voz.id}/with-timestamps?output_format=mp3_44100_128`;
  const corpo = JSON.stringify({ text: texto, model_id: "eleven_v3", voice_settings: AJUSTES });
  let r;
  try { r = await fetch(url, { method: "POST", headers: { "xi-api-key": chave, "Content-Type": "application/json" }, body: corpo, signal: AbortSignal.timeout(300000) }); }
  catch (e) { throw new Error(`voz-com-tempos: não consegui falar com a ElevenLabs (${e.name === "TimeoutError" ? "passou de 5 minutos" : e.message}). Confira a internet e rode de novo.`); }
  if (!r.ok) {
    const msg = (await r.text()).split(chave).join("***").slice(0, 400); // a resposta nunca devolve a chave para a tela
    throw new Error(`voz-com-tempos: a ElevenLabs recusou o pedido (HTTP ${r.status}): ${msg} ${DICA[r.status] ?? ""}`.trim());
  }
  const res = await r.json(), a = res.alignment ?? res.normalized_alignment;
  mkdirSync(join(pasta, "audio"), { recursive: true });
  writeFileSync(join(pasta, "audio", "voz-crua.mp3"), Buffer.from(res.audio_base64, "base64"));
  writeFileSync(join(pasta, "audio", "alinhamento-caracteres.json"), JSON.stringify(a));

  const pal = palavras(a), { cru, fator } = aceleracao(pal, voz.ritmo);
  const ff = spawnSync(env.HYPERFRAMES_FFMPEG_PATH ?? "ffmpeg", ["-v", "error", "-y", "-i", join(pasta, "audio", "voz-crua.mp3"),
    "-filter:a", `atempo=${fator}`, "-ar", "48000", "-c:a", "pcm_s16le", join(pasta, "audio", "voz.wav")], { encoding: "utf8" });
  if (ff.error || ff.status !== 0) throw new Error(`voz-com-tempos: o ffmpeg não gravou a voz.wav (${(ff.error?.message ?? ff.stderr).trim()}).`);
  for (const p of pal) { p.start = +(p.start / fator).toFixed(3); p.end = +(p.end / fator).toFixed(3); } // tempo da voz já acelerada
  conferir(pal, texto);
  writeFileSync(join(pasta, "words.json"), JSON.stringify(pal, null, 1));
  return { palavras: pal.length, cru, fator, fim: pal[pal.length - 1].end };
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), [arg, arqMarca] = args.filter((a) => !a.startsWith("--"));
  if (!arg) { console.error("Uso: node voz-com-tempos.mjs <pasta do vídeo> [marca.json] [--confirmado]"); process.exit(1); }
  const pasta = resolve(arg);
  vozComTempos(pasta, { ...(arqMarca ? { marca: resolve(arqMarca) } : {}), confirmado: args.includes("--confirmado") }).then((r) => {
    console.log(`voz-com-tempos: ritmo cru ${r.cru.toFixed(2)} palavras/s, acelerado ${r.fator}x; ${r.palavras} palavras, a última termina em ${r.fim} s.`);
  }, (e) => { console.error(e.message); process.exit(1); });
}
