// tests/conferir.test.mjs: as faixas de texto de cada molde, o rosto embaixo do texto e a conferência de um MP4 sintético
// (precisa de ffmpeg e ffprobe no PATH, o prefixo do ambiente.sh resolve)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zonas, cobre, conferir } from '../plugins/editor-chefe/scripts/conferir.mjs';

const EST = new URL('../plugins/editor-chefe/estilos/', import.meta.url);
// A pasta de dados com o detector de rosto, se este computador já rodou o Preparar (senão, os testes que precisam dele pulam)
const DETECTOR = [process.env.EDITOR_CHEFE_DATA, process.env.CLAUDE_PLUGIN_DATA].find((d) => d && existsSync(join(d, 'rosto', 'yunet.onnx')));
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

test('pico verdadeiro acima de -1 dBTP reprova, mesmo com o volume em -16 LUFS', async () => {
  writeFileSync(join(dir, 'index.html'), '<div id="raiz" data-composition-id="editor-chefe" data-start="0" data-duration="3.000" data-width="1080" data-height="1920"></div>');
  // um tom baixo com estalos quase no máximo a cada meio segundo: -16,0 LUFS e pico perto de -0,7 dBTP
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=s=1080x1920:r=30:d=3', '-f', 'lavfi', '-i', 'aevalsrc=0.24*sin(2*PI*300*t)+0.97*lt(mod(t\\,0.5)\\,0.0006):s=48000:d=3',
    '-af', 'aformat=channel_layouts=stereo,alimiter=limit=0.999:level=disabled', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', join(dir, 'pico.mp4')]);
  const r = await conferir(dir, join(dir, 'pico.mp4'), { avisar: () => {} });
  assert.ok(r.lufs > -17.5 && r.lufs < -14.5, String(r.lufs)); // o volume está certo: só o pico reprova
  assert.ok(r.pico > -1, String(r.pico));
  assert.equal(r.ok, false);
  assert.match(r.ruim.join('\n'), /o pico do áudio está em -0[.\d]* dBTP; o certo é abaixo de -1 dBTP/);
});

test('quadro sem vídeo numa emenda reprova; o mesmo vídeo sem o quadro liso passa', async () => {
  // duas emendas (1 s e 1,5 s); o quadro 30 (1,0 s) sai só com o fundo da página
  writeFileSync(join(dir, 'index.html'), '<div id="raiz" data-composition-id="editor-chefe" data-start="0" data-duration="2.000" data-width="1080" data-height="1920">\n' +
    ['0.000', '1.000', '1.500'].map((s, i) => `<video id="trecho-${i + 1}" class="trecho clip" src="fonte.mp4" data-start="${s}" data-duration="0.499"></video>`).join('\n') + '</div>');
  const mp4 = (nome, extra) => execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=1080x1920:r=30:d=2', '-f', 'lavfi', '-i', 'sine=f=300:d=2',
    '-vf', `format=yuv420p${extra}`, '-af', 'aformat=channel_layouts=stereo,loudnorm=I=-16', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', join(dir, nome)]);
  mp4('pisca.mp4', ",drawbox=x=0:y=0:w=iw:h=ih:color=0x141414:t=fill:enable='eq(n\\,30)'");
  const r = await conferir(dir, join(dir, 'pisca.mp4'), { avisar: () => {} });
  assert.deepEqual(r.piscadas, [1]);
  assert.match(r.ruim.join('\n'), /quadro sem vídeo na emenda de 1,0 s/);
  mp4('sem-pisca.mp4', '');
  const ok = await conferir(dir, join(dir, 'sem-pisca.mp4'), { avisar: () => {}, dados: DETECTOR });
  assert.deepEqual(ok.piscadas, []);
  assert.doesNotMatch(ok.ruim.join('\n'), /quadro sem vídeo/);
  if (DETECTOR) assert.equal(ok.ok, true, ok.ruim.join()); // sem o detector neste computador, a conferência reprova por isso (teste abaixo)
});

test('último quadro sem vídeo (a edição acaba depois do último trecho) reprova', async () => {
  writeFileSync(join(dir, 'index.html'), '<div id="raiz" data-composition-id="editor-chefe" data-start="0" data-duration="2.000" data-width="1080" data-height="1920">\n' +
    '<video id="trecho-1" class="trecho clip" src="fonte.mp4" data-start="0.000" data-duration="0.999"></video>\n<video id="trecho-2" class="trecho clip" src="fonte.mp4" data-start="1.000" data-duration="0.999"></video></div>');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=1080x1920:r=30:d=2', '-f', 'lavfi', '-i', 'sine=f=300:d=2',
    '-vf', "format=yuv420p,drawbox=x=0:y=0:w=iw:h=ih:color=0x141414:t=fill:enable='eq(n\\,59)'", '-af', 'aformat=channel_layouts=stereo,loudnorm=I=-16', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', join(dir, 'fim.mp4')]);
  const r = await conferir(dir, join(dir, 'fim.mp4'), { avisar: () => {} });
  assert.match(r.ruim.join('\n'), /o último quadro do vídeo saiu sem vídeo, só com o fundo/);
  assert.doesNotMatch(r.ruim.join('\n'), /na emenda/);
});

test('vídeo gravado sem o detector de rosto reprova e manda rodar o Preparar; com o detector e sem rosto (tela), só avisa', async (t) => {
  writeFileSync(join(dir, 'index.html'), '<div id="raiz" data-composition-id="editor-chefe" data-start="0" data-duration="2.000" data-width="1080" data-height="1920">\n' +
    '<video id="trecho-1" class="trecho clip" src="fonte.mp4" data-start="0.000" data-duration="1.999"></video></div>');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=1080x1920:r=30:d=2', '-f', 'lavfi', '-i', 'sine=f=300:d=2',
    '-af', 'aformat=channel_layouts=stereo,loudnorm=I=-16', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', join(dir, 'tela.mp4')]);
  const vazia = mkdtempSync(join(tmpdir(), 'sem-detector-'));
  try {
    const r = await conferir(dir, join(dir, 'tela.mp4'), { avisar: () => {}, dados: vazia });
    assert.equal(r.ok, false);
    assert.match(r.ruim.join('\n'), /o detector de rosto não está neste computador, então ninguém conferiu se o texto cobre o rosto\. Rode o Preparar do Editor Chefe/);
  } finally { rmSync(vazia, { recursive: true, force: true }); }
  if (!DETECTOR) return t.skip('o detector de rosto não está neste computador');
  const avisos = [], r = await conferir(dir, join(dir, 'tela.mp4'), { avisar: (m) => avisos.push(m), dados: DETECTOR }); // padrão de teste, sem rosto
  assert.equal(r.ok, true, r.ruim.join());
  assert.match(avisos.join('\n'), /nenhum rosto achado no vídeo/);
});

test('peça que cobre o rosto só entre as amostras de 1 por segundo reprova: com texto na tela, 10 quadros por segundo', async (t) => {
  if (!DETECTOR) return t.skip('o detector de rosto não está neste computador');
  const d = mkdtempSync(join(tmpdir(), 'rosto-denso-'));
  try {
    // 4 s em 1080x1920 com o rosto do vídeo de teste (achado em todo quadro) entre y 890 e 1200
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', fileURLToPath(new URL('./video-teste.mp4', import.meta.url)), '-t', '4', '-vf', 'scale=1080:-2,pad=1080:1920:0:600,fps=30',
      '-af', 'aformat=channel_layouts=stereo,loudnorm=I=-16', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', join(d, 'rosto.mp4')]);
    const faixa = { nome: 'a peça', y0: 900, y1: 1250, x0: 0, x1: 1080, de: 2.6, ate: 3.4 };
    writeFileSync(join(d, 'index.html'), '<div id="raiz" data-composition-id="editor-chefe" data-start="0" data-duration="4.000" data-width="1080" data-height="1920">\n' +
      '<video id="trecho-1" class="trecho clip" src="fonte.mp4" data-start="0.000" data-duration="3.999"></video></div>\n' + `<script>const D = ${JSON.stringify({ faixas: [faixa] })};</script>`);
    // as amostras antigas (um quadro por segundo, no meio de cada segundo) caíam todas fora da faixa
    assert.deepEqual([0.5, 1.5, 2.5, 3.5].filter((x) => x >= faixa.de && x < faixa.ate), []);
    const r = await conferir(d, join(d, 'rosto.mp4'), { avisar: () => {}, dados: DETECTOR });
    assert.equal(r.ok, false);
    assert.match(r.ruim.join('\n'), /a peça cobre o rosto de 2,6 a 3,3 s/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});
