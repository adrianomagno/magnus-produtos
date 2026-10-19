// tests/rosto.test.mjs: o caminho do recorte (lacunas, tremida, parado), as janelas dos estilos, o recorte pelo ffmpeg e
// o fluxo sem rosto, que segue com a fonte inteira (precisa de ffmpeg e ffprobe no PATH; o detector, da pasta de dados
// do ambiente.sh, já preparada)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { trajetoria, recortar, reenquadrar, desligar, medidas, JANELA } from '../plugins/editor-chefe/scripts/rosto.mjs';

const EST = new URL('../plugins/editor-chefe/estilos/', import.meta.url);
const dir = mkdtempSync(join(tmpdir(), 'rosto-'));
test.after(() => rmSync(dir, { recursive: true, force: true }));

test('cada estilo com gravação tem janela, e a janela é a do molde', () => {
  const comVideo = readdirSync(EST).filter((f) => f.endsWith('.html') && readFileSync(new URL(f, EST), 'utf8').includes('{{TRECHOS}}')).map((f) => f.replace('.html', ''));
  assert.deepEqual(Object.keys(JANELA).sort(), comVideo.sort());
  for (const id of comVideo) {
    const j = /#janela \{[^}]*?width: (\d+)px; height: (\d+)px;/.exec(readFileSync(new URL(`${id}.html`, EST), 'utf8'));
    assert.deepEqual(JANELA[id], j ? [+j[1], +j[2]] : [1080, 1920], id);
  }
});

test('caminho: lacunas viram reta, um quadro errado não puxa o recorte, fica dentro do vídeo', () => {
  const c = [500, null, null, 800, 800, 2000, 800, 800, 800, 800, 800, 800];
  const t = trajetoria(c, 1920, 608);
  assert.equal(t.x.length, c.length);
  assert.ok(t.x.every((x) => x >= 0 && x <= 1920 - 608));
  assert.ok(Math.max(...t.x.slice(4, 8)) < 800, 'o pulo para 2000 não passa pela mediana');
  assert.equal(trajetoria([null, null], 1920, 608), null);
});

test('rosto que quase não anda: recorte parado; rosto que anda: recorte acompanha', () => {
  const quieto = trajetoria([900, 910, 905, 920, 895, 900, 915], 1920, 608);
  assert.equal(quieto.parado, true);
  assert.equal(new Set(quieto.x).size, 1);
  const anda = trajetoria(Array.from({ length: 20 }, (_, i) => 400 + i * 60), 1920, 608);
  assert.equal(anda.parado, false);
  assert.ok(anda.x.at(-1) - anda.x[0] > 600);
});

test('recorte pelo ffmpeg sai na largura da janela e com o áudio', () => {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=1920x1080:r=30:d=1', '-f', 'lavfi', '-i', 'sine=d=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', join(dir, 'fonte-inteira.mp4')]);
  assert.ok(recortar(dir, [0, 300, 600, 900, 1200], 5, 608, 1080, 1));
  const m = medidas(join(dir, 'fonte.mp4'));
  assert.deepEqual([m.W, m.H], [608, 1080]);
  assert.ok(!existsSync(join(dir, 'rosto-comandos.txt')));
});

test('sem rosto no vídeo: segue com a fonte inteira; vídeo já em pé: nada a seguir; desligar volta a inteira', async () => {
  const p = mkdtempSync(join(dir, 'p-'));
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x1f4e5f:s=1920x1080:r=30:d=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', join(p, 'fonte.mp4')]);
  const r = await reenquadrar(p, 'legenda-viva');
  assert.equal(r.estado, 'sem rosto', JSON.stringify(r));
  assert.deepEqual([medidas(join(p, 'fonte.mp4')).W, existsSync(join(p, 'fonte-inteira.mp4'))], [1920, true]);
  assert.equal((await reenquadrar(p, 'editorial-claro')).estado, 'sem sobra', 'janela 16:9 num vídeo 16:9');
  desligar(p);
  assert.deepEqual([existsSync(join(p, 'fonte-inteira.mp4')), existsSync(join(p, 'rosto.json')), existsSync(join(p, 'fonte.mp4'))], [false, false, true]);
  await assert.rejects(reenquadrar(p, 'motion-narrado'), /não tem vídeo gravado/);
});

test('sem detector na pasta de dados: segue com o foco fixo, sem erro', async () => {
  const p = mkdtempSync(join(dir, 's-'));
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=s=1920x1080:r=30:d=0.5', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', join(p, 'fonte.mp4')]);
  const avisos = [];
  assert.equal((await reenquadrar(p, 'legenda-viva', { dados: mkdtempSync(join(dir, 'd-')), avisar: (m) => avisos.push(m) })).estado, 'sem detector');
  assert.match(avisos.join(), /preparar\.sh/);
});
