// tests/rosto.test.mjs: o caminho do recorte (lacunas, tremida, parado), as janelas dos estilos, o recorte pelo ffmpeg e
// o fluxo sem rosto, que segue com a fonte inteira (precisa de ffmpeg e ffprobe no PATH; o detector, da pasta de dados
// do ambiente.sh, já preparada)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { trajetoria, recortar, reenquadrar, desligar, medidas, JANELA, planejarAproximacao, ZOOM, ZOOM_AMPLIADO, ZOOM_MIN } from '../plugins/editor-chefe/scripts/rosto.mjs';

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
  const sobra = JSON.parse(readFileSync(join(p, 'rosto.json'), 'utf8'));
  assert.equal(sobra.rastro.caixas.length, sobra.amostras, 'sem sobra, o rastro do rosto (para a aproximação) é gravado mesmo assim');
  desligar(p);
  assert.deepEqual([existsSync(join(p, 'fonte-inteira.mp4')), existsSync(join(p, 'fonte.mp4'))], [false, true]);
  const des = JSON.parse(readFileSync(join(p, 'rosto.json'), 'utf8'));
  assert.equal(des.estado, 'desligado', 'desligar guarda o rastro, sem recorte, para a aproximação continuar valendo');
  assert.ok(des.rastro && !des.corte_x);
  await assert.rejects(reenquadrar(p, 'motion-narrado'), /não tem vídeo gravado/);
});

test('sem detector na pasta de dados: segue com o foco fixo, sem erro', async () => {
  const p = mkdtempSync(join(dir, 's-'));
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=s=1920x1080:r=30:d=0.5', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', join(p, 'fonte.mp4')]);
  const avisos = [];
  assert.equal((await reenquadrar(p, 'legenda-viva', { dados: mkdtempSync(join(dir, 'd-')), avisar: (m) => avisos.push(m) })).estado, 'sem detector');
  assert.match(avisos.join(), /preparar\.sh/);
});

// Aproximação no rosto: fala de 20 s em tela cheia, uma palavra a cada 0,5 s, fonte em pé 1080x1920 sem recorte
const P = Array.from({ length: 40 }, (_, i) => ({ txt: `p${i}`, ini: i * 0.5, fim: i * 0.5 + 0.4 }));
const TR = [{ ini: 0, dur: 20, src: 0 }];
const rastro = (caixa, n = 41) => ({ estado: 'sem sobra', rastro: { qps: 2, W: 1080, H: 1920, caixas: Array.from({ length: n }, (_, i) => (typeof caixa === 'function' ? caixa(i) : caixa)) } });
const LEGENDA = [{ y0: 1250, y1: 1470, x0: 70, x1: 1010 }];
const plano = (o) => planejarAproximacao({ pal: P, trechos: TR, total: 20, fonte: { W: 1080, H: 1920 }, janela: [0, 0, 1080, 1920], faixas: LEGENDA, ...o });

test('aproximação: frase achada na fala cresce até 1,25 com o centro no rosto e volta depois da frase', () => {
  const { lista, avisos } = plano({ frases: ['p10 p11 p12'], rosto: rastro([540, 700, 300, 380]) });
  assert.deepEqual(avisos, []);
  assert.equal(lista.length, 1);
  const a = lista[0];
  assert.deepEqual([a.z, a.ox, a.oy], [ZOOM, 540, 700]);
  assert.ok(a.de < 5 && a.ate > 5 && a.ate - a.de < 0.6, 'sobe de leve, um instante antes da frase');
  assert.ok(a.volta >= 6.4 && a.fim - a.volta >= 0.5, 'segura até o fim da frase e volta sem pulo');
  assert.ok(ZOOM >= 1.15 && ZOOM <= 1.3);
});

test('aproximação: rosto perto da legenda aproxima com o queixo parado; embaixo dela ou cortado na borda, fica sem', () => {
  const perto = plano({ frases: ['p10'], rosto: rastro([540, 1080, 300, 300]) }).lista[0];
  assert.equal(perto.z, ZOOM);
  assert.deepEqual([perto.ox, perto.oy], [540, 1230], 'o centro vai para o queixo: ele não desce em direção à legenda');
  const embaixo = plano({ frases: ['p10'], rosto: rastro([540, 1200, 300, 300]) });
  assert.deepEqual(embaixo.lista, []);
  assert.match(embaixo.avisos[0], /embaixo do texto/);
  const encostado = plano({ frases: ['p10'], rosto: rastro([150, 700, 300, 380]) }).lista[0];
  assert.equal(encostado.ox, 0, 'rosto encostado na borda: a borda fica parada e o rosto não é cortado');
  const cortado = plano({ frases: ['p10'], rosto: rastro([100, 700, 300, 380]) });
  assert.deepEqual(cortado.lista, [], 'rosto já cortado pela borda: aproximar cortaria mais');
  assert.match(cortado.avisos[0], /não cabe aproximar/);
});

test('aproximação: a cabeça nunca entra mais no texto nem sai mais da janela do que sem aproximar', () => {
  for (const caixa of [[540, 700, 300, 380], [540, 1080, 300, 300], [200, 400, 300, 380], [900, 1000, 260, 300]]) {
    const a = plano({ frases: ['p10'], rosto: rastro(caixa) }).lista[0];
    if (!a) continue;
    const [cx, cy, w, h] = caixa, m = (v, o) => o + a.z * (v - o);
    const [e, d, t, b] = [m(cx - w / 2, a.ox), m(cx + w / 2, a.ox), m(cy - 0.75 * h, a.oy), m(cy + h / 2, a.oy)];
    assert.ok(e >= -0.5 && d <= 1080.5 && t >= -0.5 && b <= 1250.5, `${caixa}: ${[e, d, t, b].map(Math.round)}`);
    assert.ok(a.ox >= 0 && a.ox <= 1080 && a.oy >= 0 && a.oy <= 1920, 'o centro fica dentro da janela');
  }
});

test('aproximação: no máximo uma a cada 8 s, 4 s entre uma e outra, nunca no gancho de capa', () => {
  const r = plano({ frases: ['p2', 'p8', 'p20', 'p30'], rosto: rastro([540, 700, 300, 380]), desde: 3 });
  assert.deepEqual(r.lista.map((a) => Math.round(a.de)), [4, 10]);
  assert.equal(r.lista.length, 2, '20 s de vídeo: até 2');
  assert.match(r.avisos.join('\n'), /"p2".*gancho de capa/);
  assert.match(r.avisos.join('\n'), /"p30".*no máximo 2/);
  const perto = plano({ frases: ['p10', 'p14'], rosto: rastro([540, 700, 300, 380]) });
  assert.equal(perto.lista.length, 1);
  assert.match(perto.avisos[0], /menos de 4 s/);
});

test('aproximação: frase fora da fala, rosto sumido ou rastro de outra fonte ficam sem aproximar, com aviso', () => {
  assert.match(plano({ frases: ['não existe'], rosto: rastro([540, 700, 300, 380]) }).avisos[0], /não foi achada/);
  assert.match(plano({ frases: ['p10'], rosto: rastro((i) => (i % 3 ? null : [540, 700, 300, 380])) }).avisos[0], /não aparece bem/);
  assert.match(plano({ frases: ['p10'], rosto: rastro([540, 700, 300, 380]), fonte: { W: 1920, H: 1080 } }).avisos[0], /outra fonte/);
  assert.match(plano({ frases: ['p10'], rosto: { estado: 'sem detector' } }).avisos[0], /rastro do rosto/);
});

test('aproximação: no recorte que segue o rosto, desconta o x do corte; vídeo muito ampliado vai só até 1,15', () => {
  const seguindo = { estado: 'seguindo', recorte: [608, 1080], corte_x: Array(41).fill(500), rastro: { qps: 2, W: 1920, H: 1080, caixas: Array(41).fill([800, 400, 160, 200]) } };
  const a = plano({ frases: ['p10'], rosto: seguindo, fonte: { W: 608, H: 1080 } }).lista[0];
  const s = 1920 / 1080;
  assert.equal(a.ox, Math.round(300 * s - (608 * s - 1080) * 0.5));
  assert.equal(a.z, ZOOM_AMPLIADO, 'fonte de 1080 de altura ampliada 1,78 vez: aproximação contida');
});
