// tests/montar.test.mjs: monta os 6 estilos (e o gancho de capa) com a marca de teste e uma fala de exemplo neutra
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
// Sexto estilo, fora da lista acima (sem efeitos sonoros e sem gancho de capa): a caixinha de perguntas do Instagram
const CAIXINHA = { estilo: 'caixinha-pergunta', caixinha: { pergunta: 'Emagrecer é só comer menos?', chamada: 'Pergunta aqui sobre emagrecimento' } };

function projeto(estilo, extra = {}) {
  const dir = mkdtempSync(join(tmpdir(), `montar-${estilo}-`));
  mkdirSync(join(dir, 'fonts'));
  for (const f of ['Montserrat-800.woff2', 'Inter-400.woff2', 'Inter-700.woff2', 'PlayfairDisplay-400-italic.woff2']) writeFileSync(join(dir, 'fonts', f), WOFF2);
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
    ['caixinha-pergunta', 'white', CAIXINHA, '1'], ['caixinha-pergunta', '0x202020', CAIXINHA, '0'],
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

// Gancho de capa: frase curta por cima do vídeo nos primeiros 3 s, numa camada própria (cópias mudas dos trechos)
const CAPA = { estilo: 'faixa', texto: 'Emagrecer é só *comer menos*?' };
const CAPAS = ['faixa', 'manchete', 'editorial', 'faixa', 'manchete'];

test('capa: estilo que não existe é erro que lista os 3', () => {
  assert.match(erro('legenda-viva', 'fonte.mp4', '', { capa: { ...CAPA, estilo: 'banner' } }), /"banner".*faixa, manchete, editorial/);
});

test('capa: o texto precisa de exatamente uma *palavra forte*', () => {
  for (const texto of ['Emagrecer é só comer menos?', 'Emagrecer *é* só *comer menos*?', 'Emagrecer é só *comer menos?'])
    assert.match(erro('legenda-viva', 'fonte.mp4', '', { capa: { ...CAPA, texto } }), /exatamente uma palavra forte/, texto);
});

test('capa: mais de 8 palavras é erro que cita o limite', () => {
  assert.match(erro('legenda-viva', 'fonte.mp4', '', { capa: { ...CAPA, texto: 'Você acha mesmo que emagrecer é só *comer menos*?' } }), /9 palavras.*até 8/);
});

// A regra duplicate_media_discovery_risk do lint da HyperFrames: duas mídias com a mesma fonte, início e duração
function semMidiaRepetida(html, msg) {
  const marcas = [...html.matchAll(/<(video|audio)\b[^>]*>/g)].map(([tag, nome]) =>
    [nome, ...['src', 'data-start', 'data-duration'].map((a) => (new RegExp(`\\s${a}="([^"]*)"`).exec(tag) || [])[1] ?? '')].join('|'));
  assert.equal(new Set(marcas).size, marcas.length, msg);
}

test('capa: edição com menos de 4 s é curta demais', () => {
  assert.match(erro('legenda-viva', 'trechos.json', { ...corte, manter: [[0.42, 3.86]] }, { capa: CAPA }), /curto demais para gancho de capa/);
});

test('capa: os 5 estilos levam a camada da capa com cópias mudas dos trechos dos primeiros 3 s', () => {
  Object.keys(ESCOLHAS).forEach((estilo, i) => {
    const capa = { estilo: CAPAS[i], texto: CAPA.texto };
    const dir = projeto(estilo, { capa, efeitos: false }), avisos = [];
    try {
      montar(dir, (m) => avisos.push(m));
      const html = readFileSync(join(dir, 'index.html'), 'utf8');
      assert.doesNotMatch(html, /\{\{[A-Z_]+\}\}/, estilo);
      assert.match(html, /<div id="capa"/, estilo);
      assert.match(html, /<div id="capa-enquadramento" data-layout-allow-overflow>/, estilo); // a Faixa desce o quadro de propósito
      // o trecho 1 (0 a 3,433 s) cai na capa e é copiado até o fim dela; o trecho 2 começa depois
      const copias = html.match(/<video id="capa-trecho-\d+"[^>]*>/g) || [];
      assert.equal(copias.length, 1, estilo);
      assert.match(copias[0], /data-start="0\.000" data-duration="3\.000" data-media-start="0\.433"/, estilo);
      assert.match(copias[0], / muted /, estilo);
      semMidiaRepetida(html, estilo);
      assert.doesNotMatch(copias[0], /data-has-audio|class="trecho\b/, estilo); // a classe trecho é a que o iniciar() lê
      assert.ok(html.indexOf('if (D.capa) EC.capa(tl, D.capa);') < html.indexOf('window.__timelines['), estilo);
      assert.deepEqual(JSON.parse(/const D = (.*);/.exec(html)[1]).capa, { estilo: capa.estilo, texto: capa.texto, queixo: 840, fim: 3 });
      if (capa.estilo === 'editorial') assert.match(html, /PlayfairDisplay-400-italic\.woff2/, estilo);
      assert.deepEqual(avisos, [], estilo);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

test('capa: trecho que começa dentro da capa é copiado só até o fim dela', () => {
  const dir = projeto('legenda-viva', { capa: { ...CAPA, queixo: 900 }, efeitos: false });
  try {
    writeFileSync(join(dir, 'trechos.json'), JSON.stringify({ ...corte, manter: [[0.42, 1.5], [2, 9.5]] }));
    montar(dir, () => {});
    const html = readFileSync(join(dir, 'index.html'), 'utf8');
    const copias = (html.match(/<video id="capa-trecho-\d+"[^>]*>/g) || []).map((v) => /data-start="([\d.]+)" data-duration="([\d.]+)" data-media-start="([\d.]+)"/.exec(v).slice(1));
    assert.deepEqual(copias, [['0.000', '1.065', '0.433'], ['1.067', '1.933', '2.000']]); // a 1ª cabe inteira na capa: 1 ms a menos que o trecho
    semMidiaRepetida(html);
    assert.equal(JSON.parse(/const D = (.*);/.exec(html)[1]).capa.queixo, 900);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('capa: efeitos sonoros somem antes do fim da capa e entra um whoosh no começo da saída', () => {
  const palavras = fala.map((w) => [w.text, w.start, w.end]);
  const trechos = [{ ini: 0, dur: 3.433, src: 0.433 }, { ini: 3.433, dur: 4.766, src: 4.733 }], total = 8.2;
  Object.keys(ESCOLHAS).forEach((estilo, i) => {
    const d = { palavras, ...ESCOLHAS[estilo] };
    assert.ok(EC.efeitos(estilo, d, trechos, total).some((e) => e.t < 3), `${estilo} sem capa tem efeito nos primeiros 3 s`);
    const capa = { estilo: CAPAS[i], texto: CAPA.texto, queixo: 840, fim: 3 };
    const ev = EC.efeitos(estilo, { ...d, capa }, trechos, total);
    assert.deepEqual(ev.filter((e) => e.t < capa.fim), [{ t: capa.estilo === 'manchete' ? 2.7 : 2.6, som: 'whoosh-short' }], estilo);
    assert.ok(ev.some((e) => e.t >= capa.fim), estilo);
  });
});

test('sem capa, os 5 estilos ficam como antes: sem camada e sem cópia de vídeo', () => {
  for (const estilo of Object.keys(ESCOLHAS)) {
    const dir = projeto(estilo);
    try {
      montar(dir, () => {});
      const html = readFileSync(join(dir, 'index.html'), 'utf8');
      assert.doesNotMatch(html, /id="capa|capa-trecho|<style>\s*#capa/, estilo);
      assert.equal((html.match(/<video /g) || []).length, 2, estilo);
      assert.equal(JSON.parse(/const D = (.*);/.exec(html)[1]).capa, undefined, estilo);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
});

test('legivel: empurra a cor até ter contraste de 4,6:1 contra o fundo', () => {
  for (const [base, rumo, fundo] of [['#9E6B5C', '#3B2F2B', '#F6EFEA'], ['#9E6B5C', '#F6EFEA', [59, 47, 43]], [[154, 106, 90], '#141414', '#F5F1EA']]) {
    const c = EC.legivel(base, rumo, fundo);
    assert.ok(Array.isArray(c) && c.length === 3 && c.every((v) => Number.isInteger(v) && v >= 0 && v <= 255), JSON.stringify(c));
    assert.ok(EC.contraste(c, fundo) >= 4.6, `${base} ${JSON.stringify(c)} ${EC.contraste(c, fundo)}`);
  }
  assert.deepEqual(EC.legivel('#141414', '#000000', '#FFFFFF'), [20, 20, 20]); // já passa: fica como está
});

test('capa editorial pede a fonte de destaque em fonts/, mesmo em estilo que não a usa', () => {
  const dir = projeto('legenda-viva', { capa: { ...CAPA, estilo: 'editorial' } });
  try {
    rmSync(join(dir, 'fonts', 'PlayfairDisplay-400-italic.woff2'));
    assert.throws(() => montar(dir, () => {}), /nenhum arquivo da fonte "Playfair Display" \(fontes\.destaque\) em fonts\//);
    writeFileSync(join(dir, 'escolhas.json'), JSON.stringify({ estilo: 'legenda-viva', marca: MARCA, capa: CAPA }));
    montar(dir, () => {}); // a Faixa só usa o título
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('capa: texto colado com quebra de linha e espaços sobrando vira uma linha só', () => {
  const dir = projeto('legenda-viva', { capa: { ...CAPA, texto: '  Emagrecer é só\n*comer   menos*?\n' }, efeitos: false });
  try {
    montar(dir, () => {});
    assert.equal(JSON.parse(/const D = (.*);/.exec(readFileSync(join(dir, 'index.html'), 'utf8'))[1]).capa.texto, CAPA.texto);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('capa: a duração da edição curta sai com 2 casas (3,97 s não vira "4,0 s")', () => {
  assert.match(erro('legenda-viva', 'trechos.json', { ...corte, manter: [[0.42, 4.39]] }, { capa: CAPA }), /tem 3,97 s, curto demais para gancho de capa/);
});

test('capa: null ou false é o mesmo que sem capa', () => {
  const html = (extra) => {
    const dir = projeto('painel-escuro', extra);
    try { montar(dir, () => {}); return readFileSync(join(dir, 'index.html'), 'utf8'); } finally { rmSync(dir, { recursive: true, force: true }); }
  };
  const sem = html({});
  assert.equal(html({ capa: null }), sem);
  assert.equal(html({ capa: false }), sem);
});

test('capa: queixo que não é número de 0 a 1920 é erro', () => {
  for (const queixo of ['840', -1, 2000, null])
    assert.match(erro('legenda-viva', 'fonte.mp4', '', { capa: { ...CAPA, queixo } }), /capa\.queixo .* de 0 a 1920/, String(queixo));
});

test('capa: na Manchete, queixo depois de 1000 empurra o texto para baixo de 1500 e é erro; Faixa e Editorial ignoram o queixo', () => {
  assert.match(erro('legenda-viva', 'fonte.mp4', '', { capa: { ...CAPA, estilo: 'manchete', queixo: 1001 } }), /queixo em 1001.*começaria em 1161.*baixo demais para a Manchete.*Faixa ou a Editorial/);
  for (const [estilo, queixo] of [['manchete', 1000], ['faixa', 1300], ['editorial', 1300]]) {
    const dir = projeto('legenda-viva', { capa: { ...CAPA, estilo, queixo }, efeitos: false });
    try { montar(dir, () => {}); } finally { rmSync(dir, { recursive: true, force: true }); }
  }
});

test('capa que não é objeto (texto, true, número, lista) é erro que mostra o formato', () => {
  for (const capa of ['faixa', true, 3, ['faixa']])
    assert.match(erro('legenda-viva', 'fonte.mp4', '', { capa }), /"capa" precisa ser \{ "estilo": \.\.\., "texto": \.\.\. \}/, JSON.stringify(capa));
});

test('capa: palavra forte no começo do texto vale', () => {
  const dir = projeto('legenda-viva', { capa: { estilo: 'faixa', texto: '*Dormir mal* engorda?' }, efeitos: false });
  try {
    montar(dir, () => {});
    assert.equal(JSON.parse(/const D = (.*);/.exec(readFileSync(join(dir, 'index.html'), 'utf8'))[1]).capa.texto, '*Dormir mal* engorda?');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// Caixinha de pergunta: a caixinha (chamada e pergunta) fica na tela o vídeo inteiro e já é a capa
const caixinhaDe = (html) => JSON.parse(/const D = (.*);/.exec(html)[1]).caixinha;
const montarCaixinha = (extra = {}, prep = () => {}) => {
  const dir = projeto('caixinha-pergunta', { ...CAIXINHA, ...extra }), avisos = [];
  try {
    prep(dir);
    const r = montar(dir, (m) => avisos.push(m));
    return { r, avisos, html: readFileSync(join(dir, 'index.html'), 'utf8'), efeitos: existsSync(join(dir, 'efeitos')) };
  } finally { rmSync(dir, { recursive: true, force: true }); }
};

test('caixinha: monta com a chamada e a pergunta, a legenda e a fonte Inter 700, sem marcador sobrando', () => {
  const { r, avisos, html } = montarCaixinha();
  assert.doesNotMatch(html, /\{\{[A-Z_]+\}\}/);
  assert.equal((html.match(/<video id="trecho-/g) || []).length, 2);
  assert.match(html, /data-duration="8\.200" data-width/);
  assert.match(html, /<div id="caixinha">/);
  assert.match(html, /<div id="legenda">/);
  assert.match(html, /@font-face \{ font-family: "Inter"; src: url\("fonts\/Inter-700\.woff2"\) format\("woff2"\); font-weight: 700;/);
  assert.match(html, /url\("fonts\/Montserrat-800\.woff2"\)/); // a legenda usa a fonte dos títulos da marca
  assert.deepEqual(caixinhaDe(html), { ...CAIXINHA.caixinha, topo: 920 });
  assert.equal(r.palavras, texto.length);
  assert.deepEqual(avisos, []);
});

test('caixinha: sem efeitos sonoros, mesmo sem o plugin hyperframes', () => {
  assert.deepEqual(EC.efeitos('caixinha-pergunta', { palavras: fala.map((w) => [w.text, w.start, w.end]) }, [{ ini: 0, dur: 3.433, src: 0.433 }, { ini: 3.433, dur: 4.766, src: 4.733 }], 8.2), []);
  const antes = process.env.HYPERFRAMES_PLUGIN_ROOT;
  process.env.HYPERFRAMES_PLUGIN_ROOT = join(HF, 'nao-existe');
  try {
    const { r, html, efeitos } = montarCaixinha();
    assert.doesNotMatch(html, /<audio/);
    assert.equal(r.efeitos, 0);
    assert.equal(efeitos, false); // nenhuma pasta efeitos/ vazia
  } finally { process.env.HYPERFRAMES_PLUGIN_ROOT = antes; }
});

test('caixinha: falta a pergunta (ou vazia, ou longa demais) é erro em português', () => {
  for (const caixinha of [undefined, { chamada: 'Pergunta aqui' }, { pergunta: '   ', chamada: 'Pergunta aqui' }, { pergunta: 42, chamada: 'Pergunta aqui' }])
    assert.match(erro('caixinha-pergunta', 'fonte.mp4', '', { ...CAIXINHA, caixinha }), /caixinha\.pergunta/, JSON.stringify(caixinha));
  assert.match(erro('caixinha-pergunta', 'fonte.mp4', '', { ...CAIXINHA, caixinha: { pergunta: 42 } }), /caixinha\.pergunta precisa ser um texto/);
  const longa = 'Dormir mal atrapalha mesmo quem quer emagrecer depois dos 40 anos e com a rotina corrida de trabalho e filhos pequenos em casa?';
  assert.match(erro('caixinha-pergunta', 'fonte.mp4', '', { ...CAIXINHA, caixinha: { ...CAIXINHA.caixinha, pergunta: longa } }), /127 caracteres.*até 110/);
  const cabe = 'Dormir mal atrapalha mesmo quem quer emagrecer depois dos 40 anos, com rotina corrida de trabalho e de casa?'; // 108
  assert.equal(caixinhaDe(montarCaixinha({ caixinha: { ...CAIXINHA.caixinha, pergunta: cabe } }).html).pergunta, cabe);
});

test('caixinha: sem chamada no escolhas.json e sem chamada_caixinha no marca.json é erro; com ela no marca.json, monta', () => {
  assert.match(erro('caixinha-pergunta', 'fonte.mp4', '', { ...CAIXINHA, caixinha: { pergunta: 'Emagrecer é só comer menos?' } }), /chamada.*chamada_caixinha/);
  const comprida = 'Manda aqui sua pergunta sobre sono, fome e emagrecimento saudável'; // 65
  assert.match(erro('caixinha-pergunta', 'fonte.mp4', '', { ...CAIXINHA, caixinha: { ...CAIXINHA.caixinha, chamada: comprida } }), /caixinha\.chamada, no escolhas\.json\) tem 65 caracteres.*até 50/);
  const marcaComprida = { ...JSON.parse(readFileSync(MARCA, 'utf8')), chamada_caixinha: comprida };
  assert.match(erro('caixinha-pergunta', 'marca.json', marcaComprida, { caixinha: { pergunta: 'Emagrecer é só comer menos?' } }), /chamada_caixinha, no marca\.json\) tem 65 caracteres/);
  const marca = { ...JSON.parse(readFileSync(MARCA, 'utf8')), chamada_caixinha: '  Pergunta aqui\nsobre   emagrecimento ' };
  const { html } = montarCaixinha({ caixinha: { pergunta: ' Emagrecer é só\ncomer menos? ' }, marca: 'marca.json' }, (dir) => writeFileSync(join(dir, 'marca.json'), JSON.stringify(marca)));
  assert.deepEqual(caixinhaDe(html), { ...CAIXINHA.caixinha, topo: 920 }); // espaços e quebras de linha viram um espaço só
  const { html: outra } = montarCaixinha({ caixinha: { ...CAIXINHA.caixinha, chamada: 'Manda sua dúvida' }, marca: 'marca.json' }, (dir) => writeFileSync(join(dir, 'marca.json'), JSON.stringify(marca)));
  assert.equal(caixinhaDe(outra).chamada, 'Manda sua dúvida'); // a do escolhas.json vale mais que a do marca.json
  const { html: vazia } = montarCaixinha({ caixinha: { ...CAIXINHA.caixinha, chamada: '  ' }, marca: 'marca.json' }, (dir) => writeFileSync(join(dir, 'marca.json'), JSON.stringify(marca)));
  assert.equal(caixinhaDe(vazia).chamada, CAIXINHA.caixinha.chamada); // chamada vazia no escolhas.json: vale a do marca.json
});

test('caixinha: gancho de capa neste estilo é erro (a caixinha já é a capa); capa null ou false vale', () => {
  assert.match(erro('caixinha-pergunta', 'fonte.mp4', '', { ...CAIXINHA, capa: CAPA }), /Caixinha de pergunta já é a capa/);
  assert.match(erro('caixinha-pergunta', 'fonte.mp4', '', { ...CAIXINHA, capa: { estilo: 'banner' } }), /Caixinha de pergunta já é a capa/);
  for (const capa of [null, false]) assert.doesNotMatch(montarCaixinha({ capa }).html, /id="capa/);
});

test('caixinha: a fonte Inter 700 da caixinha precisa estar em fonts/', () => {
  const dir = projeto('caixinha-pergunta', CAIXINHA);
  try {
    rmSync(join(dir, 'fonts', 'Inter-700.woff2'));
    assert.throws(() => montar(dir, () => {}), /fonts\/Inter-700\.woff2.*baixar-fonte\.mjs" "Inter" "700"/);
    writeFileSync(join(dir, 'fonts', 'Inter-700.woff2'), '<!DOCTYPE html>');
    assert.throws(() => montar(dir, () => {}), /fonts\/Inter-700\.woff2 não é uma fonte woff2/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('caixinha: queixo opcional baixa o topo da caixa (60 px abaixo do queixo, nunca acima de 920); fora de 0 a 1920 é erro', () => {
  for (const queixo of ['840', -1, 2000, null])
    assert.match(erro('caixinha-pergunta', 'fonte.mp4', '', { ...CAIXINHA, caixinha: { ...CAIXINHA.caixinha, queixo } }), /caixinha\.queixo .* de 0 a 1920/, String(queixo));
  for (const [queixo, topo] of [[undefined, 920], [800, 920], [900, 960], [980, 1040], [1010, 1070]])
    assert.equal(caixinhaDe(montarCaixinha({ caixinha: { ...CAIXINHA.caixinha, queixo } }).html).topo, topo, String(queixo));
  // rosto baixo demais: nem a menor caixa cabe com a legenda acima de 1500
  assert.match(erro('caixinha-pergunta', 'fonte.mp4', '', { ...CAIXINHA, caixinha: { ...CAIXINHA.caixinha, queixo: 1011 } }), /queixo em 1011, a caixinha começaria em 1071 .* queixo pode ir até 1010/);
});

test('escolhas.json que não é objeto (null, lista, texto) para com mensagem clara', () => {
  for (const valor of [null, ['legenda-viva'], 'legenda-viva']) {
    const dir = projeto('legenda-viva');
    try {
      writeFileSync(join(dir, 'escolhas.json'), JSON.stringify(valor));
      assert.throws(() => montar(dir, () => {}), /o escolhas\.json precisa ser um objeto entre chaves/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
});
