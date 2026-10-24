// tests/sigilo.test.mjs: a conferência de dado pessoal (passo 3b de audio-e-corte.md). Padrões, fala, agrupamento, resumo e
// borrar.json rodam em qualquer sistema; a leitura da tela pela Vision e o borrão no vídeo de ponta a ponta, só no Mac
// (precisa de ffmpeg e ffprobe no PATH: o prefixo do ambiente.sh resolve).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cpfValido, cnpjValido, telefoneValido, procurar, naFala, agrupar, naEdicao, resumo, conferirDados, escolherBorrar, lerTela, imagemComTexto, telaDisponivel } from '../plugins/editor-chefe/scripts/sigilo.mjs';
import { fonte } from '../plugins/editor-chefe/scripts/fonte.mjs';

const ref = (arq) => readFileSync(new URL(`../plugins/editor-chefe/skills/editor-chefe/${arq}`, import.meta.url), 'utf8');
const raiz = mkdtempSync(join(tmpdir(), 'sigilo-'));
test.after(() => rmSync(raiz, { recursive: true, force: true }));
const MAC = telaDisponivel() ? false : 'a leitura da tela só existe no Mac';
const tipos = (s) => procurar(s).map((a) => `${a.tipo}=${a.valor}`);

test('CPF e CNPJ: só com o dígito verificador certo; CNPJ com letras também', () => {
  for (const s of ['123.456.789-09', '12345678909', '529.982.247-25']) assert.ok(cpfValido(s), s);
  for (const s of ['123.456.789-00', '111.111.111-11', '1234567890', '123.456.789-091']) assert.ok(!cpfValido(s), s);
  for (const s of ['11.222.333/0001-81', '11222333000181', '12.ABC.345/01DE-35']) assert.ok(cnpjValido(s), s);
  for (const s of ['11.222.333/0001-80', '00.000.000/0000-00', '12.ABC.345/01DE-36']) assert.ok(!cnpjValido(s), s);
  assert.deepEqual(tipos('CPF 123.456.789-09 e CPF 123.456.789-00'), ['CPF=123.456.789-09'], 'o CPF inválido não alarma');
  assert.deepEqual(tipos('Empresa 12.ABC.345/01DE-35'), ['CNPJ=12.ABC.345/01DE-35']);
  assert.deepEqual(tipos('CPF 123.456.789\u201309'), ['CPF=123.456.789\u201309'], 'hífen lido como traço pela tela');
});

test('telefone no formato brasileiro e e-mail; data, ano e processo não viram telefone', () => {
  for (const s of ['(11) 98765-4321', '+55 11 98765-4321', '11987654321', '(11) 3456-7890', '11 3456-7890', '98765-4321'])
    assert.deepEqual(tipos(`ligue ${s} hoje`).map((x) => x.split('=')[0]), ['telefone'], s);
  for (const s of ['2025-2026', '3456-7890', 'processo 0001234-56.2024.8.26.0100', 'ano 2024 valor 1234', '1134567890', '(10) 98765-4321'])
    assert.deepEqual(tipos(s), [], s);
  assert.ok(telefoneValido('11 98765 4321') && !telefoneValido('1234'));
  assert.deepEqual(tipos('Escreva para joao.silva@exemplo.com.br.'), ['e-mail=joao.silva@exemplo.com.br']);
});

const fala = (frase, extras) => naFala(frase.split(' ').map((text, i) => ({ text, start: i * 0.5, end: i * 0.5 + 0.4 })), extras);
test('na fala: número dito em pedaços, com o tempo; palavra de corte extra não conta; nomes possíveis sem siglas', () => {
  const f = fala('Atendi a Maria da Silva. O CPF é 123 456 789 09 e o telefone 11 98765 4321. Mande para joao@exemplo.com, Doutor Paulo. A OAB sabe.');
  assert.deepEqual(f.achados.map((a) => [a.tipo, a.valor, a.de, a.ate]),
    [['CPF', '123 456 789 09', 4, 5.9], ['telefone', '11 98765 4321', 7.5, 8.9], ['e-mail', 'joao@exemplo.com', 10, 10.4]]);
  assert.deepEqual(f.nomes.map((n) => n.nome), ['Maria da Silva', 'Doutor Paulo'], 'sigla (CPF, OAB) e começo de frase não são nome');
  assert.deepEqual(fala('O CPF é 123 456 789 09 certo', [[1.9, 3.7]]).achados, [], 'o CPF dentro de um corte extra sai da edição');
  assert.deepEqual(fala('Foram 10 20 30 40 anos e 2025 2026').achados, [], 'contagem e anos não alarmam');
});

// Amostras de mentira: o texto lido em cada quadro, sem a Vision
const linha = (texto, caixa) => ({ texto, q: 1, caixa });
const amostras = [
  { t: 0, linhas: [] },
  { t: 1, linhas: [linha('CPF 123.456.789-09', [0.1, 0.1, 0.3, 0.03]), linha('Paciente: Maria Souza', [0.5, 0.7, 0.3, 0.03])] },
  { t: 2, linhas: [linha('CPF 123.456.789-09', [0.11, 0.1, 0.3, 0.03])] },
  { t: 3, linhas: [linha('Paciente: Maria Souza', [0.5, 0.7, 0.3, 0.03])] },
  { t: 4, linhas: [linha('CPF 123.456.789-09', [0.1, 0.5, 0.3, 0.03]), linha('paciente:  Maria Souza', [0.5, 0.7, 0.3, 0.03])] },
];

test('agrupar: dado primeiro e numerado, aparições separadas quando some, caixas que se cruzam juntas, com folga e margem de 1 s', () => {
  const it = agrupar(amostras, 4.5);
  assert.deepEqual(it.map((i) => [i.n, i.tipo, i.texto]), [[1, 'CPF', 'CPF 123.456.789-09'], [2, 'texto', 'Paciente: Maria Souza']]);
  const [cpf, nome] = it;
  assert.deepEqual(cpf.aparicoes.map((a) => [a.visto, a.de, a.ate, a.caixas.length]), [[[1, 2], 0, 3, 1], [[4, 4], 3, 4.5, 1]], 'sumiu no quadro 3: duas aparições; a margem para no fim do vídeo');
  const [x, y, w, h] = cpf.aparicoes[0].caixas[0];
  assert.ok(Math.abs(x - 0.085) < 1e-3 && Math.abs(y - 0.09) < 1e-3 && Math.abs(x + w - 0.425) < 1e-3 && Math.abs(y + h - 0.14) < 1e-3, `as duas caixas juntas, com folga: ${[x, y, w, h]}`);
  assert.equal(nome.aparicoes.length, 2, 'o mesmo texto com outro espaço e maiúscula é o mesmo item');
});

test('resumo: o tempo no vídeo editado, o número para borrar, os nomes para julgar; fora do Mac diz que não leu a tela', () => {
  const manter = [[0, 1.5], [3.5, 5]];
  assert.equal(naEdicao(4, manter), 2);
  assert.equal(naEdicao(2, manter), 1.5, 'tempo cortado vira o ponto da emenda');
  const r = { tela: { lida: true, quadros: 5 }, manter, fala: [{ tipo: 'CPF', valor: '123 456 789 09', de: 4, ate: 5 }], nomes: [{ nome: 'Maria da Silva', de: 0.5 }], itens: agrupar(amostras, 5) };
  const s = resumo(r);
  assert.match(s, /tela lida em 5 quadros/);
  assert.match(s, /NA FALA: CPF "123 456 789 09" em 0:02 do vídeo editado/);
  assert.match(s, /NA TELA \[1\]: CPF na linha "CPF 123\.456\.789-09", em 0:01, em 0:02 do vídeo editado/);
  assert.match(s, /Nomes possíveis na fala \(julgue\): Maria da Silva \(0:00\)/);
  assert.match(s, /\[2\] "Paciente: Maria Souza"/);
  assert.match(resumo({ ...r, fala: [], itens: [], nomes: [] }), /nenhum CPF, CNPJ, telefone ou e-mail achado/);
  // Fora do Mac: confere a fala, não tira quadro nenhum e avisa
  const pasta = join(raiz, 'fora-do-mac');
  mkdirSync(pasta);
  writeFileSync(join(pasta, 'transcript.json'), JSON.stringify([{ text: 'Meu', start: 0, end: 0.2 }, { text: 'e-mail:', start: 0.3, end: 0.5 }, { text: 'ana@exemplo.com', start: 0.6, end: 1 }]));
  writeFileSync(join(pasta, 'trechos.json'), JSON.stringify({ duracao: 2, manter: [[0, 2]], extras: [] }));
  const w = conferirDados(pasta, { tela: false });
  assert.match(resumo(w), /^sigilo: a tela não foi lida neste computador \(a leitura de texto da tela só existe no Mac\); conferido só o texto falado\./);
  assert.match(resumo(w), /NA FALA: e-mail "ana@exemplo\.com" em 0:00/);
  assert.ok(existsSync(join(pasta, 'sigilo.json')) && !existsSync(join(pasta, 'sigilo-quadros')));
  assert.throws(() => conferirDados(join(raiz, 'nao-existe'), { tela: false }), /falta o transcript\.json/);
});

test('--borrar: junta ao borrar.json as áreas dos itens escolhidos, sem repetir; número que não existe para', () => {
  const pasta = join(raiz, 'borrar');
  mkdirSync(pasta);
  writeFileSync(join(pasta, 'sigilo.json'), JSON.stringify({ itens: agrupar(amostras, 5) }));
  assert.equal(escolherBorrar(pasta, [1]), 2, 'as duas aparições do CPF');
  assert.equal(escolherBorrar(pasta, [1, 2]), 4, 'de novo o 1 não repete; o 2 soma as dele');
  const a = JSON.parse(readFileSync(join(pasta, 'borrar.json'), 'utf8')).areas;
  assert.deepEqual(a.map((x) => [x.de, x.ate, x.texto]), [[0, 3, 'CPF 123.456.789-09'], [3, 5, 'CPF 123.456.789-09'], [0, 2, 'Paciente: Maria Souza'], [2, 5, 'Paciente: Maria Souza']]);
  assert.throws(() => escolherBorrar(pasta, [9]), /não há item 9/);
});

test('as references mandam conferir antes da prévia, oferecer o borrão e dizer na entrega', () => {
  const ac = ref('references/audio-e-corte.md'), en = ref('references/entrega.md'), sk = ref('SKILL.md');
  assert.match(ac, /scripts\/sigilo\.mjs" \./);
  assert.match(ac, /--borrar/);
  assert.match(ac, /borrar\.json/);
  assert.match(en, /dado pessoal/);
  assert.match(sk, /dado pessoal/);
});

// Mac: a Vision lê o CPF de mentira desenhado na hora, e o fluxo inteiro (quadros do original girado, borrar.json, fonte)
// deixa o CPF ilegível só onde e quando ele aparece
test('Mac: a leitura da tela acha o CPF de mentira com a caixa no lugar dele', { skip: MAC }, () => {
  const img = join(raiz, 'cpf.png');
  imagemComTexto(img, 1080, 1920, 'CPF 123.456.789-09', { x: 0.1, y: 0.2, tamanho: 0.025 });
  const [linhas] = lerTela([img]), l = linhas.find((x) => procurar(x.texto).some((a) => a.tipo === 'CPF'));
  assert.ok(l, `a Vision não leu o CPF: ${JSON.stringify(linhas)}`);
  assert.ok(Math.abs(l.caixa[0] - 0.1) < 0.02 && Math.abs(l.caixa[1] - 0.2) < 0.02, `caixa fora do lugar: ${l.caixa}`);
});

test('Mac: de ponta a ponta num vídeo girado, o CPF da tela vira área do borrar.json e some na fonte só no tempo dele', { skip: MAC }, () => {
  const pasta = join(raiz, 'ponta');
  mkdirSync(pasta);
  const ff = (...a) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...a], { cwd: pasta });
  imagemComTexto(join(pasta, 'cpf.png'), 1080, 1920, 'CPF 123.456.789-09', { x: 0.1, y: 0.2, tamanho: 0.025 });
  // Gravado deitado (1920x1080) com a marca de girar, como o celular grava: em pé na tela, com o CPF de 1 a 2,5 s
  ff('-f', 'lavfi', '-i', 'color=c=0x1f4e5f:s=1080x1920:r=30:d=4', '-f', 'lavfi', '-i', 'sine=d=4', '-i', 'cpf.png', '-filter_complex',
    "[0][2]overlay=enable='between(t,1,2.5)',transpose=1", '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', 'deitado.mp4');
  ff('-display_rotation', '90', '-i', 'deitado.mp4', '-c', 'copy', 'original.mp4');
  writeFileSync(join(pasta, 'transcript.json'), '[]');
  writeFileSync(join(pasta, 'trechos.json'), JSON.stringify({ duracao: 4, manter: [[0, 4]], extras: [] }));
  const r = conferirDados(pasta), cpf = r.itens.find((i) => i.tipo === 'CPF');
  assert.ok(r.tela.lida && cpf, resumo(r));
  assert.deepEqual(cpf.aparicoes.map((a) => [a.visto, a.de, a.ate]), [[[1, 2], 0, 3]]);
  escolherBorrar(pasta, [cpf.n]);
  fonte(join(pasta, 'original.mp4'));
  const quadro = (t) => { const f = join(pasta, `q${t}.png`); ff('-ss', String(t), '-i', 'fonte.mp4', '-frames:v', '1', f); return f; };
  const [durante, depois] = lerTela([quadro(1.5), quadro(3.5)]);
  assert.ok(!durante.some((x) => /\d{3}\.\d{3}/.test(x.texto)), `o CPF ainda se lê na fonte: ${JSON.stringify(durante)}`);
  assert.deepEqual(depois, [], 'depois do tempo dele não há o que ler');
});
