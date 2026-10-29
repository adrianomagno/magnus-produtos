// tests/narrado.test.mjs: estilo 10, Motion narrado. Monta com a marca de teste e uma fala de exemplo neutra, com voz e
// efeitos sintéticos (precisa de ffmpeg e ffprobe no PATH, o prefixo do ambiente.sh resolve).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { montar, planoNarrado } from '../plugins/editor-chefe/scripts/montar.mjs';

// banco local de peças só deste arquivo de teste (o montador guarda ali as peças e o logo do cliente)
const BIB_TESTE = mkdtempSync(join(tmpdir(), 'biblioteca-'));
process.env.EDITOR_CHEFE_BIBLIOTECA = BIB_TESTE;
test.after(() => rmSync(BIB_TESTE, { recursive: true, force: true }));

const MARCA = fileURLToPath(new URL('./marca-teste.json', import.meta.url));
const ff = (...a) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...a]);
const raiz = mkdtempSync(join(tmpdir(), 'narrado-'));
test.after(() => rmSync(raiz, { recursive: true, force: true }));

// Plugin hyperframes de mentira com efeitos sintéticos (os sons de verdade não entram no repositório)
const SFX = join(raiz, 'hf', 'skills', 'media-use', 'audio', 'assets', 'sfx');
mkdirSync(SFX, { recursive: true });
const SONS = {
  'impact-bass-2': ['0.9*sin(2*PI*55*t)*exp(-3*t)*min(t/0.3\\,1)', 2.59], 'impact-bass-1': ['0.9*sin(2*PI*60*t)*exp(-3*t)', 2.12],
  click: ['(random(0)*2-1)*0.8*exp(-60*t)', 0.37], pop: ['0.8*sin(2*PI*600*t)*exp(-25*t)', 0.72],
  ping: ['0.6*sin(2*PI*1500*t)*exp(-4*t)', 1.32], chime: ['0.5*(sin(2*PI*880*t)+sin(2*PI*1320*t))*exp(-1.5*t)', 2.5],
};
for (const [k, [ex, d]] of Object.entries(SONS)) ff('-f', 'lavfi', '-i', `aevalsrc=${ex}:s=48000:d=${d}`, join(SFX, `${k}.wav`));
writeFileSync(join(SFX, 'manifest.json'), JSON.stringify(Object.fromEntries(Object.entries(SONS).map(([k, [, d]]) => [k, { file: `${k}.wav`, duration: d }]))));
process.env.HYPERFRAMES_PLUGIN_ROOT = join(raiz, 'hf');

// Fala de exemplo (negócio fictício falando de atendimento), 0,3 s por palavra, pausa de 1 s depois de cada ponto
const fala = (texto) => {
  let t = 0.5;
  return texto.split(' ').map((w) => { const p = { text: w, start: +t.toFixed(3), end: +(t + 0.26).toFixed(3) }; t += /[.?!]$/.test(w) ? 1.3 : 0.3; return p; });
};
const TEXTO = 'Aqui na loja, todo cliente recebe resposta no mesmo dia. Se a dúvida chega de manhã, a solução sai antes do almoço.';
const ESCOLHAS = { estilo: 'motion-narrado', chaves: ['loja', { texto: 'resposta', icone: 'conversa' }, 'manhã', 'almoço'], apice: 'resposta' };

// Pasta de vídeo como o voz-com-tempos.mjs deixa: words.json e audio/voz.wav (um tom em cada palavra, no lugar da voz)
function projeto(extra = {}, words = fala(TEXTO)) {
  const dir = mkdtempSync(join(raiz, 'video-'));
  mkdirSync(join(dir, 'fonts'));
  mkdirSync(join(dir, 'audio'));
  for (const f of ['Montserrat-800.woff2', 'Inter-400.woff2']) writeFileSync(join(dir, 'fonts', f), 'wOF2');
  writeFileSync(join(dir, 'words.json'), JSON.stringify(words));
  const tons = words.map((w) => `between(t\\,${w.start}\\,${w.end})`).join('+');
  ff('-f', 'lavfi', '-i', `aevalsrc=0.3*sin(2*PI*180*t)*(${tons}):s=48000:d=${(words.at(-1).end + 0.4).toFixed(2)}`, join(dir, 'audio', 'voz.wav'));
  writeFileSync(join(dir, 'escolhas.json'), JSON.stringify({ ...ESCOLHAS, marca: MARCA, ...extra }));
  return dir;
}
const dados = (dir) => JSON.parse(/const D = (.*);\n/.exec(readFileSync(join(dir, 'index.html'), 'utf8'))[1]);

test('monta com a marca de teste: sem marcador sobrando, uma faixa de áudio já mixada em -16 LUFS e pico abaixo de -1 dBTP', () => {
  const dir = projeto(), avisos = [];
  const r = montar(dir, (m) => avisos.push(m));
  const html = readFileSync(join(dir, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /\{\{[A-Z_]+\}\}/);
  assert.equal((html.match(/<audio /g) || []).length, 1); // voz e efeitos numa faixa só, já masterizada
  assert.match(html, new RegExp(`src="audio/mix.wav" data-start="0" data-duration="${r.duracao.toFixed(3)}"`));
  assert.match(html, /data-duration="[\d.]+" data-fps="60" data-width="1080" data-height="1920"/); // 60 qps, como o estilo pede
  assert.match(html, /<div id="fecho-nome"><span id="fecho-nome-texto">Estúdio Exemplo<\/span><\/div>/);
  assert.doesNotMatch(html, /<div id="fecho-assinatura">/); // assinatura igual ao nome: aparece uma vez só
  assert.ok(existsSync(join(dir, 'comum.js')));
  const m = JSON.parse(readFileSync(join(dir, 'audio', 'mixagem.json'), 'utf8'));
  assert.ok(Math.abs(m.integrado_lufs + 16) <= 0.3, `integrado ${m.integrado_lufs}`);
  assert.ok(m.pico_dbtp < -1, `pico ${m.pico_dbtp}`);
  assert.equal(r.efeitos, 5); // 4 palavras-chave e o fecho
  assert.equal(r.cenas, 4);
  // a fala de exemplo tem 9 s: avisa que o estilo é de 20 a 30 s; as trocas de cena ficam entre 1 e 4,5 s
  assert.equal(avisos.length, 1, avisos.join('\n'));
  assert.match(avisos[0], /o vídeo vai ter 9,8 s; o Motion narrado é de 20 a 30 s/);
});

test('efeitos: impacto grave na capa e no ápice, curtos com camada grave nas outras, carrilhão no fecho; cada um no volume-alvo', () => {
  const dir = projeto();
  montar(dir, () => {});
  const m = JSON.parse(readFileSync(join(dir, 'audio', 'mixagem.json'), 'utf8')), D = dados(dir);
  assert.deepEqual(m.efeitos.map((e) => [e.som, e.classe]), [['impact-bass-2', 'principal'], ['impact-bass-1', 'principal'], ['click', 'curto'], ['pop', 'curto'], ['chime', 'longo']]);
  assert.deepEqual(m.efeitos.slice(0, 4).map((e) => e.impacto), D.cenas.map((c) => c.t)); // o pico cai no instante da palavra
  assert.equal(m.efeitos[4].impacto, D.fecho.t);
  assert.ok(m.efeitos[4].voz_no_instante < m.voz_momentaneo_max - 20, String(m.efeitos[4].voz_no_instante)); // depois da fala: mede o silêncio, então vale o máximo da voz
  for (const e of m.efeitos) {
    const ref = e.classe === 'principal' || e.voz_no_instante < m.voz_momentaneo_max - 20 ? m.voz_momentaneo_max : e.voz_no_instante;
    assert.ok(Math.abs(e.alvo - (ref + { principal: -2, curto: -6, longo: -8 }[e.classe])) < 0.06, JSON.stringify(e)); // calibragem aprovada
    if (!e.no_teto) assert.ok(Math.abs(e.efeito_max + 20 * Math.log10(e.volume) - e.alvo) < 0.06, JSON.stringify(e));
  }
  for (const s of ['impact-bass-2', 'impact-bass-1', 'click', 'pop', 'chime']) assert.ok(existsSync(join(dir, 'efeitos', `${s}.wav`)), s);
});

test('"efeitos": false: só a voz, ainda em -16 LUFS, e sem precisar do plugin hyperframes', () => {
  const dir = projeto({ efeitos: false }), antes = process.env.HYPERFRAMES_PLUGIN_ROOT;
  process.env.HYPERFRAMES_PLUGIN_ROOT = join(raiz, 'nao-existe');
  try {
    const r = montar(dir, () => {});
    assert.equal(r.efeitos, 0);
    assert.ok(Math.abs(r.integrado + 16) <= 0.3, String(r.integrado));
  } finally { process.env.HYPERFRAMES_PLUGIN_ROOT = antes; }
});

test('a capa é a primeira palavra-chave, desde o quadro 0; gancho de capa neste estilo é erro', () => {
  const dir = projeto();
  montar(dir, () => {});
  const D = dados(dir);
  assert.equal(D.palavras[D.cenas[0].de][0], 'loja,');
  assert.equal(D.cenas[1].apice, true);
  assert.equal(D.cenas[1].icone, 'conversa');
  assert.throws(() => montar(projeto({ capa: { estilo: 'faixa', texto: 'Resposta no *mesmo dia*' } })), /já abre com a primeira palavra-chave como capa/);
  montar(projeto({ capa: null }), () => {}); // null ou false é o mesmo que sem capa
});

test('palavras-chave conferidas com mensagem em português: fora da fala, fora de ordem, longas, poucas, ícone e ápice', () => {
  const casos = [
    [{ chaves: ['cliente', 'garantia', 'manhã'] }, /"garantia" não foi achada na fala depois da anterior/],
    [{ chaves: ['manhã', 'cliente', 'almoço'] }, /"cliente" não foi achada na fala depois da anterior/],
    [{ chaves: ['cliente', 'recebe resposta no mesmo', 'almoço'] }, /longa demais; use até 3 palavras/],
    [{ chaves: ['cliente', 'almoço'] }, /de 3 a 9 palavras-chave/],
    [{ chaves: ['cliente', { texto: 'resposta', icone: 'foguete' }, 'almoço'] }, /ícone "foguete".*não existe/],
    [{ apice: 'garantia' }, /"apice" precisa ser uma das "chaves"/],
    [{ fecho: 'Aqui' }, /"fecho" \("Aqui"\) precisa ser palavra da fala depois da última palavra-chave/],
    [{ efeitos: 'sim' }, /"efeitos" é true/],
  ];
  for (const [extra, erro] of casos) assert.throws(() => montar(projeto(extra), () => {}), erro);
});

test('palavra-chave de mais de uma palavra é achada seguida na fala; cada palavra dela entra no seu instante', () => {
  const dir = projeto({ chaves: ['cliente', 'mesmo dia', 'manhã', 'antes do almoço'], apice: undefined });
  montar(dir, () => {});
  const D = dados(dir);
  assert.deepEqual(D.cenas.map((c) => D.palavras.slice(c.de, c.ate + 1).map((p) => p[0]).join(' ')), ['cliente', 'mesmo dia.', 'manhã,', 'antes do almoço.']);
});

test('falta o words.json, a voz ou o words.json não é a lista do voz-com-tempos: erro que diz o que rodar', () => {
  const sem = projeto();
  rmSync(join(sem, 'words.json'));
  assert.throws(() => montar(sem), /falta o words\.json/);
  const semVoz = projeto();
  rmSync(join(semVoz, 'audio', 'voz.wav'));
  assert.throws(() => montar(semVoz), /falta a voz .*voz-com-tempos/);
  const ruim = projeto();
  writeFileSync(join(ruim, 'words.json'), JSON.stringify([{ text: 'oi', start: 1, end: 0.5 }]));
  assert.throws(() => montar(ruim), /precisa ser a lista do voz-com-tempos/);
});

test('logo do dono no fecho, no lugar do nome; com a assinatura diferente do nome, ela entra embaixo', () => {
  const dir = projeto(), marca = JSON.parse(readFileSync(MARCA, 'utf8'));
  ff('-f', 'lavfi', '-i', 'color=c=white:s=400x160', '-frames:v', '1', join(dir, 'logo-dono.png'));
  writeFileSync(join(dir, 'marca.json'), JSON.stringify({ ...marca, assinatura: 'Atendimento com hora marcada', logo: 'logo-dono.png' }));
  writeFileSync(join(dir, 'escolhas.json'), JSON.stringify({ ...ESCOLHAS, marca: join(dir, 'marca.json') }));
  montar(dir, () => {});
  const html = readFileSync(join(dir, 'index.html'), 'utf8');
  assert.match(html, /<img id="fecho-logo" src="logo\.png" alt="Estúdio Exemplo" \/>/);
  assert.match(html, /<div id="fecho-assinatura">Atendimento com hora marcada<\/div>/);
  assert.ok(existsSync(join(dir, 'logo.png')));
  writeFileSync(join(dir, 'marca.json'), JSON.stringify({ ...marca, logo: 'nao-existe.png' }));
  assert.throws(() => montar(dir), /o logo do marca\.json \(nao-existe\.png\) precisa ser um arquivo/);
});

// Plano das cenas, sem áudio
const TEXTO_LONGO = 'Quando alguém falta sem avisar, o horário fica vazio e quem estava na lista fica de fora. Por isso a mensagem chega na véspera. Se não puder vir, é só responder. A vaga vai pra próxima pessoa da lista de espera. Estúdio Exemplo. Atendimento com hora marcada.';
const CHAVES_LONGO = ['vazio', 'mensagem', 'responder', 'vaga', 'lista de espera'];

test('plano: nunca mais de 6 palavras na tela, a legenda nunca se sobrepõe e a tela nunca fica sem palavra-chave por mais de 0,3 s', () => {
  for (const [texto, chaves] of [[TEXTO, ['cliente', 'resposta', 'manhã', 'almoço']], [TEXTO_LONGO, CHAVES_LONGO]]) {
    const p = planoNarrado(fala(texto), { chaves }), n = (c) => c.ate - c.de + 1;
    for (let t = 0; t < p.fecho.t; t += 0.01) {
      // a capa está inteira na tela desde o quadro 0; as outras entram palavra por palavra; cada uma some 0,2 s depois de "sai"
      const chave = p.cenas.filter((c, i) => (i ? c.t : 0) <= t && t < c.sai + 0.2);
      const palavrasChave = p.cenas.reduce((s, c, i) => (t >= c.sai + 0.2 ? s : s + p.palavras.slice(c.de, c.ate + 1).filter((w) => !i || w[1] <= t).length), 0);
      const leg = p.legenda.filter((g) => g.ini <= t && t < g.sai + 0.15);
      assert.ok(leg.length <= 1, `${texto.slice(0, 12)}: duas linhas de legenda em ${t.toFixed(2)} s`);
      assert.ok(palavrasChave + leg.reduce((s, g) => s + g.ate - g.de + 1, 0) <= 6, `${texto.slice(0, 12)}: mais de 6 palavras em ${t.toFixed(2)} s`);
      assert.ok(chave.length <= 1, `duas palavras-chave em ${t.toFixed(2)} s`);
    }
    for (let i = 1; i < p.cenas.length; i++) assert.ok(p.cenas[i].t - (p.cenas[i - 1].sai + 0.2) <= 0.3); // a troca é rápida
    for (const c of p.cenas) assert.ok(n(c) <= 3);
  }
});

test('plano: legenda em frases, frase longa em linhas equilibradas, "quebras" forçam a linha e a capa conta desde o quadro 0', () => {
  const linhas = (p) => p.legenda.map((g) => p.palavras.slice(g.de, g.ate + 1).map((w) => w[0]).join(' '));
  const p = planoNarrado(fala(TEXTO_LONGO), { chaves: CHAVES_LONGO });
  // "Quando alguém falta sem avisar," tem 31 letras: duas linhas, a mais comprida a menor possível
  assert.deepEqual(linhas(p).slice(0, 5), ['Quando alguém', 'falta sem avisar,', 'o horário fica', 'e quem estava na', 'lista fica de fora.']);
  const q = planoNarrado(fala(TEXTO_LONGO), { chaves: CHAVES_LONGO, quebras: ['fica de fora', 'pra próxima'] });
  assert.deepEqual(linhas(q).slice(3, 5), ['e quem estava na lista', 'fica de fora.']);
  // antes de "lista de espera" (3 palavras) a linha leva no máximo 3: "pra próxima pessoa da" vira duas
  assert.deepEqual(linhas(q).slice(10, 13), ['vai', 'pra próxima', 'pessoa da'], linhas(q).join(' | '));
  const avisos = [];
  planoNarrado(fala(TEXTO_LONGO), { chaves: CHAVES_LONGO, quebras: ['garantia'] }, (m) => avisos.push(m));
  assert.ok(avisos.some((a) => /a quebra "garantia" não foi achada/.test(a)));
});

test('plano: "fecho" falado tira a assinatura da legenda e o fecho começa nela; sem "fecho", logo depois da última palavra', () => {
  const w = fala(TEXTO_LONGO), p = planoNarrado(w, { chaves: CHAVES_LONGO, fecho: 'Estúdio' });
  const estudio = w.findIndex((x) => x.text === 'Estúdio'), atendimento = w.findIndex((x) => x.text === 'Atendimento');
  assert.equal(p.fecho.t, w[estudio].start);
  assert.equal(p.fecho.assinatura, w[atendimento].start); // a assinatura entra na frase seguinte
  assert.ok(p.legenda.every((g) => g.ate < estudio));
  assert.ok(p.fim >= w.at(-1).end + 0.9);
  const s = planoNarrado(w, { chaves: CHAVES_LONGO });
  assert.equal(s.fecho.t, +(w.at(-1).end + 0.25).toFixed(3));
  assert.ok(s.legenda.some((g) => g.ate === w.length - 1)); // sem fecho, a assinatura falada vira legenda
  assert.equal(s.fim, +(Math.ceil((w.at(-1).end + 0.25 + 1.5) * 60) / 60).toFixed(3));
});

test('plano: avisa troca de cena longa (mais de 4,5 s) e palavras-chave quase juntas (menos de 1 s)', () => {
  const avisos = [];
  planoNarrado(fala(TEXTO_LONGO), { chaves: ['horário', 'fica', 'lista de espera'] }, (m) => avisos.push(m));
  assert.ok(avisos.some((a) => /"horário" e "fica" estão a 0,3 s/.test(a)), avisos.join('\n'));
  assert.ok(avisos.some((a) => /s com a mesma palavra-chave na tela \("fica", até "lista de espera"\)/.test(a)), avisos.join('\n'));
});
