// tests/banco.test.mjs: o banco de peças (scripts/banco.mjs). O banco central do repositório (biblioteca/: só imagens e o
// catálogo), o pino do plugin (commit fixo e SHA-256 do catálogo), as duas edições seguidas (a primeira busca no banco
// central e guarda na biblioteca local; a segunda usa a cópia local, sem baixar), a peça que falta (genérica e o pedido)
// e a trava de que nada do cliente vai para o banco central.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync, cpSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { montar } from '../plugins/editor-chefe/scripts/montar.mjs';
import { abrirBanco, buscar, guardarDoCliente, pedidoDePeca, propor, enderecoCentral, lerPino, problemasImagem, CAMPOS_PROPOSTA } from '../plugins/editor-chefe/scripts/banco.mjs';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const CENTRAL = join(REPO, 'biblioteca');
const MARCA = fileURLToPath(new URL('./marca-teste.json', import.meta.url));
const sha = (arq) => createHash('sha256').update(readFileSync(arq)).digest('hex');
const TMP = mkdtempSync(join(tmpdir(), 'banco-'));
test.after(() => rmSync(TMP, { recursive: true, force: true }));
const ENV = ['EDITOR_CHEFE_BIBLIOTECA', 'EDITOR_CHEFE_BANCO_PINO', 'EDITOR_CHEFE_BANCO_CENTRAL'];
const antes = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
test.afterEach(() => { for (const k of ENV) if (antes[k] === undefined) delete process.env[k]; else process.env[k] = antes[k]; });

// Pino de teste: o banco central do repositório (a pasta biblioteca/ deste ramo) no papel do GitHub num commit fixo
function pinoDeTeste(central = REPO, catalogo = join(CENTRAL, 'catalogo.json')) {
  const arq = join(mkdtempSync(join(TMP, 'pino-')), 'banco-central.json');
  writeFileSync(arq, JSON.stringify({ repositorio: 'adrianomagno/magnus-produtos', pasta: 'biblioteca', commit: 'a'.repeat(40), catalogo_sha256: sha(catalogo) }));
  process.env.EDITOR_CHEFE_BANCO_PINO = arq;
  process.env.EDITOR_CHEFE_BANCO_CENTRAL = central;
}
const novaBiblioteca = () => (process.env.EDITOR_CHEFE_BIBLIOTECA = mkdtempSync(join(TMP, 'biblioteca-')));

// Vídeo de teste no estilo 11 com as peças dadas; frases de 0,3 s por palavra
function video(nome, frases, pecas, extra = {}) {
  const dir = join(TMP, nome);
  mkdirSync(join(dir, 'fonts'), { recursive: true });
  for (const f of ['Montserrat-800.woff2', 'Anton-400.woff2']) writeFileSync(join(dir, 'fonts', f), 'wOF2');
  writeFileSync(join(dir, 'fonte.mp4'), '');
  const fala = frases.flatMap(([t0, f]) => f.split(' ').map((text, i) => ({ text, start: +(t0 + 0.3 * i).toFixed(2), end: +(t0 + 0.3 * i + 0.28).toFixed(2) })));
  writeFileSync(join(dir, 'transcript.json'), JSON.stringify(fala));
  writeFileSync(join(dir, 'trechos.json'), JSON.stringify({ duracao: 12, manter: [[0, 12]] }));
  writeFileSync(join(dir, 'escolhas.json'), JSON.stringify({ estilo: 'destaques-tipograficos', marca: MARCA, efeitos: false, pecas, ...extra }));
  return dir;
}
const lerD = (dir) => JSON.parse(/const D = (.*);/.exec(readFileSync(join(dir, 'index.html'), 'utf8'))[1]);
const erroDe = (fn) => { try { fn(); } catch (e) { return e.message; } assert.fail('não deu erro'); };

test('banco central: só imagens (PNG ou SVG seguro) e o catálogo; cada arquivo com o SHA-256 do catálogo; propostas no formato fechado', () => {
  const todos = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? todos(join(d, e.name)) : [relative(CENTRAL, join(d, e.name))]));
  const arquivos = todos(CENTRAL), cat = JSON.parse(readFileSync(join(CENTRAL, 'catalogo.json'), 'utf8')), erros = [];
  for (const a of arquivos) {
    if (a === 'catalogo.json' || /^propostas\/[a-z0-9-]+\.json$/.test(a)) continue;
    if (!/^(objetos|icones|apps|propostas)\/[a-z0-9-]+\.(png|svg)$/.test(a)) { erros.push(`${a}: só imagens e o catálogo no banco central`); continue; }
    const ruim = problemasImagem(readFileSync(join(CENTRAL, a)), a);
    if (ruim.length) erros.push(`${a}: ${ruim.join(', ')}`);
  }
  for (const e of cat.pecas) {
    if (!existsSync(join(CENTRAL, e.arquivo)) || sha(join(CENTRAL, e.arquivo)) !== e.sha256) erros.push(`${e.nome} (${e.familia}): arquivo ausente ou com SHA-256 diferente do catálogo`);
    if (!e.licenca || !/^https:\/\//.test(e.fonte) || !e.palavras?.length) erros.push(`${e.nome}: sem licença, fonte ou palavras`);
  }
  for (const a of arquivos.filter((x) => /^propostas\/.*\.json$/.test(x))) {
    const p = JSON.parse(readFileSync(join(CENTRAL, a), 'utf8'));
    if (Object.keys(p).sort().join() !== [...CAMPOS_PROPOSTA].sort().join()) erros.push(`${a}: fora do formato fechado da proposta`);
    if (sha(join(CENTRAL, 'propostas', p.arquivo)) !== p.sha256) erros.push(`${a}: SHA-256 da imagem não confere`);
  }
  for (const a of arquivos.filter((x) => /^(objetos|icones|apps)\//.test(x))) if (!cat.pecas.some((e) => e.arquivo === a)) erros.push(`${a}: fora do catálogo`);
  assert.deepEqual(erros, []);
});

test('pino do plugin: commit e SHA-256 do catálogo juntos; o endereço de produção é o raw do GitHub pelo commit fixo, nunca por ramo', () => {
  const pino = lerPino();
  assert.equal(pino.repositorio, 'adrianomagno/magnus-produtos');
  assert.ok((pino.commit === null && pino.catalogo_sha256 === null) || (/^[0-9a-f]{40}$/.test(pino.commit) && /^[0-9a-f]{64}$/.test(pino.catalogo_sha256)), JSON.stringify(pino));
  const c = '0123456789abcdef0123456789abcdef01234567';
  assert.equal(enderecoCentral({ ...pino, commit: c }, 'objetos/comida.png'), `https://raw.githubusercontent.com/adrianomagno/magnus-produtos/${c}/biblioteca/objetos/comida.png`);
  assert.match(erroDe(() => enderecoCentral({ ...pino, commit: 'main' }, 'catalogo.json')), /só é lido por um commit fixo/);
  assert.match(erroDe(() => enderecoCentral({ ...pino, commit: c.slice(0, 7) }, 'catalogo.json')), /só é lido por um commit fixo/);
  assert.match(erroDe(() => enderecoCentral({ ...pino, commit: c }, '../segredo.png')), /caminho inválido/);
});

test('duas edições seguidas: a primeira busca a peça no banco central, confere e guarda; a segunda usa a cópia local, sem baixar', () => {
  const bib = novaBiblioteca();
  pinoDeTeste();
  const frases = [[0.5, 'Dormir mal bagunça a fome.'], [4, 'Antes de cortar comida, cuide do sono.']];
  const pecas = [{ tipo: 'objeto', objeto: 'comida', fala: 'comida' }];
  const v1 = video('edicao-1', frases, pecas), avisos1 = [];
  const r1 = montar(v1, (m) => avisos1.push(m));
  assert.deepEqual(avisos1, []);
  assert.match(r1.banco.relatorio.join('\n'), /"comida" \(objeto 3D\) veio do banco central \(commit aaaaaaa\), conferida pelo SHA-256 e guardada na biblioteca local/);
  assert.equal(sha(join(bib, 'objetos', 'comida.png')), sha(join(CENTRAL, 'objetos', 'comida.png')));
  assert.equal(lerD(v1).pecas[0].arquivo, 'pecas/comida.png');
  assert.equal(sha(join(v1, 'pecas', 'comida.png')), sha(join(CENTRAL, 'objetos', 'comida.png')));
  // a segunda edição, sem o banco central à mão: a peça sai do catálogo local
  process.env.EDITOR_CHEFE_BANCO_CENTRAL = join(TMP, 'sem-banco-central');
  const v2 = video('edicao-2', frases, pecas), avisos2 = [];
  const r2 = montar(v2, (m) => avisos2.push(m));
  assert.deepEqual(avisos2, []);
  assert.deepEqual(r2.banco.relatorio, ['banco: "comida" (objeto 3D) saiu da biblioteca local, sem baixar de novo.']);
  const cat = JSON.parse(readFileSync(join(bib, 'catalogo.json'), 'utf8')).pecas.filter((e) => e.nome === 'comida');
  assert.equal(cat.length, 1); // não duplica
  assert.deepEqual(cat[0].videos, ['edicao-1', 'edicao-2']);
  assert.deepEqual(Object.keys(cat[0]).sort(), ['arquivo', 'data', 'familia', 'fonte', 'licenca', 'nome', 'origem', 'palavras', 'sha256', 'tipo', 'videos']);
  assert.match(cat[0].origem, /^banco central aaaaaaa \(fluent-emoji\)$/);
  // a peça do plugin também entra no catálogo, com o vídeo
  const v3 = video('edicao-3', [[0.5, 'O prazo vence amanhã.']], [{ tipo: 'objeto', objeto: 'calendario', fala: 'O prazo' }]);
  montar(v3, () => {});
  const cal = JSON.parse(readFileSync(join(bib, 'catalogo.json'), 'utf8')).pecas.find((e) => e.nome === 'calendario');
  assert.deepEqual([cal.origem, cal.videos], ['plugin (fluent-emoji)', ['edicao-3']]);
});

test('banco central adulterado: arquivo com SHA-256 diferente fica de fora; catálogo que não bate com o pino é ignorado', () => {
  novaBiblioteca();
  const falso = join(mkdtempSync(join(TMP, 'central-')), 'repo');
  cpSync(CENTRAL, join(falso, 'biblioteca'), { recursive: true });
  writeFileSync(join(falso, 'biblioteca', 'objetos', 'comida.png'), readFileSync(join(CENTRAL, 'propostas', 'cafe-3d.png'))); // outra imagem, mesmo nome
  pinoDeTeste(falso, join(falso, 'biblioteca', 'catalogo.json'));
  const avisos = [];
  montar(video('adulterado', [[0.5, 'Antes de cortar comida, cuide do sono.']], [{ tipo: 'objeto', objeto: 'comida', fala: 'comida' }]), (m) => avisos.push(m));
  assert.match(avisos.join('\n'), /a peça "comida" do banco central ficou de fora \(o SHA-256 do arquivo não confere com o catálogo\)/);
  // o catálogo trocado junto (conta comprometida troca peça e SHA-256 no mesmo commit): o pino do plugin não bate
  const cat = JSON.parse(readFileSync(join(falso, 'biblioteca', 'catalogo.json'), 'utf8'));
  cat.pecas[0].sha256 = sha(join(falso, 'biblioteca', 'objetos', 'comida.png'));
  writeFileSync(join(falso, 'biblioteca', 'catalogo.json'), JSON.stringify(cat));
  novaBiblioteca();
  const avisos2 = [];
  montar(video('catalogo-trocado', [[0.5, 'Antes de cortar comida, cuide do sono.']], [{ tipo: 'objeto', objeto: 'comida', fala: 'comida' }]), (m) => avisos2.push(m));
  assert.match(avisos2.join('\n'), /o catálogo do banco central não confere com o SHA-256 fixado no plugin/);
});

test('peça que falta: entra a genérica e o pedido em formato fechado, sem fala, nome nem caminho; banco central fora do ar não trava', () => {
  novaBiblioteca();
  pinoDeTeste(join(TMP, 'nao-existe'));
  const avisos = [];
  const dir = video('falta', [[0.5, 'Eu viajo de balão toda semana.'], [4, 'Combina tudo no Slack com a equipe.']],
    [{ tipo: 'objeto', objeto: 'balao', fala: 'balão' }, { tipo: 'app', apps: ['slack'], fala: 'Slack' }]);
  const r = montar(dir, (m) => avisos.push(m)), D = lerD(dir);
  assert.match(avisos[0], /não consegui ler o banco central .*; segui com as peças do plugin e as da biblioteca local/);
  assert.deepEqual(r.banco.pedidos, [
    'Pedido de peça para o banco do Editor Chefe: tipo objeto, nome "balao", família 3D, motivo: a fala pede e o banco não tem.',
    'Pedido de peça para o banco do Editor Chefe: tipo app, nome "slack", família logo, motivo: a fala pede e o banco não tem.']);
  assert.match(avisos.join('\n'), /o objeto "balao" não está no plugin, na biblioteca local nem no banco central; entrou uma peça genérica\. Mande ao dono esta frase/);
  assert.equal(D.pecas[0].generico, true);
  assert.match(D.pecas[0].svg, /^<svg [^>]*viewBox="0 0 256 256"/);
  assert.equal(D.pecas[1].apps[0].desenho, 'celular');
  for (const f of r.banco.pedidos) assert.doesNotMatch(f, /\/|viajo|semana|equipe|Estúdio/);
});

test('mesma imagem com outro nome não duplica: vira outro nome da mesma peça', () => {
  const ctx = abrirBanco(join(novaBiblioteca(), 'x'));
  pinoDeTeste();
  buscar({ tipo: 'objeto', nome: 'comida', familia: '3d' }, ctx);
  const n = ctx.catalogo.pecas.length;
  const outro = JSON.parse(readFileSync(join(CENTRAL, 'catalogo.json'), 'utf8'));
  const arq = join(mkdtempSync(join(TMP, 'alias-')), 'biblioteca');
  cpSync(CENTRAL, arq, { recursive: true });
  outro.pecas.push({ ...outro.pecas[0], nome: 'refeicao' });
  writeFileSync(join(arq, 'catalogo.json'), JSON.stringify(outro));
  pinoDeTeste(join(arq, '..'), join(arq, 'catalogo.json'));
  ctx.central = undefined;
  const r = buscar({ tipo: 'objeto', nome: 'refeicao', familia: '3d' }, ctx);
  assert.equal(ctx.catalogo.pecas.length, n);
  assert.deepEqual([r.entrada.nome, r.entrada.nomes], ['comida', ['refeicao']]);
  assert.equal(readdirSync(join(process.env.EDITOR_CHEFE_BIBLIOTECA, 'objetos')).length, 1);
});

test('nada do cliente sobe: logo do cliente, print e pedido com nome de paciente são recusados', () => {
  const bib = novaBiblioteca(), ctx = abrirBanco(join(bib, 'video')), dir = mkdtempSync(join(TMP, 'cliente-'));
  // o logo do cliente (o que o montador guarda do marca.json) e o print da janela ficam em cliente/, marcados
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x9a6a5a:s=64x64', '-frames:v', '1', join(dir, 'logo-da-clinica.png')]);
  mkdirSync(join(dir, 'prints'));
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x2a6f97:s=120x70', '-frames:v', '1', join(dir, 'prints', 'agenda.png')]);
  const logo = guardarDoCliente(ctx, join(dir, 'logo-da-clinica.png'), 'logo'), print = guardarDoCliente(ctx, join(dir, 'prints', 'agenda.png'), 'print');
  assert.deepEqual([logo.cliente, logo.arquivo.startsWith('cliente/logos/'), print.cliente, print.arquivo.startsWith('cliente/prints/')], [true, true, true, true]);
  const destino = join(TMP, 'propostas'), base = { tipo: 'objeto', familia: '3d', origem: 'fluent-emoji', licenca: 'MIT', fonte: 'https://exemplo.org/a.png', palavras: ['clinica'], motivo: 'aparece nas falas' };
  // 1. o logo do cliente: pela entrada do catálogo, pela cópia em cliente/ e pelo arquivo original
  assert.match(erroDe(() => propor({ ...base, ...logo, nome: 'logo-clinica' }, destino)), /peça do cliente .* não sai do computador dele/);
  assert.match(erroDe(() => propor({ ...base, nome: 'marca', arquivo: join(bib, logo.arquivo) }, destino)), /print, logo e arquivo do cliente não vão para o banco central/);
  assert.match(erroDe(() => propor({ ...base, nome: 'marca', arquivo: join(dir, 'logo-da-clinica.png') }, destino)), /print, logo e arquivo do cliente não vão para o banco central/);
  // 2. o print
  assert.match(erroDe(() => propor({ ...base, nome: 'agenda', arquivo: join(dir, 'prints', 'agenda.png') }, destino)), /print, logo e arquivo do cliente não vão para o banco central/);
  assert.match(erroDe(() => propor({ ...base, ...print, nome: 'agenda' }, destino)), /peça do cliente/);
  // 3. o pedido (e a proposta) com o nome da paciente dita na fala, ou com dado pessoal
  const nomes = ['Joana Prado'];
  assert.match(erroDe(() => pedidoDePeca({ tipo: 'objeto', nome: 'joana-prado', familia: '3d' }, { nomes })), /pedido recusado: "joana" é nome de pessoa da fala/);
  assert.match(erroDe(() => pedidoDePeca({ tipo: 'objeto', nome: 'exame', familia: 'sobrio', motivo: 'a paciente joana pediu' }, { nomes })), /pedido recusado: "joana"/);
  assert.match(erroDe(() => pedidoDePeca({ tipo: 'objeto', nome: 'exame', familia: '3d', motivo: 'ligar para 11 99876-5432' }, {})), /pedido recusado: o motivo vai em poucas palavras/);
  assert.match(erroDe(() => pedidoDePeca({ tipo: 'objeto', nome: 'Exame da Joana', familia: '3d' }, {})), /não é um nome genérico de peça/);
  assert.match(erroDe(() => pedidoDePeca({ tipo: 'objeto', nome: 'consultorio', familia: '3d' }, { cliente: ['Consultório Exemplo'] })), /do negócio do cliente/);
  assert.match(erroDe(() => propor({ ...base, nome: 'exame', arquivo: join(CENTRAL, 'objetos', 'comida.png'), palavras: ['exame da joana'] }, destino, { proibidos: nomes })), /proposta recusada: "joana"/);
  assert.ok(!existsSync(destino) || readdirSync(destino).length === 0);
  // e o pedido de uma peça genérica de verdade passa
  assert.equal(pedidoDePeca({ tipo: 'objeto', nome: 'exame', familia: 'sobrio' }, { nomes }), 'Pedido de peça para o banco do Editor Chefe: tipo objeto, nome "exame", família sóbria, motivo: a fala pede e o banco não tem.');
});

test('o print da janela e o logo do marca.json ficam só na biblioteca local, em cliente/', () => {
  const bib = novaBiblioteca();
  const dir = video('janela', [[0.5, 'Olha o painel do sistema.']], [{ tipo: 'janela', print: 'prints/painel.png', fala: 'Olha o painel' }]);
  mkdirSync(join(dir, 'prints'));
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x2a6f97:s=1200x700', '-frames:v', '1', join(dir, 'prints', 'painel.png')]);
  writeFileSync(join(dir, 'sigilo.json'), JSON.stringify({ itens: [], prints: [{ arquivo: 'prints/painel.png', sha256: sha(join(dir, 'prints', 'painel.png')), lida: true, linhas: 0 }] }));
  montar(dir, () => {});
  const cat = JSON.parse(readFileSync(join(bib, 'catalogo.json'), 'utf8')).pecas;
  assert.equal(cat.length, 1);
  assert.deepEqual([cat[0].tipo, cat[0].cliente, cat[0].videos], ['print', true, ['janela']]);
  assert.match(cat[0].arquivo, /^cliente\/prints\/print-[0-9a-f]{12}\.png$/);
  assert.ok(statSync(join(bib, cat[0].arquivo)).size > 0);
});

test('sugestão de peças: o que o cliente já tem na biblioteca local também é sugerido, pelas palavras do catálogo', async () => {
  const { sugerirPasta } = await import('../plugins/editor-chefe/scripts/pecas.mjs');
  novaBiblioteca();
  pinoDeTeste();
  const frases = [[0.5, 'Antes de cortar comida, cuide do sono.']];
  const dir = video('sugere', frases, []);
  assert.ok(!sugerirPasta(dir).some((s) => s.proposta.objeto === 'comida')); // ainda não está no plugin nem na biblioteca
  montar(video('busca', frases, [{ tipo: 'objeto', objeto: 'comida', fala: 'comida' }]), () => {});
  assert.ok(sugerirPasta(dir).some((s) => s.proposta.objeto === 'comida' && s.proposta.fala === 'comida'));
});

test('SVG seguro: só elementos e atributos de desenho; style, @import, url(, use, script, evento, imagem e declaração reprovam', async () => {
  const { problemasSvg } = await import('../plugins/editor-chefe/scripts/banco.mjs');
  const X = 'xmlns="http://www.w3.org/2000/svg"';
  assert.deepEqual(problemasSvg(`<svg ${X} viewBox="0 0 256 256" fill="currentColor"><path d="M208,40V168H152Z" opacity="0.2"/><path d="M72,88V40Z"/></svg>`), []);
  const vetores = [
    ['elemento <style>', `<svg ${X}><style>path{fill:red}</style><path d="M0 0"/></svg>`],
    ['elemento <style>', `<svg ${X}><style>@import url(https://exemplo.org/a.css);</style></svg>`],
    ['atributo style', `<svg ${X}><path style="fill:url(https://exemplo.org/a)" d="M0 0"/></svg>`],
    ['valor do atributo fill', `<svg ${X}><path fill="url(#a)" d="M0 0"/></svg>`],
    ['elemento <use>', `<svg ${X}><use href="#a"/></svg>`],
    ['elemento <script>', `<svg ${X}><script>alert(1)</script></svg>`],
    ['atributo onload', `<svg ${X} onload="alert(1)"></svg>`],
    ['elemento <a>', `<svg ${X}><a href="https://exemplo.org"><path d="M0 0"/></a></svg>`],
    ['elemento <image>', `<svg ${X}><image href="data:image/png;base64,AA"/></svg>`],
    ['elemento <foreignObject>', `<svg ${X}><foreignObject><div>x</div></foreignObject></svg>`],
    ['marcação fora do que é permitido', `<!DOCTYPE svg [<!ENTITY x "y">]><svg ${X}></svg>`],
    ['texto fora de title ou desc', `<svg ${X}>texto solto<path d="M0 0"/></svg>`],
  ];
  for (const [oque, s] of vetores) assert.ok(problemasSvg(s).includes(oque), `${oque}: ${JSON.stringify(problemasSvg(s))}`);
  assert.ok(problemasSvg(`<svg ${X} onload=alert(1)></svg>`).length); // atributo sem aspas
  assert.ok(problemasSvg(`<svg ${X}><![CDATA[x]]></svg>`).length);
  assert.ok(problemasSvg(`<svg xmlns="http://exemplo.org/svg"></svg>`).length);
});

test('SVG sóbrio com <style> na biblioteca local não entra no vídeo: o montador põe a peça genérica', () => {
  const bib = novaBiblioteca();
  pinoDeTeste(join(TMP, 'nao-existe'));
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><style>@import url(https://exemplo.org/a.css);</style><path d="M0 0"/></svg>';
  mkdirSync(join(bib, 'icones'), { recursive: true });
  writeFileSync(join(bib, 'icones', 'comida.svg'), svg);
  writeFileSync(join(bib, 'catalogo.json'), JSON.stringify({ versao: 1, pecas: [{ nome: 'comida', tipo: 'objeto', familia: 'sobrio', palavras: ['comida'], origem: 'phosphor', licenca: 'MIT', sha256: createHash('sha256').update(svg).digest('hex'), arquivo: 'icones/comida.svg', data: '2026-10-26', videos: [] }] }));
  const dir = video('style-local', [[0.5, 'Antes de cortar comida, cuide do sono.']], [{ tipo: 'objeto', objeto: 'comida', fala: 'comida' }], { icones: 'sobrio' });
  montar(dir, () => {});
  const p = lerD(dir).pecas[0];
  assert.equal(p.generico, true);
  assert.doesNotMatch(readFileSync(join(dir, 'index.html'), 'utf8'), /@import|exemplo\.org/);
});
