// Baixa uma família do Google Fonts em woff2. Uso: node baixar-fonte.mjs "Montserrat" "400,800" ./fontes
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function extrairUrls(css) {
  // O Google repete cada peso por subconjunto (/* latin-ext */, /* cyrillic */, /* latin */...).
  // Com comentários de subconjunto, fica só o latin; sem eles, vale o CSS inteiro.
  const blocos = [...css.matchAll(/(?:\/\*\s*([\w-]+)\s*\*\/\s*)?@font-face\s*\{([^}]*)\}/g)];
  const comSubset = blocos.some((m) => m[1]);
  return blocos
    .filter((m) => !comSubset || m[1] === 'latin')
    .map((m) => ({
      peso: /font-weight:\s*(\d+)/.exec(m[2])[1],
      italico: /font-style:\s*italic/.test(m[2]),
      url: /url\((https:[^)]+\.woff2)\)/.exec(m[2])[1],
    }));
}

async function principal([familia, pesos, pasta]) {
  const eixo = pesos.split(',').flatMap((p) => [`0,${p}`, `1,${p}`]).join(';');
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(familia)}:ital,wght@${eixo}&display=swap`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/120 Safari/537.36' } });
  if (!r.ok) { console.error(`Fonte "${familia}" não encontrada no Google Fonts.`); process.exit(1); }
  await mkdir(pasta, { recursive: true });
  for (const f of extrairUrls(await r.text())) {
    const nome = `${familia.replace(/\s+/g, '')}-${f.peso}${f.italico ? '-italic' : ''}.woff2`;
    const arquivo = await fetch(f.url);
    if (!arquivo.ok) throw new Error(`Falha ao baixar ${f.url}: HTTP ${arquivo.status}`); // não gravar página de erro como .woff2
    await writeFile(join(pasta, nome), Buffer.from(await arquivo.arrayBuffer()));
    console.log(join(pasta, nome));
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) principal(process.argv.slice(2));
