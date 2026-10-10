// tests/baixar-fonte.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extrairUrls } from '../plugins/editor-chefe/scripts/baixar-fonte.mjs';

test('extrai peso, itálico e url do CSS do Google Fonts', () => {
  const css = `@font-face { font-family: 'Montserrat'; font-style: normal; font-weight: 800; src: url(https://fonts.gstatic.com/s/montserrat/v1/a.woff2) format('woff2'); }
@font-face { font-family: 'Playfair Display'; font-style: italic; font-weight: 400; src: url(https://fonts.gstatic.com/s/c/v1/b.woff2) format('woff2'); }`;
  assert.deepEqual(extrairUrls(css), [
    { peso: '800', italico: false, url: 'https://fonts.gstatic.com/s/montserrat/v1/a.woff2' },
    { peso: '400', italico: true, url: 'https://fonts.gstatic.com/s/c/v1/b.woff2' },
  ]);
});

test('escolhe o subconjunto latin de cada peso (o Google põe cyrillic e latin-ext antes)', () => {
  const css = `/* cyrillic */
@font-face { font-family: 'Montserrat'; font-style: normal; font-weight: 800; src: url(https://fonts.gstatic.com/s/montserrat/v17/cyr.woff2) format('woff2'); }
/* latin-ext */
@font-face { font-family: 'Montserrat'; font-style: normal; font-weight: 800; src: url(https://fonts.gstatic.com/s/montserrat/v17/ext.woff2) format('woff2'); }
/* latin */
@font-face { font-family: 'Montserrat'; font-style: normal; font-weight: 800; src: url(https://fonts.gstatic.com/s/montserrat/v17/lat.woff2) format('woff2'); }`;
  assert.deepEqual(extrairUrls(css), [
    { peso: '800', italico: false, url: 'https://fonts.gstatic.com/s/montserrat/v17/lat.woff2' },
  ]);
});
