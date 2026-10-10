// tests/montar.test.mjs: monta os 5 estilos com a marca de teste e uma fala de exemplo neutra
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { montar } from '../plugins/editor-chefe/scripts/montar.mjs';

const EC = createRequire(import.meta.url)('../plugins/editor-chefe/estilos/comum.js');
const WOFF2 = 'wOF2'; // os 4 primeiros bytes de um arquivo woff2 de verdade
const MARCA = fileURLToPath(new URL('./marca-teste.json', import.meta.url));

// Plugin hyperframes de mentira, só com a pasta de efeitos (os arquivos de som de verdade não entram no repositório)
const HF = mkdtempSync(join(tmpdir(), 'hyperframes-'));
const SFX = join(HF, 'skills', 'media-use', 'audio', 'assets', 'sfx');
mkdirSync(SFX, { recursive: true });
const SONS = { 'whoosh-short': 0.57, pop: 0.72, 'impact-bass-1': 2.12 };
writeFileSync(join(SFX, 'manifest.json'), JSON.stringify(Object.fromEntries(Object.entries(SONS).map(([k, d]) => [k, { file: `${k}.mp3`, duration: d }]))));
for (const k of Object.keys(SONS)) writeFileSync(join(SFX, `${k}.mp3`), 'ID3');
process.env.HYPERFRAMES_PLUGIN_ROOT = HF;
test.after(() => rmSync(HF, { recursive: true, force: true }));

// Fala de exemplo (negócio fictício falando de atendimento), 0,3 s por palavra, pausa de 1 s depois de "dia."
const texto = 'Aqui na loja, todo cliente recebe resposta no mesmo dia. Se a dúvida chega de manhã, a solução sai antes do almoço.'.split(' ');
let t = 0.5;
const fala = texto.map((w) => { const p = { text: w, start: +t.toFixed(2), end: +(t + 0.28).toFixed(2) }; t += w.endsWith('.') ? 1.3 : 0.3; return p; });
const corte = { limiar: -38, duracao: 9.5, manter: [[0.42, 3.86], [4.72, 9.5]] };
const ESCOLHAS = {
  'legenda-viva': {},
  'palavra-chave': { identidade: 'stomp', chaves: ['cliente', 'resposta', 'manhã', 'almoço'], apice: 'resposta' },
  'corte-seco-zoom': { enfase: ['resposta', 'almoço'] },
  'painel-escuro': { cartoes: [{ de: 0.5, titulo: 'Todo cliente recebe *resposta* no mesmo dia.' }, { de: 4.8, titulo: 'A *solução* sai antes do almoço.' }] },
  'editorial-claro': { cartoes: [{ de: 0.5, titulo: 'Todo cliente recebe *resposta* no mesmo dia.' }, { de: 4.8, titulo: 'A *solução* sai antes do almoço.' }] },
};

function projeto(estilo, extra = {}) {
  const dir = mkdtempSync(join(tmpdir(), `montar-${estilo}-`));
  mkdirSync(join(dir, 'fonts'));
  for (const f of ['Montserrat-800.woff2', 'Inter-400.woff2', 'PlayfairDisplay-400-italic.woff2']) writeFileSync(join(dir, 'fonts', f), WOFF2);
  writeFileSync(join(dir, 'fonte.mp4'), '');
  writeFileSync(join(dir, 'transcript.json'), JSON.stringify(fala));
  writeFileSync(join(dir, 'trechos.json'), JSON.stringify(corte));
  writeFileSync(join(dir, 'escolhas.json'), JSON.stringify({ estilo, marca: MARCA, foco: '52% 45%', ...ESCOLHAS[estilo], ...extra }));
  return dir;
}

for (const estilo of Object.keys(ESCOLHAS)) {
  test(`monta ${estilo} sem marcador sobrando`, () => {
    const dir = projeto(estilo), avisos = [];
    try {
      const r = montar(dir, (m) => avisos.push(m));
      const html = readFileSync(join(dir, 'index.html'), 'utf8');
      assert.doesNotMatch(html, /\{\{[A-Z_]+\}\}/);
      assert.equal((html.match(/<video id="trecho-/g) || []).length, 2);
      assert.match(html, /data-duration="8\.200" data-width/);
      assert.ok(existsSync(join(dir, 'comum.js')));
      assert.equal(r.palavras, texto.length);
      assert.deepEqual(avisos, []);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}

test('palavra escolhida que não está na fala é avisada e não apaga as seguintes', () => {
  const pal = texto.map((txt) => ({ txt }));
  assert.deepEqual(EC.marcar(pal, ['cliente', 'garantia', 'resposta']), [4, -1, 6]);
  const dir = projeto('palavra-chave', { chaves: ['cliente', 'garantia', 'resposta'], apice: 'resposta' }), avisos = [];
  try {
    montar(dir, (m) => avisos.push(m));
    assert.equal(avisos.length, 1);
    assert.match(avisos[0], /"garantia"/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('palavra com tempo dentro de um corte não se perde e não fica com duração zero', () => {
  const palavras = [['antes', 1, 1.5], ['dentro', 2.1, 2.4], ['depois', 3.1, 3.5]];
  const trechos = [{ ini: 0, dur: 2, src: 0 }, { ini: 2, dur: 2, src: 3 }]; // o original de 2 a 3 s foi cortado
  const pal = EC.mapear(palavras, trechos, 4);
  assert.equal(pal.length, 3);
  assert.ok(pal.every((p) => p.fim > p.ini));
  assert.ok(pal[1].ini < pal[2].ini);
});

test('fonte de destaque sem itálico: declara a normal e avisa', () => {
  const dir = projeto('editorial-claro'), avisos = [];
  try {
    rmSync(join(dir, 'fonts', 'PlayfairDisplay-400-italic.woff2'));
    writeFileSync(join(dir, 'fonts', 'PlayfairDisplay-400.woff2'), WOFF2);
    montar(dir, (m) => avisos.push(m));
    assert.match(readFileSync(join(dir, 'index.html'), 'utf8'), /PlayfairDisplay-400\.woff2/);
    assert.match(avisos.join('\n'), /sem itálico/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('título sem peso 800: usa o mais pesado que existir e avisa', () => {
  const dir = projeto('legenda-viva'), avisos = [];
  try {
    rmSync(join(dir, 'fonts', 'Montserrat-800.woff2'));
    for (const f of ['Montserrat-400.woff2', 'Montserrat-700.woff2']) writeFileSync(join(dir, 'fonts', f), WOFF2);
    montar(dir, (m) => avisos.push(m));
    assert.match(readFileSync(join(dir, 'index.html'), 'utf8'), /url\("fonts\/Montserrat-700\.woff2"\) format\("woff2"\); font-weight: 800;/);
    assert.match(avisos.join('\n'), /sem peso 800/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('arquivo de fonte que não é woff2 (página de erro salva) para a montagem com mensagem clara', () => {
  const dir = projeto('legenda-viva');
  try {
    writeFileSync(join(dir, 'fonts', 'Montserrat-800.woff2'), '<!DOCTYPE html><html>Not Found</html>');
    assert.throws(() => montar(dir, () => {}), /fonts\/Montserrat-800\.woff2 não é uma fonte woff2/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// Monta com um arquivo trocado; devolve o erro (ou falha se montou)
function erro(estilo, arquivo, conteudo, extra = {}) {
  const dir = projeto(estilo, extra);
  try {
    writeFileSync(join(dir, arquivo), typeof conteudo === 'string' ? conteudo : JSON.stringify(conteudo));
    if (arquivo === 'marca.json') writeFileSync(join(dir, 'escolhas.json'), JSON.stringify({ estilo, marca: 'marca.json', ...ESCOLHAS[estilo], ...extra }));
    let msg;
    assert.throws(() => montar(dir, () => {}), (e) => { msg = e.message; return true; });
    return msg;
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('"manter" vazio é erro em português', () => {
  assert.match(erro('legenda-viva', 'trechos.json', { ...corte, manter: [] }), /nenhum trecho em "manter"/);
});

test('trecho com menos de 1 quadro (ou duração negativa) é erro', () => {
  assert.match(erro('legenda-viva', 'trechos.json', { ...corte, manter: [[0.42, 3.86], [5, 5.01]] }), /trecho 2 .* menos de 1 quadro/);
  assert.match(erro('legenda-viva', 'trechos.json', { ...corte, manter: [[3, 2]] }), /trecho 1 .* menos de 1 quadro/);
});

test('cartões fora de ordem são erro', () => {
  const cartoes = [{ de: 4.8, titulo: 'A *solução* sai antes do almoço.' }, { de: 0.5, titulo: 'Todo cliente recebe *resposta* no mesmo dia.' }];
  assert.match(erro('painel-escuro', 'escolhas.json', { estilo: 'painel-escuro', marca: MARCA, cartoes }), /ordem da fala: o cartão 2/);
});

test('nome de fonte com caractere fora de letra, número e espaço é recusado antes de ir para o CSS', () => {
  const marca = JSON.parse(readFileSync(MARCA, 'utf8'));
  marca.fontes.titulo = 'Montserrat"; } body { color: red';
  assert.match(erro('legenda-viva', 'marca.json', marca), /fontes\.titulo .* só com letras, números e espaço/);
});

test('JSON inválido: a mensagem diz qual arquivo', () => {
  assert.match(erro('legenda-viva', 'trechos.json', ''), /trechos\.json.*não é um JSON válido/);
});

test('efeitos ligados (padrão): um <audio> por efeito, por baixo da voz, e os sons copiados para efeitos/', () => {
  for (const estilo of Object.keys(ESCOLHAS)) {
    const dir = projeto(estilo);
    try {
      const r = montar(dir, () => {});
      const html = readFileSync(join(dir, 'index.html'), 'utf8');
      const audios = html.match(/<audio id="efeito-\d+" class="clip" src="efeitos\/[\w-]+\.mp3" data-start="[\d.]+" data-duration="[\d.]+" data-track-index="\d+" data-volume="0\.(35|2)"><\/audio>/g) || [];
      assert.ok(audios.length > 0, estilo);
      assert.equal(audios.length, r.efeitos, estilo);
      for (const a of audios) assert.ok(existsSync(join(dir, /src="([^"]+)"/.exec(a)[1])), a);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
});

test('palavra-chave: impacto grave no ápice, whoosh nas outras palavras fortes', () => {
  const dir = projeto('palavra-chave');
  try {
    montar(dir, () => {});
    const sons = [...readFileSync(join(dir, 'index.html'), 'utf8').matchAll(/src="efeitos\/([\w-]+)\.mp3"/g)].map((m) => m[1]);
    assert.deepEqual(sons, ['whoosh-short', 'impact-bass-1', 'whoosh-short', 'whoosh-short']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('"efeitos": false tira todos os <audio> de efeito', () => {
  const dir = projeto('painel-escuro', { efeitos: false });
  try {
    const r = montar(dir, () => {});
    assert.doesNotMatch(readFileSync(join(dir, 'index.html'), 'utf8'), /<audio/);
    assert.equal(r.efeitos, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('sem o plugin hyperframes, os efeitos param a montagem com mensagem em português', () => {
  const antes = process.env.HYPERFRAMES_PLUGIN_ROOT;
  process.env.HYPERFRAMES_PLUGIN_ROOT = join(HF, 'nao-existe');
  try {
    assert.match(erro('legenda-viva', 'fonte.mp4', ''), /não achei os efeitos sonoros do plugin hyperframes.*"efeitos": false/);
  } finally { process.env.HYPERFRAMES_PLUGIN_ROOT = antes; }
});

test('"efeitos" que não é true nem false é erro', () => {
  assert.match(erro('legenda-viva', 'fonte.mp4', '', { efeitos: 'sim' }), /"efeitos" é true/);
});

test('efeitos que se sobrepõem ficam em faixas diferentes (o impacto grave dura 2,1 s)', () => {
  const dir = projeto('palavra-chave', { apice: 'cliente' }); // "resposta" entra 0,6 s depois, ainda no som do impacto
  try {
    montar(dir, () => {});
    const a = [...readFileSync(join(dir, 'index.html'), 'utf8').matchAll(/<audio [^>]*data-start="([\d.]+)" data-duration="([\d.]+)" data-track-index="(\d+)"/g)].map((m) => ({ ini: +m[1], fim: +m[1] + +m[2], faixa: +m[3] }));
    assert.ok(a.length >= 2);
    for (const x of a) for (const y of a) if (x !== y && x.faixa === y.faixa) assert.ok(x.fim <= y.ini || y.fim <= x.ini, JSON.stringify([x, y]));
    assert.ok(a.every((x) => x.faixa >= 1));
    assert.ok(new Set(a.map((x) => x.faixa)).size >= 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// Véu atrás do texto: liga só com a faixa do texto clara na fonte.mp4 (precisa de ffmpeg e ffprobe no PATH)
function comFonte(estilo, cor, extra = {}) {
  const dir = projeto(estilo, extra);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=c=${cor}:s=360x640:d=1:r=30`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', join(dir, 'fonte.mp4')]);
  return dir;
}
const opacidade = (dir) => /#veu-legenda \{[^}]*opacity: (\d)/.exec(readFileSync(join(dir, 'index.html'), 'utf8'))[1];

test('véu atrás do texto: liga com a faixa clara (jaleco branco), desliga com a escura; no stomp, só com a faixa muito clara', () => {
  for (const [estilo, cor, extra, esperado] of [
    ['legenda-viva', 'white', {}, '1'], ['legenda-viva', '0x202020', {}, '0'],
    ['corte-seco-zoom', 'white', {}, '1'], ['palavra-chave', 'white', { identidade: 'keynote' }, '1'],
    // a palavra-chave do teste é stomp, que já escurece o vídeo: luma ~153 fica sem véu, branco (~235) liga
    ['palavra-chave', '0xA0A0A0', {}, '0'], ['palavra-chave', 'white', {}, '1'],
  ]) {
    const dir = comFonte(estilo, cor, extra), avisos = [];
    try {
      const r = montar(dir, (m) => avisos.push(m));
      assert.equal(opacidade(dir), esperado, `${estilo} ${cor} ${JSON.stringify(extra)}`);
      assert.equal(r.veu, esperado === '1');
      assert.deepEqual(avisos, []);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
});

test('sem ffmpeg e ffprobe (fora do PATH e sem as variáveis do ambiente.sh), o véu fica desligado com aviso, sem exceção', () => {
  const dir = comFonte('legenda-viva', 'white'), avisos = [];
  const antes = { PATH: process.env.PATH, P: process.env.HYPERFRAMES_FFPROBE_PATH, M: process.env.HYPERFRAMES_FFMPEG_PATH };
  process.env.PATH = join(dir, 'sem-ferramentas');
  delete process.env.HYPERFRAMES_FFPROBE_PATH; delete process.env.HYPERFRAMES_FFMPEG_PATH;
  try {
    const r = montar(dir, (m) => avisos.push(m));
    assert.equal(r.veu, false);
    assert.equal(opacidade(dir), '0');
    assert.match(avisos.join('\n'), /não consegui medir a claridade/);
  } finally {
    process.env.PATH = antes.PATH;
    if (antes.P !== undefined) process.env.HYPERFRAMES_FFPROBE_PATH = antes.P;
    if (antes.M !== undefined) process.env.HYPERFRAMES_FFMPEG_PATH = antes.M;
    rmSync(dir, { recursive: true, force: true });
  }
});
