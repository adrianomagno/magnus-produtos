// tests/cache.test.mjs: ramo de produção da busca da HyperFrames, sem HYPERFRAMES_PLUGIN_ROOT.
// Cada teste monta o próprio cache simulado no layout do Claude Code (<cache>/<marketplace>/<plugin>/<versão>/) e roda
// o hf e o montar.mjs da cópia do plugin nesse cache: os dois escolhem a versão mais alta da hyperframes que tenha o
// lançador skills/hyperframes/scripts/plugin-cli.mjs e ignoram pasta de versão sem ele.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';

// banco local de peças só deste arquivo de teste (o montador guarda ali as peças e o logo do cliente)
const BIB_TESTE = mkdtempSync(join(tmpdir(), 'biblioteca-'));
process.env.EDITOR_CHEFE_BIBLIOTECA = BIB_TESTE;
test.after(() => rmSync(BIB_TESTE, { recursive: true, force: true }));

const PLUGIN = fileURLToPath(new URL('../plugins/editor-chefe', import.meta.url));
const MARCA = fileURLToPath(new URL('./marca-teste.json', import.meta.url));
const env = { ...process.env, PATH: dirname(process.execPath) + delimiter + process.env.PATH };
delete env.HYPERFRAMES_PLUGIN_ROOT;
const SONS = { 'whoosh-short': 0.57, pop: 0.72, 'impact-bass-1': 2.12 };

// Cache novo com o editor-chefe 0.1.0; devolve o que o teste usa e apaga tudo no fim do teste
function cache(t) {
  const raiz = mkdtempSync(join(tmpdir(), 'cache-'));
  t.after(() => rmSync(raiz, { recursive: true, force: true }));
  const magnus = join(raiz, 'magnus'), ec = join(magnus, 'editor-chefe', '0.1.0');
  cpSync(PLUGIN, ec, { recursive: true });
  const pasta = (v) => join(magnus, 'hyperframes', v);
  // Os sons de mentira levam a versão no conteúdo, para o teste saber de qual pasta vieram
  const sons = (v) => {
    const sfx = join(pasta(v), 'skills', 'media-use', 'audio', 'assets', 'sfx');
    mkdirSync(sfx, { recursive: true });
    writeFileSync(join(sfx, 'manifest.json'), JSON.stringify(Object.fromEntries(Object.entries(SONS).map(([k, d]) => [k, { file: `${k}.mp3`, duration: d }]))));
    for (const k of Object.keys(SONS)) writeFileSync(join(sfx, `${k}.mp3`), `ID3 ${v}`);
  };
  return {
    // Versão completa: lançador (imprime a versão) e sons
    versao(v) {
      const cli = join(pasta(v), 'skills', 'hyperframes', 'scripts');
      mkdirSync(cli, { recursive: true });
      writeFileSync(join(cli, 'plugin-cli.mjs'), `console.log(${JSON.stringify('v' + v)}, process.argv.slice(2).join(' '));\n`);
      sons(v);
    },
    // Instalação pela metade: os sons já estão, o lançador não
    metade(v) { sons(v); },
    // Pasta sem skills/
    vazia(v) { mkdirSync(pasta(v), { recursive: true }); writeFileSync(join(pasta(v), 'README.md'), 'sem skills\n'); },
    hf: () => spawnSync('bash', [join(ec, 'scripts', 'hf'), '--version'], { encoding: 'utf8', env }),
    montar: (dir) => spawnSync(process.execPath, [join(ec, 'scripts', 'montar.mjs'), dir], { encoding: 'utf8', env }),
    // Projeto de um vídeo no estilo legenda-viva, com fala neutra
    projeto(extra = {}) {
      const dir = mkdtempSync(join(raiz, 'video-'));
      mkdirSync(join(dir, 'fonts'));
      writeFileSync(join(dir, 'fonts', 'Montserrat-800.woff2'), 'wOF2');
      writeFileSync(join(dir, 'fonte.mp4'), '');
      let s = 0.5;
      const fala = 'Aqui na loja todo cliente recebe resposta no mesmo dia.'.split(' ').map((w) => { const p = { text: w, start: +s.toFixed(2), end: +(s + 0.28).toFixed(2) }; s += 0.3; return p; });
      writeFileSync(join(dir, 'transcript.json'), JSON.stringify(fala));
      writeFileSync(join(dir, 'trechos.json'), JSON.stringify({ limiar: -38, duracao: 4, manter: [[0.42, 3.86]] }));
      writeFileSync(join(dir, 'escolhas.json'), JSON.stringify({ estilo: 'legenda-viva', marca: MARCA, ...extra }));
      return dir;
    },
  };
}

test('sem nenhuma hyperframes no cache: hf e montar.mjs param com mensagem em português', (t) => {
  const c = cache(t);
  const h = c.hf();
  assert.equal(h.status, 1);
  assert.match(h.stderr, /não achei a HyperFrames/);
  const m = c.montar(c.projeto());
  assert.equal(m.status, 1);
  assert.match(m.stderr, /não achei os efeitos sonoros do plugin hyperframes.*"efeitos": false/);
});

test('sem nenhuma hyperframes, "efeitos": false monta normalmente', (t) => {
  const c = cache(t);
  const dir = c.projeto({ efeitos: false });
  const m = c.montar(dir);
  assert.equal(m.status, 0, m.stderr);
  assert.match(m.stdout, /0 efeitos sonoros/);
  assert.doesNotMatch(readFileSync(join(dir, 'index.html'), 'utf8'), /<audio/);
});

test('com 0.8.9, 0.8.143, 0.10.0, uma 0.11.0 pela metade e uma pasta sem skills: os dois escolhem 0.10.0', (t) => {
  const c = cache(t);
  for (const v of ['0.8.9', '0.8.143', '0.10.0']) c.versao(v);
  c.metade('0.11.0');
  c.vazia('sem-skills');
  const h = c.hf();
  assert.equal(h.status, 0, h.stderr);
  assert.equal(h.stdout.trim(), 'v0.10.0 --version');
  const dir = c.projeto();
  const m = c.montar(dir);
  assert.equal(m.status, 0, m.stderr);
  const sons = readdirSync(join(dir, 'efeitos'));
  assert.ok(sons.length > 0);
  for (const s of sons) assert.equal(readFileSync(join(dir, 'efeitos', s), 'utf8'), 'ID3 0.10.0', s);
});

test('só uma versão pela metade no cache: os dois param como se não houvesse hyperframes', (t) => {
  const c = cache(t);
  c.metade('0.10.0');
  assert.equal(c.hf().status, 1);
  const m = c.montar(c.projeto());
  assert.equal(m.status, 1);
  assert.match(m.stderr, /não achei os efeitos sonoros/);
});
