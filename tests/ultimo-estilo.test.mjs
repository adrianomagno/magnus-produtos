// tests/ultimo-estilo.test.mjs: "mesmo estilo do último vídeo". Guarda só as escolhas de estilo (nunca o conteúdo), lê e
// monta a pergunta com o nome do catálogo, e arquivo ausente ou estragado não para o fluxo (precisa de ffmpeg no PATH para a
// fonte de verdade: o prefixo do ambiente.sh resolve).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { guardar, ler, pergunta, normalizar, ESTILOS, CAPAS } from '../plugins/editor-chefe/scripts/ultimo-estilo.mjs';
import { fonte } from '../plugins/editor-chefe/scripts/fonte.mjs';

const SCRIPT = new URL('../plugins/editor-chefe/scripts/ultimo-estilo.mjs', import.meta.url).pathname;
const ref = (arq) => readFileSync(new URL(`../plugins/editor-chefe/skills/editor-chefe/${arq}`, import.meta.url), 'utf8');
const raiz = mkdtempSync(join(tmpdir(), 'ultimo-estilo-'));
test.after(() => rmSync(raiz, { recursive: true, force: true }));
// Documentos/Editor Chefe de mentira, com uma pasta de vídeo dentro
const editor = (nome) => { const e = join(raiz, nome), v = join(e, '2026-10-24-video'); mkdirSync(v, { recursive: true }); return [e, v]; };
const node = (...a) => spawnSync(process.execPath, [SCRIPT, ...a], { encoding: 'utf8' });

test('o catálogo dá os 10 estilos e as 3 capas com número e nome', () => {
  assert.deepEqual(ESTILOS['legenda-viva'], { n: 1, nome: 'Legenda viva' });
  assert.deepEqual(ESTILOS['motion-narrado'], { n: 10, nome: 'Motion narrado' });
  assert.equal(Object.keys(ESTILOS).length, 10);
  assert.deepEqual(Object.keys(CAPAS), ['faixa', 'manchete', 'editorial']);
});

test('guarda só os campos de estilo, com o visual de cor e a limpeza da fonte de verdade; nada do conteúdo', () => {
  const [e, v] = editor('guardar');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=320x240:d=0.5:r=30', '-f', 'lavfi', '-i', 'sine=d=0.5', '-c:a', 'aac', '-shortest', 'original.mp4'], { cwd: v });
  fonte(join(v, 'original.mp4'), { cor: 'quente-forte' });
  assert.deepEqual(JSON.parse(readFileSync(join(v, 'fonte.json'), 'utf8')), { cor: 'quente-forte', ruido: false }, 'o fonte.mjs anota as opções');
  const conteudo = { capa: { estilo: 'manchete', texto: 'Emagrecer é só *comer menos*?', queixo: 900 }, aproximar: ['o segredo é a constância'],
    chaves: ['segredo', 'constância'], apice: 'constância', foco: '50% 35%', cartoes: [{ de: 1, titulo: 'Título do cartão' }] };
  writeFileSync(join(v, 'escolhas.json'), JSON.stringify({ estilo: 'palavra-chave', identidade: 'stomp', efeitos: false, marca: '../marca.json', ...conteudo }));
  guardar(v);
  const s = JSON.parse(readFileSync(join(e, 'ultimo-estilo.json'), 'utf8'));
  assert.match(s.guardado, /^\d{4}-\d{2}-\d{2}$/);
  delete s.guardado;
  assert.deepEqual(s, { estilo: 'palavra-chave', identidade: 'stomp', efeitos: false, capa: 'manchete', cor: 'quente-forte', ruido: false, aproximar: true });
  const texto = readFileSync(join(e, 'ultimo-estilo.json'), 'utf8');
  for (const x of ['Emagrecer', 'segredo', 'constância', '50% 35%', 'Título', '900', 'marca']) assert.ok(!texto.includes(x), `"${x}" é conteúdo e não pode ser guardado`);
  // Sem fonte.json (fonte de antes da 0.8) e sem capa: sem visual de cor, sem limpeza, sem capa; aproximação vazia é desligada
  rmSync(join(v, 'fonte.json'));
  writeFileSync(join(v, 'escolhas.json'), JSON.stringify({ estilo: 'legenda-viva', aproximar: [] }));
  assert.deepEqual(guardar(v), { estilo: 'legenda-viva', efeitos: true, capa: null, cor: null, ruido: false, aproximar: false });
  // A Caixinha não guarda a pergunta nem efeitos ou capa; o Motion narrado guarda só o estilo
  writeFileSync(join(v, 'escolhas.json'), JSON.stringify({ estilo: 'caixinha-pergunta', caixinha: { pergunta: 'Qual o melhor horário para treinar?' } }));
  assert.deepEqual(guardar(v), { estilo: 'caixinha-pergunta', cor: null, ruido: false, aproximar: false });
  assert.ok(!readFileSync(join(e, 'ultimo-estilo.json'), 'utf8').includes('horário'));
  writeFileSync(join(v, 'escolhas.json'), JSON.stringify({ estilo: 'motion-narrado', chaves: ['Joelho'] }));
  assert.deepEqual(guardar(v), { estilo: 'motion-narrado' });
});

test('lê e monta a pergunta única, com o nome do estilo e da capa do catálogo', () => {
  assert.equal(pergunta({ estilo: 'legenda-viva', efeitos: true, capa: null, cor: 'quente', ruido: false, aproximar: true }),
    'Quer o mesmo estilo do último vídeo: Estilo 1, Legenda viva, com efeitos, visual quente, aproximação no rosto, sem gancho de capa?');
  assert.equal(pergunta({ estilo: 'palavra-chave', identidade: 'stomp', efeitos: false, capa: 'manchete', cor: 'contraste-forte', ruido: true, aproximar: false }),
    'Quer o mesmo estilo do último vídeo: Estilo 2, Palavra-chave, identidade stomp, sem efeitos, visual contraste forte, limpeza de ruído, sem aproximação no rosto, capa 2, Manchete?');
  assert.equal(pergunta({ estilo: 'corte-seco-zoom', efeitos: true, capa: 'faixa', cor: null, ruido: false }),
    'Quer o mesmo estilo do último vídeo: Estilo 3, Corte seco, com efeitos, sem visual de cor, capa 1, Faixa?');
  assert.equal(pergunta({ estilo: 'motion-narrado' }), 'Quer o mesmo estilo do último vídeo: Estilo 10, Motion narrado?');
  const [e] = editor('ler');
  writeFileSync(join(e, 'ultimo-estilo.json'), JSON.stringify({ estilo: 'legenda-viva', efeitos: true, capa: null, cor: 'quente', ruido: false, aproximar: true, guardado: '2026-10-24' }));
  assert.deepEqual(ler(e), { estilo: 'legenda-viva', efeitos: true, capa: null, cor: 'quente', ruido: false, aproximar: true });
  const r = node('ler', e);
  assert.equal(r.status, 0);
  assert.equal(r.stdout.split('\n')[0], 'Quer o mesmo estilo do último vídeo: Estilo 1, Legenda viva, com efeitos, visual quente, aproximação no rosto, sem gancho de capa?');
  assert.deepEqual(JSON.parse(r.stdout.split('\n')[1]).estilo, 'legenda-viva');
});

test('arquivo ausente ou estragado não para o fluxo: o ler diz que não há estilo guardado e sai sem erro', () => {
  const [e, v] = editor('estragado');
  const nada = () => { assert.equal(ler(e), null); const r = node('ler', e); assert.equal(r.status, 0); assert.match(r.stdout, /nenhum estilo guardado; siga as perguntas normais/); };
  nada(); // ausente
  for (const s of ['{ quebrado', 'null', '[]', JSON.stringify({ estilo: 'sepia' }), JSON.stringify({ estilo: 'legenda-viva', efeitos: 'sim', capa: null, cor: null, ruido: false, aproximar: true }),
    JSON.stringify({ estilo: 'legenda-viva', efeitos: true, capa: 'tarja', cor: null, ruido: false, aproximar: true }), JSON.stringify({ estilo: 'legenda-viva', efeitos: true, capa: null, cor: 'roxo', ruido: false, aproximar: true }),
    JSON.stringify({ estilo: 'palavra-chave', identidade: 'neon', efeitos: true, capa: null, cor: null, ruido: false, aproximar: true })]) {
    writeFileSync(join(e, 'ultimo-estilo.json'), s);
    nada();
  }
  assert.equal(normalizar({ estilo: 'legenda-viva', efeitos: true, capa: null, cor: null, ruido: false }), null, 'falta a aproximação');
  // guardar sem escolhas.json: erro claro, sem mexer no que estava guardado
  writeFileSync(join(e, 'ultimo-estilo.json'), 'antes');
  const r = node('guardar', v);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /não consegui ler o escolhas\.json.*nada foi guardado/);
  assert.equal(readFileSync(join(e, 'ultimo-estilo.json'), 'utf8'), 'antes');
});

test('a SKILL pergunta o último estilo quando o pedido não trouxe o estilo e a entrega guarda', () => {
  const sk = ref('SKILL.md'), en = ref('references/entrega.md');
  assert.match(sk, /scripts\/ultimo-estilo\.mjs" ler/);
  assert.match(sk, /pedido não trouxe o estilo/);
  assert.match(en, /scripts\/ultimo-estilo\.mjs" guardar \./);
});
