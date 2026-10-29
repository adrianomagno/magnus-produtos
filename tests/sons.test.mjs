// tests/sons.test.mjs: os sons do Editor Chefe (plugins/editor-chefe/sons/). Cada som do manifesto tem o arquivo, cada
// arquivo tem a linha da origem e da licença no LICENCAS.md, e a medida do manifesto (duração, instante e nível do pico,
// momentâneo máximo, volume) é a do arquivo. Precisa de ffmpeg e ffprobe (o prefixo do ambiente.sh resolve). Os 3 sons
// da hyperframes só são medidos com HYPERFRAMES_PLUGIN_ROOT apontando para o plugin de verdade.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync, mkdtempSync, cpSync, rmSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { medirSom, volumeDoSom } from '../plugins/editor-chefe/scripts/montar.mjs';

const SONS = fileURLToPath(new URL('../plugins/editor-chefe/sons/', import.meta.url));
const EC = createRequire(import.meta.url)('../plugins/editor-chefe/estilos/comum.js');
const AUDIO = /\.(mp3|wav)$/;
const HF = process.env.HYPERFRAMES_PLUGIN_ROOT && join(process.env.HYPERFRAMES_PLUGIN_ROOT, 'skills', 'media-use', 'audio', 'assets', 'sfx');

// Tudo o que está errado na pasta de sons, em português; vazio quando está tudo certo
function problemas(dir, { medir = true } = {}) {
  const m = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')), licencas = readFileSync(join(dir, 'LICENCAS.md'), 'utf8').split('\n');
  const erros = [], arquivos = readdirSync(dir).filter((a) => AUDIO.test(a));
  for (const [nome, s] of Object.entries(m)) {
    if (s.origem === 'hyperframes') continue;
    if (!['woven-sfx', 'kenney-ui-audio', 'kenney-impact-sounds', 'kenney-interface-sounds'].includes(s.origem)) erros.push(`${nome}: origem "${s.origem}" sem licença conhecida`);
    if (!existsSync(join(dir, s.arquivo))) erros.push(`${nome}: falta o arquivo ${s.arquivo}`);
  }
  for (const a of arquivos) {
    if (!Object.values(m).some((s) => s.arquivo === a && s.origem !== 'hyperframes')) erros.push(`${a}: arquivo sem entrada no manifest.json`);
    if (!licencas.some((l) => l.startsWith(`| \`${a}\` |`) && /CC0/.test(l) && /Woven SFX|Kenney/.test(l))) erros.push(`${a}: sem linha de origem e licença CC0 no LICENCAS.md`);
  }
  for (const [nome, s] of Object.entries(m)) {
    if (s.volume !== volumeDoSom(s)) erros.push(`${nome}: volume ${s.volume} não é o calculado da medida (${volumeDoSom(s)})`);
    const arq = s.origem === 'hyperframes' ? HF && join(HF, s.arquivo) : join(dir, s.arquivo);
    if (!medir || !arq || !existsSync(arq)) continue;
    const med = medirSom(arq), dif = ['duracao', 'pico'].filter((k) => Math.abs(med[k] - s[k]) > 0.002).concat(['pico_dbfs', 'momentaneo_lufs'].filter((k) => Math.abs(med[k] - s[k]) > 0.2));
    if (dif.length) erros.push(`${nome}: ${dif.join(', ')} fora do medido (medido: ${JSON.stringify(med)}, volume ${volumeDoSom(med)})`);
  }
  return erros;
}

test('a pasta de sons está certa: arquivo, licença e medida de cada som', () => {
  assert.deepEqual(problemas(SONS), []);
});

test('os sons da hyperframes do manifesto batem com os arquivos do plugin instalado', (t) => {
  if (!HF || !existsSync(join(HF, 'whoosh-short.mp3'))) return t.skip('sem HYPERFRAMES_PLUGIN_ROOT com a pasta de efeitos');
  const m = JSON.parse(readFileSync(join(SONS, 'manifest.json'), 'utf8'));
  const daHf = Object.entries(m).filter(([, s]) => s.origem === 'hyperframes');
  assert.equal(daHf.length, 3);
  for (const [nome, s] of daHf) assert.ok(existsSync(join(HF, s.arquivo)), nome); // e a medida já foi conferida no teste acima
});

test('a conferência reprova som sem arquivo, arquivo sem licença, arquivo fora do manifesto e medida diferente', () => {
  const copia = () => { const d = mkdtempSync(join(tmpdir(), 'sons-')); cpSync(SONS, d, { recursive: true }); return d; };
  const casos = [
    ['som do manifesto sem arquivo', (d) => unlinkSync(join(d, 'tique.wav')), /tique: falta o arquivo tique\.wav/],
    ['arquivo sem linha no LICENCAS.md', (d) => writeFileSync(join(d, 'LICENCAS.md'), readFileSync(join(d, 'LICENCAS.md'), 'utf8').replace(/^\| `clique\.wav` \|.*$/m, '')), /clique\.wav: sem linha de origem e licença CC0/],
    ['arquivo fora do manifesto', (d) => cpSync(join(d, 'tique.wav'), join(d, 'outro.wav')), /outro\.wav: arquivo sem entrada no manifest\.json/],
    ['pico fora do medido', (d) => { const m = JSON.parse(readFileSync(join(d, 'manifest.json'), 'utf8')); m['whoosh-largo'].pico += 0.05; writeFileSync(join(d, 'manifest.json'), JSON.stringify(m)); }, /whoosh-largo: pico fora do medido/],
    ['volume diferente do calculado', (d) => { const m = JSON.parse(readFileSync(join(d, 'manifest.json'), 'utf8')); m['pop-mao'].volume = 0.9; writeFileSync(join(d, 'manifest.json'), JSON.stringify(m)); }, /pop-mao: volume 0\.9 não é o calculado/],
    ['origem sem licença conhecida', (d) => { const m = JSON.parse(readFileSync(join(d, 'manifest.json'), 'utf8')); m.tique.origem = 'outro-site'; writeFileSync(join(d, 'manifest.json'), JSON.stringify(m)); }, /tique: origem "outro-site"/],
  ];
  for (const [caso, estraga, msg] of casos) {
    const d = copia();
    try {
      estraga(d);
      assert.match(problemas(d, { medir: caso === 'pico fora do medido' }).join('\n'), msg, caso);
    } finally { rmSync(d, { recursive: true, force: true }); }
  }
});

test('todo som que os estilos usam está no manifesto', () => {
  const m = JSON.parse(readFileSync(join(SONS, 'manifest.json'), 'utf8'));
  for (const [familia, lista] of Object.entries(EC.SONS)) for (const som of lista) assert.ok(m[som], `${familia}: ${som}`);
});

test('nenhum som passa da voz: momentâneo até -24 LUFS e pico até -10 dBFS no volume do manifesto', () => {
  const m = JSON.parse(readFileSync(join(SONS, 'manifest.json'), 'utf8'));
  for (const [nome, s] of Object.entries(m)) {
    const db = 20 * Math.log10(s.volume);
    assert.ok(s.momentaneo_lufs + db <= -24 + 0.05, nome);
    assert.ok(s.pico_dbfs + db <= -10 + 0.05, nome);
  }
});

test('a pasta de sons fica abaixo de 1 MB (o repositório é público)', () => {
  const total = readdirSync(SONS).reduce((n, a) => n + statSync(join(SONS, a)).size, 0);
  assert.ok(total < 1 << 20, `${total} bytes`);
});
