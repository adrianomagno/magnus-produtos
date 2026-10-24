// tests/trechos.test.mjs: pausas conhecidas num áudio sintético (precisa de ffmpeg e ffprobe no PATH, o prefixo do ambiente.sh resolve)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { trechos } from '../plugins/editor-chefe/scripts/trechos.mjs';

const dir = mkdtempSync(join(tmpdir(), 'trechos-'));
const gerar = (nome, expr, d) => {
  const wav = join(dir, nome);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `aevalsrc='${expr}':s=48000:d=${d}`, wav]);
  return wav;
};
const TOM = '0.3*sin(2*PI*440*t)';
// tom 0-1 s, pausa de 0,3 s (sai), tom 1,3-2,3 s, pausa de 0,2 s (fica), tom 2,5-3,5 s, silêncio até 4 s (o fim)
const wav = gerar('pausas.wav', `if(lt(t,1)+between(t,1.3,2.3)+between(t,2.5,3.5),${TOM},0)`, 4);
// Fundo de -75 dB; tom 0-1 s que morre devagar (cai 8,7 dB a cada 0,1 s, até 1,6 s), respiração de -43 dB de 1,9 a 2 s, tom 2-3 s
const cauda = gerar('cauda.wav', `if(lt(t,1)+gte(t,2),${TOM},0)+if(between(t,1,1.6),0.3*exp(-(t-1)/0.1)*sin(2*PI*440*t),0)` +
  `+if(between(t,1.9,2),0.01*(2*random(1)-1),0)+0.0003*(2*random(0)-1)`, 3);
const perto = (a, b) => {
  assert.equal(a.length, b.length, `${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
  a.forEach((x, i) => x.forEach((v, j) => assert.ok(Math.abs(v - b[i][j]) < 0.02, `${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`)));
};

test('pausa de 0,3 s sai com emenda de 0,12 s (0,06 s de cada lado), a de 0,2 s fica, o silêncio do fim sai', () => {
  const r = trechos(wav);
  perto(r.manter, [[0, 1.06], [1.24, 3.56]]);
  assert.deepEqual(r.extras, []);
});

test('cortes extras entram junto com as pausas, mesmo curtos, e ficam anotados em "extras"', () => {
  const r = trechos(wav, '2.0-2.1');
  perto(r.manter, [[0, 1.06], [1.24, 2.0], [2.1, 3.56]]);
  assert.deepEqual(r.extras, [[2.0, 2.1]]);
});

test('o fim da palavra que morre devagar e a respiração antes da seguinte ficam; a pausa entre eles sai', () => {
  const [a, b] = trechos(cauda).manter;
  // o silencedetect põe o começo da pausa em cerca de 1,25 s (a cauda ainda a -40 dB); a borda medida na onda vai além de 1,5 s
  assert.ok(a[1] > 1.5 && a[1] < 1.75, `o trecho que fica termina em ${a[1]}`);
  // a respiração começa em 1,9 s: o trecho seguinte começa antes dela, com a folga da emenda
  assert.ok(b[0] > 1.8 && b[0] < 1.88, `o trecho seguinte começa em ${b[0]}`);
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
