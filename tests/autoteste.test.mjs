// tests/autoteste.test.mjs: o autoteste monta o projeto sintético (sem internet: fonte falsa, como no montar.test) e,
// com um lançador da HyperFrames de mentira, confere o MP4 e grava a marca de pronto.
// Precisa de ffmpeg e ffprobe no PATH e do detector de rosto na pasta de dados (o prefixo do ambiente.sh resolve, depois
// do preparar.sh): cada pasta de dados do teste ganha uma cópia dele.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { autoteste, estaPronto } from '../plugins/editor-chefe/scripts/autoteste.mjs';

const VERSAO = JSON.parse(readFileSync(new URL('../plugins/editor-chefe/.claude-plugin/plugin.json', import.meta.url), 'utf8')).version;
const raiz = mkdtempSync(join(tmpdir(), 'autoteste-'));
test.after(() => rmSync(raiz, { recursive: true, force: true }));

// HyperFrames de mentira: os sons (só a pasta de efeitos) e um lançador que "renderiza" com o ffmpeg um MP4 com áudio em
// -16 LUFS, com a duração do index.html, em 1080x1920 ou no TAMANHO pedido pelo teste
const HF = join(raiz, 'hyperframes');
const SFX = join(HF, 'skills', 'media-use', 'audio', 'assets', 'sfx');
mkdirSync(SFX, { recursive: true });
const SONS = { 'whoosh-short': 0.57, pop: 0.72, 'impact-bass-1': 2.12 };
writeFileSync(join(SFX, 'manifest.json'), JSON.stringify(Object.fromEntries(Object.entries(SONS).map(([k, d]) => [k, { file: `${k}.mp3`, duration: d }]))));
for (const k of Object.keys(SONS)) writeFileSync(join(SFX, `${k}.mp3`), 'ID3');
mkdirSync(join(HF, 'skills', 'hyperframes', 'scripts'), { recursive: true });
writeFileSync(join(HF, 'skills', 'hyperframes', 'scripts', 'plugin-cli.mjs'), `import { spawnSync } from 'node:child_process';
if (process.env.DORMIR) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20000); // render que trava
import { readFileSync } from 'node:fs';
const a = process.argv.slice(2), saida = a[a.indexOf('-o') + 1], d = /data-duration="([0-9.]+)"/.exec(readFileSync('index.html', 'utf8'))[1];
const r = spawnSync(process.env.HYPERFRAMES_FFMPEG_PATH ?? 'ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=s=' + (process.env.TAMANHO ?? '1080x1920') + ':d=' + d, '-f', 'lavfi', '-i', 'sine=d=' + d,
  '-af', 'aformat=channel_layouts=stereo,loudnorm=I=-16', '-pix_fmt', 'yuv420p', '-shortest', saida], { stdio: 'inherit' });
process.exit(a[0] === 'render' ? r.status : 1);
`);
process.env.HYPERFRAMES_PLUGIN_ROOT = HF;

// Pasta de dados nova, com o detector de rosto da pasta de dados do ambiente
const DET = join(process.env.EDITOR_CHEFE_DATA ?? '', 'rosto');
if (!existsSync(join(DET, 'yunet.onnx'))) throw new Error('falta o detector de rosto em EDITOR_CHEFE_DATA/rosto: rode o preparar.sh e o prefixo do ambiente.sh');
const novosDados = () => { const d = mkdtempSync(join(raiz, 'dados-')); cpSync(DET, join(d, 'rosto'), { recursive: true }); return d; };

const fonteFalsa = (familia, pesos, pasta) => { mkdirSync(pasta, { recursive: true }); writeFileSync(join(pasta, `${familia}-800.woff2`), 'wOF2'); };

test('sem render: monta o projeto sintético na Legenda viva com efeitos, não grava pronto e apaga a pasta', () => {
  const pasta = join(raiz, 'sem-render'), dados = novosDados(), linhas = [];
  const r = autoteste(pasta, { render: false, baixarFonte: fonteFalsa, dados, avisar: (m) => linhas.push(m) });
  assert.equal(r.montagem.trechos, 2);
  assert.ok(r.montagem.efeitos > 0, 'os efeitos sonoros da HyperFrames entram');
  assert.equal(r.montagem.aproximacoes, 1, 'a aproximação no rosto entra, no rastro de rosto de mentira');
  assert.match(linhas.join('\n'), /visual de cor forte/);
  assert.equal(linhas.at(-1), 'AUTOTESTE SEM RENDER OK');
  assert.ok(!existsSync(pasta));
  assert.ok(!existsSync(join(dados, 'pronto')));
  assert.equal(estaPronto(dados), false);
});

test('pasta de teste que já existe, de qualquer jeito: recusa e não apaga nada', () => {
  const arquivos = [['video-do-dono.mp4'], ['.autoteste-editor-chefe', 'guardado-depois.txt']];
  arquivos.forEach((lista, i) => {
    const pasta = join(raiz, `ja-existe-${i}`);
    mkdirSync(pasta);
    for (const f of lista) writeFileSync(join(pasta, f), 'x');
    assert.throws(() => autoteste(pasta, { render: false, baixarFonte: fonteFalsa, dados: novosDados(), avisar: () => {} }), /já existe.*nada foi apagado/);
    for (const f of lista) assert.ok(existsSync(join(pasta, f)), f);
  });
});

test('render que passa do tempo máximo: para com erro em português que diz a etapa', () => {
  const pasta = join(raiz, 'trava'), dados = novosDados();
  process.env.DORMIR = '1';
  try {
    assert.throws(() => autoteste(pasta, { baixarFonte: fonteFalsa, dados, tempo: 3000, avisar: () => {} }), /etapa "render".*passou do tempo máximo/s);
  } finally { delete process.env.DORMIR; }
  assert.ok(!existsSync(pasta));
  assert.ok(!existsSync(join(dados, 'pronto')));
});

test('com render: confere o MP4 1080x1920 com áudio e grava a marca de pronto com a versão do plugin', () => {
  const pasta = join(raiz, 'completo'), dados = novosDados(), linhas = [];
  autoteste(pasta, { baixarFonte: fonteFalsa, dados, avisar: (m) => linhas.push(m) });
  assert.equal(linhas.at(-1), 'AUTOTESTE OK');
  assert.match(readFileSync(join(dados, 'pronto'), 'utf8'), new RegExp(`^versao=${VERSAO.replace(/\./g, '\\.')} data=\\d{4}-\\d{2}-\\d{2}T`));
  assert.equal(estaPronto(dados), true);
  assert.ok(!existsSync(pasta));
  writeFileSync(join(dados, 'pronto'), 'versao=0.0.1 data=2020-01-01T00:00:00.000Z\n');
  assert.equal(estaPronto(dados), false, 'pronto de outra versão não vale');
});

test('render com tamanho errado: falha, apaga a pasta e tira a marca de pronto antiga', () => {
  const pasta = join(raiz, 'errado'), dados = novosDados();
  writeFileSync(join(dados, 'pronto'), `versao=${VERSAO} data=2020-01-01T00:00:00.000Z\n`);
  process.env.TAMANHO = '720x1280';
  try {
    assert.throws(() => autoteste(pasta, { baixarFonte: fonteFalsa, dados, avisar: () => {} }), /1080x1920/);
  } finally { delete process.env.TAMANHO; }
  assert.ok(!existsSync(join(dados, 'pronto')));
  assert.ok(!existsSync(pasta));
});
