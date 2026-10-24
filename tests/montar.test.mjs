// tests/montar.test.mjs: monta os 9 estilos (e o gancho de capa) com a marca de teste e uma fala de exemplo neutra
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { montar } from '../plugins/editor-chefe/scripts/montar.mjs';

const EC = createRequire(import.meta.url)('../plugins/editor-chefe/estilos/comum.js');
const MANIFESTO = JSON.parse(readFileSync(new URL('../plugins/editor-chefe/sons/manifest.json', import.meta.url), 'utf8'));
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
const corte = { limiar: -38, duracao: 9.5, manter: [[0.44, 3.86], [4.74, 9.5]] };
const ESCOLHAS = {
  'legenda-viva': {},
  'palavra-chave': { identidade: 'stomp', chaves: ['cliente', 'resposta', 'manhã', 'almoço'], apice: 'resposta' },
  'corte-seco-zoom': { enfase: ['resposta', 'almoço'] },
  'painel-escuro': { cartoes: [{ de: 0.5, titulo: 'Todo cliente recebe *resposta* no mesmo dia.' }, { de: 4.8, titulo: 'A *solução* sai antes do almoço.' }] },
  'editorial-claro': { cartoes: [{ de: 0.5, titulo: 'Todo cliente recebe *resposta* no mesmo dia.' }, { de: 4.8, titulo: 'A *solução* sai antes do almoço.' }] },
  // Tela dividida (7 a 9): vídeo na metade de baixo, texto ou animação na de cima
  'painel-escuro-dividido': { cartoes: [{ de: 0.5, titulo: 'Todo cliente recebe *resposta* no mesmo dia.' }, { de: 4.8, titulo: 'A *solução* sai antes do almoço.' }] },
  'editorial-claro-dividido': { cartoes: [{ de: 0.5, titulo: 'Todo cliente recebe *resposta* no mesmo dia.' }, { de: 4.8, titulo: 'A *solução* sai antes do almoço.' }] },
  'motion-dividido': { cartoes: [
    { de: 0.5, titulo: 'Resposta no *mesmo dia*', animacao: 'etapas', itens: ['todo cliente', 'recebe resposta', 'no mesmo dia'] },
    { de: 4.8, titulo: 'Antes do *almoço*', animacao: 'antes-depois', itens: ['chega de manhã', 'antes do almoço'] },
  ] },
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

test('palavra dentro de corte extra sai da legenda, com aviso; palavra dentro de corte de pausa fica', () => {
  // "todo" (1,4 a 1,68 s) cai no corte extra; "Se" (4,5 a 4,78 s) cai no corte da pausa depois de "dia." (3,86 a 4,74 s)
  const dir = projeto('legenda-viva', { efeitos: false }), avisos = [];
  try {
    writeFileSync(join(dir, 'trechos.json'), JSON.stringify({ ...corte, manter: [[0.44, 1.38], [1.7, 3.86], [4.74, 9.5]], extras: [[1.38, 1.7]] }));
    assert.equal(montar(dir, (m) => avisos.push(m)).palavras, texto.length - 1);
    assert.equal(avisos.length, 1);
    assert.match(avisos[0], /1 palavra dentro de um corte extra saiu da legenda: "todo"/);
    const legenda = JSON.parse(/const D = (.*);/.exec(readFileSync(join(dir, 'index.html'), 'utf8'))[1]).palavras.map(([w]) => w);
    assert.ok(!legenda.includes('todo') && legenda.includes('Se'), legenda.join(' '));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('"extras" do trechos.json fora do formato é erro em português', () => {
  assert.match(erro('legenda-viva', 'trechos.json', { ...corte, extras: ['1.38-1.7'] }), /"extras" do trechos\.json/);
});

test('o trecho começa no quadro de antes e termina no de depois (o fim da palavra não se perde), sem repetir quadro', () => {
  const dir = projeto('legenda-viva', { efeitos: false });
  try {
    // 0,42 vai para o quadro 12 (0,400 s) e 3,851 para o 116 (3,867 s); o 2º trecho começaria no quadro 115, já mostrado
    writeFileSync(join(dir, 'trechos.json'), JSON.stringify({ ...corte, manter: [[0.42, 3.851], [3.86, 9.5]] }));
    montar(dir, () => {});
    const html = readFileSync(join(dir, 'index.html'), 'utf8');
    const v = [...html.matchAll(/<video id="trecho-\d+"[^>]* data-start="([\d.]+)" data-duration="([\d.]+)" data-media-start="([\d.]+)"/g)].map((m) => m.slice(1));
    assert.deepEqual(v, [['0.000', '3.465', '0.400'], ['3.466', '5.633', '3.867']]); // a emenda no quadro 104 (3,4667 s) arredonda para baixo
    semMidiaRepetida(html);
  } finally { rmSync(dir, { recursive: true, force: true }); }
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
  assert.match(erro('legenda-viva', 'trechos.json', { ...corte, manter: [[0.44, 3.86], [5, 5]] }), /trecho 2 .* menos de 1 quadro/);
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
      const audios = html.match(/<audio id="efeito-\d+" class="clip" src="efeitos\/[\w-]+\.(mp3|wav)" data-start="[\d.]+" data-duration="[\d.]+" data-track-index="\d+" data-volume="[\d.]+"><\/audio>/g) || [];
      assert.ok(audios.length > 0, estilo);
      assert.equal(audios.length, r.efeitos, estilo);
      for (const a of audios) assert.ok(existsSync(join(dir, /src="([^"]+)"/.exec(a)[1])), a);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
});

// Os trechos do corte como o molde os lê (os mesmos do montar.mjs para este trechos.json)
const TRECHOS = [{ ini: 0, dur: 3.432, src: 0.433 }, { ini: 3.433, dur: 4.766, src: 4.733 }];
const PALAVRAS = fala.map((w) => [w.text, w.start, w.end]);

test('cada efeito começa no instante do movimento menos o pico medido do som, com o volume e a duração do manifesto', () => {
  for (const estilo of Object.keys(ESCOLHAS)) {
    const dir = projeto(estilo);
    try {
      const r = montar(dir, () => {});
      const ev = EC.efeitos(estilo, { palavras: PALAVRAS, ...ESCOLHAS[estilo] }, TRECHOS, 8.2);
      const audios = [...readFileSync(join(dir, 'index.html'), 'utf8').matchAll(/<audio id="efeito-\d+" class="clip" src="efeitos\/([^"]+)" data-start="([\d.]+)" data-duration="([\d.]+)" data-track-index="\d+" data-volume="([\d.]+)">/g)];
      assert.equal(audios.length, ev.length, estilo);
      assert.deepEqual(r.sons, ev.map((e) => e.som), estilo);
      audios.forEach(([, arq, ini, dur, vol], i) => {
        const s = MANIFESTO[ev[i].som];
        assert.equal(arq, s.arquivo, estilo);
        assert.equal(ini, Math.max(0, ev[i].t - s.pico).toFixed(3), `${estilo}: ${ev[i].som} em ${ev[i].t}`);
        assert.ok(ev[i].t - s.pico < 0 || Math.abs(+ini + s.pico - ev[i].t) <= 0.0005, `${estilo}: o pico de ${ev[i].som} não cai no movimento`);
        assert.equal(+vol, s.volume, estilo);
        assert.equal(+dur, Math.min(s.duracao, +(8.2 - +ini).toFixed(3)), estilo);
      });
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
});

test('o som do pacote (sons/) entra sem o plugin hyperframes; só o som da hyperframes pede o plugin', () => {
  const antes = process.env.HYPERFRAMES_PLUGIN_ROOT;
  process.env.HYPERFRAMES_PLUGIN_ROOT = join(HF, 'nao-existe');
  const dir = projeto('painel-escuro'); // só a entrada dos cartões: whoosh-largo, do pacote
  try {
    const r = montar(dir, () => {});
    assert.deepEqual(r.sons, ['whoosh-largo', 'whoosh-largo']);
    assert.ok(existsSync(join(dir, 'efeitos', MANIFESTO['whoosh-largo'].arquivo)));
  } finally { process.env.HYPERFRAMES_PLUGIN_ROOT = antes; rmSync(dir, { recursive: true, force: true }); }
});

test('palavra-chave: impacto no ápice (grave no stomp, suave no keynote), whooshes revezando nas outras palavras fortes', () => {
  for (const [identidade, apice] of [['stomp', 'impact-bass-1'], ['keynote', 'impacto-suave']]) {
    const dir = projeto('palavra-chave', { identidade });
    try {
      montar(dir, () => {});
      const sons = [...readFileSync(join(dir, 'index.html'), 'utf8').matchAll(/src="efeitos\/([\w-]+)\.(mp3|wav)"/g)].map((m) => m[1]);
      assert.deepEqual(sons, ['whoosh-short', apice, 'whoosh-rapido', 'whoosh-short'], identidade);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
});

test('corte seco: whoosh na aproximação, pop e pop da mão revezando nas palavras de ênfase', () => {
  assert.deepEqual(EC.efeitos('corte-seco-zoom', { palavras: PALAVRAS, ...ESCOLHAS['corte-seco-zoom'] }, TRECHOS, 8.2).map((e) => e.som), ['pop', 'whoosh-short', 'pop-mao']);
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
const CAPAS = ['faixa', 'manchete', 'editorial', 'faixa', 'manchete', 'editorial', 'faixa', 'manchete'];

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
  assert.match(erro('legenda-viva', 'trechos.json', { ...corte, manter: [[0.44, 3.86]] }, { capa: CAPA }), /curto demais para gancho de capa/);
});

test('capa: os estilos de 1 a 5 e de 7 a 9 levam a camada da capa com cópias mudas dos trechos dos primeiros 3 s', () => {
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
    writeFileSync(join(dir, 'trechos.json'), JSON.stringify({ ...corte, manter: [[0.44, 1.5], [2, 9.5]] }));
    montar(dir, () => {});
    const html = readFileSync(join(dir, 'index.html'), 'utf8');
    const copias = (html.match(/<video id="capa-trecho-\d+"[^>]*>/g) || []).map((v) => /data-start="([\d.]+)" data-duration="([\d.]+)" data-media-start="([\d.]+)"/.exec(v).slice(1));
    assert.deepEqual(copias, [['0.000', '1.064', '0.433'], ['1.066', '1.934', '2.000']]); // a 1ª cabe inteira na capa: 1 ms a menos que o trecho
    semMidiaRepetida(html);
    assert.equal(JSON.parse(/const D = (.*);/.exec(html)[1]).capa.queixo, 900);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('capa: efeitos sonoros somem antes do fim da capa e entra o whoosh grave no começo da saída', () => {
  const palavras = fala.map((w) => [w.text, w.start, w.end]);
  const trechos = [{ ini: 0, dur: 3.433, src: 0.433 }, { ini: 3.433, dur: 4.766, src: 4.733 }], total = 8.2;
  Object.keys(ESCOLHAS).forEach((estilo, i) => {
    const d = { palavras, ...ESCOLHAS[estilo] };
    assert.ok(EC.efeitos(estilo, d, trechos, total).some((e) => e.t < 3), `${estilo} sem capa tem efeito nos primeiros 3 s`);
    const capa = { estilo: CAPAS[i], texto: CAPA.texto, queixo: 840, fim: 3 };
    const ev = EC.efeitos(estilo, { ...d, capa }, trechos, total);
    assert.deepEqual(ev.filter((e) => e.t < capa.fim), [{ t: capa.estilo === 'manchete' ? 2.7 : 2.6, som: 'whoosh-grave' }], estilo);
    assert.ok(ev.some((e) => e.t >= capa.fim), estilo);
  });
});

test('sem capa, os estilos de 1 a 5 e de 7 a 9 ficam sem camada e sem cópia de vídeo', () => {
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
  assert.match(erro('legenda-viva', 'trechos.json', { ...corte, manter: [[0.44, 4.39]] }, { capa: CAPA }), /tem 3,97 s, curto demais para gancho de capa/);
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

// Tela dividida (estilos 7 a 9): vídeo na metade de baixo, em toda a largura; texto ou animação na de cima
const DIVIDIDOS = ['painel-escuro-dividido', 'editorial-claro-dividido', 'motion-dividido'];
const molde = (estilo) => readFileSync(new URL(`../plugins/editor-chefe/estilos/${estilo}.html`, import.meta.url), 'utf8');
const caixa = (html, id) => { const m = new RegExp(`#${id} \\{[^}]*?top: (\\d+)px;[^}]*?height: (\\d+)px;`).exec(html); return m && { top: +m[1], alt: +m[2] }; };

test('tela dividida: o vídeo ocupa a metade de baixo inteira e a legenda (no 8, a palavra grande) fica centrada na emenda', () => {
  for (const estilo of DIVIDIDOS) {
    const html = molde(estilo);
    assert.match(html, /#janela \{ position: absolute; left: 0; top: 960px; width: 1080px; height: 960px; overflow: hidden; \}/, estilo);
    assert.match(html, /\.trecho \{[^}]*object-fit: cover; object-position: \{\{FOCO\}\};/, estilo);
    const leg = caixa(html, estilo === 'editorial-claro-dividido' ? 'palavra' : 'legenda');
    assert.ok(leg, estilo);
    assert.equal(leg.top + leg.alt / 2, 960, estilo);
  }
  const painel = caixa(molde('motion-dividido'), 'painel'); // a animação fica sempre em cima, acima da legenda
  assert.ok(painel.top + painel.alt <= caixa(molde('motion-dividido'), 'legenda').top, JSON.stringify(painel));
});

test('tela dividida: whoosh largo na entrada de cada cartão (no 9, de cada animação, e clique discreto em cada item seguinte), sem som na legenda', () => {
  for (const estilo of DIVIDIDOS) {
    const ev = EC.efeitos(estilo, { palavras: PALAVRAS, ...ESCOLHAS[estilo] }, TRECHOS, 8.2);
    const cartao = ev.filter((e) => e.som === 'whoosh-largo'), resto = ev.filter((e) => e.som !== 'whoosh-largo');
    assert.deepEqual(cartao.map((e) => +e.t.toFixed(3)), [0.067, 3.5], estilo);
    if (estilo !== 'motion-dividido') { assert.deepEqual(resto, [], estilo); continue; }
    // os itens depois do primeiro (que entra com o título), no instante em que a animação mostra cada um
    const itens = ESCOLHAS[estilo].cartoes.flatMap((c, i, cs) => EC.batidas(EC.mapear(PALAVRAS, TRECHOS, 8.2), c.itens, EC.naEdicao(c.de, 'ini', TRECHOS, 8.2), cs[i + 1] ? EC.naEdicao(cs[i + 1].de, 'ini', TRECHOS, 8.2) : 8.2).slice(1).map((b) => b.t));
    assert.deepEqual(resto.map((e) => e.t), itens, estilo);
    assert.deepEqual(resto.map((e) => e.som), ['tique', 'clique-suave', 'tique'], estilo);
  }
});

test('motion: o primeiro item entra junto com o título; os outros quando a fala diz as palavras deles, na ordem', () => {
  const pal = ['Aqui', 'Resposta,', 'no', 'mesmo', 'dia.', 'Depois'].map((txt, i) => ({ txt, ini: i, fim: i + 0.5 }));
  const b = (itens, ini = 0, fim = 6) => EC.batidas(pal, itens, ini, fim);
  const T = EC.ENTRA_TITULO; // o instante do título no molde, depois do começo da ideia
  assert.equal(T, 0.05);
  assert.deepEqual(b(['RESPOSTA', 'mesmo dia']), [{ t: T, achou: true }, { t: 3, achou: true }]); // sem diferença de caixa e pontuação
  assert.deepEqual(b(['mesmo dia'], 2.5, 6), [{ t: 2.55, achou: true }]); // dito 0,5 s depois do começo: entra no começo mesmo assim
  assert.deepEqual(b(['dia', 'resposta']), [{ t: T, achou: true }, { t: 0.55, achou: false }]); // fora de ordem não volta
  assert.deepEqual(b(['garantia', 'no']), [{ t: T, achou: false }, { t: 2, achou: true }]); // o primeiro sem a fala é avisado pelo montador
  assert.deepEqual(b(['Aqui', 'mesmo'], 0, 3.2), [{ t: T, achou: true }, { t: 2.6, achou: true }]); // nunca depois de fim - 0,6 s
  assert.deepEqual(b(['Depois'], 0, 3), [{ t: T, achou: false }]); // só procura dentro da ideia
  assert.deepEqual(b(['?']), [{ t: T, achou: false }]); // item sem palavra não quebra
});

test('motion: o número que cresce lê o número no jeito brasileiro e escreve cada passo no mesmo formato', () => {
  const n = EC.numero('R$ 2.000');
  assert.deepEqual(n, { antes: 'R$ ', valor: 2000, casas: 0, milhar: true, depois: '' });
  assert.equal(EC.escrever(n, 1234.4), 'R$ 1.234');
  assert.equal(EC.escrever(EC.numero('30%'), 7.6), '8%');
  assert.equal(EC.escrever(EC.numero('1,5 milhão'), 0.7), '0,7 milhão');
  assert.equal(EC.escrever(EC.numero('2000 clientes'), 1500), '1500 clientes'); // sem ponto no original, sem ponto na contagem
  assert.equal(EC.numero('sem número'), null);
});

const motion = (cartoes) => ({ estilo: 'motion-dividido', marca: MARCA, cartoes });
test('motion: animação, quantidade e tamanho dos itens, número e título são conferidos com mensagem em português', () => {
  const c = (extra) => motion([{ de: 0.5, titulo: 'Resposta', animacao: 'lista', itens: ['todo cliente', 'recebe resposta'], ...extra }]);
  const msg = (extra) => erro('motion-dividido', 'escolhas.json', c(extra));
  assert.match(msg({ animacao: 'grafico' }), /cartão 1 pede "animacao", uma destas: etapas, antes-depois, lista, numero, pergunta, comparacao/);
  assert.match(msg({ animacao: undefined }), /pede "animacao"/);
  assert.match(msg({ animacao: 'etapas', itens: ['a', 'b', 'c', 'd'] }), /\(etapas\) pede "itens", uma lista com 2 a 3 textos curtos/);
  assert.match(msg({ animacao: 'antes-depois', itens: ['todo cliente'] }), /\(antes-depois\) pede "itens", uma lista com 2 textos curtos/);
  assert.match(msg({ itens: 'todo cliente' }), /pede "itens"/);
  assert.match(msg({ itens: ['todo cliente', '  '] }), /pede "itens"/);
  assert.match(msg({ itens: ['todo cliente recebe resposta no', 'dia'] }), /tem 31 caracteres; em lista cabem até 28/);
  assert.match(msg({ animacao: 'numero', itens: ['vários'] }), /primeiro item é o número dito na fala, com algarismos/);
  assert.match(msg({ animacao: 'numero', itens: ['R$ 1.000.000,00 '] }), /tem 15 caracteres; em numero cabem até 14/);
  assert.match(msg({ titulo: 'Todo cliente recebe *resposta* no mesmo dia, sempre' }), /título do cartão 1 tem 49 caracteres; .* até 40/);
  assert.match(erro('motion-dividido', 'escolhas.json', motion([{ de: 0.5, titulo: 'x' }])), /pede "animacao"/);
});

test('motion: as 6 animações montam; item que não está na fala daquela ideia é avisado e o texto colado vira uma linha', () => {
  const cartoes = [
    { de: 0.5, titulo: '', animacao: 'etapas', itens: ['Aqui na loja', 'todo cliente'] },
    { de: 2.0, titulo: 'Resposta', animacao: 'lista', itens: ['recebe  resposta', 'no mesmo dia', 'garantia'] },
    { de: 4.8, titulo: 'A *dúvida*', animacao: 'numero', itens: ['24 horas', 'a dúvida'] },
    { de: 5.4, titulo: 'Manhã', animacao: 'pergunta', itens: ['chega de manhã', 'a solução'] },
    { de: 6.6, titulo: 'Solução', animacao: 'comparacao', itens: ['solução', 'sai'] },
    { de: 7.2, titulo: 'Almoço', animacao: 'antes-depois', itens: ['antes', 'do\nalmoço'] },
  ];
  const dir = projeto('motion-dividido', { cartoes }), avisos = [];
  try {
    montar(dir, (m) => avisos.push(m));
    const D = JSON.parse(/const D = (.*);/.exec(readFileSync(join(dir, 'index.html'), 'utf8'))[1]);
    assert.deepEqual(D.cartoes.map((c) => c.animacao), ['etapas', 'lista', 'numero', 'pergunta', 'comparacao', 'antes-depois']);
    assert.deepEqual(D.cartoes[1].itens, ['recebe resposta', 'no mesmo dia', 'garantia']);
    assert.deepEqual(D.cartoes[5].itens, ['antes', 'do almoço']);
    assert.equal(D.cartoes[2].titulo, 'A *dúvida*'); // o título guarda a palavra forte
    assert.deepEqual(avisos.map((m) => /"([^"]+)" do cartão (\d)/.exec(m).slice(1)), [['garantia', '2'], ['24 horas', '3']]);
    assert.match(avisos[0], /entra 0,5 s depois do anterior/); // 'garantia' é o terceiro item
    assert.match(avisos[1], /entra junto com o título, mas o texto precisa ser da fala/); // '24 horas' é o primeiro
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// Motion dividido com ícones: item como { "texto", "icone" }, ícones da biblioteca fechada EC.ICONES
test('ícones: a biblioteca é fechada, cada ícone é só traço desenhado aqui, e a tabela do motion-dividido.md cita todos', () => {
  const nomes = Object.keys(EC.ICONES);
  assert.ok(nomes.length >= 16, String(nomes.length));
  for (const n of nomes) {
    assert.match(n, /^[a-z]+$/, n); // nome simples para o escolhas.json, sem acento
    assert.ok(EC.ICONES[n].length && EC.ICONES[n].every((d) => /^~?M[\d. ]/.test(d) && /^[~MLHVCAZ\d. -]+$/i.test(d)), n); // só comandos de caminho
    assert.ok(EC.ICONES[n].some((d) => !d.startsWith('~')), n); // ao menos um traço na cor destaque
  }
  const doc = readFileSync(new URL('../plugins/editor-chefe/skills/editor-chefe/references/estilos/motion-dividido.md', import.meta.url), 'utf8');
  for (const n of nomes) assert.match(doc, new RegExp('`' + n + '`'), n);
});

test('ícones: item com ícone monta e leva a lista de ícones; texto puro continua como antes', () => {
  const D = (cartoes) => {
    const dir = projeto('motion-dividido', { cartoes }), avisos = [];
    try { montar(dir, (m) => avisos.push(m)); return { D: JSON.parse(/const D = (.*);/.exec(readFileSync(join(dir, 'index.html'), 'utf8'))[1]), avisos }; } finally { rmSync(dir, { recursive: true, force: true }); }
  };
  const com = D([
    { de: 0.5, titulo: 'Resposta', animacao: 'etapas', itens: [{ texto: 'todo cliente', icone: 'pessoa' }, { texto: 'recebe  resposta', icone: 'conversa' }] },
    { de: 4.8, titulo: 'Manhã', animacao: 'pergunta', itens: ['a dúvida chega de manhã', { texto: 'a solução sai', icone: 'ideia' }] },
  ]);
  assert.deepEqual(com.avisos, []);
  assert.deepEqual(com.D.cartoes[0].itens, ['todo cliente', 'recebe resposta']);
  assert.deepEqual(com.D.cartoes[0].icones, ['pessoa', 'conversa']);
  assert.deepEqual(com.D.cartoes[1].icones, [null, 'ideia']); // na pergunta, cada item tem ou não o seu
  assert.equal(D(ESCOLHAS['motion-dividido'].cartoes).D.cartoes[0].icones, undefined);
});

test('ícones: nome fora da biblioteca e ícone em só parte da fileira ou da lista são erro em português', () => {
  const c = (animacao, itens) => motion([{ de: 0.5, titulo: 'Resposta', animacao, itens }]);
  assert.match(erro('motion-dividido', 'escolhas.json', c('lista', [{ texto: 'todo cliente', icone: 'foguete' }, { texto: 'resposta', icone: 'pessoa' }])),
    /o ícone "foguete" do cartão 1 não existe\. Use um destes: conversa, documento/);
  assert.match(erro('motion-dividido', 'escolhas.json', c('lista', [{ texto: 'todo cliente', icone: '' }, 'resposta'])), /o ícone "" do cartão 1 não existe/);
  for (const animacao of ['etapas', 'lista', 'antes-depois', 'comparacao'])
    assert.match(erro('motion-dividido', 'escolhas.json', c(animacao, [{ texto: 'todo cliente', icone: 'pessoa' }, 'recebe resposta'])),
      new RegExp(`no cartão 1 \\(${animacao}\\), ponha ícone em todos os itens ou em nenhum`), animacao);
  assert.match(erro('motion-dividido', 'escolhas.json', c('lista', [{ icone: 'pessoa' }, 'resposta'])), /pede "itens".*\{ "texto": "\.\.\.", "icone": "\.\.\." \}/);
});

test('tela dividida: no Editorial claro dividido a marca aparece uma vez só (na assinatura, no alto)', () => {
  const html = molde('editorial-claro-dividido');
  assert.match(html, /<div id="assinatura-texto">\{\{ASSINATURA\}\}<\/div>/);
  assert.doesNotMatch(html, /D\.nome/);
});

test('legenda em caixa escura (estilos 4, 7 e 9): a caixa é opaca, porque o contraste da palavra falada é conferido contra o fundo escuro puro', () => {
  for (const estilo of ['painel-escuro', 'painel-escuro-dividido', 'motion-dividido']) // com a caixa a 92%, o vídeo claro vazava e a palavra caía para 2,99:1
    assert.match(molde(estilo), /\.grupo \.caixa \{[^}]*background: var\(--fundo-escuro\);/, estilo);
});

// Aproximação no rosto: fonte.mp4 de verdade (1080x1920, para o montador medir) e o rosto.json gravado depois dela
function comRosto(estilo, extra, caixa = [540, 900, 300, 300]) {
  const dir = projeto(estilo, extra);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x303030:s=1080x1920:r=30:d=9.5', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', join(dir, 'fonte.mp4')]);
  writeFileSync(join(dir, 'rosto.json'), JSON.stringify({ estado: 'sem sobra', rastro: { qps: 2, W: 1080, H: 1920, caixas: Array(20).fill(caixa) } }));
  utimesSync(join(dir, 'rosto.json'), new Date(), new Date(Date.now() + 1000));
  return dir;
}
const aproxima = (dir) => {
  const html = readFileSync(join(dir, 'index.html'), 'utf8');
  return { html, lista: JSON.parse(/const D = (\{.*\});/.exec(html)[1]).aproximar ?? [] };
};

test('aproximar: a frase de ênfase vira uma aproximação no rosto, com o invólucro #aproximar em volta dos trechos', () => {
  for (const estilo of ['legenda-viva', 'painel-escuro-dividido', 'painel-escuro']) {
    const dir = comRosto(estilo, { aproximar: ['a solução sai'] }), avisos = [];
    try {
      const r = montar(dir, (m) => avisos.push(m));
      const { html, lista } = aproxima(dir);
      assert.deepEqual(avisos, [], estilo);
      assert.equal(r.aproximacoes, 1, estilo);
      assert.equal(lista.length, 1);
      assert.ok(lista[0].z >= 1.1 && lista[0].z <= 1.25 && lista[0].de > 4.5 && lista[0].de < 5.1, JSON.stringify(lista[0]));
      assert.match(html, /<div id="aproximar" data-layout-allow-overflow style="position: absolute; inset: 0;">\s*<video id="trecho-1"[^]*<video id="trecho-2"[^]*?<\/video>\s*<\/div>/, estilo);
      assert.match(html, /if \(D\.aproximar\) EC\.aproximar\(tl, D\.aproximar\);/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
});

test('aproximar: cada molde com gravação (menos o Corte seco) chama a aproximação', () => {
  for (const estilo of [...Object.keys(ESCOLHAS), 'caixinha-pergunta'].filter((e) => e !== 'corte-seco-zoom')) {
    const m = readFileSync(new URL(`../plugins/editor-chefe/estilos/${estilo}.html`, import.meta.url), 'utf8');
    assert.match(m, /if \(D\.aproximar\) EC\.aproximar\(tl, D\.aproximar\);\s*(if \(D\.capa\) EC\.capa\(tl, D\.capa\);\s*)?window\.__timelines/, estilo);
  }
});

test('aproximar: rosto embaixo da caixinha, Corte seco, sem rosto.json ou rosto.json velho seguem sem aproximar, com aviso', () => {
  const casos = [
    [comRosto('caixinha-pergunta', { ...CAIXINHA, aproximar: ['a solução sai'] }), /embaixo do texto/],
    [comRosto('corte-seco-zoom', { aproximar: ['a solução sai'] }), /Corte seco/],
  ];
  const sem = comRosto('legenda-viva', { aproximar: ['a solução sai'] });
  rmSync(join(sem, 'rosto.json'));
  const velho = comRosto('legenda-viva', { aproximar: ['a solução sai'] });
  utimesSync(join(velho, 'rosto.json'), new Date(), new Date(Date.now() - 60000)); // a fonte foi gravada de novo depois do rosto.mjs
  casos.push([sem, /falta o rosto\.json/], [velho, /falta o rosto\.json/]);
  for (const [dir, aviso] of casos) {
    const avisos = [];
    try {
      const r = montar(dir, (m) => avisos.push(m));
      assert.equal(r.aproximacoes, 0);
      assert.doesNotMatch(aproxima(dir).html, /id="aproximar"/);
      assert.match(avisos.join('\n'), aviso);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
});

test('aproximar: false desliga sem aviso; formato errado é erro em português', () => {
  const dir = comRosto('legenda-viva', { aproximar: false }), avisos = [];
  try {
    assert.equal(montar(dir, (m) => avisos.push(m)).aproximacoes, 0);
    assert.deepEqual(avisos, []);
    writeFileSync(join(dir, 'escolhas.json'), JSON.stringify({ estilo: 'legenda-viva', marca: MARCA, aproximar: 'a solução sai' }));
    assert.throws(() => montar(dir, () => {}), /"aproximar" é a lista das frases de ênfase/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('trechos encostados nunca se sobrepõem na linha do tempo (o lint acusaria duplicate_audio_track)', () => {
  // Caso real da prova de 2026-10-24: trecho no quadro 2531 com 38 quadros; 84.367 + 1.266 passava de 85.633 no ponto flutuante
  const manter = [];
  for (let q = 0, i = 0; q < 2400; i++) { const n = 1 + ((i * 37) % 59); manter.push([q / 30, (q + n) / 30]); q += n + (i % 3); }
  manter.push([2531 / 30, 2569 / 30], [2569 / 30, 2600 / 30]);
  const dir = projeto('legenda-viva', { efeitos: false });
  writeFileSync(join(dir, 'trechos.json'), JSON.stringify({ limiar: -38, duracao: 90, manter }));
  montar(dir, () => {});
  const v = [...readFileSync(join(dir, 'index.html'), 'utf8').matchAll(/<video id="trecho-\d+"[^>]*data-start="([\d.]+)" data-duration="([\d.]+)"/g)].map((m) => [+m[1], +m[2]]);
  assert.equal(v.length, manter.length);
  v.slice(1).forEach(([ini], i) => assert.ok(v[i][0] + v[i][1] < ini, `trecho ${i + 1} (${v[i][0]} + ${v[i][1]}) passa do início do ${i + 2} (${ini})`));
  // e nenhum quadro cai no milésimo entre um trecho e o seguinte: sem isso, o quadro sai sem vídeo, só com o fundo (medido na
  // prova de 2026-10-24: os quadros 101 e 404, nas emendas de 3,367 s e 13,467 s, saíram vazios)
  const fim = v[v.length - 1][0] + v[v.length - 1][1];
  for (let q = 0; q / 30 < fim; q++) assert.ok(v.some(([ini, dur]) => q / 30 >= ini && q / 30 < ini + dur), `o quadro ${q} (${(q / 30).toFixed(4)} s) fica sem vídeo`);
  rmSync(dir, { recursive: true, force: true });
});
