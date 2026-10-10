// tests/hf.test.mjs: o hf acha a hyperframes no cache de plugins (versão mais alta) ou pela variável de ambiente
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';

const HF = fileURLToPath(new URL('../plugins/editor-chefe/scripts/hf', import.meta.url));
const raiz = mkdtempSync(join(tmpdir(), 'hf-'));
// Layout do cache do Claude Code: <cache>/<marketplace>/<plugin>/<versão>/
const cache = join(raiz, 'cache', 'magnus');
const hf = join(cache, 'editor-chefe', '0.1.0', 'scripts', 'hf');
mkdirSync(dirname(hf), { recursive: true });
copyFileSync(HF, hf);
const falsa = (pasta, nome) => {
  const d = join(pasta, 'skills', 'hyperframes', 'scripts');
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, 'plugin-cli.mjs'), `console.log(${JSON.stringify(nome)}, process.argv.slice(2).join(' '));\n`);
};
const rodar = (env = {}) => spawnSync('bash', [hf, 'doctor', '--json'], {
  encoding: 'utf8',
  env: { ...process.env, HYPERFRAMES_PLUGIN_ROOT: '', PATH: dirname(process.execPath) + delimiter + process.env.PATH, ...env },
});

test('sem a hyperframes, sai com 1 e explica em português', () => {
  const r = rodar();
  assert.equal(r.status, 1);
  assert.match(r.stderr, /não achei a HyperFrames/);
});

test('com duas versões no cache, usa a mais alta (0.8.143 vence 0.8.9)', () => {
  falsa(join(cache, 'hyperframes', '0.8.9'), 'v0.8.9');
  falsa(join(cache, 'hyperframes', '0.8.143'), 'v0.8.143');
  const r = rodar();
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), 'v0.8.143 doctor --json');
});

test('HYPERFRAMES_PLUGIN_ROOT tem precedência sobre o cache', () => {
  const dev = join(raiz, 'clone');
  falsa(dev, 'clone');
  const r = rodar({ HYPERFRAMES_PLUGIN_ROOT: dev });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), 'clone doctor --json');
});

test.after(() => rmSync(raiz, { recursive: true, force: true }));
