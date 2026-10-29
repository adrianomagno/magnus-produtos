// tests/pecas.test.mjs: a biblioteca de peças do estilo 11 (pasta pecas/, licença de cada arquivo, as 8 peças no
// montador, as regras da faixa de cima, a conferência vendo cada peça e o print passando pela conferência de dado pessoal)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync, statSync, appendFileSync, symlinkSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { montar, lerPecas, planoDestaques } from '../plugins/editor-chefe/scripts/montar.mjs';
import { zonas, cobre } from '../plugins/editor-chefe/scripts/conferir.mjs';
import { conferirPrint, escolherBorrar, imagemComTexto, lerTela, procurar, resumo, telaDisponivel } from '../plugins/editor-chefe/scripts/sigilo.mjs';
import { problemasSvg } from '../plugins/editor-chefe/scripts/banco.mjs';

const EC = createRequire(import.meta.url)('../plugins/editor-chefe/estilos/comum.js');
const PASTA = fileURLToPath(new URL('../plugins/editor-chefe/pecas/', import.meta.url));
const MANIFESTO = JSON.parse(readFileSync(join(PASTA, 'manifest.json'), 'utf8'));
const MARCA = fileURLToPath(new URL('./marca-teste.json', import.meta.url));
const sha = (arq) => createHash('sha256').update(readFileSync(arq)).digest('hex');
// banco local de peças só deste arquivo de teste (o montador guarda ali as peças e o logo do cliente)
const BIB_TESTE = mkdtempSync(join(tmpdir(), 'biblioteca-'));
process.env.EDITOR_CHEFE_BIBLIOTECA = BIB_TESTE;
test.after(() => rmSync(BIB_TESTE, { recursive: true, force: true }));

// Plugin hyperframes de mentira, só com a pasta de efeitos (como no montar.test.mjs)
const HF = mkdtempSync(join(tmpdir(), 'hyperframes-'));
const SFX = join(HF, 'skills', 'media-use', 'audio', 'assets', 'sfx');
mkdirSync(SFX, { recursive: true });
writeFileSync(join(SFX, 'manifest.json'), JSON.stringify(Object.fromEntries(['whoosh-short', 'pop', 'impact-bass-1'].map((k) => [k, { file: `${k}.mp3`, duration: 0.5 }]))));
for (const k of ['whoosh-short', 'pop', 'impact-bass-1']) writeFileSync(join(SFX, `${k}.mp3`), 'ID3');
process.env.HYPERFRAMES_PLUGIN_ROOT = HF;
test.after(() => rmSync(HF, { recursive: true, force: true }));

// Fala de exemplo com um momento para cada peça, 0,3 s por palavra (negócio fictício)
const FRASES = [[0.5, 'Isso o juiz reprova.'], [3, 'Você precisa de três documentos: o contrato, o recibo e o laudo.'], [8.5, 'Primeiro, o contrato.'],
  [11.5, 'Comenta agenda que eu te mando.'], [17.5, 'O prazo vence amanhã.'], [20.5, 'Me chama no WhatsApp ou no Instagram.'], [24.5, 'Olha o painel do sistema.'],
  [28.5, 'O atendimento vira agenda, venda, retorno e indicação.']];
const FALA = FRASES.flatMap(([t0, f]) => f.split(' ').map((text, i) => ({ text, start: +(t0 + 0.3 * i).toFixed(2), end: +(t0 + 0.3 * i + 0.28).toFixed(2) })));
const TOTAL = 32;
const PECAS = [
  { tipo: 'selo', selo: 'reprovado', fala: 'o juiz reprova' },
  { tipo: 'lista', titulo: 'três documentos', itens: ['o contrato', 'o recibo', 'o laudo'], fala: 'três documentos' },
  { tipo: 'capitulo', numero: 1, titulo: 'o contrato', fala: 'Primeiro' },
  { tipo: 'comenta', palavra: 'agenda', fala: 'Comenta agenda' },
  { tipo: 'objeto', objeto: 'calendario', fala: 'O prazo' },
  { tipo: 'app', apps: ['whatsapp', 'instagram'], fala: 'WhatsApp' },
  { tipo: 'janela', print: 'prints/painel.png', endereco: 'painel.exemplo.com.br', fala: 'Olha o painel' },
  { tipo: 'esquema', centro: 'atendimento', vagas: ['agenda', 'venda', 'retorno', 'indicação'], fala: 'O atendimento' },
];
const PAL = EC.mapear(FALA.map((w) => [w.text, w.start, w.end]), [{ ini: 0, dur: TOTAL, src: 0 }], TOTAL);

// Pasta de vídeo de teste no estilo 11, com o print da janela já conferido (o registro que o sigilo.mjs --print grava)
function projeto(extra = {}, { conferido = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'pecas-'));
  mkdirSync(join(dir, 'fonts'));
  for (const f of ['Montserrat-800.woff2', 'Anton-400.woff2']) writeFileSync(join(dir, 'fonts', f), 'wOF2');
  writeFileSync(join(dir, 'fonte.mp4'), '');
  writeFileSync(join(dir, 'transcript.json'), JSON.stringify(FALA));
  writeFileSync(join(dir, 'trechos.json'), JSON.stringify({ duracao: TOTAL, manter: [[0, TOTAL]] }));
  mkdirSync(join(dir, 'prints'));
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x2a6f97:s=1200x700', '-frames:v', '1', join(dir, 'prints', 'painel.png')]);
  if (conferido) writeFileSync(join(dir, 'sigilo.json'), JSON.stringify({ itens: [], prints: [{ arquivo: 'prints/painel.png', sha256: sha(join(dir, 'prints', 'painel.png')), lida: true, linhas: 0 }] }));
  writeFileSync(join(dir, 'escolhas.json'), JSON.stringify({ estilo: 'destaques-tipograficos', marca: MARCA, pecas: PECAS, ...extra }));
  return dir;
}
const lerD = (dir) => JSON.parse(/const D = (.*);/.exec(readFileSync(join(dir, 'index.html'), 'utf8'))[1]);
const erroDe = (fn) => { try { fn(); } catch (e) { return e.message; } assert.fail('não deu erro'); };

test('peças: a pasta tem só arquivos do manifesto, cada um com o SHA-256 e a linha da licença; PNG de até 256 px; SVG sem script nem link; menos de 4 MB', () => {
  const licencas = readFileSync(join(PASTA, 'LICENCAS.md'), 'utf8'), erros = [];
  const nosArquivos = ['objetos', 'icones', 'apps'].flatMap((d) => readdirSync(join(PASTA, d)).map((a) => `${d}/${a}`));
  const doManifesto = [...Object.values(MANIFESTO.objetos), ...Object.values(MANIFESTO.objetos).map((x) => x.sobrio), ...Object.values(MANIFESTO.apps)].filter((x) => x?.arquivo);
  for (const a of nosArquivos) if (!doManifesto.some((x) => x.arquivo === a)) erros.push(`${a}: fora do manifest.json`);
  for (const x of doManifesto) {
    if (!existsSync(join(PASTA, x.arquivo))) { erros.push(`${x.arquivo}: falta o arquivo`); continue; }
    if (sha(join(PASTA, x.arquivo)) !== x.sha256) erros.push(`${x.arquivo}: SHA-256 diferente do manifesto`);
    const linha = licencas.split('\n').find((l) => l.startsWith(`| \`${x.arquivo}\` |`));
    if (!linha) erros.push(`${x.arquivo}: sem linha no LICENCAS.md`);
    else if (x.origem === 'fluent-emoji' ? !/Fluent Emoji .* MIT \|$/.test(linha) || !linha.includes(x.sha256)
      : x.origem === 'phosphor' ? !/\| Phosphor \|.* MIT \|$/.test(linha) || !linha.includes(x.sha256) || !linha.includes(x.original) : !/https:\/\//.test(linha)) erros.push(`${x.arquivo}: linha do LICENCAS.md sem a origem e a licença`);
    if (/\.svg$/.test(x.arquivo) && x.origem === 'phosphor' && !readFileSync(join(PASTA, x.arquivo), 'utf8').includes('opacity="0.2"')) erros.push(`${x.arquivo}: sem a forma de trás do duotone`);
    if (/\.png$/.test(x.arquivo)) {
      const b = readFileSync(join(PASTA, x.arquivo));
      assert.equal(b.subarray(1, 4).toString(), 'PNG', x.arquivo);
      const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
      if (w > 256 || h > 256) erros.push(`${x.arquivo}: ${w}x${h}, maior que 256 px`);
    }
  }
  for (const [k, x] of Object.entries(MANIFESTO.objetos)) {
    if (x.origem !== 'fluent-emoji' || !x.original.startsWith('assets/')) erros.push(`${k}: origem sem licença conhecida`);
    if (!x.palavras?.length) erros.push(`${k}: sem palavras para a sugestão`);
    if (x.sobrio?.origem !== 'phosphor' || x.sobrio.arquivo !== `icones/${k}.svg` || !x.sobrio.original.startsWith('assets/duotone/')) erros.push(`${k}: sem o ícone sóbrio do Phosphor`);
  }
  for (const [k, x] of Object.entries(MANIFESTO.apps)) {
    if (!['meta-whatsapp', 'meta-instagram', 'meta-facebook', 'meta-threads', 'youtube', 'linkedin', 'telegram', 'perplexity', 'atlassian-trello', 'anthropic', 'google', 'tiktok', 'x', 'pinterest', 'notion', 'zoom', 'wikimedia-commons', 'desenho-proprio'].includes(x.origem)) erros.push(`${k}: origem "${x.origem}" sem kit de marca conhecido`);
    // marca sem kit público ou cuja regra não deixa usar o logo: ícone neutro nosso, marcado como genérico e com o motivo
    if (x.origem === 'desenho-proprio' && (x.arquivo || !EC.NEUTROS[x.desenho] || x.generico !== true || !(x.motivo?.length > 20))) erros.push(`${k}: genérico sem o desenho neutro, a marca de genérico ou o motivo`);
    if (x.origem !== 'desenho-proprio' && (!x.arquivo || x.generico)) erros.push(`${k}: logo oficial sem arquivo`);
    if (!x.palavras?.length) erros.push(`${k}: sem palavras para a sugestão`);
  }
  assert.match(licencas, /1ffb34c752ecf5d402f04cfb4b392c77f57c54bc/);
  assert.match(licencas, /Permission is hereby granted, free of charge/); // o texto da MIT vai junto, como a licença manda
  assert.match(licencas, /2b75f3ad12b420c9504ef05df8d2564a28f8500e[\s\S]*Copyright \(c\) 2023 Phosphor Icons/); // e a do Phosphor, no commit fixado
  assert.match(readFileSync(new URL('../NOTICE', import.meta.url), 'utf8'), /Fluent Emoji[\s\S]*Phosphor[\s\S]*Logos de aplicativo/);
  // o banco tem os 24 aplicativos, todos com o logo oficial (o desenho neutro fica só como reserva interna)
  assert.equal(Object.keys(MANIFESTO.apps).length, 24);
  for (const [k, x] of Object.entries(MANIFESTO.apps)) if (x.generico || !x.arquivo) erros.push(`${k}: sem o logo oficial`);
  // SVG de terceiro sem script, evento, link externo, imagem embutida nem entidade
  for (const a of nosArquivos.filter((a) => a.endsWith('.svg'))) {
    const s = readFileSync(join(PASTA, a), 'utf8');
    for (const oque of problemasSvg(s)) erros.push(`${a}: SVG com ${oque}`); // a mesma regra do banco de peças
  }
  // cada genérico aparece na lista do LICENCAS.md com o motivo
  for (const [k, x] of Object.entries(MANIFESTO.apps)) if (x.generico && !licencas.includes(`| ${k} |`)) erros.push(`${k}: genérico fora da lista do LICENCAS.md`);
  const total = nosArquivos.reduce((s, a) => s + statSync(join(PASTA, a)).size, 0);
  assert.ok(total < 4 * 1024 * 1024, `${total} bytes`);
  assert.deepEqual(erros, []);
});

test('peças: as 8 montam no estilo 11, cada uma no instante da fala dela, com a escala, os arquivos copiados e os sons', () => {
  const dir = projeto(), avisos = [];
  try {
    const r = montar(dir, (m) => avisos.push(m));
    assert.deepEqual(avisos, []);
    assert.equal(r.pecas, 8);
    const html = readFileSync(join(dir, 'index.html'), 'utf8'), D = lerD(dir);
    assert.doesNotMatch(html, /\{\{[A-Z_]+\}\}/);
    assert.match(html, /<script src="pecas\.js"><\/script>/);
    assert.ok(existsSync(join(dir, 'pecas.js')));
    assert.match(html, /font-family: "Anton"; src: url\("fonts\/Anton-400\.woff2"\)/); // a Montserrat da marca não é condensada
    assert.deepEqual(D.pecas.map((p) => p.tipo), PECAS.map((p) => p.tipo));
    const em = (txt) => PAL.find((p) => p.txt === txt).ini;
    assert.deepEqual(D.pecas.map((p) => p.t), [em('o'), em('três'), em('Primeiro,'), em('Comenta'), em('O'), em('WhatsApp'), em('Olha'), PAL.filter((p) => p.txt === 'O')[1].ini]);
    for (const p of D.pecas) assert.ok(p.sai > p.t && p.s > 0 && p.s <= 1 && p.h === EC.alturaPeca(p), JSON.stringify(p));
    // os itens da lista entram quando são ditos e ganham o check na última palavra; o aplicativo seguinte, quando é citado
    const lista = D.pecas[1];
    const antes = (w) => PAL[PAL.findIndex((p) => p.txt === w) - 1].ini; // o "o" antes do item
    assert.deepEqual(lista.escreve, [antes('contrato,'), antes('recibo'), antes('laudo.')]);
    assert.deepEqual(lista.marca, [em('contrato,'), em('recibo'), em('laudo.')]);
    assert.deepEqual(D.pecas[5].apps.map((a) => [a.app, a.t]), [['whatsapp', em('WhatsApp')], ['instagram', em('Instagram.')]]);
    assert.equal(D.pecas[3].palavra, 'AGENDA'); // a palavra do dono, em caixa alta
    assert.equal(D.nome, 'Estúdio Exemplo'); // a notificação do Comenta leva o nome do negócio
    // a pílula do capítulo fica do fim do cartão grande até o fim do vídeo, e empurra a faixa das peças seguintes para 330
    assert.deepEqual(D.pecas[2].pilula, [+(em('Primeiro,') + 2).toFixed(3), TOTAL]);
    // os arquivos usados copiados para pecas/ da pasta do vídeo, com o caminho que o molde usa
    assert.deepEqual(readdirSync(join(dir, 'pecas')).sort(), ['calendario.png', 'instagram.png', 'print-1.png', 'whatsapp.png']);
    assert.equal(D.pecas[4].arquivo, 'pecas/calendario.png');
    assert.equal(D.pecas[6].arquivo, 'pecas/print-1.png');
    // as palavras do objeto e dos aplicativos saem na cor de destaque na legenda
    assert.deepEqual(D.chaves.map((i) => PAL[i].txt), ['O', 'prazo', 'WhatsApp', 'Instagram.']);
    // cada som cai no movimento da peça (o pico do som no quadro em que ela pousa)
    const ev = EC.efeitos('destaques-tipograficos', D, [{ ini: 0, dur: TOTAL, src: 0 }], TOTAL).map((e) => [+e.t.toFixed(3), e.som]);
    const P = EC.PECA;
    for (const [t, sons] of [[D.pecas[0].t + P.selo.pousa, EC.SONS.apice], [D.pecas[3].t + P.comenta.notifica, ['notificacao']], [D.pecas[3].t + P.comenta.enche[1], ['pronto']], [D.pecas[4].t + P.objeto.pousa, EC.SONS.destaque]])
      assert.ok(ev.some(([x, s]) => Math.abs(x - t) < 0.002 && sons.includes(s)), `${sons} em ${t}: ${JSON.stringify(ev)}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('peças: fonte de título já condensada vale para a legenda e as peças, sem baixar a Anton', () => {
  const dir = projeto();
  try {
    const m = JSON.parse(readFileSync(MARCA, 'utf8'));
    writeFileSync(join(dir, 'marca.json'), JSON.stringify({ ...m, fontes: { ...m.fontes, titulo: 'Oswald' } }));
    writeFileSync(join(dir, 'escolhas.json'), JSON.stringify({ estilo: 'destaques-tipograficos', marca: 'marca.json', pecas: PECAS }));
    rmSync(join(dir, 'fonts', 'Anton-400.woff2'));
    writeFileSync(join(dir, 'fonts', 'Oswald-800.woff2'), 'wOF2');
    montar(dir, () => {});
    const html = readFileSync(join(dir, 'index.html'), 'utf8');
    assert.doesNotMatch(html, /Anton/);
    assert.match(html, /cond: "Oswald", condPeso: 800/);
    rmSync(join(dir, 'fonts', 'Oswald-800.woff2'));
    writeFileSync(join(dir, 'escolhas.json'), JSON.stringify({ estilo: 'destaques-tipograficos', marca: MARCA, pecas: PECAS }));
    assert.match(erroDe(() => montar(dir, () => {})), /falta a letra condensada da legenda e das peças \(fonts\/Anton-400\.woff2\)\. Baixe com: node .*baixar-fonte\.mjs" "Anton" "400"/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('peças: escolhas.json errado é erro em português que diz o que pôr', () => {
  const casos = [
    [{ tipo: 'balão', fala: 'x' }, /a peça 1 pede "tipo", um destes: selo, lista, capitulo, comenta, objeto, app, janela, esquema/],
    [{ tipo: 'selo', selo: 'aprovado' }, /pede "fala", as palavras da fala em que ela entra/],
    [{ tipo: 'selo', selo: 'verde', fala: 'o juiz reprova' }, /pede "selo", um destes: aprovado, reprovado, atencao, novo\. Verde e vermelho só para certo e errado/],
    [{ tipo: 'lista', itens: ['o contrato'], fala: 'três documentos' }, /pede "itens", uma lista com 2 a 4 textos curtos tirados da fala/],
    [{ tipo: 'lista', itens: ['o contrato', 'o recibo que chegou pelo correio ontem'], fala: 'três documentos' }, /o item "o recibo que chegou pelo correio ontem" da peça 1 \(.*\) tem 38 caracteres; cabem até 24/],
    [{ tipo: 'capitulo', numero: 12, titulo: 'o contrato', fala: 'Primeiro' }, /pede "numero", de 1 a 9/],
    [{ tipo: 'capitulo', numero: 1, fala: 'Primeiro' }, /pede "titulo", o nome da parte, tirado da fala/],
    [{ tipo: 'comenta', fala: 'Comenta agenda' }, /pede "palavra", a palavra que o dono escolheu .* Pergunte ao dono; não invente/],
    [{ tipo: 'comenta', palavra: 'duas palavras', fala: 'Comenta agenda' }, /uma só, sem espaço/],
    [{ tipo: 'objeto', objeto: 'unicórnio', fala: 'O prazo' }, /o objeto "unicórnio" da peça 1 precisa ser o nome de uma peça, em minúsculas e sem espaço\. Os do plugin: .*calendario/],
    [{ tipo: 'app', apps: ['Snap Chat'], fala: 'WhatsApp' }, /o aplicativo "Snap Chat" da peça 1 precisa ser o nome de uma peça, em minúsculas e sem espaço\. Os do plugin: whatsapp, instagram/],
    [{ tipo: 'app', apps: [], fala: 'WhatsApp' }, /pede "apps", de 1 a 4 aplicativos/],
    [{ tipo: 'esquema', vagas: ['a', 'b'], fala: 'O atendimento' }, /pede "centro"/],
    [{ tipo: 'esquema', centro: 'atendimento', vagas: ['a'], fala: 'O atendimento' }, /pede "vagas", uma lista com 2 a 4/],
    [{ tipo: 'janela', fala: 'Olha o painel' }, /pede "print", o caminho do print que o dono mandou/],
    [{ tipo: 'janela', print: 'prints/nao-existe.png', fala: 'Olha o painel' }, /o print "prints\/nao-existe\.png" da peça 1 precisa ser um PNG, JPG ou WebP que exista/],
  ];
  const dir = projeto();
  try {
    for (const [p, msg] of casos) assert.match(erroDe(() => lerPecas([p], dir)), msg, JSON.stringify(p));
    assert.match(erroDe(() => lerPecas({ tipo: 'selo' }, dir)), /"pecas" é a lista das peças animadas/);
    assert.deepEqual(lerPecas(undefined, dir), []);
    // sem frases e sem peças, o estilo 11 não tem o que mostrar acima da cabeça
    writeFileSync(join(dir, 'escolhas.json'), JSON.stringify({ estilo: 'destaques-tipograficos', marca: MARCA }));
    assert.match(erroDe(() => montar(dir, () => {})), /pedem "destaques".* ou "pecas", a lista das peças animadas/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('peças: uma de cada vez na faixa de cima; a que entra antes de a anterior terminar fica de fora, com aviso; frases e peças se revezam', () => {
  const pecas = lerPecas(PECAS.slice(0, 5), null), avisos = [];
  // a frase em destaque entra no meio da lista (antes do último item): fica de fora; o objeto 0,4 s depois do selo também
  const r = planoDestaques(['o *recibo* e o laudo', 'Me chama no *WhatsApp*'], PAL, { total: TOTAL, pecas: [{ ...pecas[0], fala: 'Isso o juiz' }, { tipo: 'objeto', objeto: 'erro', fala: 'reprova' }, ...pecas.slice(1)] }, (m) => avisos.push(m));
  assert.equal(avisos.length, 2, avisos.join('\n'));
  assert.match(avisos[0], /a peça 2 \(objeto 3D\) começa logo depois de a peça 1 \(selo\) \(antes de ela terminar na tela\); ficou de fora/);
  assert.match(avisos[1], /a frase em destaque "o recibo e o laudo" começa logo depois de a peça 3 \(cartão de lista\)/);
  assert.deepEqual(r.pecas.map((p) => p.tipo), ['selo', 'lista', 'capitulo', 'comenta', 'objeto']);
  assert.equal(r.destaques.length, 1); // "Me chama no WhatsApp" fica: entra bem depois de o objeto terminar
  // cada uma sai 0,35 s antes da seguinte entrar, ou quando termina
  const todos = [...r.pecas, ...r.destaques].sort((a, b) => a.t - b.t);
  todos.slice(0, -1).forEach((o, i) => assert.ok(o.sai <= todos[i + 1].t - 0.35 + 1e-9, JSON.stringify(o)));
  // com a pílula do capítulo na tela, ela encolhe para só o número enquanto cada peça ou frase passa, e quem passa fica
  // com até 772 px de largura, centrado (de 154 a 926), sem encostar nela
  const cap = r.pecas[2], faixa = (nome) => r.faixas.find((f) => f.nome.startsWith(nome));
  assert.equal(faixa('a peça 1').y0, 640 - Math.round(EC.alturaPeca(r.pecas[0]) * r.pecas[0].s)); // sem rastro do rosto: faixa fixa, de 240 a 640
  const depois = r.faixas.filter((f) => f.de > cap.pilula[0] && !/pílula/.test(f.nome));
  assert.equal(depois.length, 3); // o Comenta, o objeto e a frase
  assert.ok(depois.every((f) => f.x0 >= 154 && f.x1 <= 926 && f.y0 >= 240), JSON.stringify(depois));
  assert.deepEqual(cap.encolhe, depois.map((f) => [f.de, f.ate]));
  assert.deepEqual(r.destaques[0].x, [154, 926]);
  assert.deepEqual(faixa('a pílula do capítulo 1'), { nome: 'a pílula do capítulo 1', y0: 240, y1: 304, x0: 90, x1: 200 + 19 * 'o contrato'.length, de: cap.pilula[0], ate: +(cap.pilula[1] + 0.25).toFixed(3) });
});

test('peças: com a cabeça alta, o vídeo aproxima até o teto ou até o queixo chegar perto da legenda; sem lugar em cima para a peça inteira, ela vai para logo abaixo do queixo', () => {
  const pecas = lerPecas([PECAS[0]], null), cabeca = (topo) => () => [540, topo + 225, 300, 300]; // rosto de 300 px
  // alto da cabeça em 450: só com frases bastam 540 px (1,2); com peças o alvo é 630 (240 + 360 + 30), e o teto segura em 1,25
  const so = planoDestaques(['o juiz *reprova*'], PAL, { total: TOTAL, caixa: cabeca(450) });
  const com = planoDestaques(undefined, PAL, { total: TOTAL, caixa: cabeca(450), pecas });
  assert.deepEqual([so.z, com.z], [1.2, 1.25]);
  assert.equal(com.pecas[0].y1, Math.round(450 * 1.25 - 30));
  assert.deepEqual([com.pecas[0].lado, com.pecas[0].s], ['cima', 1]); // o selo (210 px) cabe inteiro em 292 px
  // rosto grande (600 px, alto da cabeça em 450, queixo em 1200): a aproximação para com o queixo 20 px acima da legenda
  const grande = planoDestaques(undefined, PAL, { total: TOTAL, caixa: () => [540, 900, 450, 600], pecas });
  assert.equal(grande.z, +(Math.floor((1290 / 1200) * 1000) / 1000).toFixed(3));
  assert.ok(1200 * grande.z <= 1290, String(grande.z));
  assert.equal(grande.pecas[0].y1, Math.round(450 * grande.z - 30));
  // a selfie comum (alto da cabeça em 110, queixo em 485): o selo encosta 30 px abaixo do queixo, inteiro
  const selfie = planoDestaques(undefined, PAL, { total: TOTAL, caixa: cabeca(110), pecas });
  assert.deepEqual([selfie.z, selfie.abre, selfie.pecas[0].lado, selfie.pecas[0].y1, selfie.pecas[0].s], [1, [], 'baixo', 515 + 210, 1]);
  // queixo em 1500: não sobra lugar nem em cima nem embaixo (120 px até o piso); a faixa fica no mínimo, com aviso
  const avisos = [], miuda = planoDestaques(undefined, PAL, { total: TOTAL, caixa: () => [540, 900, 300, 1200], pecas }, (m) => avisos.push(m));
  assert.deepEqual([miuda.pecas[0].lado, miuda.pecas[0].y1], ['baixo', 1650]);
  assert.match(avisos.join('\n'), /a peça 1 \(selo\) ficou apertada embaixo do queixo/);
});

// Caminho 2 (desde 2026-10-27): a peça ou a frase embaixo do queixo já mostra as palavras, então a legenda
// sai da tela enquanto ela está ali; a janela (o print) não mostra a fala, então ali a legenda fica
const legendaDe = (r) => EC.palavraPorVez(PAL.map((p, k) => ({ ...p, k })), new Set(), TOTAL, r.semLegenda);
const naTela = (grupos, [a, b]) => grupos.filter((g) => g.ini < b && g.sai > a);

test('caminho 2: com a peça embaixo do queixo a legenda sai da tela inteira dela; com a peça acima da cabeça a legenda fica', () => {
  // a selfie comum: as 7 peças (menos a janela) vão para logo abaixo do queixo
  const r = planoDestaques(undefined, PAL, { total: TOTAL, caixa: () => [540, 335, 300, 300], pecas: lerPecas(PECAS.filter((p) => p.tipo !== 'janela'), null) });
  const embaixo = r.faixas.filter((f) => f.lado === 'baixo');
  assert.equal(embaixo.length, 7);
  assert.ok(embaixo.every((f) => f.legenda === false && f.y0 >= 515), JSON.stringify(embaixo));
  for (const f of embaixo) assert.deepEqual(naTela(legendaDe(r), [f.de, f.ate]), [], `${f.nome}: a legenda ficou na tela`);
  // o teste pega: sem os intervalos, a legenda estaria na tela com cada uma delas
  for (const f of embaixo) assert.ok(naTela(legendaDe({ semLegenda: [] }), [f.de, f.ate]).length > 0, f.nome);
  // a legenda volta entre uma peça e outra: a fala de "Primeiro, o contrato." só tem o capítulo; antes dele, ela aparece
  assert.ok(legendaDe(r).length > 0);
  // cabeça baixa (alto em 700, queixo em 1075): o selo cabe inteiro acima da cabeça, e a legenda fica com ele
  const alto = planoDestaques(undefined, PAL, { total: TOTAL, caixa: () => [540, 925, 300, 300], pecas: lerPecas([PECAS[0]], null) });
  assert.deepEqual([alto.pecas[0].lado, alto.semLegenda], ['cima', []]);
  assert.ok(naTela(legendaDe(alto), [alto.faixas[0].de, alto.faixas[0].ate]).length > 0);
});

test('caminho 2: na janela a legenda fica na tela, e a janela não cobre a legenda nem o rosto', () => {
  const janela = (caixa) => planoDestaques(undefined, PAL, { total: TOTAL, caixa, pecas: [PECAS[6]] }), f0 = (r) => r.faixas.find((f) => /janela/.test(f.nome));
  const fala = PAL.filter((p) => p.ini >= 24.5 && p.ini < 26); // "Olha o painel do sistema."
  // selfie (queixo em 485): entre o queixo e a legenda, inteira
  const selfie = janela(() => [540, 335, 300, 300]), fs = f0(selfie);
  assert.deepEqual([fs.lado, fs.legenda, fs.y0, fs.y1, selfie.semLegenda], ['baixo', true, 515, 515 + 344, []]);
  // cabeça baixa no alto (alto da cabeça em 700, queixo em 1075): cabe inteira acima da cabeça, com a legenda no lugar
  const alta = janela(() => [540, 925, 300, 300]), fa = f0(alta);
  assert.deepEqual([fa.lado, fa.legenda, fa.legendaY, alta.legendaNoAlto], ['cima', true, undefined, undefined]);
  // rosto enorme (alto da cabeça em 150, queixo em 1400): só sobra embaixo da legenda, de 1500 ao piso de 1650; a legenda não
  // cabe acima da cabeça (precisaria dela em 430 ou abaixo), então fica o lugar de antes
  const enorme = janela(() => [540, 900, 600, 1000]), fe = f0(enorme);
  assert.deepEqual([fe.lado, fe.legenda, fe.y0, fe.legendaY], ['rodape', true, 1500, undefined]);
  for (const [r, f] of [[selfie, fs], [alta, fa], [enorme, fe]]) {
    assert.ok(f.y1 <= 1310 || f.y0 >= 1480, `a janela cobre a legenda: ${f.y0} a ${f.y1}`);
    for (const p of fala) assert.ok(legendaDe(r).some((g) => g.ini <= p.ini && g.sai > p.ini), `"${p.txt}" sem legenda durante a janela`);
  }
  // o teste pega: com a janela num intervalo sem legenda, as palavras dela sumiriam
  assert.ok(fala.some((p) => !legendaDe({ semLegenda: [[fs.de, fs.ate]] }).some((g) => g.ini <= p.ini && g.sai > p.ini)));
});

test('caminho 2: a janela que não cabe inteira em lugar nenhum desce para embaixo do queixo, e a legenda sobe para acima da cabeça enquanto ela fica', () => {
  const janela = (caixa) => planoDestaques(undefined, PAL, { total: TOTAL, caixa, pecas: [PECAS[6]] }), f0 = (r) => r.faixas.find((f) => /janela/.test(f.nome));
  // cabeça baixa e rosto grande (alto da cabeça em 482, queixo em 1220, como na gravação de prova): acima da cabeça, mesmo
  // aproximando, sobram 239 px; entre o queixo e a legenda, 40; embaixo da legenda, 150. Embaixo do queixo até 1650, 400
  const r = janela(() => [540, 925, 443, 590]), f = f0(r), leg = r.faixas.find((x) => x.nome === 'a legenda acima da cabeça');
  assert.deepEqual([f.lado, f.legenda, f.y0, f.y1, f.x1 - f.x0], ['baixo', true, 1250, 1250 + 344, 860]); // inteira, 860 px
  assert.equal(r.z, 1); // nada fica acima da cabeça: o vídeo não aproxima
  // a caixa da legenda (170 px) vai para o alto da área segura, de 240 a 410, e acaba 20 px ou mais acima da cabeça mais alta
  assert.deepEqual([f.legendaY, leg.y0, leg.y1], [240, 240, 410]);
  assert.deepEqual(r.legendaNoAlto, [[f.de, f.ate, 240]]);
  assert.ok(leg.y0 >= 240 && leg.y1 <= 482 - 20);
  assert.ok(leg.y1 <= f.y0 && [leg.de, leg.ate].join() === [f.de, f.ate].join(), 'a legenda não sobrepõe a janela');
  // a legenda continua na tela durante a janela (as palavras dela aparecem), só que no alto
  for (const p of PAL.filter((x) => x.ini >= 24.5 && x.ini < 26)) assert.ok(legendaDe(r).some((g) => g.ini <= p.ini && g.sai > p.ini), p.txt);
  // o molde move a caixa da legenda nesses intervalos e a devolve no fim
  const js = readFileSync(new URL('../plugins/editor-chefe/estilos/pecas.js', import.meta.url), 'utf8');
  assert.match(js, /for \(const \[a, b, y\] of noAlto\) \{ tl\.set\(host, \{ y: y - host\.offsetTop \}, a\); tl\.set\(host, \{ y: 0 \}, b\); \}/);
  // a legenda só sobe com a cabeça em 430 ou abaixo (240 + 170 + 20): rosto de 590 px com o queixo em 1220 e a cabeça em 429
  // ou 430 (o queixo segura a janela embaixo dele)
  const limite = (alto) => janela(() => [540, alto + 0.75 * (1220 - alto) / 1.25, 0.75 * (1220 - alto) / 1.25, (1220 - alto) / 1.25]);
  assert.equal(f0(limite(430)).legendaY, 240);
  assert.equal(f0(limite(429)).legendaY, undefined);
  // a regra não muda nada quando a janela já cabe: a selfie (entre o queixo e a legenda) e a cabeça baixa com lugar em cima
  for (const caixa of [() => [540, 335, 300, 300], () => [540, 925, 300, 300]]) {
    const x = janela(caixa);
    assert.deepEqual([f0(x).legendaY, x.legendaNoAlto, x.faixas.some((y) => y.nome === 'a legenda acima da cabeça')], [undefined, undefined, false]);
  }
});

test('peças: a conferência enxerga cada peça e a pílula como faixas com tempo e reprova o rosto embaixo delas', () => {
  const dir = projeto();
  try {
    montar(dir, () => {});
    const html = readFileSync(join(dir, 'index.html'), 'utf8'), D = lerD(dir), z = zonas(html, TOTAL);
    const daPeca = z.filter((a) => /^a peça \d/.test(a.nome));
    assert.equal(daPeca.length, 8);
    assert.ok(z.some((a) => a.nome === 'a pílula do capítulo 1'));
    D.pecas.forEach((p, i) => {
      const f = daPeca[i], meio = (p.t + p.sai) / 2, alt = f.y1 - f.y0;
      assert.match(f.nome, new RegExp(`^a peça ${i + 1} \\(`));
      assert.ok(cobre({ x: 540, y: f.y1 - alt / 2, w: 300, h: 300 }, meio, z).some((a) => a.nome === f.nome), `${f.nome} em cima do rosto`);
      assert.ok(!cobre({ x: 540, y: f.y1 + 400, w: 300, h: 300 }, meio, z).some((a) => a.nome === f.nome), `${f.nome} acima do rosto`);
      assert.ok(!cobre({ x: 540, y: f.y1 - alt / 2, w: 300, h: 300 }, p.sai + 0.4, z).some((a) => a.nome === f.nome), `${f.nome} já saiu`);
    });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('peças: o print só entra na janela depois da conferência de dado pessoal, sem mudar depois dela, e o borrão vale para ele', (t) => {
  const dir = projeto({}, { conferido: false });
  try {
    assert.match(erroDe(() => montar(dir, () => {})), /o print "prints\/painel\.png" ainda não passou pela conferência de dado pessoal\. Rode node sigilo\.mjs \. --print "prints\/painel\.png"/);
    // fora do Mac a leitura não existe: o print fica registrado como não lido e a janela não entra
    conferirPrint(dir, 'prints/painel.png', { tela: false });
    assert.match(erroDe(() => montar(dir, () => {})), /o texto do print "prints\/painel\.png" não foi lido neste computador \(a leitura de texto da tela só existe no Mac\)/);
    if (!telaDisponivel()) return t.skip('a leitura da tela só existe no Mac');
    // no Mac: um CPF de mentira desenhado no print, achado pela leitura de texto do macOS
    imagemComTexto(join(dir, 'prints', 'painel.png'), 1200, 700, 'CPF 123.456.789-09', { x: 0.1, y: 0.2, tamanho: 0.06 });
    const r = conferirPrint(dir, 'prints/painel.png'), cpf = r.itens.find((i) => i.tipo === 'CPF');
    assert.ok(cpf && cpf.print === 'prints/painel.png', JSON.stringify(r.itens));
    assert.match(resumo(r), new RegExp(`NO PRINT \\[${cpf.n}\\]: CPF na linha "CPF 123\\.456\\.789-09" do print "prints/painel\\.png"`));
    montar(dir, () => {});
    assert.ok(procurar(lerTela([join(dir, 'pecas', 'print-1.png')])[0].map((l) => l.texto).join(' ')).length, 'sem borrão, o CPF ainda se lê');
    // o print trocado depois da conferência não entra
    appendFileSync(join(dir, 'prints', 'painel.png'), Buffer.from([0]));
    assert.match(erroDe(() => montar(dir, () => {})), /o print "prints\/painel\.png" mudou depois da conferência/);
    imagemComTexto(join(dir, 'prints', 'painel.png'), 1200, 700, 'CPF 123.456.789-09', { x: 0.1, y: 0.2, tamanho: 0.06 });
    const r2 = conferirPrint(dir, 'prints/painel.png'), cpf2 = r2.itens.find((i) => i.tipo === 'CPF');
    // com o sim do dono, o --borrar guarda a caixa do CPF para o print e o montador borra o print copiado
    escolherBorrar(dir, [cpf2.n]);
    const b = JSON.parse(readFileSync(join(dir, 'borrar.json'), 'utf8'));
    assert.equal(b.prints['prints/painel.png'].length, 1);
    assert.deepEqual(b.areas, []);
    const D = (montar(dir, () => {}), lerD(dir));
    assert.equal(D.pecas.find((p) => p.tipo === 'janela').borradas, 1);
    const lido = lerTela([join(dir, 'pecas', 'print-1.png')])[0].map((l) => l.texto).join(' ');
    assert.deepEqual(procurar(lido), [], `o CPF ainda se lê depois do borrão: "${lido}"`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('peças: cores legíveis na marca: selo verde e vermelho com 4,5:1 no branco, texto sobre o destaque com 3:1', () => {
  const BRANCO = [255, 255, 255], c = EC.contraste;
  for (const m of [{ CLARO: '#F5F1EA', ESCURO: '#141414', DESTAQUE: '#9A6A5A' }, { CLARO: '#FAF7F0', ESCURO: '#14213D', DESTAQUE: '#F2C200' }, { CLARO: '#FFFFFF', ESCURO: '#7A7A7A', DESTAQUE: '#FFE066' }]) {
    const K = EC.coresPecas(m);
    assert.ok(c(K.VERDE, BRANCO) >= 4.5 && c(K.VERMELHO, BRANCO) >= 4.5);
    assert.ok(c(K.SOBRE_LINHA, K.LINHA) >= 3, `${m.DESTAQUE}: ${c(K.SOBRE_LINHA, K.LINHA)}`);
    assert.ok(c(K.LINHA, BRANCO) >= 3 && c(K.TEXTO, BRANCO) >= 4.5 && c(K.APAGADO, BRANCO) >= 4.5);
  }
});

test('legenda de uma palavra: uma por vez, a curta vai com a seguinte, a palavra-chave marcada, cada uma até a próxima', () => {
  const pal = [['A', 0, 0.1], ['análise', 0.12, 0.6], ['do', 0.8, 0.9], ['contrato.', 0.95, 1.5], ['Depois,', 2.5, 2.9], ['é', 3.6, 3.7]].map(([txt, ini, fim], k) => ({ txt, ini, fim, k }));
  assert.deepEqual(EC.palavraPorVez(pal, new Set([3]), 4), [
    { txt: 'A análise', ini: 0, sai: 0.8, chave: false },
    { txt: 'do contrato', ini: 0.8, sai: 1.9, chave: true }, // a pausa depois: fica até 0,4 s depois do fim
    { txt: 'Depois', ini: 2.5, sai: 3.3, chave: false }, // a pontuação do fim sai
    { txt: 'é', ini: 3.6, sai: 4, chave: false }, // a última fica sozinha, até o fim do vídeo
  ]);
  // o molde: caixa alta, letra condensada, contorno no escuro da marca e a palavra-chave na cor de destaque
  const js = readFileSync(new URL('../plugins/editor-chefe/estilos/pecas.js', import.meta.url), 'utf8');
  assert.match(js, /#legenda \.palavra \{[^}]*font-family: var\(--cond\)[^}]*font-size: 150px[^}]*text-transform: uppercase/);
  // o contorno grosso fica atrás da letra (camada ::before), e a letra da frente leva 1 px dele
  assert.match(js, /#legenda \.palavra span::before \{ content: attr\(data-t\);[^}]*z-index: -1;[^}]*-webkit-text-stroke: 16px var\(--leg-contorno\)/);
  assert.match(js, /#legenda \.palavra span \{[^}]*-webkit-text-stroke: 1px var\(--leg-contorno\); \}/);
  assert.match(js, /#legenda \.palavra\.chave span \{ color: var\(--leg-chave\); \}/);
});

test('legenda de uma palavra: branca com 15:1 contra o contorno, e a palavra-chave no destaque clareado até 9:1, que lê também em fundo escuro', () => {
  const c = EC.contraste;
  for (const m of [{ ESCURO: '#141414', DESTAQUE: '#9A6A5A' }, { ESCURO: '#14213D', DESTAQUE: '#F2C200' }, { ESCURO: '#1A3464', DESTAQUE: '#1A3464' }]) {
    const L = EC.coresLegenda(m);
    assert.ok(c(L.TEXTO, L.CONTORNO) >= 15 && c(L.CHAVE, L.CONTORNO) >= 9, JSON.stringify(L));
    // num fundo de luminância 0,1 (cabelo, roupa escura), a letra da palavra-chave sozinha passa de 3:1
    assert.ok(c(L.CHAVE, [89, 89, 89]) >= 3, `${m.DESTAQUE}: ${c(L.CHAVE, [89, 89, 89])}`);
  }
  assert.deepEqual(EC.coresLegenda({ ESCURO: '#14213D', DESTAQUE: '#F2C200' }).CHAVE, [0xf2, 0xc2, 0x00]); // o amarelo já lê: fica a cor da marca
});

// Sugestão de peças (scripts/pecas.mjs): lê a fala e sugere; o Claude confere
import { sugerir, sugerirPasta, familiaSugerida } from '../plugins/editor-chefe/scripts/pecas.mjs';

const falaDe = (frases) => { let t = 0.5; return frases.flatMap((f) => { const r = f.split(' ').map((txt) => { const p = { txt, ini: +t.toFixed(2), fim: +(t + 0.28).toFixed(2) }; t += 0.3; return p; }); t += 0.6; return r; }); };

test('sugestão: cada tipo de peça é sugerido no momento da fala que pede, com as palavras dela', () => {
  const pal = falaDe(['Isso é errado.', 'Você precisa de três documentos: o contrato, o recibo e o laudo.', 'Primeiro, o contrato.', 'Segundo, o prazo.',
    'Comenta agenda que eu te mando.', 'Me chama no WhatsApp ou no Instagram.', 'Olha o painel do sistema.', 'O atendimento vira agenda, venda, retorno e indicação.', 'Atenção ao golpe.']);
  const s = sugerir(pal), de = (tipo) => s.filter((x) => x.tipo === tipo).map((x) => x.proposta);
  const em = (txt) => pal.find((p) => p.txt === txt).ini;
  assert.deepEqual(de('selo'), [{ tipo: 'selo', selo: 'reprovado', fala: 'errado' }, { tipo: 'selo', selo: 'atencao', fala: 'Atenção' }]);
  assert.deepEqual(de('lista')[0], { tipo: 'lista', titulo: 'três documentos', itens: ['o contrato', 'o recibo', 'o laudo'], fala: 'três documentos' });
  assert.deepEqual(de('capitulo'), [{ tipo: 'capitulo', numero: 1, titulo: 'o contrato', fala: 'Primeiro' }, { tipo: 'capitulo', numero: 2, titulo: 'o prazo', fala: 'Segundo' }]);
  assert.deepEqual(de('comenta'), [{ tipo: 'comenta', palavra: 'AGENDA', fala: 'Comenta' }]);
  assert.match(s.find((x) => x.tipo === 'comenta').nota, /confirme com o dono que a palavra é AGENDA/);
  assert.deepEqual(de('app'), [{ tipo: 'app', apps: ['whatsapp', 'instagram'], fala: 'WhatsApp' }]);
  assert.deepEqual(de('janela'), [{ tipo: 'janela', print: null, fala: 'o painel' }]); // uma só para "painel do sistema"
  assert.match(s.find((x) => x.tipo === 'janela').nota, /só entra com um print que o dono mandar/);
  assert.deepEqual(de('esquema'), [{ tipo: 'esquema', centro: 'atendimento', vagas: ['agenda', 'venda', 'retorno', 'indicação'], fala: 'atendimento' }]);
  assert.ok(de('objeto').some((p) => p.objeto === 'calendario' && p.fala === 'prazo'), JSON.stringify(de('objeto')));
  assert.equal(s.find((x) => x.tipo === 'app').t, em('WhatsApp'));
  s.slice(1).forEach((x, i) => assert.ok(x.t >= s[i].t)); // na ordem do tempo
  // cada "fala" proposta está na fala, como está no texto (o montador acha a peça)
  for (const x of s) assert.ok(pal.map((p) => p.txt).join(' ').includes(x.proposta.fala), x.proposta.fala);
});

test('sugestão: cada aplicativo do banco é chamado pelo nome e pelos apelidos dele; palavra comum não chama logo', () => {
  const chama = [
    ['Me chama no zap.', 'whatsapp'], ['Manda no zapzap.', 'whatsapp'], ['Manda no WhatsApp.', 'whatsapp'], ['Posta no insta.', 'instagram'], ['Posta no Instagram.', 'instagram'],
    ['Está no Facebook.', 'facebook'], ['Tem no YouTube.', 'youtube'], ['Me acha no Linked In.', 'linkedin'], ['Eu pergunto pro Chat GPT.', 'chatgpt'], ['O ChatGPT respondeu.', 'chatgpt'],
    ['O GPT respondeu.', 'chatgpt'], ['Eu uso o Claude.', 'claude'], ['Joga no Gemini.', 'gemini'], ['Pesquisei no Perplexity.', 'perplexity'], ['Salva no Google Drive.', 'google-drive'],
    ['Está na pasta do drive.', 'google-drive'], ['Manda pro Gmail.', 'gmail'], ['Marca na agenda do Google.', 'google-agenda'], ['Entra no Google Meet.', 'google-meet'],
    ['Te mando o link do meet.', 'google-meet'], ['Está na planilha do Google.', 'google-planilhas'], ['Escreve no Google Docs.', 'google-docs'], ['Posta no TikTok.', 'tiktok'],
    ['Posta no tik tok.', 'tiktok'], ['Eu escrevi no Threads.', 'threads'], ['Saiu no Twitter.', 'x'], ['Entra no grupo do Telegram.', 'telegram'], ['Salvei no Pinterest.', 'pinterest'],
    ['Organiza no Notion.', 'notion'], ['Faz no Canva.', 'canva'], ['A reunião foi pelo Zoom.', 'zoom'], ['Entra no zoom às oito.', 'zoom'], ['Coloca no quadro do Trello.', 'trello'],
  ];
  for (const [frase, app] of chama) {
    const s = sugerir(falaDe([frase])).filter((x) => x.tipo === 'app');
    assert.deepEqual(s.map((x) => x.proposta.apps), [[app]], frase);
  }
  for (const app of Object.keys(MANIFESTO.apps)) assert.ok(chama.some(([, a]) => a === app), `${app}: sem frase de teste`);
  // "zoom" de aproximar, "x" letra, "drive" sozinho, "face" do rosto, "telegrama", planilha e documento quaisquer
  for (const frase of ['Dá um zoom na imagem.', 'Faz um zoom no rosto.', 'Com zoom fica melhor.', 'O x da questão é esse.', 'Salva no pen drive.', 'Fiz um test drive.',
    'Limpeza da face.', 'Mandei um telegrama.', 'Abre a planilha do Excel.', 'O documento do cliente.', 'Guarda na nuvem.', 'Vamos nos encontrar.', 'Uma thread no fórum.'])
    assert.deepEqual(sugerir(falaDe([frase])).filter((x) => x.tipo === 'app'), [], frase);
});

test('sugestão: sem a palavra depois de "comenta", ela não é inventada; sequência falada vira lista; sem nada a sugerir, lista vazia', () => {
  const s = sugerir(falaDe(['Comenta aí embaixo.']));
  assert.deepEqual(s.map((x) => x.proposta), [{ tipo: 'comenta', palavra: null, fala: 'Comenta' }]);
  assert.match(s[0].nota, /pergunte ao dono qual é, sem inventar/);
  const seq = sugerir(falaDe(['Primeiro, a análise técnica.', 'Depois, a negociação.', 'Por fim, a justiça.'])).filter((x) => x.tipo === 'lista');
  assert.deepEqual(seq.map((x) => x.proposta.itens), [['a análise técnica', 'a negociação', 'a justiça']]);
  assert.deepEqual(sugerir(falaDe(['Bom dia a todos.', 'Hoje eu quero falar com vocês.'])), []);
  // um só "primeiro" não é vídeo em partes: nada de capítulo
  assert.ok(!sugerir(falaDe(['Primeiro, a análise técnica do contrato.'])).some((x) => x.tipo === 'capitulo'));
});

test('sugestão: na pasta do vídeo, palavra de corte extra não sugere nada e o tempo é o do vídeo editado', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sugestao-'));
  try {
    const fala = [['Isso', 0.5], ['é', 0.8], ['errado.', 1.1], ['Me', 3], ['chama', 3.3], ['no', 3.6], ['WhatsApp.', 3.9]].map(([text, start]) => ({ text, start, end: start + 0.28 }));
    writeFileSync(join(dir, 'transcript.json'), JSON.stringify(fala));
    writeFileSync(join(dir, 'trechos.json'), JSON.stringify({ manter: [[0.4, 1.5], [2.9, 4.3]], extras: [[0.4, 1.5]] }));
    const s = sugerirPasta(dir);
    assert.deepEqual(s.map((x) => x.tipo), ['app']); // o "errado" caiu no corte
    assert.equal(s[0].t, +(1.1 + 3.9 - 2.9).toFixed(2)); // 1,1 s do primeiro trecho mais 1 s dentro do segundo
    assert.deepEqual(JSON.parse(readFileSync(join(dir, 'pecas-sugeridas.json'), 'utf8')), s);
    rmSync(join(dir, 'transcript.json'));
    assert.match(erroDe(() => sugerirPasta(dir)), /pecas: falta o transcript\.json na pasta do vídeo/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('ícones sóbrios: com "icones": "sobrio" o objeto vai como o SVG do Phosphor nos dados, sem PNG; o padrão vem do marca.json', () => {
  const dir = projeto({ icones: 'sobrio' });
  try {
    montar(dir, () => {});
    let D = lerD(dir), obj = D.pecas.find((p) => p.tipo === 'objeto');
    assert.equal(D.icones, 'sobrio');
    assert.equal(obj.svg, readFileSync(join(PASTA, 'icones', 'calendario.svg'), 'utf8').trim()); // o original, sem mudança
    assert.equal(obj.arquivo, undefined);
    assert.ok(!readdirSync(join(dir, 'pecas')).includes('calendario.png'));
    // o molde: disco branco, traço no escuro da marca e a forma de trás no destaque
    const js = readFileSync(new URL('../plugins/editor-chefe/estilos/pecas.js', import.meta.url), 'utf8');
    assert.match(js, /\.objeto-disco \{[^}]*border-radius: 50%; background: #fff;/);
    assert.match(js, /\.objeto-disco svg \{[^}]*color: var\(--texto\); \}/);
    assert.match(js, /\.objeto-disco svg \[opacity="0\.2"\] \{ fill: var\(--linha\); opacity: 1; \}/);
    // sem o campo no escolhas.json, vale o "icones" do marca.json; sem os dois, 3D
    const m = JSON.parse(readFileSync(MARCA, 'utf8'));
    writeFileSync(join(dir, 'marca.json'), JSON.stringify({ ...m, icones: 'sobrio' }));
    writeFileSync(join(dir, 'escolhas.json'), JSON.stringify({ estilo: 'destaques-tipograficos', marca: 'marca.json', pecas: PECAS }));
    montar(dir, () => {});
    assert.equal(lerD(dir).icones, 'sobrio');
    writeFileSync(join(dir, 'escolhas.json'), JSON.stringify({ estilo: 'destaques-tipograficos', marca: MARCA, pecas: PECAS }));
    montar(dir, () => {});
    D = lerD(dir); obj = D.pecas.find((p) => p.tipo === 'objeto');
    assert.deepEqual([D.icones, obj.arquivo, obj.svg], ['3d', 'pecas/calendario.png', undefined]);
    writeFileSync(join(dir, 'escolhas.json'), JSON.stringify({ estilo: 'destaques-tipograficos', marca: MARCA, pecas: PECAS, icones: 'emoji' }));
    assert.match(erroDe(() => montar(dir, () => {})), /"icones" \(no escolhas\.json\) é "3d" \(objetos 3D, mais animados\) ou "sobrio"/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('família dos objetos: para clínica, consultório, advocacia e contabilidade a sugestão é a sóbria; nos outros, nenhuma', () => {
  const s = (nome, assinatura) => familiaSugerida({ nome, assinatura })?.motivo ?? null;
  assert.equal(s('MF Coelho Advocacia'), 'escritório de advocacia');
  assert.equal(s('Dra. Ana', 'Direito de família'), 'escritório de advocacia'); // pela assinatura
  assert.equal(s('Clínica Exemplo'), 'clínica ou consultório');
  assert.equal(s('Odonto Sorriso'), 'clínica ou consultório');
  assert.equal(s('Silva Contabilidade'), 'escritório de contabilidade');
  for (const nome of ['Estúdio Exemplo', 'Rede Independente', 'Escritório de Design', 'Loja Acidente Zero', 'Padaria Saudável']) assert.equal(s(nome), null, nome);
  assert.equal(familiaSugerida(null), null);
});

test('print da janela: só caminho dentro da pasta do vídeo; absoluto, ".." e link que sai dela são recusados no sigilo e no montador', () => {
  const dir = projeto(), fora = mkdtempSync(join(tmpdir(), 'fora-'));
  try {
    copyFileSync(join(dir, 'prints', 'painel.png'), join(fora, 'painel.png'));
    symlinkSync(join(fora, 'painel.png'), join(dir, 'prints', 'link.png')); // link dentro de prints/ que aponta para fora
    symlinkSync(join(dir, 'prints', 'painel.png'), join(dir, 'prints', 'link-dentro.png')); // link que fica dentro: vale
    const casos = [[join(fora, 'painel.png'), /é um caminho absoluto\. Copie o print do dono para prints\/ da pasta do vídeo/],
      ['../' + fora.split('/').pop() + '/painel.png', /sobe de pasta \(".."\)\. Copie o print do dono para prints\//],
      ['prints/link.png', /é um link que sai da pasta do vídeo\. Copie o print do dono para prints\//]];
    for (const [arq, msg] of casos) {
      assert.match(erroDe(() => conferirPrint(dir, arq, { tela: false })), new RegExp('^sigilo: o print "[^"]*" ' + msg.source), arq);
      assert.match(erroDe(() => lerPecas([{ tipo: 'janela', print: arq, fala: 'Olha o painel' }], dir)), new RegExp('^montar: o print "[^"]*" ' + msg.source), arq);
    }
    // o caminho de dentro (também por link que fica dentro) passa da conferência do caminho
    assert.equal(conferirPrint(dir, 'prints/link-dentro.png', { tela: false }).prints.at(-1).arquivo, 'prints/link-dentro.png');
    assert.match(erroDe(() => lerPecas([{ tipo: 'janela', print: 'prints/link-dentro.png', fala: 'Olha o painel' }], dir)), /não foi lido neste computador/); // chegou na conferência de dado pessoal
  } finally { rmSync(dir, { recursive: true, force: true }); rmSync(fora, { recursive: true, force: true }); }
});

test('peças: a letra da lista, do esquema e da janela ficou de 25% a 45% maior, e o mínimo de quando encolhe subiu junto', () => {
  const js = readFileSync(new URL('../plugins/editor-chefe/estilos/pecas.js', import.meta.url), 'utf8');
  const px = (cls) => +new RegExp(`\\.${cls} \\{[^}]*font-size: (\\d+)px`).exec(js)[1];
  // antes (2026-10-26): título da lista 42, itens 40, centro do esquema 34, vagas 30, endereço da janela 18
  assert.deepEqual([px('lista-titulo'), px('lista-texto'), px('esquema-centro-texto'), px('vaga-texto'), px('janela-endereco')], [54, 52, 44, 40, 26]);
  // o texto que encolhe até caber para no mínimo novo (antes 28, 26, 18, 18), não no antigo
  assert.match(js, /"lista-titulo", `\$\{id\}-titulo`, p\.titulo\)\), larg, 0, 36\)/);
  assert.match(js, /caber\(tx, larg - 84, 0, 34\)/);
  assert.match(js, /caber\(tx, 256, 86, 24\)/);
  assert.match(js, /p\.centro\)\), 242, 130, 24\)/);
  // a peça cresceu junto: a altura da linha e do título da lista, do esquema e da janela (o plano reserva essas alturas)
  assert.deepEqual([EC.PECA.lista.linha, EC.PECA.lista.titulo, EC.PECA.esquema.h, EC.PECA.janela.h], [84, 90, 330, 344]);
});
