// Editor Chefe: funções comuns dos moldes de estilo.
// No navegador vira window.EditorChefe; no Node, require() (usado pelo montar.mjs e pelos testes).
(function (raiz) {
  // Tempo do vídeo original para o tempo da edição. trechos: [{ ini, dur, src }] (início na edição, duração, início no original)
  function naEdicao(t, lado, trechos, total) {
    for (const s of trechos) if (t >= s.src && t <= s.src + s.dur) return s.ini + (t - s.src);
    if (lado === "ini") { const p = trechos.find((s) => s.src > t); return p ? p.ini : total; }
    const a = [...trechos].reverse().find((s) => s.src + s.dur < t); return a ? a.ini + a.dur : 0;
  }

  // Palavras [texto, início, fim] do original para { txt, ini, fim } da edição.
  // Palavra que caiu num corte (o reconhecedor erra o tempo perto de pausa) reparte o tempo com a vizinha; nenhuma se perde.
  function mapear(palavras, trechos, total) {
    const pal = palavras.map(([txt, a, b]) => ({ txt, ini: naEdicao(a, "ini", trechos, total), fim: naEdicao(b, "fim", trechos, total) }));
    for (let i = 0; i < pal.length; i++) {
      if (pal[i].fim - pal[i].ini >= 0.06) continue;
      let j = i; while (j + 1 < pal.length && pal[j + 1].ini - pal[i].ini < 0.06) j++;
      const n = j - i + 1, ini = pal[i].ini, passo = (Math.max(pal[j].fim, ini + 0.12 * n) - ini) / n;
      for (let k = i; k <= j; k++) Object.assign(pal[k], { ini: ini + passo * (k - i), fim: ini + passo * (k - i + 1) });
      i = j;
    }
    return pal;
  }

  // Palavras escolhidas, na ordem da fala: o índice de cada uma em pal, ou -1 se não achou (sem pular as seguintes).
  const limpa = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  function marcar(pal, lista) {
    let k = 0;
    return lista.map((w) => {
      let j = k; while (j < pal.length && limpa(pal[j].txt) !== limpa(w)) j++;
      if (j >= pal.length) return -1;
      k = j + 1; return j;
    });
  }

  // Grupos de legenda: quebra em ponto, vírgula (com 2 palavras ou mais), pausa e tamanho.
  function agrupar(pal, maxPal, maxLetras) {
    const g = [];
    pal.forEach((p, i) => {
      const atual = g[g.length - 1], ant = pal[i - 1];
      const letras = atual ? atual.reduce((n, q) => n + q.txt.length + 1, 0) + p.txt.length : 0;
      const quebra = !atual || atual.length >= maxPal || letras > maxLetras || /[.?!]$/.test(ant.txt) || (/,$/.test(ant.txt) && atual.length >= 2) || p.ini - ant.fim > 0.35;
      quebra ? g.push([p]) : atual.push(p);
    });
    return g;
  }

  // Corte seco: instantes em que o enquadramento troca (a cada corte e a cada frase nova, no mínimo 0,8 s entre trocas).
  // A primeira troca aproxima (115%), a segunda volta (100%), e assim por diante.
  function trocas(pal, trechos, total) {
    return [...trechos.slice(1).map((s) => s.ini), ...pal.filter((p, i) => i > 0 && /[.?!]$/.test(pal[i - 1].txt)).map((p) => p.ini)]
      .sort((a, b) => a - b).reduce((r, t) => (t > 0.3 && t < total - 0.3 && (!r.length || t - r[r.length - 1] >= 0.8) ? [...r, t] : r), []);
  }

  // Efeitos sonoros de cada estilo, nos mesmos instantes em que o molde mostra o elemento: [{ t, som }] no tempo da edição.
  // d: os dados do molde (palavras, chaves, apice, enfase, cartoes). Efeitos a menos de 0,5 s um do outro: fica o mais forte.
  const FORCA = { "impact-bass-1": 3, pop: 2, "whoosh-short": 1 };
  function efeitos(estilo, d, trechos, total) {
    const pal = mapear(d.palavras, trechos, total), ev = [];
    if (estilo === "legenda-viva") // começo de cada frase
      agrupar(pal, 4, 18).forEach((g, i, gs) => { if (!i || /[.?!]$/.test(gs[i - 1][gs[i - 1].length - 1].txt)) ev.push({ t: g[0].ini, som: "whoosh-short" }); });
    if (estilo === "palavra-chave") { // cada palavra forte; o ápice com impacto grave
      const a = marcar(pal, d.chaves), ka = a[d.chaves.indexOf(d.apice)];
      a.filter((i) => i >= 0).forEach((k) => ev.push({ t: pal[k].ini, som: k === ka ? "impact-bass-1" : "whoosh-short" }));
    }
    if (estilo === "corte-seco-zoom") { // cada aproximação do enquadramento; estalo nas palavras de ênfase
      trocas(pal, trechos, total).forEach((t, n) => n % 2 || ev.push({ t, som: "whoosh-short" }));
      marcar(pal, d.enfase).filter((i) => i >= 0).forEach((i) => ev.push({ t: pal[i].ini, som: "pop" }));
    }
    if (estilo === "painel-escuro" || estilo === "editorial-claro") // entrada de cada cartão
      d.cartoes.forEach((c) => ev.push({ t: naEdicao(c.de, "ini", trechos, total), som: "whoosh-short" }));
    const fica = [];
    ev.filter((e) => e.t < total).sort((x, y) => x.t - y.t).forEach((e) => {
      const ant = fica[fica.length - 1];
      if (!ant || e.t - ant.t >= 0.5) fica.push(e);
      else if (FORCA[e.som] > FORCA[ant.som]) fica[fica.length - 1] = e;
    });
    return fica;
  }

  // Contraste WCAG entre duas cores #RRGGBB
  const lum = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)).reduce((s, x, i) => s + x * [0.2126, 0.7152, 0.0722][i], 0);
  function contraste(a, b) { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); }

  // Só no navegador: lê a edição da página (trechos dos <video>, duração da raiz) e as cores da marca.
  function iniciar(palavras) {
    const total = +document.getElementById("raiz").dataset.duration;
    const trechos = [...document.querySelectorAll("video.trecho")].map((v) => ({ ini: +v.dataset.start, dur: +v.dataset.duration, src: +v.dataset.mediaStart }));
    const cor = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    const c = { CLARO: cor("--fundo-claro"), ESCURO: cor("--fundo-escuro"), TEXTO: cor("--texto"), DESTAQUE: cor("--destaque") };
    c.SOBRE_DESTAQUE = contraste(c.DESTAQUE, c.CLARO) >= contraste(c.DESTAQUE, c.ESCURO) ? c.CLARO : c.ESCURO;
    return { TOTAL: total, TRECHOS: trechos, PAL: mapear(palavras, trechos, total), ...c };
  }
  function novo(tag, cls, id, txt) { const e = document.createElement(tag); e.className = cls; if (id) e.id = id; if (txt != null) e.textContent = txt; return e; }

  const api = { naEdicao, mapear, marcar, agrupar, trocas, efeitos, contraste, iniciar, novo };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.EditorChefe = api;
})(this);
