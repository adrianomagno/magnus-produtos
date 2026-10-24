// tests/tomadas.test.mjs: sugestão de tomada repetida em falas sintéticas
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tomadas } from '../plugins/editor-chefe/scripts/tomadas.mjs';

// 0,3 s por palavra e 0,6 s a mais depois de cada frase
function fala(texto) {
  let t = 0.5;
  return texto.split(' ').map((w) => { const p = { text: w, start: +t.toFixed(2), end: +(t + 0.28).toFixed(2) }; t += /[.?!]$/.test(w) ? 0.9 : 0.3; return p; });
}

test('acha o falso começo e a frase regravada: sai a primeira tomada, do fim da palavra anterior ao começo da que fica', () => {
  const f = fala('Olha só. Hoje eu vou te mostrar, hoje eu vou te mostrar um erro. Seu cliente pede desconto toda semana e você aceita. ' +
    'Você perde margem no fim do mês. Quando o cliente pede desconto, você aceita e perde margem todo mês. Por isso a tabela precisa de regra.');
  const em = (w, n = 0) => f.filter((p) => p.text === w)[n];
  assert.deepEqual(tomadas(f), [
    { tipo: 'falso começo', corte: `${em('só.').end}-${em('hoje').start}`, sai: 'Hoje eu vou te mostrar,', fica: 'hoje eu vou te mostrar um erro.' },
    { tipo: 'frase regravada', corte: `${em('erro.').end}-${em('Quando').start}`,
      sai: 'Seu cliente pede desconto toda semana e você aceita. Você perde margem no fim do mês.',
      fica: 'Quando o cliente pede desconto, você aceita e perde margem todo mês.' },
  ]);
});

test('texto sem repetição, lista e repetição de efeito: nenhuma sugestão', () => {
  assert.deepEqual(tomadas(fala('Aqui na loja, todo cliente recebe resposta no mesmo dia. Se a dúvida chega de manhã, a solução sai antes do almoço.')), []);
  assert.deepEqual(tomadas(fala('Mandei para o amigo, para o contador, para o Google. Ninguém respondeu. Não é falta de tempo, não é falta de dinheiro.')), []);
});

test('pela linha de comando: transcript que não é a lista de palavras é erro em português', () => {
  const r = spawnSync(process.execPath, [fileURLToPath(new URL('../plugins/editor-chefe/scripts/tomadas.mjs', import.meta.url)), fileURLToPath(new URL('./marca-teste.json', import.meta.url))], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /^tomadas: não consegui ler .* \(precisa ser o transcript\.json\)/);
});
