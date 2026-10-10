// tests/trechos.test.mjs: pausas conhecidas num áudio sintético (precisa de ffmpeg e ffprobe no PATH, o prefixo do ambiente.sh resolve)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { trechos } from '../plugins/editor-chefe/scripts/trechos.mjs';

// tom 0-1 s, silêncio 1-2 s (pausa longa), tom 2-3 s, silêncio 3-3,3 s (curta, fica), tom 3,3-4,3 s, silêncio até 5,1 s (fim)
const dir = mkdtempSync(join(tmpdir(), 'trechos-'));
const wav = join(dir, 'sintetico.wav');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i',
  "aevalsrc='if(lt(t,1)+between(t,2,3)+between(t,3.3,4.3),0.3*sin(2*PI*440*t),0)':s=48000:d=5.1", wav]);
const perto = (a, b) => a.forEach((x, i) => x.forEach((v, j) => assert.ok(Math.abs(v - b[i][j]) < 0.02, `${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`)));

test('corta a pausa longa e o silêncio do fim, com 0,08 s de folga, e mantém a pausa curta', () => {
  const r = trechos(wav);
  assert.equal(r.manter.length, 2);
  perto(r.manter, [[0, 1.08], [1.92, 4.38]]);
});

test('cortes extras entram junto com as pausas', () => {
  perto(trechos(wav, '2.5-2.7').manter, [[0, 1.08], [1.92, 2.5], [2.7, 4.38]]);
});

test('corte extra com vírgula decimal ou sem fim é recusado, em português', () => {
  for (const ruim of ['2,5-2,7', '2.5', '2.7-2.5']) assert.throws(() => trechos(wav, ruim), /corte extra ".*" inválido/);
  const r = spawnSync(process.execPath, [fileURLToPath(new URL('../plugins/editor-chefe/scripts/trechos.mjs', import.meta.url)), wav, '2.5'], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /^trechos: corte extra "2\.5" inválido/);
});

test('chamado por link simbólico, o script roda (sem argumento, mostra o uso e sai com 1)', () => {
  const link = join(dir, 'trechos-link.mjs');
  symlinkSync(fileURLToPath(new URL('../plugins/editor-chefe/scripts/trechos.mjs', import.meta.url)), link);
  const r = spawnSync(process.execPath, [link], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Uso: node trechos\.mjs/);
});

test.after(() => rmSync(dir, { recursive: true, force: true }));
