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

  // Gancho de capa: instante em que começa a saída de cada estilo de capa (a camada inteira some até capa.fim)
  const SAIDA = { faixa: 2.6, manchete: 2.7, editorial: 2.6 };

  // Efeitos sonoros de cada estilo, nos mesmos instantes em que o molde mostra o elemento: [{ t, som }] no tempo da edição.
  // d: os dados do molde (palavras, chaves, apice, enfase, cartoes, capa). Efeitos a menos de 0,5 s um do outro: fica o mais forte.
  // Com gancho de capa, os efeitos do estilo só começam depois dela, e a saída da capa ganha um whoosh.
  // A Caixinha de pergunta não tem efeito nenhum (só a edição básica): não entra em nenhum ramo e a lista sai vazia.
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
    const todos = d.capa ? [...ev.filter((e) => e.t >= d.capa.fim), { t: SAIDA[d.capa.estilo], som: "whoosh-short" }] : ev;
    const fica = [];
    todos.filter((e) => e.t < total).sort((x, y) => x.t - y.t).forEach((e) => {
      const ant = fica[fica.length - 1];
      if (!ant || e.t - ant.t >= 0.5) fica.push(e);
      else if (FORCA[e.som] > FORCA[ant.som]) fica[fica.length - 1] = e;
    });
    return fica;
  }

  // Contraste WCAG entre duas cores (#RRGGBB ou [r, g, b])
  const rgb = (c) => (Array.isArray(c) ? c : [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)));
  const lum = (c) => rgb(c).map((v) => v / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)).reduce((s, x, i) => s + x * [0.2126, 0.7152, 0.0722][i], 0);
  function contraste(a, b) { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); }
  const mistura = (a, b, t) => rgb(a).map((v, i) => Math.round(v * (1 - t) + rgb(b)[i] * t));
  // Ajuste de cor: empurra base na direção de rumo, em passos de 2%, até passar de min contra o fundo; devolve [r, g, b]
  function legivel(base, rumo, fundo, min = 4.6) {
    for (let t = 0; t <= 1.001; t += 0.02) { const c = mistura(base, rumo, t); if (contraste(c, fundo) >= min) return c; }
    return rgb(rumo);
  }

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

  // Gancho de capa (só no navegador): a frase por cima das cópias mudas dos trechos, na camada #capa que o montar.mjs
  // põe por cima de tudo (com o CSS de cada estilo). c: { estilo, texto, queixo, fim }. A palavra forte (*assim*) abre
  // a segunda linha; linha mais larga que a área segura encolhe até caber. A animação só mexe em opacidade, deslocamento
  // e --capa-sai, nunca nas medidas, então a medida pode ser refeita quando as fontes carregam.
  function capa(tl, c) {
    const raiz = document.getElementById("capa"), css = raiz.style, enq = document.getElementById("capa-enquadramento");
    const cor = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), em = (x) => `rgb(${x.join(",")})`;
    const CLARO = cor("--fundo-claro"), ESCURO = cor("--fundo-escuro"), TEXTO = cor("--texto"), DESTAQUE = cor("--destaque");
    // O destaque puro pode não passar de 4,6:1 contra o fundo da capa: cada estilo usa o tom mais próximo que passa
    if (c.estilo === "faixa") css.setProperty("--capa-tarja", em(legivel(DESTAQUE, ESCURO, CLARO)));
    if (c.estilo === "manchete") css.setProperty("--capa-forte", em(legivel(DESTAQUE, CLARO, mistura([255, 255, 255], ESCURO, 0.9))));
    if (c.estilo === "editorial") css.setProperty("--capa-forte", em(legivel(DESTAQUE, TEXTO, mistura([0, 0, 0], CLARO, 0.93))));
    if (c.estilo === "manchete") { css.setProperty("--capa-queixo", c.queixo + "px"); css.setProperty("--capa-topo", Math.max(1000, c.queixo + 160) + "px"); }

    const veu = c.estilo !== "faixa" && raiz.appendChild(novo("div", "", "capa-veu"));
    const faixa = c.estilo === "faixa" && raiz.appendChild(novo("div", "", "capa-faixa"));
    const filete = c.estilo === "editorial" && raiz.appendChild(novo("div", "", "capa-filete"));
    const h1 = (faixa || raiz).appendChild(novo("h1", "", "capa-gancho"));
    // Quebra antes da palavra forte; a pontuação colada nela vai junto
    const [, antes, forte, pont, depois] = c.texto.match(/^(.*?)\*([^*]+)\*([?!.,]*)(.*)$/);
    const l1 = h1.appendChild(novo("span", "capa-linha", "capa-linha-1", antes.trim()));
    const l2 = h1.appendChild(novo("span", "capa-linha", "capa-linha-2"));
    const f = l2.appendChild(novo("span", "", "capa-forte", forte + pont));
    if (depois.trim()) l2.append(" " + depois.trim());
    // A capa fica por cima do texto do estilo de propósito (o hf check aceita a sobreposição marcada no próprio texto)
    for (const e of [l1, l2, f]) e.setAttribute("data-layout-allow-overlap", "");

    // Medidas de layout (offset*, que não mudam com transformação nem com a escala da prévia)
    const LARG = 900; // 1080 menos 90 de cada lado (botões do Instagram)
    const medir = () => {
      for (const l of [l1, l2]) {
        l.style.fontSize = "";
        const w = l.offsetWidth;
        if (w > LARG) l.style.fontSize = Math.floor((parseFloat(getComputedStyle(l).fontSize) * LARG) / w) + "px";
      }
      if (c.estilo === "faixa") css.setProperty("--capa-alt", Math.round(h1.offsetTop + h1.offsetHeight + 52) + "px");
      if (c.estilo === "editorial") css.setProperty("--capa-topo", h1.offsetTop + "px");
    };
    medir();
    // Mede de novo com as fontes carregadas; a HyperFrames espera essa promessa antes de gravar (buildReady)
    const fonte = (e) => { const s = getComputedStyle(e); return `${s.fontStyle} ${s.fontWeight} 100px ${s.fontFamily}`; };
    window.__hf = window.__hf || {};
    window.__hf.buildReady = window.__hf.buildReady || {};
    window.__hf.buildReady["editor-chefe-capa"] = Promise.all([l1, f].map((e) => document.fonts.load(fonte(e)))).catch(() => {}).then(medir);

    // Saída de cada estilo, a partir de SAIDA[estilo]
    const s = SAIDA[c.estilo];
    if (c.estilo === "faixa") // a tarja recolhe para cima e o vídeo da capa sobe junto (as duas posições vêm de --capa-sai)
      tl.fromTo(raiz, { "--capa-sai": 0 }, { "--capa-sai": 1, duration: 0.35, ease: "power3.out" }, s);
    if (c.estilo === "manchete") {
      tl.fromTo(enq, { scale: 1 }, { scale: 1.04, duration: c.fim, ease: "none" }, 0);
      tl.to([h1, veu], { opacity: 0, duration: 0.3, ease: "power2.out" }, s);
    }
    if (c.estilo === "editorial") {
      tl.to([filete, l1], { y: -20, opacity: 0, duration: 0.3, ease: "power2.out" }, s);
      tl.to(l2, { y: -20, opacity: 0, duration: 0.3, ease: "power2.out" }, s + 0.08);
      tl.to(veu, { y: 420, duration: 0.4, ease: "power2.in" }, s);
    }
    // No fim, a camada inteira some (cobre a troca para os estilos em cartão e o zoom do corte seco)
    tl.to(raiz, { opacity: 0, duration: 0.25, ease: "none" }, c.fim - 0.25);
    // Enquanto a camada cobre a tela, o texto do estilo (filhos de #raiz com texto e sem vídeo) fica escondido e volta
    // quando ela começa a sumir: não muda o que se vê, e o hf check não acusa texto coberto pela capa.
    // Só acha o texto que já existe: chame EC.capa depois de montar o texto do estilo.
    const textos = [...document.getElementById("raiz").children].filter((e) => e !== raiz && e.tagName === "DIV" && !e.querySelector("video") && e.textContent.trim());
    if (textos.length) {
      tl.fromTo(textos, { opacity: 0 }, { opacity: 0, duration: c.fim - 0.25, ease: "none" }, 0); // fromTo: segura 0 mesmo voltando ao quadro 0
      tl.set(textos, { opacity: 1 }, c.fim - 0.25);
    }
  }

  const api = { naEdicao, mapear, marcar, agrupar, trocas, efeitos, contraste, legivel, iniciar, novo, capa };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.EditorChefe = api;
})(this);
