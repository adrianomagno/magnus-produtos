// tests/fonte.test.mjs: o fonte.mjs (passo 1 de audio-e-corte.md) em clipes sintéticos: HDR para SDR, sem ampliar vídeo
// pequeno, os visuais de cor, a medida do ruído e a limpeza (precisa de ffmpeg e ffprobe no PATH, o prefixo do ambiente.sh resolve)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, renameSync } from 'node:fs';
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

test('borrão do borrar.json: a área some só no tempo dela, o resto do quadro fica igual; arquivo estragado para a fonte', () => {
  // Pasta própria: o borrar.json valeria para os outros testes deste arquivo
  const d = mkdtempSync(join(tmpdir(), 'borrao-')), W = 1080, H = 1920;
  try {
    // Xadrez de 8 px em pé (cada quadrado tem borda, a medida de detalhe fica alta em todo o quadro)
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `nullsrc=s=${W}x${H}:d=2:r=30,geq=lum='if(mod(floor(X/8)+floor(Y/8)\\,2)\\,235\\,16)':cb=128:cr=128`,
      '-f', 'lavfi', '-i', 'sine=d=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', 'original.mp4'], { cwd: d });
    const quadro = (t) => execFileSync('ffmpeg', ['-v', 'error', '-ss', String(t), '-i', 'fonte.mp4', '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { cwd: d, maxBuffer: 1 << 24 });
    // Detalhe: a média da diferença entre pixels vizinhos na região [x0, x1) x [y0, y1)
    const detalhe = (q, [x0, y0, x1, y1]) => { let s = 0, n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1 - 1; x++) { s += Math.abs(q[y * W + x + 1] - q[y * W + x]); n++; } return s / n; };
    fonte(join(d, 'original.mp4'));
    const sem = quadro(0.8);
    writeFileSync(join(d, 'borrar.json'), JSON.stringify({ areas: [{ de: 0.5, ate: 1.2, caixa: [0.1, 0.2, 0.5, 0.1], texto: 'CPF 123.456.789-09' }] }));
    assert.equal(fonte(join(d, 'original.mp4')).borradas, 1);
    // A área em px: x de 108 a 648, y de 384 a 576; medida por dentro, longe da borda do borrão
    const area = [128, 404, 628, 556], fora = [700, 404, 1000, 556], acima = [128, 300, 628, 370];
    const [antes, durante, depois] = [0.3, 0.8, 1.6].map(quadro);
    assert.ok(detalhe(sem, area) > 20, `o xadrez sem borrão tem detalhe (${detalhe(sem, area)})`);
    assert.ok(detalhe(durante, area) < 2, `a área no tempo dela fica lisa (${detalhe(durante, area)})`);
    for (const [nome, q] of [['antes', antes], ['depois', depois]]) assert.ok(Math.abs(detalhe(q, area) - detalhe(sem, area)) < 2, `${nome} do tempo a área fica como era`);
    for (const r of [fora, acima]) assert.ok(Math.abs(detalhe(durante, r) - detalhe(sem, r)) < 2, `fora da área o quadro fica como era (${r})`);
    // Cada borda no lugar: uma faixa de 12 px logo dentro dela já está lisa, a faixa logo fora ainda tem o xadrez
    for (const [dentro, ao_lado] of [[[110, 404, 122, 556], [94, 404, 106, 556]], [[634, 404, 646, 556], [650, 404, 662, 556]],
      [[128, 386, 628, 396], [128, 372, 628, 382]], [[128, 564, 628, 574], [128, 578, 628, 588]]])
      assert.ok(detalhe(durante, dentro) < 3 && detalhe(durante, ao_lado) > 20, `borda fora do lugar: ${dentro} (${detalhe(durante, dentro).toFixed(1)}), ${ao_lado} (${detalhe(durante, ao_lado).toFixed(1)})`);
    writeFileSync(join(d, 'borrar.json'), JSON.stringify({ areas: [{ de: 2, ate: 1, caixa: [0.1, 0.2, 0.5, 0.1] }] }));
    assert.throws(() => fonte(join(d, 'original.mp4')), /borrar\.json está estragado/);
    renameSync(join(d, 'borrar.json'), join(d, 'borrar-velho.json'));
    assert.equal(fonte(join(d, 'original.mp4')).borradas, 0, 'sem o arquivo, sem borrão');
  } finally { rmSync(d, { recursive: true, force: true }); }
});
