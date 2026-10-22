// tests/capa-perfil.test.mjs: as regras do título, os instantes dos quadros, a escolha dos candidatos e o enquadramento do rosto
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validar, instantes, escolher, enquadrar, GRADE } from '../plugins/editor-chefe/scripts/capa-perfil.mjs';

test('título: uma palavra forte, até 6 palavras, sem travessão; selo curto', () => {
  assert.deepEqual(validar({ titulo: 'Um dia para olhar *seu negócio.*', selo: '24/10 · Centro' }).ruim, []);
  assert.equal(validar({ titulo: 'Sem palavra forte' }).ruim.length, 1);
  assert.equal(validar({ titulo: '*Duas* palavras *fortes*' }).ruim.length, 1);
  assert.match(validar({ titulo: 'Um dois três quatro cinco seis *sete*' }).ruim[0], /7 palavras/);
  assert.match(validar({ titulo: 'Tudo certo \u2014 *agora*' }).ruim.join(), /travessão/);
  assert.match(validar({ titulo: 'Tudo *certo*', selo: 'Hoje \u2013 Centro' }).ruim.join(), /travessão/);
  assert.match(validar({ titulo: 'Tudo *certo*', selo: 'x'.repeat(40) }).ruim.join(), /40 letras/);
  assert.equal(validar({ titulo: 'Tudo *certo*', selo: true }).selo, '');
  assert.equal(validar({ titulo: 'Tudo *certo*' }).selo, null);
});

test('instantes: espalhados só pelos trechos mantidos, sem as pontas', () => {
  const t = instantes([[0, 10], [20, 30]], 8);
  assert.equal(t.length, 8);
  assert.ok(t.every((x) => (x >= 0.3 && x <= 9.7) || (x >= 20.3 && x <= 29.7)), String(t));
  assert.ok(t.some((x) => x > 20) && t.some((x) => x < 10));
  assert.deepEqual(instantes([[0, 0.4]]), []);
});

test('candidatos: rosto maior primeiro, sem dois da mesma cena', () => {
  const r = (h) => ({ h, q: 1 });
  const e = escolher([{ t: 1, rosto: r(100) }, { t: 1.5, rosto: r(300) }, { t: 5, rosto: r(200) }, { t: 9, rosto: r(50) }], 2);
  assert.deepEqual(e.map((a) => a.t), [1.5, 5]);
});

test('enquadramento: rosto em close, imagem cobrindo a largura, centro do rosto dentro da grade', () => {
  for (const c of [{ W: 1080, H: 1920, rosto: { x: 590, y: 750, h: 500 } }, { W: 1920, H: 1080, rosto: { x: 1500, y: 400, h: 200 } }, { W: 3840, H: 2160, rosto: { x: 300, y: 900, h: 400 } }]) {
    const q = enquadrar(c);
    assert.ok(q.left <= 0 && q.left + q.largura >= 1080, JSON.stringify(q));
    const y = q.top + c.rosto.y * q.s;
    assert.ok(y > GRADE[0] && y < GRADE[1]);
    assert.ok(c.rosto.h * q.s >= 479);
  }
});
