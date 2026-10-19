// tests/conferir.test.mjs: as faixas de texto de cada molde, o rosto embaixo do texto e a conferência de um MP4 sintético
// (precisa de ffmpeg e ffprobe no PATH, o prefixo do ambiente.sh resolve)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zonas, cobre, conferir } from '../plugins/editor-chefe/scripts/conferir.mjs';

const EST = new URL('../plugins/editor-chefe/estilos/', import.meta.url);
const dir = mkdtempSync(join(tmpdir(), 'conferir-'));
test.after(() => rmSync(dir, { recursive: true, force: true }));

test('todo molde com gravação tem a faixa do texto que a conferência lê', () => {
  for (const f of readdirSync(EST).filter((f) => f.endsWith('.html'))) {
    const h = readFileSync(new URL(f, EST), 'utf8');
    if (h.includes('{{TRECHOS}}')) assert.equal(zonas(h, 10).length, 1, f);
  }
});

test('capa e caixinha entram como faixas; rosto embaixo da legenda é achado, rosto acima não', () => {
  const html = '#legenda { position: absolute; left: 70px; right: 70px; top: 1250px; height: 220px; }\nconst D = {"capa":{"estilo":"manchete","queixo":900,"fim":3},"caixinha":{"topo":920}};';
  const z = zonas(html, 20);
  assert.deepEqual(z.map((a) => [a.nome, a.y0, a.y1, a.ate]), [['a legenda', 1250, 1470, 20], ['a caixinha', 920, 1500, 20], ['o gancho de capa', 1060, 1405, 3]]);
  const so = [z[0]];
  assert.equal(cobre({ x: 540, y: 1300, w: 300, h: 300 }, 5, so).length, 1);
  assert.equal(cobre({ x: 540, y: 700, w: 300, h: 300 }, 5, so).length, 0);
  assert.equal(cobre({ x: 540, y: 1200, w: 300, h: 300 }, 5, so).length, 1, 'cobre um terço do rosto');
  assert.equal(cobre({ x: 540, y: 1300, w: 300, h: 300 }, 5, [z[2]]).length, 0, 'a capa já saiu');
});

test('MP4 certo passa; tamanho, duração e volume errados reprovam com o motivo', async () => {
  writeFileSync(join(dir, 'index.html'), '<div id="raiz" data-composition-id="editor-chefe" data-start="0" data-duration="2.000" data-width="1080" data-height="1920"></div>');
  const mp4 = (nome, s, d, vol) => execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=s=${s}:r=30:d=${d}`, '-f', 'lavfi', '-i', `sine=f=300:d=${d}`,
    '-af', `aformat=channel_layouts=stereo,loudnorm=I=${vol}`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', join(dir, nome)]);
  const rodar = (nome, op = {}) => conferir(dir, join(dir, nome), { avisar: () => {}, ...op });
  mp4('certo.mp4', '1080x1920', 2, -16);
  const ok = await rodar('certo.mp4');
  assert.equal(ok.ok, true, ok.ruim.join());
  assert.ok(existsSync(join(dir, 'conferencia.jpg')));
  mp4('ruim.mp4', '720x1280', 3, -10);
  const r = await rodar('ruim.mp4');
  assert.equal(r.ok, false);
  assert.match(r.ruim.join('\n'), /720x1280.*1080x1920[\s\S]*3,0 s e a edição tem 2,0 s[\s\S]*LUFS/);
  mp4('previa.mp4', '1080x1920', 1, -16);
  assert.equal((await rodar('previa.mp4', { previa: true })).ok, true, 'a prévia pode ser mais curta');
  assert.equal((await rodar('previa.mp4')).ok, false);
});
