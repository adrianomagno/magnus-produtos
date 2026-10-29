// tests/voz.test.mjs: voz-com-tempos.mjs sem chamar a ElevenLabs (a resposta da API é montada aqui, com um áudio sintético).
// Precisa de ffmpeg e ffprobe no PATH (o prefixo do ambiente.sh resolve).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, statSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { palavras, aceleracao, conferir, lerChave, vozComTempos, RITMO, ARQUIVO_CHAVE } from '../plugins/editor-chefe/scripts/voz-com-tempos.mjs';

const raiz = mkdtempSync(join(tmpdir(), 'voz-'));
test.after(() => rmSync(raiz, { recursive: true, force: true }));
const ROTEIRO = 'Aqui na loja, todo cliente recebe resposta no mesmo dia.\nSe a dúvida chega de manhã,\n\na solução sai antes do almoço.\n';
const TEXTO = 'Aqui na loja, todo cliente recebe resposta no mesmo dia. Se a dúvida chega de manhã, a solução sai antes do almoço.';

// Alinhamento por letra como o da ElevenLabs, a partir de palavras com tempo (o espaço fica entre o fim de uma e o início da seguinte)
function alinhamento(ws) {
  const a = { characters: [], character_start_times_seconds: [], character_end_times_seconds: [] };
  ws.forEach(([txt, ini, fim], i) => {
    if (i) { a.characters.push(' '); a.character_start_times_seconds.push(ws[i - 1][2]); a.character_end_times_seconds.push(ini); }
    [...txt].forEach((c, k, l) => { a.characters.push(c); a.character_start_times_seconds.push(ini + ((fim - ini) * k) / l.length); a.character_end_times_seconds.push(ini + ((fim - ini) * (k + 1)) / l.length); });
  });
  return a;
}
// Voz crua sintética: passo entre palavras, que dá o ritmo pedido (palavras por segundo)
const exemplo = (ritmo, texto = TEXTO) => texto.split(' ').map((w, i) => [w, +(i / ritmo).toFixed(3), +((i + 0.8) / ritmo).toFixed(3)]);

function pasta(marca = { nome: 'Estúdio Exemplo', voz: { elevenlabs_voice_id: 'vozDeTeste123' } }, roteiro = ROTEIRO) {
  const base = mkdtempSync(join(raiz, 'caso-')), dir = join(base, 'video');
  mkdirSync(dir);
  writeFileSync(join(base, 'marca.json'), JSON.stringify(marca));
  writeFileSync(join(dir, 'roteiro.txt'), roteiro);
  return dir;
}
// fetch de mentira: guarda o pedido e devolve o áudio (um tom com a duração da fala) e o alinhamento
function api(ws, { status = 200, corpo } = {}) {
  const wav = join(raiz, `crua-${ws.length}-${ws.at(-1)[2]}.wav`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `sine=f=200:d=${ws.at(-1)[2] + 0.3}`, '-ar', '44100', wav]);
  const f = async (url, op) => {
    f.pedidos.push({ url, ...op, corpo: JSON.parse(op.body) });
    if (status !== 200) return new Response(corpo, { status });
    return new Response(JSON.stringify({ audio_base64: readFileSync(wav).toString('base64'), alignment: alinhamento(ws) }));
  };
  f.pedidos = [];
  return f;
}
const env = { ELEVENLABS_API_KEY: 'chave-de-teste-123', HYPERFRAMES_FFMPEG_PATH: process.env.HYPERFRAMES_FFMPEG_PATH ?? 'ffmpeg' };
const dur = (arq) => +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', arq], { encoding: 'utf8' });

test('letras do alinhamento viram palavras, com a pontuação grudada, como no roteiro', () => {
  const p = palavras(alinhamento([['Olá,', 0, 0.4], ['tudo', 0.5, 0.8], ['bem?', 0.85, 1.2]]));
  assert.deepEqual(p.map((w) => w.text), ['Olá,', 'tudo', 'bem?']);
  assert.deepEqual(p.map((w) => [w.start, w.end]), [[0, 0.4], [0.5, 0.8], [0.85, 1.2]]);
  // espaço duplo e espaço no fim não criam palavra vazia
  const a = alinhamento([['um', 0, 0.2], ['dois', 0.3, 0.6]]);
  a.characters.splice(2, 0, ' '); a.character_start_times_seconds.splice(2, 0, 0.2); a.character_end_times_seconds.splice(2, 0, 0.25);
  a.characters.push(' '); a.character_start_times_seconds.push(0.6); a.character_end_times_seconds.push(0.7);
  assert.deepEqual(palavras(a).map((w) => w.text), ['um', 'dois']);
});

test('aceleração pelo ritmo: de 1,00 a 1,10x, alvo de 2,54 palavras por segundo', () => {
  const ritmo = (r) => aceleracao(exemplo(r).map(([text, start, end]) => ({ text, start, end }))).fator;
  assert.equal(RITMO, 2.54);
  assert.equal(ritmo(2.0), 1.1); // voz lenta: no máximo 10% mais rápida
  assert.equal(ritmo(3.0), 1); // voz rápida: nunca desacelera
  const p = exemplo(2.4).map(([text, start, end]) => ({ text, start, end })), cru = p.length / p.at(-1).end;
  assert.equal(aceleracao(p).fator, +(2.54 / cru).toFixed(3)); // no meio: exatamente o que falta para o alvo
  assert.equal(aceleracao(p, 2.2).fator, 1); // voz.ritmo do marca.json muda o alvo
});

test('palavras da voz que não batem com o roteiro param, dizendo qual palavra', () => {
  const p = TEXTO.split(' ').map((text) => ({ text }));
  conferir(p, TEXTO);
  p[3].text = 'Todo';
  assert.throws(() => conferir(p, TEXTO), /na palavra 4 \(roteiro: "todo", voz: "Todo"\).*por extenso/);
  p[3].text = 'todo';
  assert.throws(() => conferir(p.slice(0, -1), TEXTO), /roteiro: "almoço\.", voz: "\(fim\)"/);
});

test('pedido à ElevenLabs: voz do marca.json, modelo eleven_v3, ajustes da receita, chave só no cabeçalho', async () => {
  const dir = pasta(), f = api(exemplo(2.0)); // voz lenta: acelera no teto, 1,10x
  const r = await vozComTempos(dir, { env, fetch: f });
  assert.equal(f.pedidos.length, 1);
  const [p] = f.pedidos;
  assert.equal(p.url, 'https://api.elevenlabs.io/v1/text-to-speech/vozDeTeste123/with-timestamps?output_format=mp3_44100_128');
  assert.equal(p.method, 'POST');
  assert.equal(p.headers['xi-api-key'], 'chave-de-teste-123');
  assert.deepEqual(p.corpo, { text: TEXTO, model_id: 'eleven_v3', voice_settings: { stability: 0.5, similarity_boost: 0.85, style: 0.4, use_speaker_boost: true } });
  assert.doesNotMatch(JSON.stringify(p.corpo), /chave-de-teste/);
  assert.equal(r.fator, 1.1);
  assert.equal(r.palavras, 22);
});

test('grava a voz crua, o alinhamento, a voz.wav em 48 kHz acelerada e o words.json com o tempo da voz acelerada', async () => {
  const dir = pasta(), ws = exemplo(2.4), { fator } = await vozComTempos(dir, { env, fetch: api(ws) });
  for (const a of ['audio/voz-crua.mp3', 'audio/alinhamento-caracteres.json', 'audio/voz.wav', 'words.json']) assert.ok(existsSync(join(dir, a)), a);
  const sr = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=sample_rate', '-of', 'csv=p=0', join(dir, 'audio', 'voz.wav')], { encoding: 'utf8' }).trim();
  assert.equal(sr, '48000');
  assert.ok(Math.abs(dur(join(dir, 'audio', 'voz.wav')) - dur(join(dir, 'audio', 'voz-crua.mp3')) / fator) < 0.03);
  const w = JSON.parse(readFileSync(join(dir, 'words.json'), 'utf8'));
  assert.deepEqual(w.map((x) => x.text), TEXTO.split(' '));
  w.forEach((x, i) => { assert.equal(x.start, +(ws[i][1] / fator).toFixed(3)); assert.equal(x.end, +(ws[i][2] / fator).toFixed(3)); });
});

test('voz que não bate com o roteiro: não grava o words.json', async () => {
  const dir = pasta(), ws = exemplo(2.4);
  ws[5][0] = 'recebem';
  await assert.rejects(vozComTempos(dir, { env, fetch: api(ws) }), /na palavra 6 \(roteiro: "recebe", voz: "recebem"\)/);
  assert.ok(!existsSync(join(dir, 'words.json')));
});

test('sem voz no marca.json, roteiro vazio ou longo demais: para antes de gastar créditos', async () => {
  const f = api(exemplo(2.4));
  await assert.rejects(vozComTempos(pasta({ nome: 'Estúdio Exemplo' }), { env, fetch: f }), /o marca\.json não tem a voz.*elevenlabs_voice_id/);
  await assert.rejects(vozComTempos(pasta({ nome: 'X', voz: { elevenlabs_voice_id: 'abc/../x' } }), { env, fetch: f }), /não tem a voz/);
  await assert.rejects(vozComTempos(pasta({ nome: 'X', voz: { elevenlabs_voice_id: 'abc', ritmo: 9 } }), { env, fetch: f }), /voz\.ritmo/);
  await assert.rejects(vozComTempos(pasta(undefined, '\n  \n'), { env, fetch: f }), /o roteiro\.txt está vazio/);
  await assert.rejects(vozComTempos(pasta(undefined, 'palavra '.repeat(101)), { env, fetch: f }), /tem 101 palavras/);
  assert.equal(f.pedidos.length, 0);
});

test('chave: a variável vem primeiro; depois o arquivo na pasta de dados, que fica só para o dono (600); sem chave, diz como guardar', () => {
  const dados = mkdtempSync(join(raiz, 'dados-')), arq = join(dados, ARQUIVO_CHAVE);
  assert.throws(() => lerChave({ EDITOR_CHEFE_DATA: dados }), /falta a chave da ElevenLabs.*references\/marca\.md.*nunca vai na conversa/);
  writeFileSync(arq, 'chave-do-arquivo\n');
  chmodSync(arq, 0o644);
  assert.equal(lerChave({ EDITOR_CHEFE_DATA: dados }), 'chave-do-arquivo');
  if (process.platform !== 'win32') assert.equal(statSync(arq).mode & 0o777, 0o600);
  assert.equal(lerChave({ ELEVENLABS_API_KEY: 'da-variavel', EDITOR_CHEFE_DATA: dados }), 'da-variavel');
  assert.equal(lerChave({ CLAUDE_PLUGIN_DATA: dados }), 'chave-do-arquivo'); // sem o prefixo do ambiente.sh
  writeFileSync(arq, '  \n');
  assert.throws(() => lerChave({ EDITOR_CHEFE_DATA: dados }), /arquivo da chave está vazio/);
});

test('erro da ElevenLabs: mostra o motivo sem a chave, com a dica de cada código', async () => {
  const f = api(exemplo(2.4), { status: 401, corpo: '{"detail":{"status":"invalid_api_key","message":"Invalid API key: chave-de-teste-123"}}' });
  await assert.rejects(vozComTempos(pasta(), { env, fetch: f }), (e) => {
    assert.doesNotMatch(e.message, /chave-de-teste-123/);
    assert.match(e.message, /HTTP 401.*Invalid API key: \*\*\*.*A chave não vale ou faltam créditos/);
    return true;
  });
  const g = async () => { throw new TypeError('fetch failed'); };
  await assert.rejects(vozComTempos(pasta(), { env, fetch: g }), /não consegui falar com a ElevenLabs \(fetch failed\)/);
});

test('pela linha de comando: sem pasta mostra o uso e sai com 1; o erro sai em português, sem pilha', () => {
  const S = fileURLToPath(new URL('../plugins/editor-chefe/scripts/voz-com-tempos.mjs', import.meta.url));
  const r = spawnSync(process.execPath, [S], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /^Uso: node voz-com-tempos\.mjs/);
  const s = spawnSync(process.execPath, [S, pasta({ nome: 'X' })], { encoding: 'utf8', env: { ...process.env, ELEVENLABS_API_KEY: 'x' } });
  assert.equal(s.status, 1);
  assert.match(s.stderr, /^voz-com-tempos: o marca\.json não tem a voz/);
});

test('o comando da chave em marca.md, rodado pelo zsh e pelo bash, grava o arquivo que o script lê, só para o dono', () => {
  const md = readFileSync(new URL('../plugins/editor-chefe/skills/editor-chefe/references/marca.md', import.meta.url), 'utf8');
  const linha = md.split('\n').find((l) => l.trim().startsWith("bash -c 'read -rsp")).trim();
  for (const shell of ['bash', 'zsh']) {
    if (spawnSync(shell, ['-c', 'true']).status !== 0) continue; // zsh só no Mac
    const dados = mkdtempSync(join(raiz, 'dados-'));
    const r = spawnSync(shell, ['-c', linha.replace('${CLAUDE_PLUGIN_DATA}', dados)], { input: 'sk_teste_do_comando\n', encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(r.stdout + r.stderr, /sk_teste_do_comando/); // a chave não aparece na tela
    assert.equal(lerChave({ EDITOR_CHEFE_DATA: dados }), 'sk_teste_do_comando');
    if (process.platform !== 'win32') assert.equal(statSync(join(dados, ARQUIVO_CHAVE)).mode & 0o777, 0o600);
  }
});

test('roteiro com dado pessoal: para antes de mandar à ElevenLabs e só segue com a confirmação do dono; sem dado, nada muda', async () => {
  const texto = 'Ligue para 11 98765-4321 e fale com a Joana Prado hoje.';
  let chamou = 0;
  const nao = async () => { chamou++; throw new Error('não devia chamar a ElevenLabs'); };
  await assert.rejects(vozComTempos(pasta(undefined, texto), { env, fetch: nao }),
    /o roteiro tem o que parece dado pessoal \(telefone 11 98765-4321; nome possível "Joana Prado"\), e o texto vai para a ElevenLabs .*rode com --confirmado/);
  await assert.rejects(vozComTempos(pasta(undefined, 'Mande o CPF 529 982 247 25 hoje.'), { env, fetch: nao }), /CPF 529 982 247 25/); // dito em pedaços
  assert.equal(chamou, 0);
  const ws = exemplo(2.5, texto), f = api(ws);
  assert.equal((await vozComTempos(pasta(undefined, texto), { env, fetch: f, confirmado: true })).palavras, ws.length);
  assert.equal(f.pedidos[0].corpo.text, texto); // confirmado, o texto vai como está
  // o nome do negócio e um aplicativo no meio da frase não pedem confirmação
  const t2 = 'Aqui no Estúdio Exemplo, todo cliente chama no WhatsApp.';
  assert.equal((await vozComTempos(pasta(undefined, t2), { env, fetch: api(exemplo(2.5, t2)) })).palavras, t2.split(' ').length);
});
