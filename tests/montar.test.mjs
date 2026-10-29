// tests/montar.test.mjs: monta os estilos (e o gancho de capa) com a marca de teste e uma fala de exemplo neutra
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, utimesSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { montar, planoDestaques, lerPecas, GSAP_SHA256 } from '../plugins/editor-chefe/scripts/montar.mjs';
import { zonas, cobre } from '../plugins/editor-chefe/scripts/conferir.mjs';

// banco local de peças só deste arquivo de teste (o montador guarda ali as peças e o logo do cliente)
const BIB_TESTE = mkdtempSync(join(tmpdir(), 'biblioteca-'));
process.env.EDITOR_CHEFE_BIBLIOTECA = BIB_TESTE;
test.after(() => rmSync(BIB_TESTE, { recursive: true, force: true }));

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
  // Animado pela fala (11): as frases fortes, com a palavra-chave entre asteriscos (depois dos 3 s da capa, para valer com ela)
  'destaques-tipograficos': { destaques: ['Se a *dúvida* chega', 'a *solução* sai antes do almoço'] },
  // Papelaria (12): cartões em letra de mão; o segundo com a lista que ganha o check item por item
  papelaria: { cartoes: [{ de: 0.5, titulo: 'Todo cliente recebe *resposta*' }, { de: 4.8, titulo: 'Antes do *almoço*', lista: ['chega de manhã', 'antes do almoço'] }] },
};
// Sexto estilo, fora da lista acima (sem efeitos sonoros e sem gancho de capa): a caixinha de perguntas do Instagram
const CAIXINHA = { estilo: 'caixinha-pergunta', caixinha: { pergunta: 'Emagrecer é só comer menos?', chamada: 'Pergunta aqui sobre emagrecimento' } };

function projeto(estilo, extra = {}) {
  const dir = mkdtempSync(join(tmpdir(), `montar-${estilo}-`));
  mkdirSync(join(dir, 'fonts'));
  for (const f of ['Montserrat-800.woff2', 'Inter-400.woff2', 'Inter-700.woff2', 'PlayfairDisplay-400-italic.woff2', 'Caveat-700.woff2', 'Anton-400.woff2']) writeFileSync(join(dir, 'fonts', f), WOFF2);
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
// Os dados que o montador grava no molde (const D), para conferir os efeitos com o que o vídeo usa de fato
const lerD = (dir) => JSON.parse(/const D = (.*);/.exec(readFileSync(join(dir, 'index.html'), 'utf8'))[1]);

test('cada efeito começa no instante do movimento menos o pico medido do som, com o volume e a duração do manifesto', () => {
  for (const estilo of Object.keys(ESCOLHAS)) {
    const dir = projeto(estilo);
    try {
      const r = montar(dir, () => {});
      const ev = EC.efeitos(estilo, lerD(dir), TRECHOS, 8.2);
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
// cor "jaleco": fundo escuro com as pontas brancas (60 px de cada lado), como a legenda que cai no pescoço e no jaleco
function comFonte(estilo, cor, extra = {}) {
  const dir = projeto(estilo, extra), jaleco = cor === 'jaleco';
  const vf = jaleco ? ['-vf', 'drawbox=x=0:y=0:w=60:h=640:color=white:t=fill,drawbox=x=300:y=0:w=60:h=640:color=white:t=fill'] : [];
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=c=${jaleco ? '0x202020' : cor}:s=360x640:d=1:r=30`, ...vf, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', join(dir, 'fonte.mp4')]);
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
    ['legenda-viva', 'jaleco', {}, '0'], // nos estilos com véu, a medida continua a média da faixa (como na 0.8.1)
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
const CAPAS = ['faixa', 'manchete', 'editorial', 'faixa', 'manchete', 'editorial', 'faixa', 'manchete', 'editorial', 'faixa'];

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

test('capa: os estilos de 1 a 5, de 7 a 9, 11 e 12 levam a camada da capa com cópias mudas dos trechos dos primeiros 3 s', () => {
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
    let d = { palavras, ...ESCOLHAS[estilo] };
    if (estilo === 'destaques-tipograficos') { // o plano das frases sai do montador; as do exemplo começam depois dos 3 s da capa
      const dir = projeto(estilo);
      try { montar(dir, () => {}); d = lerD(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
    } else assert.ok(EC.efeitos(estilo, d, trechos, total).some((e) => e.t < 3), `${estilo} sem capa tem efeito nos primeiros 3 s`);
    const capa = { estilo: CAPAS[i], texto: CAPA.texto, queixo: 840, fim: 3 };
    const ev = EC.efeitos(estilo, { ...d, capa }, trechos, total);
    assert.deepEqual(ev.filter((e) => e.t < capa.fim), [{ t: capa.estilo === 'manchete' ? 2.7 : 2.6, som: 'whoosh-grave' }], estilo);
    assert.ok(ev.some((e) => e.t >= capa.fim), estilo);
  });
});

test('sem capa, os estilos de 1 a 5, de 7 a 9, 11 e 12 ficam sem camada e sem cópia de vídeo', () => {
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

test('tela dividida: o vídeo ocupa a metade de baixo inteira; a legenda fica dentro dela, embaixo, e no 8 a palavra grande fica na emenda', () => {
  for (const estilo of [...DIVIDIDOS, 'papelaria']) {
    const html = molde(estilo);
    assert.match(html, /#janela \{ position: absolute; left: 0; top: 960px; width: 1080px; height: 960px; overflow: hidden; \}/, estilo);
    assert.match(html, /\.trecho \{[^}]*object-fit: cover; object-position: \{\{FOCO\}\};/, estilo);
    if (estilo === 'editorial-claro-dividido') { const p = caixa(html, 'palavra'); assert.equal(p.top + p.alt / 2, 960, estilo); continue; } // a identidade do 8, centrada na emenda
    const leg = caixa(html, 'legenda');
    assert.deepEqual([leg.top, leg.top + leg.alt], [1500, 1650], estilo); // inteira dentro do vídeo, sem cruzar a divisa, abaixo do rosto
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

// Motion dividido com painel branco (0.8.1): o fundo fica no escuro da marca e o painel da animação fica branco
const MARCAS_MOTION = {
  'destaque escuro': { CLARO: '#F5F1EA', ESCURO: '#141414', DESTAQUE: '#9A6A5A' }, // a de tests/marca-teste.json
  'destaque claro (amarelo)': { CLARO: '#FAF7F0', ESCURO: '#14213D', DESTAQUE: '#F2C200' },
  'escuro e destaque claros demais': { CLARO: '#FFFFFF', ESCURO: '#7A7A7A', DESTAQUE: '#FFE066' }, // o escuro também escurece no painel
};
test('motion: no painel branco o texto lê com 4,5:1, traço e destaque com 3:1 (a cor clara escurecida) e o cabeçalho lê no escuro', () => {
  const BRANCO = [255, 255, 255], c = EC.contraste;
  for (const [nome, m] of Object.entries(MARCAS_MOTION)) {
    const P = EC.coresMotion(m);
    assert.deepEqual(P.PAINEL, BRANCO, nome);
    for (const fundo of [BRANCO, P.FORTE]) assert.ok(c(P.TEXTO, fundo) >= 4.5, `${nome}: texto ${c(P.TEXTO, fundo)}`); // o tom forte fica embaixo de texto
    assert.ok(c(P.APAGADO, BRANCO) >= 4.5 && c(P.APAGADO, BRANCO) < c(P.TEXTO, BRANCO), `${nome}: apagado ${c(P.APAGADO, BRANCO)}`);
    for (const k of ['LINHA', 'DETALHE']) assert.ok(c(P[k], BRANCO) >= 3, `${nome}: ${k} ${c(P[k], BRANCO)}`);
    assert.ok(c(P.TRACO_APAGADO, BRANCO) >= 2, `${nome}: traço apagado ${c(P.TRACO_APAGADO, BRANCO)}`);
    for (const k of ['NUM_CABECA', 'FILETE']) assert.ok(c(P[k], m.ESCURO) >= 3, `${nome}: ${k} no fundo escuro ${c(P[k], m.ESCURO)}`);
    const antes = EC.mistura(m.ESCURO, m.CLARO, 0.05); // fora do painel nada muda: as contas da 0.8.0, contra o painel de antes
    assert.deepEqual([P.NUM_CABECA, P.FILETE], [EC.legivel(EC.mistura(m.CLARO, antes, 0.55), m.CLARO, antes, 3.2), EC.legivel(m.DESTAQUE, m.CLARO, antes, 3.2)], nome);
  }
  // destaque que já lê no branco fica a cor da marca; o amarelo escurece no mesmo matiz e o filete do cabeçalho segue amarelo
  assert.deepEqual(EC.coresMotion(MARCAS_MOTION['destaque escuro']).LINHA, [0x9a, 0x6a, 0x5a]);
  const amarela = EC.coresMotion(MARCAS_MOTION['destaque claro (amarelo)']);
  assert.ok(amarela.LINHA.every((v, i) => v <= [0xf2, 0xc2, 0x00][i]) && amarela.LINHA[2] === 0, String(amarela.LINHA));
  assert.deepEqual(amarela.FILETE, [0xf2, 0xc2, 0x00]);
});

test('motion: o molde usa as cores do painel branco dentro dele e as do fundo escuro fora', () => {
  const html = molde('motion-dividido'), regra = (sel) => new RegExp(`(^|\\n)\\s*${sel.replace(/[.*]/g, '\\$&')} \\{([^}]*)\\}`).exec(html)?.[2] ?? assert.fail(sel);
  assert.match(regra('#painel'), /background: var\(--painel\); $/);
  for (const sel of ['.ideia-tit', '.rot', '.etapa-num']) assert.match(regra(sel), /[^-]color: var\(--texto-painel\)/, sel);
  assert.match(regra('.ideia-num'), /color: var\(--num-cabeca\)/); // fora do painel, no fundo escuro
  for (const sel of ['#cabeca-filete', '#emenda']) assert.match(regra(sel), /background: var\(--filete\)/, sel);
  for (const sel of ['.caixa-anim', '.balao', '.balao-cauda']) assert.match(regra(sel), /background: var\(--painel\)/, sel);
  for (const sel of ['.caixa-anim.forte', '.balao.resposta', '.balao.resposta .balao-cauda']) assert.match(regra(sel), /background: var\(--forte\)/, sel);
  assert.doesNotMatch(html, /--painel-2|color-mix\(in srgb, var\(--linha\)/);
  assert.match(html, /tl\.to\(r, \{ color: TEXTO_PAINEL, x: 10/); // o item dito da lista acende no texto escuro, não no claro
  assert.match(html, /P = EC\.coresMotion\(C\)/);
});

test('tela dividida: no Editorial claro dividido a marca aparece uma vez só (na assinatura, no alto)', () => {
  const html = molde('editorial-claro-dividido');
  assert.match(html, /<div id="assinatura-texto">\{\{ASSINATURA\}\}<\/div>/);
  assert.doesNotMatch(html, /D\.nome/);
});

test('legenda do Corte seco nos estilos com muitos elementos (4, 7, 9 e 12): sem caixa, dentro do vídeo, com o traço na ênfase', () => {
  for (const estilo of ['painel-escuro', 'painel-escuro-dividido', 'motion-dividido', 'papelaria']) {
    const html = molde(estilo);
    assert.match(html, /EC\.legendaCorrida\(tl, C, \{ fortes: D\.fortes, familia: "\{\{TITULO\}\}",[^}]*reforcar: \{\{VEU\}\} === 1 \}\);/, estilo);
    assert.doesNotMatch(html, /legendaEmCaixa|\.grupo|\.caixa \{/, estilo);
  }
  // no 4, a legenda fica dentro da janela do vídeo, embaixo
  const j = caixa(molde('painel-escuro'), 'janela'), l = caixa(molde('painel-escuro'), 'legenda');
  assert.ok(l.top >= j.top && l.top + l.alt <= j.top + j.alt, JSON.stringify({ j, l }));
  // a legenda: linha corrida no claro da marca, com o contorno numa camada de trás e um fio dele na letra, e o traço de 8 px
  const js = readFileSync(new URL('../plugins/editor-chefe/estilos/comum.js', import.meta.url), 'utf8');
  assert.match(js, /#legenda \.p::before \{ content: attr\(data-t\);[^`]*-webkit-text-stroke: \$\{reforcar \? 10 : 5\}px/);
  assert.match(js, /#legenda \.sublinha \{[^}]*height: 8px;[^}]*background: \$\{c\.DESTAQUE\};/);
  assert.match(js, /tl\.set\(el, \{ opacity: 0, display: "none" \}, sai\);/);
});

test('legenda do Corte seco: a ênfase sai da palavra forte de cada cartão, dita no tempo dele, ou do "enfase" do escolhas.json', () => {
  const dir = projeto('painel-escuro'), avisos = [];
  try {
    montar(dir, (m) => avisos.push(m));
    const D = lerD(dir), txt = (i) => D.palavras[i][0];
    assert.deepEqual(D.fortes.map(txt), ['resposta', 'solução']); // "Todo cliente recebe *resposta*", "A *solução* sai"
    writeFileSync(join(dir, 'escolhas.json'), JSON.stringify({ estilo: 'painel-escuro', marca: MARCA, ...ESCOLHAS['painel-escuro'], enfase: ['cliente', 'almoço.', 'garantia'] }));
    montar(dir, (m) => avisos.push(m));
    assert.deepEqual(lerD(dir).fortes.map(txt), ['cliente', 'almoço.']);
    assert.match(avisos.join('\n'), /"garantia" \(enfase\) não foi achada na fala/);
    writeFileSync(join(dir, 'escolhas.json'), JSON.stringify({ estilo: 'painel-escuro', marca: MARCA, ...ESCOLHAS['painel-escuro'], enfase: 'cliente' }));
    assert.throws(() => montar(dir, () => {}), /"enfase" é a lista das palavras da fala que ganham o traço na legenda/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('legenda do Corte seco: com a faixa da legenda clara no vídeo, o contorno e a sombra ficam reforçados (nunca volta a caixa)', () => {
  // "jaleco": a média da faixa fica abaixo de 130, mas as pontas no branco pedem o reforço (o 90º percentil da luma)
  for (const [estilo, cor, esperado] of [['painel-escuro', 'white', 1], ['painel-escuro', '0x202020', 0], ['painel-escuro-dividido', 'white', 1], ['motion-dividido', '0x202020', 0], ['papelaria', 'white', 1],
    ['painel-escuro', 'jaleco', 1], ['motion-dividido', 'jaleco', 1], ['motion-dividido', '0x808080', 0]]) {
    const dir = comFonte(estilo, cor), avisos = [];
    try {
      const r = montar(dir, (m) => avisos.push(m));
      assert.equal(r.veu, !!esperado, `${estilo} ${cor}`);
      assert.equal(r.reforco, !!esperado, `${estilo} ${cor}`);
      assert.match(readFileSync(join(dir, 'index.html'), 'utf8'), new RegExp(`reforcar: ${esperado} === 1`), `${estilo} ${cor}`);
      assert.deepEqual(avisos, []);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
});

test('estilo 8: a palavra grande na emenda continua o padrão; "legenda": "corrida" é a opção de teste com a legenda do Corte seco', () => {
  const dir = projeto('editorial-claro-dividido');
  try {
    montar(dir, () => {});
    let html = readFileSync(join(dir, 'index.html'), 'utf8');
    assert.deepEqual(zonas(html, 8.2).map((z) => [z.nome, z.y0, z.y1]), [['a palavra na tela', 880, 1040]]);
    assert.equal(lerD(dir).legenda, undefined);
    writeFileSync(join(dir, 'escolhas.json'), JSON.stringify({ estilo: 'editorial-claro-dividido', marca: MARCA, ...ESCOLHAS['editorial-claro-dividido'], legenda: 'corrida' }));
    montar(dir, () => {});
    html = readFileSync(join(dir, 'index.html'), 'utf8');
    assert.deepEqual(zonas(html, 8.2).map((z) => [z.nome, z.y0, z.y1]), [['a legenda', 1500, 1650]]); // a conferência vê a faixa nova
    assert.match(html, /<div id="legenda"><\/div>/);
    assert.doesNotMatch(html, /<div id="palavra"><\/div>/);
    const D = lerD(dir);
    assert.equal(D.legenda, 'corrida');
    assert.deepEqual(D.fortes.map((i) => D.palavras[i][0]), ['resposta', 'solução']);
    writeFileSync(join(dir, 'escolhas.json'), JSON.stringify({ estilo: 'editorial-claro-dividido', marca: MARCA, ...ESCOLHAS['editorial-claro-dividido'], legenda: 'caixa' }));
    assert.throws(() => montar(dir, () => {}), /"legenda" no Editorial claro dividido é "palavra" \(a palavra grande na emenda, o padrão\) ou "corrida"/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
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
    // no dividido o rosto de teste fica no alto da metade de vídeo, acima da legenda (que fica embaixo, de 1500 a 1650)
    const dir = comRosto(estilo, { aproximar: ['a solução sai'] }, estilo === 'painel-escuro-dividido' ? [540, 760, 300, 300] : undefined), avisos = [];
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

// Destaques tipográficos (estilo 11): a frase forte em letra grande acima da cabeça, palavra por palavra no tempo da fala,
// e a legenda pequena embaixo com as outras palavras
const PAL_ED = EC.mapear(PALAVRAS, TRECHOS, 8.2);
const cabeca = (topo) => () => [540, topo + 0.75 * 300, 300, 300]; // rosto de 300 px com o alto da cabeça (caixa e cabelo) em "topo"
const trecho = (a, b) => PAL_ED.slice(a, b + 1).map((p) => p.txt).join(' ');

test('destaques: cada frase vira as palavras da fala, a palavra-chave e o instante da primeira; sai 1,5 s depois ou 0,35 s antes da seguinte', () => {
  const r = planoDestaques(['Se a *dúvida* chega', 'a *solução* sai antes do almoço'], PAL_ED, { total: 8.2 });
  assert.deepEqual(r.destaques.map((x) => trecho(x.de, x.ate)), ['Se a dúvida chega', 'a solução sai antes do almoço.']);
  assert.deepEqual(r.destaques.map((x) => trecho(...x.chave)), ['dúvida', 'solução']);
  r.destaques.forEach((x) => assert.equal(x.t, +PAL_ED[x.de].ini.toFixed(3)));
  assert.equal(r.destaques[0].sai, +(PAL_ED[r.destaques[1].de].ini - 0.35).toFixed(3)); // a seguinte vem antes de 1,5 s
  assert.equal(r.destaques[1].sai, 8.2); // a última fica até o fim do vídeo (menos de 1,5 s depois)
  // sem rastro do rosto: o vídeo não aproxima e a faixa é fixa, de 240 a 640 px; a conferência recebe a faixa com o tempo da frase
  assert.deepEqual([r.z, r.abre], [1, []]);
  assert.deepEqual(r.faixas.map((f) => [f.y0, f.y1, f.x0, f.x1]), [[240, 640, 90, 990], [240, 640, 90, 990]]);
  r.faixas.forEach((f, i) => assert.deepEqual([f.de, f.ate], [+(r.destaques[i].t - 0.15).toFixed(3), +(r.destaques[i].sai + 0.25).toFixed(3)]));
  assert.match(r.faixas[0].nome, /a frase em destaque "Se a dúvida chega"/);
});

test('destaques: sem moldura, a frase fica acima da cabeça se ali couber inteira (com o vídeo aproximado ancorado no alto, se preciso); senão vai para logo abaixo do queixo', () => {
  const f = ['a *solução* sai antes do almoço'], plano = (caixa, avisos = [], extra = {}) => planoDestaques(f, PAL_ED, { total: 8.2, caixa, ...extra }, (m) => avisos.push(m));
  const baixa = plano(cabeca(700));
  assert.deepEqual([baixa.z, baixa.destaques[0].lado, baixa.destaques[0].y1, baixa.abre, baixa.semLegenda], [1, 'cima', 670, [], []]); // cabeça baixa: o vídeo fica como foi gravado, e a legenda também
  // cabeça em 450: os 540 px acima dela (240 + 270 + 30) pedem 1,2; um ponto y vai para y * 1,2
  const media = plano(cabeca(450));
  assert.deepEqual([media.z, media.destaques[0].lado, media.destaques[0].y1, media.semLegenda], [1.2, 'cima', 510, []]);
  assert.deepEqual(media.abre, [[+(media.destaques[0].t - 0.4).toFixed(3), +Math.min(8.2, media.destaques[0].sai + 0.25).toFixed(3)]]);
  // a frase em duas linhas cheias precisa de 270 px: em vídeo já ampliado (até 1,15) ou com o queixo segurando a aproximação
  // (rosto de 600 px, queixo em 1200: 1290 / 1200), não cabe em cima; vai para logo abaixo do queixo, sem aproximar
  for (const [nome, r, queixo] of [['contida', plano(cabeca(450), [], { teto: 1.15 }), 825], ['grande', plano(() => [540, 900, 450, 600]), 1200]]) {
    const d = r.destaques[0];
    assert.deepEqual([r.z, r.abre, d.lado, d.y0, d.y1], [1, [], 'baixo', queixo + 30, queixo + 30 + 270], nome);
    assert.equal(r.semLegenda.length, 1, nome); // a legenda sai enquanto a frase está embaixo do queixo
  }
  // a selfie comum (alto da cabeça em 110, queixo em 485) e a cabeça cortada no alto: a frase encosta 30 px abaixo do
  // queixo (nunca acima de 240, o cabeçalho do Instagram), sem aviso
  for (const [topo, y0] of [[110, 515], [-200, 240]]) {
    const avisos = [], alta = plano(cabeca(topo), avisos), d = alta.destaques[0];
    assert.deepEqual([alta.z, alta.abre, d.lado, d.y0, d.y1], [1, [], 'baixo', y0, y0 + 270], String(topo));
    assert.deepEqual(avisos, []);
  }
  // queixo em 1500: embaixo dele sobram 120 px até o piso de 1650, e em cima nada; a faixa fica nos 150 px do mínimo, com aviso
  const avisos = [], miuda = plano(() => [540, 900, 300, 1200], avisos);
  assert.deepEqual([miuda.destaques[0].lado, miuda.destaques[0].y0, miuda.destaques[0].y1], ['baixo', 1500, 1650]);
  assert.match(avisos.join('\n'), /ficou apertada embaixo do queixo/);
  // a cabeça que sobe durante a frase puxa a faixa para cima; fora dela, não conta
  const sobe = plano((t) => [540, (t > 5.5 && t < 6.5 ? 560 : 700) + 225, 300, 300]);
  assert.deepEqual([sobe.z, sobe.destaques[0].y1], [1, 530]);
  const antes = plano((t) => [540, (t < 1 ? 300 : 700) + 225, 300, 300]); // alta em menos de 15% do vídeo: não aproxima
  assert.deepEqual([antes.z, antes.destaques[0].y1], [1, 670]);
  // alta em 24% do vídeo: aproxima para ela (o queixo, 85º percentil em 1075, segura em 1,2), e a faixa vai ao máximo
  const muito = plano((t) => [540, (t < 2 ? 300 : 700) + 225, 300, 300]);
  assert.deepEqual([muito.z, muito.destaques[0].y1], [1.2, 760]);
});

test('destaques: nenhum plano descobre borda do vídeo; escala de 1 para cima, ancorada no alto, sem deslocamento, e nada cobre o rosto aproximado', () => {
  // O molde: só a escala muda no #enquadramento, ancorada no alto, e nada de cor sólida pode aparecer em volta do vídeo
  const html = molde('destaques-tipograficos');
  assert.match(html, /#enquadramento \{[^}]*transform-origin: 50% 0; \}/);
  assert.match(html, /for \(const \[a, b\] of D\.abre\) \{\s*const ab = \{ scale: D\.z \}, fe = \{ scale: 1 \};/);
  assert.doesNotMatch(html, /emenda-topo|--borda|borderRadius|D\.desce|translate/);
  // Os planos: rostos de 200 a 900 px, do alto cortado ao meio da tela, parados e se mexendo, com frase e com peças, nos dois tetos
  const pecas = [{ tipo: 'janela', print: 'prints/tela.png', fala: 'Aqui na loja' }, ...lerPecas([{ tipo: 'selo', selo: 'aprovado', fala: 'Se a dúvida' }, { tipo: 'objeto', objeto: 'relogio', fala: 'antes do almoço' }], null)];
  let n = 0;
  for (const h of [200, 300, 450, 600, 900]) for (const topo of [-150, 0, 60, 150, 300, 450, 700]) for (const anda of [0, 140]) for (const teto of [1.25, 1.15]) for (const comPecas of [false, true]) {
    const caixa = (t) => [540, topo + 0.75 * h + anda * Math.sin(t), 0.75 * h, h], avisos = [];
    const r = comPecas ? planoDestaques(undefined, PAL_ED, { total: 8.2, caixa, pecas, teto }, (m) => avisos.push(m)) : planoDestaques(['a *solução* sai antes do almoço'], PAL_ED, { total: 8.2, caixa, teto }, (m) => avisos.push(m));
    const caso = JSON.stringify({ h, topo, anda, teto, comPecas, z: r.z });
    n++;
    // com a origem no alto e escala s, a borda do vídeo vai para 0 (em cima), 1920 * s (embaixo) e 540 -/+ 540 * s (dos
    // lados): cobre a tela só com s de 1 para cima, e sem deslocamento nenhum
    assert.ok(r.z >= 1 && r.z <= teto, caso);
    assert.equal(r.desce, undefined, caso);
    assert.equal(r.borda, undefined, caso);
    if (r.z > 1) assert.ok(r.abre.length > 0, caso);
    else assert.deepEqual(r.abre, [], caso);
    // a legenda (caminho 2): fora da tela durante toda frase ou peça embaixo do queixo; na tela durante a janela, que não
    // mostra a fala, e a janela fora da faixa da legenda (1310 a 1480)
    const grupos = EC.palavraPorVez(PAL_ED.map((p, k) => ({ ...p, k })), new Set(), 8.2, r.semLegenda);
    for (const f of r.faixas.filter((x) => x.lado && x.lado !== 'cima')) {
      if (!/janela/.test(f.nome)) { assert.deepEqual(grupos.filter((g) => g.ini < f.ate && g.sai > f.de), [], `${caso} ${f.nome}: legenda na tela com ela embaixo do queixo`); continue; }
      const [a, b] = [f.de + 0.15, f.ate - 0.25];
      assert.ok(f.legenda && !r.semLegenda.some(([x, y]) => x < b && y > a), `${caso} ${f.nome}: a legenda saiu durante a janela`);
      if (f.legendaY == null) assert.ok(f.y1 <= 1310 || f.y0 >= 1480, `${caso} ${f.nome}: a janela cobre a legenda (${f.y0} a ${f.y1})`);
      else { // a janela embaixo do queixo: a legenda sobe, entre 240 e 20 px acima da cabeça em todo instante dela, sem tocar a janela
        assert.ok(f.legendaY >= 240 && f.legendaY + 170 <= f.y0, `${caso} legenda no alto em ${f.legendaY}, janela em ${f.y0}`);
        for (let t = f.de; t <= f.ate; t += 0.1) { const c = caixa(t), s = r.abre.some(([x, y]) => t >= x && t <= y + 0.45) ? r.z : 1; assert.ok((c[1] - 0.75 * c[3]) * s - (f.legendaY + 170) >= 20 - 1e-9, `${caso} legenda a menos de 20 px da cabeça em ${t.toFixed(1)} s`); }
      }
      for (const p of PAL_ED.filter((x) => x.ini >= a && x.ini < b)) assert.ok(grupos.some((g) => g.ini <= p.ini && g.sai > p.ini), `${caso} "${p.txt}" sem legenda na janela`);
    }
    // o rosto (a caixa, sem o cabelo) na posição de cada instante, com a escala do momento, fora de toda faixa de frase e de
    // peça; quando a pessoa ocupa o quadro todo, o montador avisa que ficou apertada
    if (avisos.some((m) => /apertada/.test(m))) continue;
    for (const f of r.faixas) for (let t = f.de + 0.15; t <= f.ate - 0.25; t += 0.1) {
      const [cx, cy, w, hh] = caixa(t), s = r.abre.some(([a, b]) => t >= a + 0.4 && t <= b) ? r.z : 1;
      const x0 = 540 + (cx - w / 2 - 540) * s, x1 = 540 + (cx + w / 2 - 540) * s, y0 = (cy - hh / 2) * s, y1 = (cy + hh / 2) * s;
      assert.ok(f.x1 <= x0 || f.x0 >= x1 || f.y1 <= y0 || f.y0 >= y1, `${caso} ${f.nome} em ${t.toFixed(1)} s: faixa ${[f.y0, f.y1]} e rosto ${[Math.round(y0), Math.round(y1)]}`);
    }
  }
  assert.equal(n, 280);
});

test('destaques: frase fora da fala, no gancho de capa ou colada na anterior fica de fora com aviso; formato errado é erro em português', () => {
  const avisos = [], r = planoDestaques(['todo cliente recebe *garantia*', 'Aqui na *loja*', 'Se a *dúvida* chega', 'de *manhã*, a solução'], PAL_ED, { total: 8.2, desde: 3 }, (m) => avisos.push(m));
  assert.deepEqual(r.destaques.map((x) => trecho(x.de, x.ate)), ['Se a dúvida chega']);
  assert.equal(avisos.length, 3, avisos.join('\n'));
  assert.match(avisos[0], /"todo cliente recebe garantia" não foi achada na fala, na ordem; ficou de fora/);
  assert.match(avisos[1], /"Aqui na loja" cai no gancho de capa/);
  assert.match(avisos[2], /"de manhã, a solução" começa menos de meio segundo depois da anterior; ficou de fora/);
  assert.throws(() => planoDestaques([], PAL_ED, { total: 8.2 }), /pedem "destaques"/);
  assert.throws(() => planoDestaques('Se a *dúvida*', PAL_ED, { total: 8.2 }), /pedem "destaques"/);
  for (const f of ['Se a dúvida chega', '*Se* a *dúvida* chega', 'Se a *dúvida chega'])
    assert.throws(() => planoDestaques([f], PAL_ED, { total: 8.2 }), /exatamente uma palavra-chave entre asteriscos/, f);
  assert.throws(() => planoDestaques(['*dúvida*'], PAL_ED, { total: 8.2 }), /tem 1 palavra e 6 caracteres; use de 2 a 10/);
  assert.throws(() => planoDestaques(['Aqui na loja, todo cliente recebe *resposta* no mesmo dia. Se'], PAL_ED, { total: 8.2 }), /tem 11 palavras/);
  assert.match(erro('destaques-tipograficos', 'escolhas.json', { estilo: 'destaques-tipograficos', marca: MARCA }), /pedem "destaques"/);
});

test('destaques: whoosh na entrada de cada frase e pop na palavra-chave (o mais forte fica, a menos de 0,5 s); nada na legenda pequena', () => {
  const d = { palavras: PALAVRAS, ...planoDestaques(['Se a *dúvida* chega', 'a solução sai antes do *almoço*'], PAL_ED, { total: 8.2 }) };
  const ev = EC.efeitos('destaques-tipograficos', d, TRECHOS, 8.2).map((e) => [+e.t.toFixed(3), e.som]);
  assert.deepEqual(ev, [[3.8, 'pop'], [5, 'whoosh-short'], [6.5, 'pop-mao']]); // "Se" (3,433) fica sem som: "dúvida" vem 0,37 s depois
});

test('destaques: o montador lê o rosto.json e grava a faixa de cada frase; a conferência enxerga a faixa e reprova o rosto embaixo dela', () => {
  const dir = comRosto('destaques-tipograficos', {}), avisos = []; // rosto em 900, com 300 px: o alto da cabeça em 675
  try {
    const r = montar(dir, (m) => avisos.push(m));
    assert.deepEqual(avisos, []);
    assert.equal(r.destaques, 2);
    const html = readFileSync(join(dir, 'index.html'), 'utf8'), D = lerD(dir);
    assert.equal(D.z, 1);
    assert.deepEqual(D.destaques.map((x) => x.y1), [645, 645]);
    const z = zonas(html, 8.2), frase = z.filter((a) => /frase em destaque/.test(a.nome));
    assert.equal(z[0].nome, 'a legenda'); // a legenda de uma palavra, do molde
    assert.deepEqual([z[0].y0, z[0].y1], [1310, 1480]);
    assert.deepEqual(frase.map((a) => [a.y0, a.y1, a.de, a.ate]), D.faixas.map((f) => [240, 645, f.de, f.ate]));
    const meio = (D.destaques[1].t + D.destaques[1].sai) / 2;
    assert.equal(cobre({ x: 540, y: 500, w: 300, h: 300 }, meio, z).length, 1, 'rosto que subiu para baixo da frase');
    assert.equal(cobre({ x: 540, y: 900, w: 300, h: 300 }, meio, z).length, 0, 'rosto abaixo da frase');
    assert.equal(cobre({ x: 540, y: 500, w: 300, h: 300 }, 1, z).length, 0, 'sem frase na tela, nada cobre');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('destaques: no cartão branco a frase lê com 4,5:1 e a palavra-chave com 3:1, com o destaque claro escurecido rumo ao preto', () => {
  const BRANCO = [255, 255, 255], c = EC.contraste;
  for (const [nome, m] of Object.entries(MARCAS_MOTION)) {
    const K = EC.coresMotion(m);
    assert.ok(c(K.TEXTO, BRANCO) >= 4.5, `${nome}: frase ${c(K.TEXTO, BRANCO)}`);
    assert.ok(c(K.LINHA, BRANCO) >= 3, `${nome}: palavra-chave ${c(K.LINHA, BRANCO)}`);
  }
  assert.deepEqual(EC.coresMotion(MARCAS_MOTION['destaque escuro']).LINHA, [0x9a, 0x6a, 0x5a]); // já lê no branco: fica a cor da marca
  const amarela = EC.coresMotion(MARCAS_MOTION['destaque claro (amarelo)']).LINHA; // o amarelo escurece no mesmo matiz (mostarda)
  assert.ok(amarela.every((v, i) => v < [0xf2, 0xc2, 0x00][i] || v === 0) && amarela[0] > amarela[1] && amarela[2] === 0, String(amarela));
  assert.equal(EC.coresDestaques, undefined); // o véu escuro saiu
});

test('destaques: o molde põe cada palavra no instante dela, a legenda de uma palavra sem as palavras grandes e a aproximação sem moldura', () => {
  const html = molde('destaques-tipograficos');
  assert.match(html, /\{ opacity: 1, y: 0, duration: 0\.24, ease: "power3\.out" \}, PAL\[i\]\.ini\)/);
  assert.match(html, /EditorChefePecas\.legenda\(tl, EC\.semDestaques\(PAL\.map\(\(p, k\) => \(\{ \.\.\.p, k \}\)\), D\.destaques\), new Set\(D\.chaves \?\? \[\]\), C\.TOTAL, D\.semLegenda \?\? \[\], D\.legendaNoAlto \?\? \[\]\);/);
  assert.match(html, /if \(x\.lado === "baixo"\) caixa\.style\.justifyContent = "flex-start";/); // embaixo do queixo, o cartão encosta nele
  assert.doesNotMatch(html, /legendaEmCaixa|\.grupo/);
  assert.match(html, /K = EC\.coresMotion\(C\);\s*raizCss\.setProperty\("--texto-frase", em\(K\.TEXTO\)\);\s*raizCss\.setProperty\("--chave", em\(K\.LINHA\)\);/);
  assert.match(html, /\.destaque-frase \{[^]*?background: #fff;[^]*?overflow: hidden;[^]*?color: var\(--texto-frase\);\s*\}/); // a frase num cartão branco, que recorta a entrada das palavras
  // o cartão não encolhe com a faixa (com overflow hidden, o flex o deixaria do tamanho dela e recortaria a segunda linha):
  // a letra é que encolhe até caber
  assert.match(html, /\.destaque-frase \{\s*flex: none;/);
  assert.match(html, /while \(s > 56 && \(frase\.offsetHeight > alt/);
  assert.doesNotMatch(html, /destaque-veu|destaque liso|--chave-liso/);
  assert.match(html, /for \(const \[a, b\] of D\.abre\)[\s\S]*?scale: D\.z/); // aproxima e volta nos intervalos do plano
  const d = planoDestaques(['Se a *dúvida* chega', 'a *solução* sai antes do almoço'], PAL_ED, { total: 8.2 });
  assert.deepEqual(EC.semDestaques(PAL_ED, d.destaques).map((p) => p.txt), ['Aqui', 'na', 'loja,', 'todo', 'cliente', 'recebe', 'resposta', 'no', 'mesmo', 'dia.', 'de', 'manhã,']);
});

test('destaques: o vídeo só aproxima para a frase depois do gancho de capa, e a aproximação no rosto que cai com ela fica de fora, com aviso', () => {
  const dir = comRosto('destaques-tipograficos', { capa: CAPA, aproximar: ['a solução sai'] }, [540, 675, 300, 300]), avisos = []; // cabeça em 450
  try {
    montar(dir, (m) => avisos.push(m));
    const html = readFileSync(join(dir, 'index.html'), 'utf8'), D = lerD(dir);
    assert.equal(D.z, 1.2); // 540 px acima da cabeça (240 + 270 + 30) / 450
    assert.match(html, /\.capa-trecho \{[^}]*transform: translateY\(var\(--desce, 0px\)\); \}/); // sem --desce no molde: a capa fica no vídeo fechado
    assert.doesNotMatch(html, /setProperty\("--desce"/);
    assert.ok(D.abre.every(([a]) => a >= 3), JSON.stringify(D.abre));
    assert.ok(D.destaques.every((x) => x.y1 === 450 * 1.2 - 30), JSON.stringify(D.destaques));
    assert.equal(D.aproximar, undefined);
    assert.match(avisos.join('\n'), /a aproximação em [\d,]+ s cai com uma frase ou peça acima da cabeça \(o vídeo já está aproximado para ela ali\)/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// Papelaria (estilo 12): cartões brancos em letra de mão acima da pessoa e a lista que ganha o check (ou o risco) item por item
const papel = (cartoes) => ({ estilo: 'papelaria', marca: MARCA, cartoes });

test('papelaria: título, lista e marca do cartão são conferidos com mensagem em português; texto colado vira uma linha', () => {
  const msg = (c) => erro('papelaria', 'escolhas.json', papel([{ de: 0.5, titulo: 'Todo cliente', ...c }]));
  assert.match(msg({ titulo: '  ' }), /cartão 1 pede "titulo", o trecho da fala que vai escrito à mão/);
  assert.match(msg({ titulo: '*Todo* *cliente*' }), /no máximo uma palavra forte entre asteriscos/);
  assert.match(msg({ titulo: 'Aqui na loja, todo cliente recebe resposta no mesmo' }), /tem 51 caracteres; na Papelaria cabem até 48/);
  for (const lista of [[], ['a', 'b', 'c', 'd', 'e'], 'chega de manhã', ['chega', ' ']])
    assert.match(msg({ lista }), /"lista" é uma lista com 1 a 4 textos curtos tirados da fala/, JSON.stringify(lista));
  assert.match(msg({ lista: ['todo cliente recebe resposta no mesmo'] }), /tem 37 caracteres; na lista cabem até 32/);
  assert.match(msg({ lista: ['todo cliente'], marca: 'x' }), /"marca" é "check" .* ou "risco"/);
  const dir = projeto('papelaria', { cartoes: [{ de: 0.5, titulo: ' Todo cliente\nrecebe *resposta* ', lista: ['todo  cliente'], marca: 'risco' }] }), avisos = [];
  try {
    montar(dir, (m) => avisos.push(m));
    assert.deepEqual(avisos, []);
    assert.deepEqual(lerD(dir).cartoes, [{ de: 0.5, titulo: 'Todo cliente recebe *resposta*', lista: ['todo cliente'], marca: 'risco' }]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('papelaria: título ou item que não está na fala daquele cartão é avisado', () => {
  const dir = projeto('papelaria', { cartoes: [{ de: 0.5, titulo: 'Atendimento *rápido*', lista: ['todo cliente', 'garantia'] }, { de: 4.8, titulo: 'Antes do almoço', lista: ['todo cliente'] }] }), avisos = [];
  try {
    montar(dir, (m) => avisos.push(m));
    assert.equal(avisos.length, 3, avisos.join('\n'));
    assert.match(avisos[0], /o título "Atendimento rápido" do cartão 1 não aparece igual na fala desse cartão/);
    assert.match(avisos[1], /o item "garantia" do cartão 1 .* o check entra 0,5 s depois do anterior/);
    assert.match(avisos[2], /o item "todo cliente" do cartão 2/); // dito no cartão 1: fora do cartão 2
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('papelaria: cada item ganha a marca no começo da última palavra dele, o primeiro também, nunca depois de 0,6 s antes do fim do cartão', () => {
  const pal = ['Primeiro,', 'a', 'análise', 'técnica.', 'Depois', 'negociação.'].map((txt, i) => ({ txt, ini: i, fim: i + 0.5 }));
  const m = (itens, ini = 0, fim = 8) => EC.batidas(pal, itens, ini, fim, { comTitulo: false, naUltima: true });
  assert.deepEqual(m(['análise técnica', 'negociação']), [{ t: 3, achou: true }, { t: 5, achou: true }]); // "técnica" e "negociação"
  assert.deepEqual(m(['a análise']), [{ t: 2, achou: true }]); // o primeiro item não entra com o título: espera ser dito
  assert.deepEqual(m(['garantia', 'negociação']), [{ t: 0.55, achou: false }, { t: 5, achou: true }]);
  assert.deepEqual(m(['negociação'], 0, 5.5), [{ t: 4.9, achou: true }]); // fim do cartão em 5,5 s: a marca fica na tela antes da saída
  assert.deepEqual(EC.batidas(pal, ['análise técnica'], 0, 8), [{ t: EC.ENTRA_TITULO, achou: true }]); // o Motion dividido segue como era
});

test('papelaria: whoosh largo na entrada de cada cartão e clique discreto em cada check ou risco, no instante em que o item é dito', () => {
  const dir = projeto('papelaria');
  try {
    montar(dir, () => {});
    const d = lerD(dir), ev = EC.efeitos('papelaria', d, TRECHOS, 8.2).map((e) => [+e.t.toFixed(3), e.som]);
    // "manhã," (original 6,0 s) e "almoço." (7,8 s) na edição; a entrada dos cartões em 0,067 e 3,5 s
    assert.deepEqual(ev, [[0.067, 'whoosh-largo'], [3.5, 'whoosh-largo'], [4.7, 'tique'], [6.5, 'clique-suave']]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('papelaria: no papel branco a tinta lê com 4,5:1, traço, check e risco com 3:1, o item riscado ainda com 4,5:1, e a assinatura no fundo claro', () => {
  const BRANCO = [255, 255, 255], c = EC.contraste;
  for (const [nome, m] of Object.entries(MARCAS_MOTION)) {
    const P = EC.coresPapelaria({ ...m, TEXTO: m.ESCURO });
    assert.deepEqual(P.PAINEL, BRANCO, nome);
    assert.ok(c(P.TEXTO, BRANCO) >= 4.5 && c(P.APAGADO, BRANCO) >= 4.5, `${nome}: tinta ${c(P.TEXTO, BRANCO)}, riscado ${c(P.APAGADO, BRANCO)}`);
    assert.ok(c(P.LINHA, BRANCO) >= 3 && c(P.DETALHE, BRANCO) >= 3, `${nome}: traço ${c(P.LINHA, BRANCO)}, quadradinho ${c(P.DETALHE, BRANCO)}`);
    assert.ok(c(P.CABECA, m.CLARO) >= 4.5, `${nome}: assinatura ${c(P.CABECA, m.CLARO)}`);
    assert.deepEqual(P.LINHA, EC.coresMotion(m).LINHA, nome); // a mesma conta do painel branco
  }
  const amarela = EC.coresPapelaria({ ...MARCAS_MOTION['destaque claro (amarelo)'], TEXTO: '#14213D' }).LINHA; // escurece no mesmo matiz
  assert.ok(amarela.every((v, i) => v <= [0xf2, 0xc2, 0x00][i]) && amarela[2] === 0 && amarela[0] > amarela[1], String(amarela));
});

test('papelaria: o molde usa as cores do papel, a letra de mão Caveat e a marca no tempo da fala; a legenda é a do Corte seco', () => {
  const html = molde('papelaria');
  assert.match(html, /P = EC\.coresPapelaria\(C\)/);
  assert.match(html, /EC\.batidas\(PAL, c\.lista, ini, fim, \{ comTitulo: false, naUltima: true \}\)/); // a mesma conta dos efeitos
  assert.match(html, /EC\.legendaCorrida\(tl, C, \{ fortes: D\.fortes/); // a legenda do Corte seco, sem o papel branco
  assert.match(html, /\.titulo \{[^}]*font-family: "Caveat", cursive; font-weight: 700;/);
  const dir = projeto('papelaria');
  try {
    montar(dir, () => {});
    assert.match(readFileSync(join(dir, 'index.html'), 'utf8'), /@font-face \{ font-family: "Caveat"; src: url\("fonts\/Caveat-700\.woff2"\) format\("woff2"\); font-weight: 700;/);
    rmSync(join(dir, 'fonts', 'Caveat-700.woff2'));
    assert.throws(() => montar(dir, () => {}), /falta a letra de mão da Papelaria \(fonts\/Caveat-700\.woff2\).*baixar-fonte\.mjs" "Caveat" "700"/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a duração da edição vai no milésimo de baixo: a HyperFrames não grava um quadro depois do último trecho', () => {
  const dir = projeto('legenda-viva', { efeitos: false });
  try {
    // 2786 quadros (92,8667 s): "92.867" faria a HyperFrames gravar 2787 quadros, o último só com o fundo
    writeFileSync(join(dir, 'trechos.json'), JSON.stringify({ ...corte, duracao: 100, manter: [[0, 50], [51, 93.85]] })); // 1500 + 1286 quadros
    montar(dir, () => {});
    const html = readFileSync(join(dir, 'index.html'), 'utf8'), d = +/data-composition-id="editor-chefe"[^>]*?data-duration="([\d.]+)"/.exec(html)[1];
    const v = [...html.matchAll(/<video id="trecho-\d+"[^>]* data-start="([\d.]+)" data-duration="([\d.]+)"/g)].map((m) => [+m[1], +m[2]]), [a, b] = v[v.length - 1];
    assert.equal(d, 92.866);
    assert.equal(Math.ceil(d * 30 - 1e-9), 2786); // quadros de 0 a 2785
    assert.ok(2785 / 30 < a + b, `o último quadro (${2785 / 30}) cai no último trecho, que vai até ${a + b}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('palavra que anima y ou scale sai também do layout (display none), nunca só fica transparente', () => {
  // na gravação rápida da HyperFrames (900 quadros ou mais), o elemento escondido só com opacity 0 depois de animar uma
  // transformação mostrava a pintura velha por trás da palavra seguinte (provado num render de 930 quadros, 2026-10-26)
  const comum = readFileSync(new URL('../plugins/editor-chefe/estilos/comum.js', import.meta.url), 'utf8'), corrida = comum.slice(comum.indexOf('function legendaCorrida'), comum.indexOf('function capa('));
  const fontes = { corrida, pecas: readFileSync(new URL('../plugins/editor-chefe/estilos/pecas.js', import.meta.url), 'utf8') };
  for (const estilo of ['corte-seco-zoom', 'editorial-claro-dividido', 'editorial-claro', 'palavra-chave']) fontes[estilo] = molde(estilo);
  for (const [nome, js] of Object.entries(fontes)) {
    const sets = [...js.matchAll(/tl\.set\(el, \{ opacity: 0[^}]*\}/g)];
    assert.ok(sets.length, nome);
    for (const m of sets) assert.match(m[0], /display: "none"/, `${nome}: ${m[0]}`);
  }
});

test('nenhum molde carrega script da internet: o GSAP vem do plugin, com o SHA-256 registrado, e vai para a pasta do vídeo', () => {
  const E = fileURLToPath(new URL('../plugins/editor-chefe/estilos/', import.meta.url)), sha = (b) => createHash('sha256').update(b).digest('hex');
  const moldes = readdirSync(E).filter((a) => a.endsWith('.html'));
  assert.equal(moldes.length, 12);
  for (const m of moldes) {
    const html = readFileSync(join(E, m), 'utf8');
    assert.doesNotMatch(html, /<script[^>]+src\s*=\s*["'](?:https?:)?\/\//i, m);
    assert.match(html, /<script src="gsap\.min\.js"><\/script>/, m);
  }
  assert.equal(sha(readFileSync(join(E, 'gsap.min.js'))), GSAP_SHA256);
  assert.match(readFileSync(join(E, 'gsap.min.js'), 'utf8'), /^\/\*!\n \* GSAP 3\.14\.2\n/);
  assert.match(readFileSync(join(E, 'gsap-LICENCA.txt'), 'utf8'), /Standard "No Charge" GSAP License/);
  assert.match(readFileSync(new URL('../NOTICE', import.meta.url), 'utf8'), new RegExp(`GSAP 3\\.14\\.2[\\s\\S]*${GSAP_SHA256}`));
  const dir = projeto('legenda-viva');
  try {
    montar(dir, () => {});
    assert.equal(sha(readFileSync(join(dir, 'gsap.min.js'))), GSAP_SHA256);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
