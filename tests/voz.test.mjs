// tests/voz.test.mjs: voz-com-tempos.mjs sem chamar a ElevenLabs nem o UltraVoice (as respostas das APIs e a transcrição são
// montadas aqui, com um áudio sintético).
// Precisa de ffmpeg e ffprobe no PATH (o prefixo do ambiente.sh resolve).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, statSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { palavras, aceleracao, conferir, lerChave, vozComTempos, escolherVoz, pronunciar, alinhar, RITMO, ARQUIVO_CHAVE, ULTRAVOICE } from '../plugins/editor-chefe/scripts/voz-com-tempos.mjs';

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

// UltraVoice (VoiceStudio local): dublê da API em 127.0.0.1:3900 e do transcritor. A voz é um tom com a duração da fala.
function uv(ws, { saude = true, perfil = 200, status = 200, cabecalhos = {} } = {}) {
  const wav = join(raiz, `uv-${ws.length}-${ws.at(-1)[2]}.wav`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `sine=f=180:d=${ws.at(-1)[2] + 0.3}`, '-ar', '24000', wav]);
  const f = async (url, op = {}) => {
    f.pedidos.push({ url, metodo: op.method ?? 'GET', campos: op.body instanceof FormData ? Object.fromEntries(op.body) : undefined });
    if (url === `${ULTRAVOICE}/health`) { if (!saude) throw new TypeError('fetch failed'); return new Response('{"status":"ok","device":"mps","version":"0.5.6"}'); }
    if (url.startsWith(`${ULTRAVOICE}/profiles/`)) return new Response('{}', { status: perfil });
    if (url === `${ULTRAVOICE}/generate`) return status === 200 ? new Response(readFileSync(wav), { headers: cabecalhos }) : new Response('{"detail":"OmniVoice não instalado"}', { status });
    throw new Error(`não devia chamar ${url}`);
  };
  f.pedidos = [];
  return f;
}
// transcritor de mentira: devolve as palavras "ouvidas" e guarda o arquivo que recebeu
const ouvir = (ws) => { const t = (arq) => { t.arquivos.push(arq); return ws.map(([text, start, end]) => ({ text, start, end })); }; t.arquivos = []; return t; };
const MARCA_UV = { nome: 'Estúdio Exemplo', voz: { ultravoice_perfil: 'perfil-dono_1' } };
const MARCA_DUAS = { nome: 'Estúdio Exemplo', voz: { ultravoice_perfil: 'perfil-dono_1', elevenlabs_voice_id: 'vozDeTeste123' } };

test('escolha da voz: UltraVoice com perfil aprovado e app aberto; ElevenLabs sem perfil ou com --elevenlabs; sem nenhum, pede um', async () => {
  const f = uv(exemplo(2.4));
  assert.equal(await escolherVoz({ perfil: 'perfil-dono_1', id: 'vozDeTeste123' }, { fetch: f }), 'ultravoice'); // padrão, sem custo
  assert.deepEqual(f.pedidos.map((p) => p.url), [`${ULTRAVOICE}/health`, `${ULTRAVOICE}/profiles/perfil-dono_1`]);
  const nada = async (url) => { throw new Error(`não devia chamar ${url}`); };
  assert.equal(await escolherVoz({ id: 'vozDeTeste123' }, { fetch: nada }), 'elevenlabs'); // sem perfil: como hoje
  assert.equal(await escolherVoz({ perfil: 'perfil-dono_1', id: 'vozDeTeste123' }, { fetch: nada, elevenlabs: true }), 'elevenlabs');
  await assert.rejects(escolherVoz({ perfil: 'perfil-dono_1' }, { fetch: nada, elevenlabs: true }), /pediram a ElevenLabs.*elevenlabs_voice_id/);
  await assert.rejects(escolherVoz({}, { fetch: nada }), /não tem a voz.*ultravoice_perfil.*sem custo.*elevenlabs_voice_id.*pago/);
});

test('UltraVoice fechado ou sem o perfil: para, sem trocar sozinho para a ElevenLabs paga', async () => {
  await assert.rejects(escolherVoz({ perfil: 'p1', id: 'vozDeTeste123' }, { fetch: uv(exemplo(2.4), { saude: false }) }),
    (e) => /não respondeu em http:\/\/127\.0\.0\.1:3900.*open -g \/Applications\/VoiceStudio\.app.*--elevenlabs/.test(e.message));
  await assert.rejects(escolherVoz({ perfil: 'p1' }, { fetch: uv(exemplo(2.4), { saude: false }) }), (e) => /não respondeu/.test(e.message) && !/--elevenlabs/.test(e.message));
  await assert.rejects(escolherVoz({ perfil: 'p1', id: 'x' }, { fetch: uv(exemplo(2.4), { perfil: 404 }) }), /o perfil "p1" não existe no UltraVoice/);
  // perfil com caractere fora do formato não chega à URL
  await assert.rejects(vozComTempos(pasta({ nome: 'X', voz: { ultravoice_perfil: '../models' } }), { env, fetch: uv(exemplo(2.4)) }), /voz\.ultravoice_perfil/);
});

test('dicionário de pronúncia: OAB vira "Óabê" e A.I. vira "Ei Ai", igual ao do UltraVoice', () => {
  assert.equal(pronunciar('A OAB aprovou.'), 'A Óabê aprovou.');
  assert.equal(pronunciar('Usamos A.I. no atendimento.'), 'Usamos Ei Ai no atendimento.');
  assert.equal(pronunciar('Tudo com A.I. Depois, a OAB.'), 'Tudo com Ei Ai. Depois, a Óabê.');
  assert.equal(pronunciar('Fim com A.I.'), 'Fim com Ei Ai.');
  assert.equal(pronunciar('AIDS e OABX ficam como estão.'), 'AIDS e OABX ficam como estão.');
});

test('alinhamento texto x transcrição: palavra trocada leva o tempo do lugar; pulada fica no vão; a mais vai junto', () => {
  const ouvidas = [['Aqui', 0, 0.3], ['na', 0.35, 0.5], ['lousa', 0.55, 1], ['todo', 1.1, 1.4], ['cliente', 1.45, 1.9], ['recebem', 2, 2.5], ['a', 2.55, 2.6], ['resposta', 2.6, 3.1], ['dia.', 3.6, 4]]
    .map(([text, start, end]) => ({ text, start, end }));
  const { palavras: p, trocas, iguais } = alinhar('Aqui na loja, todo cliente recebe resposta no mesmo dia.'.split(' '), ouvidas);
  assert.deepEqual(p.map((w) => w.text), ['Aqui', 'na', 'loja,', 'todo', 'cliente', 'recebe', 'resposta', 'no', 'mesmo', 'dia.']); // as palavras do roteiro
  assert.deepEqual(p[2], { text: 'loja,', start: 0.55, end: 1 }); // trocada: o tempo do que foi ouvido no lugar
  assert.deepEqual(p[5], { text: 'recebe', start: 2, end: 2.6 }); // trocada com uma a mais depois: fica com as duas
  assert.deepEqual(p[6], { text: 'resposta', start: 2.6, end: 3.1 });
  assert.deepEqual([p[7].start, p[8].end], [3.1, 3.6]); // "no mesmo" pulados: dividem o vão até "dia."
  assert.ok(p[7].end <= p[8].start && p[8].end - p[8].start > p[7].end - p[7].start); // pelo tamanho da palavra
  assert.equal(iguais, 6);
  assert.deepEqual(trocas, [{ roteiro: 'loja,', ouvido: 'lousa' }, { roteiro: 'recebe', ouvido: 'recebem a' }, { roteiro: 'no mesmo', ouvido: '' }]);
  p.forEach((w, i) => assert.ok(w.end >= w.start && (!i || w.start >= p[i - 1].start))); // o que o montar.mjs exige
  // palavra a mais logo antes de uma igual vai junto com ela: "Ei Ai" falado no lugar de "A.I."
  const q = alinhar(['com', 'A.I.', 'hoje.'], [['com', 0, 0.3], ['Ei', 0.35, 0.5], ['Ai', 0.55, 0.8], ['hoje.', 0.9, 1.3]].map(([text, start, end]) => ({ text, start, end }))).palavras;
  assert.deepEqual(q[1], { text: 'A.I.', start: 0.35, end: 0.8 });
});

test('UltraVoice: pede ao app local com o perfil e o texto do dicionário, transcreve a voz e grava o words.json com as palavras do roteiro', async () => {
  const roteiro = 'A OAB aprovou o atendimento com A.I. aqui na loja, todo cliente recebe resposta no mesmo dia.';
  const falado = 'A Óabê aprovou o atendimento com Ei Ai aqui na loja, todo cliente recebe resposta no mesmo dia.';
  const ws = exemplo(2.4, falado);
  ws[1][0] = 'OAB'; ws[13][0] = 'recebem'; // o transcritor escreve a sigla e troca uma palavra
  const dir = pasta(MARCA_UV, roteiro), f = uv(ws), t = ouvir(ws);
  const r = await vozComTempos(dir, { env, fetch: f, transcrever: t, confirmado: true }); // a procura de dado pessoal acha "A.I" como nome possível
  assert.equal(r.caminho, 'ultravoice');
  const ger = f.pedidos.find((p) => p.url === `${ULTRAVOICE}/generate`);
  assert.deepEqual(ger.campos, { text: falado, profile_id: 'perfil-dono_1', language: 'Portuguese', engine: 'omnivoice', seed: '23', speed: '1.0', effect_preset: 'raw' });
  assert.ok(f.pedidos.every((p) => p.url.startsWith(ULTRAVOICE))); // nada sai do computador
  assert.deepEqual(t.arquivos, [join(dir, 'audio', 'voz-crua.wav')]);
  for (const a of ['audio/voz-crua.wav', 'audio/transcricao.json', 'audio/voz.wav', 'words.json']) assert.ok(existsSync(join(dir, a)), a);
  const w = JSON.parse(readFileSync(join(dir, 'words.json'), 'utf8'));
  assert.deepEqual(w.map((x) => x.text), roteiro.split(' ')); // a legenda mostra "OAB" e "A.I.", como o dono escreveu
  assert.deepEqual(w.find((x) => x.text === 'A.I.'), { text: 'A.I.', start: +(ws[6][1] / r.fator).toFixed(3), end: +(ws[7][2] / r.fator).toFixed(3) });
  assert.deepEqual(r.trocas.map((x) => x.roteiro), ['Óabê', 'recebe']);
});

test('o words.json do UltraVoice tem o mesmo formato e os mesmos tempos que o da ElevenLabs para a mesma fala', async () => {
  const ws = exemplo(2.3);
  const a = pasta(), b = pasta(MARCA_UV);
  await vozComTempos(a, { env, fetch: api(ws) });
  await vozComTempos(b, { env, fetch: uv(ws), transcrever: ouvir(ws) });
  const [we, wu] = [a, b].map((d) => JSON.parse(readFileSync(join(d, 'words.json'), 'utf8')));
  assert.deepEqual(wu, we);
  wu.forEach((x) => assert.deepEqual(Object.keys(x), ['text', 'start', 'end']));
  const sr = (d) => execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=sample_rate,channels', '-of', 'csv=p=0', join(d, 'audio', 'voz.wav')], { encoding: 'utf8' }).trim();
  assert.equal(sr(b), '48000,1');
});

test('UltraVoice: voz que não diz o roteiro, pedaço sem voz ou erro do app param sem gravar o words.json', async () => {
  const ws = exemplo(2.4), errado = ws.map(([, s, e], i) => [i % 3 ? 'outra' : ws[i][0], s, e]); // um terço reconhecido
  const d1 = pasta(MARCA_UV);
  await assert.rejects(vozComTempos(d1, { env, fetch: uv(ws), transcrever: ouvir(errado) }), /não parece dizer o roteiro \(a transcrição reconheceu 8 de 22 palavras\).*voz-crua\.wav/);
  assert.ok(!existsSync(join(d1, 'words.json')));
  const d2 = pasta(MARCA_UV);
  await assert.rejects(vozComTempos(d2, { env, fetch: uv(ws, { cabecalhos: { 'X-OmniVoice-Dropped-Chunks': '1', 'X-OmniVoice-Dropped-Text': 'antes do almoço' } }), transcrever: ouvir(ws) }), /sem um pedaço do texto \(antes do almoço\)/);
  const d3 = pasta(MARCA_UV);
  await assert.rejects(vozComTempos(d3, { env, fetch: uv(ws, { status: 500 }), transcrever: ouvir(ws) }), /o UltraVoice recusou o pedido \(HTTP 500\).*OmniVoice não instalado/);
  for (const d of [d2, d3]) assert.ok(!existsSync(join(d, 'words.json')));
});

test('UltraVoice com dado pessoal no roteiro: a mesma conferência para antes de gerar; ElevenLabs também recebe o texto do dicionário', async () => {
  const texto = 'Ligue para 11 98765-4321 e fale com a Joana Prado hoje.', f = uv(exemplo(2.5, texto));
  await assert.rejects(vozComTempos(pasta(MARCA_UV, texto), { env, fetch: f, transcrever: ouvir([]) }),
    /parece dado pessoal \(telefone 11 98765-4321; nome possível "Joana Prado"\), e o texto vira voz no UltraVoice, neste computador, e vai ao ar no Reel.*--confirmado/);
  assert.ok(!f.pedidos.some((p) => p.url.endsWith('/generate')));
  // ElevenLabs: a voz recebe "Óabê", a legenda fica com "OAB"
  const t2 = 'Aqui a OAB confere tudo.', ws = exemplo(2.5, pronunciar(t2)), g = api(ws), dir = pasta(undefined, t2);
  await vozComTempos(dir, { env, fetch: g });
  assert.equal(g.pedidos[0].corpo.text, 'Aqui a Óabê confere tudo.');
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 'words.json'), 'utf8')).map((x) => x.text), t2.split(' '));
  // com o perfil e o --elevenlabs, vai pela ElevenLabs sem tocar no UltraVoice
  const h = api(exemplo(2.4));
  assert.equal((await vozComTempos(pasta(MARCA_DUAS), { env, fetch: h, elevenlabs: true })).caminho, 'elevenlabs');
  assert.ok(h.pedidos.every((p) => p.url.startsWith('https://api.elevenlabs.io/')));
});
