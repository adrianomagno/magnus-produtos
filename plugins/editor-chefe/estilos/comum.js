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

  // Estilos com cartões ("cartoes" no escolhas.json): o Painel escuro, o Editorial claro e os três de tela dividida.
  // No Motion dividido, cada cartão é uma ideia com uma animação da biblioteca.
  const COM_CARTOES = ["painel-escuro", "editorial-claro", "painel-escuro-dividido", "editorial-claro-dividido", "motion-dividido"];

  // Motion dividido: instante (na edição) em que cada item da animação entra. O primeiro entra junto com o título da
  // ideia (ini + ENTRA_TITULO, o mesmo instante do título no molde), mesmo antes de ser dito; os seguintes, quando a fala
  // diz as palavras deles, todas seguidas e na ordem dos itens, dentro da ideia (de ini - 0,5 s a fim). Item que não
  // aparece assim entra 0,5 s depois do anterior; nenhum dos seguintes entra depois de fim - 0,6 s (para ficar na tela
  // antes da saída). achou: as palavras do item estão na fala da ideia (o montador avisa quando não estão, também no
  // primeiro). Devolve [{ t, achou }], com t em milésimos de segundo.
  const ENTRA_TITULO = 0.05;
  function batidas(pal, itens, ini, fim) {
    let k = pal.findIndex((p) => p.ini >= ini - 0.5), ant = ini + ENTRA_TITULO;
    if (k < 0) k = pal.length;
    const teto = Math.max(ant, fim - 0.6);
    return itens.map((item, n) => {
      const w = item.split(/\s+/).map(limpa).filter(Boolean);
      let j = k;
      while (w.length && j + w.length <= pal.length && pal[j].ini < fim && !w.every((x, m) => limpa(pal[j + m].txt) === x)) j++;
      const achou = w.length > 0 && j + w.length <= pal.length && pal[j].ini < fim;
      if (achou) k = j + w.length;
      const t = n ? Math.min(teto, Math.max(achou ? pal[j].ini : ant + 0.5, ant)) : ant;
      ant = t;
      return { t: +t.toFixed(3), achou };
    });
  }

  // Motion dividido: biblioteca fechada de ícones de traço, desenhados para o Editor Chefe numa grade de 64x64 (nenhum
  // ícone de terceiros). Cada ícone é uma lista de traços, desenhados nesta ordem; traço que começa com "~" é detalhe
  // (linha interna, numa cor mais apagada que a de destaque).
  const ICONES = {
    conversa: ["M10 6 H32 A6 6 0 0 1 38 12 V24 A6 6 0 0 1 32 30 H16 L10 36 V30 A6 6 0 0 1 4 24 V12 A6 6 0 0 1 10 6 Z", "~M11 15 H31 M11 21 H24",
      "M32 32 H54 A6 6 0 0 1 60 38 V48 A6 6 0 0 1 54 54 V60 L48 54 H32 A6 6 0 0 1 26 48 V38 A6 6 0 0 1 32 32 Z", "~M33 40 H53 M33 46 H45"],
    documento: ["M16 6 H38 L50 18 V58 H16 Z", "M38 6 V18 H50", "~M23 28 H43 M23 36 H43 M23 44 H35"],
    celular: ["M21 4 H43 A5 5 0 0 1 48 9 V55 A5 5 0 0 1 43 60 H21 A5 5 0 0 1 16 55 V9 A5 5 0 0 1 21 4 Z", "~M28 10 H36 M29 53 H35", "M28 24 L40 32 L28 40 Z"],
    dinheiro: ["M6 18 H58 V46 H6 Z", "M32 24 A8 8 0 1 0 32 40 A8 8 0 1 0 32 24", "~M14 26 V38 M50 26 V38"],
    calendario: ["M14 12 H50 A4 4 0 0 1 54 16 V54 A4 4 0 0 1 50 58 H14 A4 4 0 0 1 10 54 V16 A4 4 0 0 1 14 12 Z", "M10 24 H54", "M22 6 V16 M42 6 V16",
      "~M19 34 H23 M30 34 H34 M41 34 H45 M19 44 H23 M30 44 H34"],
    pessoa: ["M32 8 A10 10 0 1 0 32 28 A10 10 0 1 0 32 8", "M12 58 V52 A12 12 0 0 1 24 40 H40 A12 12 0 0 1 52 52 V58"],
    equipe: ["M32 12 A7 7 0 1 0 32 26 A7 7 0 1 0 32 12", "M19 54 V48 A9 9 0 0 1 28 39 H36 A9 9 0 0 1 45 48 V54",
      "~M13 22 A5 5 0 1 0 13 32 A5 5 0 1 0 13 22 M3 50 V46 A7 7 0 0 1 10 39 H15", "~M51 22 A5 5 0 1 0 51 32 A5 5 0 1 0 51 22 M61 50 V46 A7 7 0 0 0 54 39 H49"],
    grafico: ["M8 8 V56 H58", "M16 44 L28 31 L38 37 L54 19", "M45 19 H54 V28"],
    check: ["M32 6 A26 26 0 1 0 32 58 A26 26 0 1 0 32 6", "M20 33 L28 41 L45 23"],
    alerta: ["M32 8 L58 54 H6 Z", "M32 25 V38", "M32 46 V46.01"],
    relogio: ["M32 6 A26 26 0 1 0 32 58 A26 26 0 1 0 32 6", "~M32 10 V13 M54 32 H51 M32 54 V51 M10 32 H13", "M32 18 V32 L42 40"],
    loja: ["M10 22 L15 8 H49 L54 22", "M10 22 A5.5 5.5 0 0 0 21 22 A5.5 5.5 0 0 0 32 22 A5.5 5.5 0 0 0 43 22 A5.5 5.5 0 0 0 54 22", "M13 28 V56 H51 V28", "~M26 56 V42 H38 V56"],
    contrato: ["M8 6 H34 L42 14 V58 H8 Z", "M34 6 V14 H42", "~M14 22 H36 M14 29 H36", "M14 46 C18 38 21 52 25 44 C28 39 30 48 34 45", "M45 57 L47 51 L58 40 L62 44 L51 55 Z"],
    ideia: ["M24 44 V40 C17 35 14 29 15 23 A17 17 0 0 1 49 23 C50 29 47 35 40 40 V44 Z", "M25 50 H39 M27 56 H37", "~M32 44 V33 M27 30 L32 34 L37 30"],
    alvo: ["M30 10 A24 24 0 1 0 30 58 A24 24 0 1 0 30 10", "~M30 19 A15 15 0 1 0 30 49 A15 15 0 1 0 30 19", "M30 28 A6 6 0 1 0 30 40 A6 6 0 1 0 30 28", "M30 34 L56 8", "M47 8 H56 V17"],
    megafone: ["M10 26 H18 L44 12 V52 L18 38 H10 Z", "M20 38 L24 52 H31 L28 41", "~M51 25 A9 9 0 0 1 51 39", "~M56 19 A16 16 0 0 1 56 45"],
    pasta: ["M6 18 A4 4 0 0 1 10 14 H24 L30 20 H54 A4 4 0 0 1 58 24 V50 A4 4 0 0 1 54 54 H10 A4 4 0 0 1 6 50 Z", "~M6 28 H58"],
    engrenagem: ["M50.6 28.2 L56.8 28.8 L56.8 35.2 L50.6 35.8 L47.8 42.5 L51.8 47.2 L47.2 51.8 L42.5 47.8 L35.8 50.6 L35.2 56.8 L28.8 56.8 L28.2 50.6 L21.5 47.8 L16.8 51.8 L12.2 47.2 L16.2 42.5 L13.4 35.8 L7.2 35.2 L7.2 28.8 L13.4 28.2 L16.2 21.5 L12.2 16.8 L16.8 12.2 L21.5 16.2 L28.2 13.4 L28.8 7.2 L35.2 7.2 L35.8 13.4 L42.5 16.2 L47.2 12.2 L51.8 16.8 L47.8 21.5 Z",
      "M32 24 A8 8 0 1 0 32 40 A8 8 0 1 0 32 24"],
    robo: ["M15 22 H49 A6 6 0 0 1 55 28 V48 A6 6 0 0 1 49 54 H15 A6 6 0 0 1 9 48 V28 A6 6 0 0 1 15 22 Z", "M32 22 V13 M32 6 A3.5 3.5 0 1 0 32 13 A3.5 3.5 0 1 0 32 6", "M24 34 V38 M40 34 V38",
      "~M25 46 H39 M9 36 H4 M55 36 H60"],
  };

  // Número que cresce: separa o número do texto ("R$ 2.000" vira antes "R$ ", valor 2000, depois ""), no jeito brasileiro
  // (ponto no milhar, vírgula nos decimais); sem algarismo, null. escrever(n, v) escreve o valor v no mesmo formato.
  function numero(s) {
    const m = /^(\D*?)(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?(.*)$/.exec(s);
    if (!m) return null;
    return { antes: m[1], valor: +(m[2].replace(/\./g, "") + "." + (m[3] || "0")), casas: (m[3] || "").length, milhar: m[2].includes("."), depois: m[4] };
  }
  function escrever(n, v) {
    const [i, d] = v.toFixed(n.casas).split(".");
    return n.antes + (n.milhar ? i.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : i) + (d ? "," + d : "") + n.depois;
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
    if (COM_CARTOES.includes(estilo)) // entrada de cada cartão (no Motion dividido, de cada animação)
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

  // Legenda em caixa escura, na emenda das duas metades (Painel escuro dividido e Motion dividido), como a do Painel
  // escuro: grupos de até 4 palavras e 22 letras dentro de #legenda; a palavra falada na cor destaque, clareada até
  // 3,4:1 contra o fundo escuro quando precisa (a caixa é opaca: o vídeo da emenda não vaza). c: o que o iniciar() devolve.
  function legendaEmCaixa(tl, c) {
    const COR = `rgb(${legivel(c.DESTAQUE, c.CLARO, c.ESCURO, 3.4).join(",")})`, host = document.getElementById("legenda"), GRUPOS = agrupar(c.PAL, 4, 22);
    GRUPOS.forEach((g, gi) => {
      const el = host.appendChild(novo("div", "grupo", `grupo-${gi + 1}`)), cx = el.appendChild(novo("div", "caixa", `grupo-${gi + 1}-caixa`));
      g.forEach((p, pi) => (p.el = cx.appendChild(novo("span", "p", `grupo-${gi + 1}-p${pi + 1}`, p.txt))));
      const prox = GRUPOS[gi + 1], sai = Math.min(prox ? prox[0].ini : c.TOTAL, g[g.length - 1].fim + 0.6);
      tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: Math.min(0.07, (sai - g[0].ini) / 2), ease: "none" }, g[0].ini);
      tl.set(el, { opacity: 0 }, sai);
      g.forEach((p, pi) => {
        tl.set(p.el, { color: COR }, p.ini);
        tl.set(p.el, { color: c.CLARO }, Math.min(g[pi + 1] ? g[pi + 1].ini : sai, p.fim + 0.25));
      });
    });
  }

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

  const api = { naEdicao, mapear, marcar, agrupar, trocas, efeitos, contraste, legivel, mistura, iniciar, novo, capa, COM_CARTOES, batidas, ENTRA_TITULO, numero, escrever, legendaEmCaixa, ICONES };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.EditorChefe = api;
})(this);
