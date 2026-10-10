// tests/fonte.test.mjs: roda o comando da fonte de trabalho, como está em audio-e-corte.md, em clipes sintéticos
// (precisa de ffmpeg e ffprobe no PATH, o prefixo do ambiente.sh resolve)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const md = readFileSync(new URL('../plugins/editor-chefe/skills/editor-chefe/references/audio-e-corte.md', import.meta.url), 'utf8').split('\n');
const ini = md.findIndex((l) => l.includes('TRC="$(ffprobe'));
const fim = md.findIndex((l, i) => i > ini && l.trimEnd().endsWith(' fonte.mp4'));
const comando = md.slice(ini, fim + 1).map((l) => l.trim()).join('\n');

const dir = mkdtempSync(join(tmpdir(), 'fonte-'));
const ff = (...a) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...a], { cwd: dir });
const props = () => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries',
  'stream=width,height,pix_fmt,color_transfer', '-of', 'json', 'fonte.mp4'], { cwd: dir, encoding: 'utf8' })).streams[0];
const clipe = (tamanho, ...cor) => ff('-f', 'lavfi', '-i', `testsrc2=s=${tamanho}:d=0.5:r=30`, '-f', 'lavfi', '-i', 'sine=f=440:d=0.5',
  ...cor, '-c:a', 'aac', '-shortest', 'original.mp4');

test('o comando foi achado no texto', () => assert.ok(ini > 0 && fim > ini, comando));

for (const [nome, trc] of [['HLG', 'arib-std-b67'], ['PQ', 'smpte2084']]) {
  test(`vídeo ${nome} em pé, maior que 1920: reduz e converte para SDR BT.709`, () => {
    clipe('1200x2400', '-vf', 'format=yuv420p10le', '-c:v', 'libx265', '-x265-params', 'log-level=error',
      '-color_primaries', 'bt2020', '-color_trc', trc, '-colorspace', 'bt2020nc');
    execFileSync('bash', ['-c', comando], { cwd: dir, stdio: 'pipe' });
    assert.deepEqual(props(), { width: 960, height: 1920, pix_fmt: 'yuv420p', color_transfer: 'bt709' });
  });
}

test('vídeo comum menor que 1920 não é ampliado', () => {
  clipe('640x360', '-c:v', 'libx264', '-pix_fmt', 'yuv420p');
  execFileSync('bash', ['-c', comando], { cwd: dir, stdio: 'pipe' });
  const p = props();
  assert.deepEqual([p.width, p.height, p.pix_fmt], [640, 360, 'yuv420p']);
});

test.after(() => rmSync(dir, { recursive: true, force: true }));
