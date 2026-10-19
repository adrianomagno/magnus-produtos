// tests/fonte.test.mjs: o fonte.mjs (passo 1 de audio-e-corte.md) em clipes sintéticos: HDR para SDR, sem ampliar vídeo
// pequeno, os visuais de cor, a medida do ruído e a limpeza (precisa de ffmpeg e ffprobe no PATH, o prefixo do ambiente.sh resolve)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fonte, medirRuido, filtros, conferirForte, CORES } from '../plugins/editor-chefe/scripts/fonte.mjs';

const md = readFileSync(new URL('../plugins/editor-chefe/skills/editor-chefe/references/audio-e-corte.md', import.meta.url), 'utf8');
const dir = mkdtempSync(join(tmpdir(), 'fonte-'));
const orig = join(dir, 'original.mp4');
const ff = (...a) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...a], { cwd: dir });
const props = () => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries',
  'stream=codec_type,width,height,pix_fmt,color_transfer,channels', '-of', 'json', 'fonte.mp4'], { cwd: dir, encoding: 'utf8' })).streams;
const clipe = (tamanho, ...cor) => ff('-f', 'lavfi', '-i', `testsrc2=s=${tamanho}:d=0.5:r=30`, '-f', 'lavfi', '-i', 'sine=f=440:d=0.5',
  ...cor, '-c:a', 'aac', '-shortest', 'original.mp4');
const lufs = (arq) => +/I:\s+(-?[\d.]+) LUFS/.exec(spawnSync('ffmpeg', ['-nostats', '-i', arq, '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'], { encoding: 'utf8' }).stderr)?.[1];

test('o audio-e-corte.md manda rodar o fonte.mjs e cita cada visual de cor', () => {
  assert.match(md, /scripts\/fonte\.mjs/);
  for (const nome of Object.keys(CORES)) assert.match(md, new RegExp('`' + nome + '`'), nome);
});

for (const [nome, trc] of [['HLG', 'arib-std-b67'], ['PQ', 'smpte2084']]) {
  test(`vídeo ${nome} em pé, maior que 1920: reduz e converte para SDR BT.709, também com visual de cor`, () => {
    clipe('1200x2400', '-vf', 'format=yuv420p10le', '-c:v', 'libx265', '-x265-params', 'log-level=error',
      '-color_primaries', 'bt2020', '-color_trc', trc, '-colorspace', 'bt2020nc');
    for (const op of [{}, { cor: 'quente' }]) {
      const r = fonte(orig, op);
      assert.equal(r.hdr, true);
      const v = props().find((s) => s.codec_type === 'video');
      assert.deepEqual([v.width, v.height, v.pix_fmt, v.color_transfer], [960, 1920, 'yuv420p', 'bt709']);
    }
  });
}

test('vídeo comum menor que 1920 não é ampliado; áudio mono sai estéreo', () => {
  clipe('640x360', '-c:v', 'libx264', '-pix_fmt', 'yuv420p');
  fonte(orig);
  const s = props(), v = s.find((x) => x.codec_type === 'video');
  assert.deepEqual([v.width, v.height, v.pix_fmt], [640, 360, 'yuv420p']);
  assert.equal(s.find((x) => x.codec_type === 'audio').channels, 2);
});

test('cada visual de cor roda no ffmpeg e visual que não existe dá erro com a lista', () => {
  for (const [nome, f] of Object.entries(CORES)) ff('-f', 'lavfi', '-i', 'testsrc2=s=64x64:d=0.1', '-vf', f, '-f', 'null', '-'), assert.ok(nome);
  clipe('640x360', '-c:v', 'libx264');
  assert.throws(() => filtros(orig, { cor: 'sepia' }), /"sepia" não existe.*natural, claro, quente, contraste/);
});

test('ruído: chiado perto da fala é oferecido, a limpeza afasta o fundo da fala e o volume fica em -16', () => {
  // Fala de mentira (tom ligando e desligando a cada 0,5 s) com chiado rosa por baixo
  ff('-f', 'lavfi', '-i', 'color=s=320x240:d=8:r=30', '-f', 'lavfi', '-i', "sine=f=300:d=8,volume='if(lt(mod(t,1),0.5),1,0)':eval=frame",
    '-f', 'lavfi', '-i', 'anoisesrc=color=pink:amplitude=0.02:d=8', '-filter_complex', '[1:a][2:a]amix=inputs=2:normalize=0[a]', '-map', '0:v', '-map', '[a]',
    '-c:v', 'libx264', '-c:a', 'aac', '-shortest', 'original.mp4');
  const antes = medirRuido(orig);
  assert.equal(antes.oferecer, true, JSON.stringify(antes));
  fonte(orig, { ruido: true });
  const depois = medirRuido(join(dir, 'fonte.mp4'));
  assert.ok(depois.distancia_db >= antes.distancia_db + 8, `${antes.distancia_db} -> ${depois.distancia_db}`);
  assert.ok(Math.abs(lufs(join(dir, 'fonte.mp4')) + 16) <= 1, 'volume');
  fonte(orig);
  assert.ok(medirRuido(join(dir, 'fonte.mp4')).distancia_db < depois.distancia_db - 5, 'sem --ruido não limpa');
});

test.after(() => rmSync(dir, { recursive: true, force: true }));

test('visuais fortes: um para cada visual de hoje, que ficam como estavam; mais luz no rosto, pele no tom e branco sem estourar', () => {
  assert.deepEqual(Object.fromEntries(['natural', 'claro', 'quente', 'contraste'].map((n) => [n, CORES[n]])), {
    natural: 'eq=contrast=1.04:saturation=1.06', claro: 'eq=brightness=0.03:gamma=1.08:contrast=0.98:saturation=0.96',
    quente: 'colortemperature=temperature=5200:mix=0.55,eq=saturation=1.04', contraste: 'eq=contrast=1.12:gamma=0.97:saturation=1.08',
  }, 'os 4 visuais da 0.6.0 não mudam');
  assert.deepEqual(Object.keys(CORES).filter((n) => n.endsWith('-forte')), ['natural-forte', 'claro-forte', 'quente-forte', 'contraste-forte']);
  for (const nome of Object.keys(CORES).filter((n) => n.endsWith('-forte'))) assert.deepEqual(conferirForte(nome), [], nome);
});

test('visuais fortes: a conferência pega o filtro que estoura o branco, alaranja a pele ou não clareia', () => {
  assert.match(conferirForte('natural-forte', 'eq=brightness=0.12').join(), /branco estoura/);
  assert.match(conferirForte('quente-forte', 'colortemperature=temperature=3500:mix=1,eq=saturation=1.4').join(), /laranja|muda de tom/);
  assert.match(conferirForte('claro-forte', 'eq=gamma=1.02').join(), /não ganha luz/);
  assert.throws(() => conferirForte('quente'), /não é um visual forte/);
});
