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

  // Estilos com cartões ("cartoes" no escolhas.json): o Painel escuro, o Editorial claro, os três de tela dividida e a
  // Papelaria. No Motion dividido, cada cartão é uma ideia com uma animação da biblioteca; na Papelaria, um cartão de papel
  // com o título em letra de mão e, se tiver, a lista que ganha o check ou o risco item por item.
  const COM_CARTOES = ["painel-escuro", "editorial-claro", "painel-escuro-dividido", "editorial-claro-dividido", "motion-dividido", "papelaria"];

  // Motion dividido: instante (na edição) em que cada item da animação entra. O primeiro entra junto com o título da
  // ideia (ini + ENTRA_TITULO, o mesmo instante do título no molde), mesmo antes de ser dito; os seguintes, quando a fala
  // diz as palavras deles, todas seguidas e na ordem dos itens, dentro da ideia (de ini - 0,5 s a fim). Item que não
  // aparece assim entra 0,5 s depois do anterior; nenhum dos seguintes entra depois de fim - 0,6 s (para ficar na tela
  // antes da saída). achou: as palavras do item estão na fala da ideia (o montador avisa quando não estão, também no
  // primeiro). Devolve [{ t, achou }], com t em milésimos de segundo. Na lista da Papelaria ({ comTitulo: false,
  // naUltima: true }) todos os itens já estão no cartão e cada um ganha a marca quando é dito, o primeiro também, no
  // começo da última palavra dele (a marca termina de se desenhar junto com o item).
  const ENTRA_TITULO = 0.05;
  function batidas(pal, itens, ini, fim, { comTitulo = true, naUltima = false } = {}) {
    let k = pal.findIndex((p) => p.ini >= ini - 0.5), ant = ini + ENTRA_TITULO;
    if (k < 0) k = pal.length;
    const teto = Math.max(ant, fim - 0.6);
    return itens.map((item, n) => {
      const w = item.split(/\s+/).map(limpa).filter(Boolean);
      let j = k;
      while (w.length && j + w.length <= pal.length && pal[j].ini < fim && !w.every((x, m) => limpa(pal[j + m].txt) === x)) j++;
      const achou = w.length > 0 && j + w.length <= pal.length && pal[j].ini < fim;
      if (achou) k = j + w.length;
      const t = n || !comTitulo ? Math.min(teto, Math.max(achou ? pal[naUltima ? j + w.length - 1 : j].ini : ant + 0.5, ant)) : ant;
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
  // Ícone neutro do aplicativo citado, para a marca sem kit público ou cuja regra não deixa usar o logo (o "desenho" do
  // manifest.json de pecas/): só traços nossos, sem a cor nem a forma do logo. Mesma convenção de "~" dos ÍCONES.
  const QUADRO = "M8 10 H56 A4 4 0 0 1 60 14 V50 A4 4 0 0 1 56 54 H8 A4 4 0 0 1 4 50 V14 A4 4 0 0 1 8 10 Z";
  const NEUTROS = {
    calendario: ICONES.calendario, robo: ICONES.robo, pasta: ICONES.pasta, documento: ICONES.documento, celular: ICONES.celular, conversa: ICONES.conversa,
    email: ["M8 16 H56 A4 4 0 0 1 60 20 V46 A4 4 0 0 1 56 50 H8 A4 4 0 0 1 4 46 V20 A4 4 0 0 1 8 16 Z", "M6 19 L32 38 L58 19"],
    planilha: [QUADRO, "~M4 24 H60", "~M4 39 H60", "~M24 10 V54"],
    imagem: [QUADRO, "~M10 48 L24 32 L34 42 L42 34 L54 48", "~M44 18 A5 5 0 1 0 44 28 A5 5 0 1 0 44 18"],
    camera: ["M8 18 H38 A4 4 0 0 1 42 22 V42 A4 4 0 0 1 38 46 H8 A4 4 0 0 1 4 42 V22 A4 4 0 0 1 8 18 Z", "~M42 28 L58 19 V45 L42 36 Z"],
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
  // d: os dados do molde (palavras, chaves, apice, identidade, enfase, cartoes, destaques, capa). Cada momento tem uma família de som
  // (SONS: os nomes do sons/manifest.json); a família com mais de um som reveza, na ordem, para não repetir o mesmo som
  // seguido. Efeitos a menos de 0,5 s um do outro: fica o da família mais forte (FORCA).
  // Com gancho de capa, os efeitos do estilo só começam depois dela, e a saída da capa ganha o som dela.
  // A Caixinha de pergunta não tem efeito nenhum (só a edição básica): não entra em nenhum ramo e a lista sai vazia.
  const SONS = {
    frase: ["whoosh-short", "whoosh-rapido"], // começo de frase, palavra forte, aproximação do enquadramento
    destaque: ["pop", "pop-mao", "clique"], // palavra de ênfase
    item: ["tique", "clique-suave"], // item da animação do Motion dividido e check ou risco da Papelaria, quando é dito
    cartao: ["whoosh-largo"], // entrada de cartão (no Motion dividido, de cada animação)
    capa: ["whoosh-grave"], // saída do gancho de capa
    apice: ["impacto-suave"], // ápice da Palavra-chave na identidade keynote; o carimbo do selo
    "apice-stomp": ["impact-bass-1"], // ápice na identidade stomp
    notificacao: ["notificacao"], // a notificação de mensagem que desce no "Comenta"
    pronto: ["pronto"], // a barra do "Comenta" que chega a pronto
  };
  const FORCA = { item: 0, frase: 1, destaque: 2, notificacao: 2, pronto: 2, cartao: 3, capa: 3, apice: 4, "apice-stomp": 4 };
  function efeitos(estilo, d, trechos, total) {
    const pal = mapear(d.palavras, trechos, total), ev = [];
    if (estilo === "legenda-viva") // começo de cada frase
      agrupar(pal, 4, 18).forEach((g, i, gs) => { if (!i || /[.?!]$/.test(gs[i - 1][gs[i - 1].length - 1].txt)) ev.push({ t: g[0].ini, f: "frase" }); });
    if (estilo === "palavra-chave") { // cada palavra forte; o ápice com impacto
      const a = marcar(pal, d.chaves), ka = a[d.chaves.indexOf(d.apice)], apice = d.identidade === "stomp" ? "apice-stomp" : "apice";
      a.filter((i) => i >= 0).forEach((k) => ev.push({ t: pal[k].ini, f: k === ka ? apice : "frase" }));
    }
    if (estilo === "corte-seco-zoom") { // cada aproximação do enquadramento; estalo nas palavras de ênfase
      trocas(pal, trechos, total).forEach((t, n) => n % 2 || ev.push({ t, f: "frase" }));
      marcar(pal, d.enfase).filter((i) => i >= 0).forEach((i) => ev.push({ t: pal[i].ini, f: "destaque" }));
    }
    if (estilo === "destaques-tipograficos") { // whoosh na entrada de cada frase em destaque; pop na palavra-chave dela; os sons de cada peça (do plano)
      d.destaques.forEach((x) => { ev.push({ t: pal[x.de].ini, f: "frase" }); ev.push({ t: pal[x.chave[0]].ini, f: "destaque" }); });
      (d.pecas ?? []).forEach((p) => ev.push(...p.sons));
    }
    if (COM_CARTOES.includes(estilo)) // entrada de cada cartão (no Motion dividido, de cada animação, e cada item seguinte quando é dito; na Papelaria, cada check ou risco)
      d.cartoes.forEach((c, i) => {
        const ini = naEdicao(c.de, "ini", trechos, total), fim = d.cartoes[i + 1] ? naEdicao(d.cartoes[i + 1].de, "ini", trechos, total) : total;
        ev.push({ t: ini, f: "cartao" });
        if (estilo === "motion-dividido") batidas(pal, c.itens, ini, fim).slice(1).forEach((b) => ev.push({ t: b.t, f: "item" }));
        if (estilo === "papelaria" && c.lista) batidas(pal, c.lista, ini, fim, { comTitulo: false, naUltima: true }).forEach((b) => ev.push({ t: b.t, f: "item" }));
      });
    const todos = d.capa ? [...ev.filter((e) => e.t >= d.capa.fim), { t: SAIDA[d.capa.estilo], f: "capa" }] : ev;
    const fica = [], vez = {};
    todos.filter((e) => e.t < total).sort((x, y) => x.t - y.t).forEach((e) => {
      const ant = fica[fica.length - 1];
      if (!ant || e.t - ant.t >= 0.5) fica.push(e);
      else if (FORCA[e.f] > FORCA[ant.f]) fica[fica.length - 1] = e;
    });
    return fica.map(({ t, f }) => { const n = vez[f] = (vez[f] ?? -1) + 1; return { t, som: SONS[f][n % SONS[f].length] }; });
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
  // Motion dividido: cores do painel branco (o fundo fica no escuro da marca; o painel da animação, branco). Traço, setas,
  // marcas, número e palavra forte do título na cor destaque, escurecida até 3,2:1 contra o branco se for clara demais
  // (amarelo); a caixa forte e o balão da resposta, um tom de 18% dela. Texto no escuro da marca, escurecido até 4,6:1
  // contra esse tom (o fundo mais escuro em que um texto pousa). Item ainda não dito: cinza com 4,6:1; detalhe de ícone,
  // 3:1; trilho e traço apagado, 2:1. Fora do painel, sobre o fundo escuro, iguais aos da 0.8.0 (medidos contra o tom do
  // painel de antes, 5% mais claro que o fundo): o número do cabeçalho e os filetes (do cabeçalho e da emenda), na cor
  // destaque clareada até 3,2:1 se for escura demais. Tudo [r, g, b].
  function coresMotion(c) {
    const PAINEL = [255, 255, 255], PRETO = [0, 0, 0], LINHA = legivel(c.DESTAQUE, PRETO, PAINEL, 3.2), FORTE = mistura(PAINEL, LINHA, 0.18);
    const TEXTO = legivel(c.ESCURO, PRETO, FORTE, 4.6), TOPO = mistura(c.ESCURO, c.CLARO, 0.05);
    return {
      PAINEL, LINHA, FORTE, TEXTO,
      APAGADO: legivel(mistura(TEXTO, PAINEL, 0.55), TEXTO, PAINEL, 4.6),
      DETALHE: legivel(mistura(TEXTO, PAINEL, 0.45), TEXTO, PAINEL, 3),
      TRACO_APAGADO: legivel(mistura(TEXTO, PAINEL, 0.78), TEXTO, PAINEL, 2),
      NUM_CABECA: legivel(mistura(c.CLARO, TOPO, 0.55), c.CLARO, TOPO, 3.2),
      FILETE: legivel(c.DESTAQUE, c.CLARO, TOPO, 3.2),
    };
  }

  // Papelaria: o papel branco do cartão leva as cores do painel branco do Motion dividido (coresMotion): tinta no escuro da
  // marca (4,6:1), traço, check, risco e palavra forte no destaque, escurecido rumo ao preto até 3,2:1 se for claro
  // demais; item riscado em cinza ainda com 4,6:1; contorno do quadradinho com 3:1. Fora do cartão, no fundo claro: a
  // assinatura no texto da marca, escurecida até 4,6:1; os pontos do papel e a fita adesiva são só enfeite. Tudo [r, g, b].
  function coresPapelaria(c) {
    const P = coresMotion(c);
    return { ...P, CABECA: legivel(c.TEXTO, [0, 0, 0], c.CLARO, 4.6), PONTO: mistura(c.CLARO, c.TEXTO, 0.14), FITA: mistura(P.LINHA, [255, 255, 255], 0.62) };
  }

  // Destaques tipográficos: as palavras da legenda, que são as de fora das frases em destaque (por índice da fala). Com
  // "k" na palavra (o índice dela na fala inteira), o filtro usa o k: a legenda de uma palavra marca a palavra-chave por ele.
  function semDestaques(pal, destaques) {
    const fora = new Set(destaques.flatMap((x) => Array.from({ length: x.ate - x.de + 1 }, (_, k) => x.de + k)));
    return pal.filter((p, i) => !fora.has(p.k ?? i));
  }

  // Biblioteca de peças (estilo 11), desenhadas para o Editor Chefe: o tamanho de desenho de cada uma (px, antes da escala
  // que o montar.mjs calcula para caber na faixa, acima da cabeça ou embaixo do queixo), o instante de cada movimento depois da entrada (s) e quanto ela
  // fica na tela. O montar.mjs usa estes números no plano (tempo, faixa da conferência e sons, com o pico no quadro do
  // movimento) e o pecas.js, na animação: os dois leem a mesma tabela. A pílula do capítulo fica no canto, de 240 a 304
  // px (com as peças embaixo do queixo, logo acima da legenda, na mesma altura delas). Enquanto outra peça ou frase está
  // na faixa, a pílula encolhe para só o número (de 90 a 154 px) e a peça fica com até larguraComPilula de largura,
  // centrada, para não encostar nela. A lista, o esquema e a janela têm a letra 30% maior que na primeira versão (a letra
  // miúda não se lia no celular), e a peça cresceu junto, para a letra não voltar a encolher.
  const PECA = {
    topo: 240, pilula: [240, 304], larguraComPilula: 772,
    selo: { w: 660, h: 210, pousa: 0.16, fica: 2.2 },
    lista: { w: 860, linha: 84, titulo: 90, borda: 60, escreve: 0.35, fica: 1.6 },
    capitulo: { w: 900, h: 260, grande: 1.7 },
    comenta: { w: 820, h: 296, acende: 0.55, notifica: 1.05, enche: [1.5, 3], fica: 4.6 },
    objeto: { w: 340, h: 340, pousa: 0.2, fica: 2 },
    app: { w: 760, h: 280, fica: 2.4 },
    janela: { w: 860, h: 344, fica: 3.6 },
    esquema: { w: 900, h: 330, liga: 0.3, fica: 1.6 },
  };
  const alturaPeca = (p) => (p.tipo === "lista" ? PECA.lista.borda + (p.titulo ? PECA.lista.titulo : 0) + p.itens.length * PECA.lista.linha : PECA[p.tipo].h);
  // Cores das peças: os cartões são brancos, com as cores do painel branco do Motion dividido (coresMotion). Verde e
  // vermelho só no selo de aprovado e reprovado e no "pronto" do Comenta (certo e errado), os dois com 4,5:1 no branco.
  // SOBRE_LINHA: o texto sobre a cor de destaque (o branco ou o texto da marca, o que lê mais). VEU: o fundo das vagas
  // vazias do esquema, sobre o vídeo. Tudo [r, g, b].
  function coresPecas(c) {
    const P = coresMotion(c), BRANCO = [255, 255, 255];
    return { ...P, VERDE: [21, 128, 61], VERMELHO: [198, 40, 40], SOBRE_LINHA: contraste(BRANCO, P.LINHA) >= contraste(P.TEXTO, P.LINHA) ? BRANCO : P.TEXTO, VEU: mistura(c.ESCURO, [0, 0, 0], 0.3) };
  }
  // Legenda de uma palavra por vez (estilo 11). pal: as palavras da fala ({ txt, ini, fim, k }, k o índice na fala inteira);
  // chaves: os índices k das palavras-chave. Palavra de 1 ou 2 letras colada na seguinte (menos de 0,12 s entre elas) vai
  // junto ("A ANÁLISE"), para não piscar sozinha. Cada uma fica até a seguinte entrar, ou até 0,4 s depois do fim dela se
  // vem uma pausa, e no mínimo 0,08 s. fora: os intervalos [de, ate] sem legenda (a frase ou peça embaixo do queixo, que
  // já mostra as palavras): a palavra que começa dentro de um deles não entra, e a de antes sai quando ele começa.
  // Devolve [{ txt, ini, sai, chave }], o texto sem a pontuação do fim.
  function palavraPorVez(pal, chaves, total, fora = []) {
    const g = [], curta = (p) => p.txt.replace(/[^\p{L}\p{N}]/gu, "").length <= 2;
    pal.forEach((p, i) => {
      const ant = g[g.length - 1];
      if (ant && ant.curta && p.ini - ant.fim < 0.12 && ant.txt.length + p.txt.length < 12) Object.assign(ant, { txt: `${ant.txt} ${p.txt}`, fim: p.fim, chave: ant.chave || chaves.has(p.k), curta: false });
      else g.push({ txt: p.txt, ini: p.ini, fim: p.fim, chave: chaves.has(p.k), curta: curta(p) && i < pal.length - 1 });
    });
    return g.map((x, i) => ({ txt: x.txt.replace(/[.,;:…]+$/u, ""), ini: x.ini, sai: +Math.max(x.ini + 0.08, Math.min(g[i + 1] ? g[i + 1].ini : total, x.fim + 0.4)).toFixed(3), chave: x.chave }))
      .filter((x) => !fora.some(([a, b]) => x.ini >= a && x.ini < b))
      .map((x) => ({ ...x, sai: Math.min(x.sai, ...fora.filter(([a]) => a > x.ini).map(([a]) => a)) }))
      .filter((x) => x.sai - x.ini >= 0.08);
  }
  // Legenda de uma palavra (estilo 11), sobre o vídeo: letra branca com um contorno no escuro da marca, escurecido até 15:1
  // contra o branco. Sobre fundo claro (jaleco, parede) quem separa a letra é o contorno; sobre fundo escuro (cabelo,
  // roupa escura), é a própria letra. Por isso a palavra-chave clareia rumo ao branco, no mesmo matiz, até 9:1 contra o
  // contorno: assim ela passa de 3:1 também num fundo de luminância 0,1, onde o contorno escuro quase não ajuda (medido
  // no hf check: o destaque a 4,5:1 caiu para 2,4:1 sobre o cabelo). Tudo [r, g, b].
  function coresLegenda(c) {
    const BRANCO = [255, 255, 255], CONTORNO = legivel(c.ESCURO, [0, 0, 0], BRANCO, 15);
    return { TEXTO: BRANCO, CONTORNO, CHAVE: legivel(c.DESTAQUE, BRANCO, CONTORNO, 9) };
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
  // cores: { texto, falada } para caixa de outra cor (na Papelaria, papel branco com tinta escura), com o fundo no CSS.
  function legendaEmCaixa(tl, c, cores = {}) {
    const COR = cores.falada ?? `rgb(${legivel(c.DESTAQUE, c.CLARO, c.ESCURO, 3.4).join(",")})`, BASE = cores.texto ?? c.CLARO, host = document.getElementById("legenda"), GRUPOS = agrupar(c.PAL, 4, 22);
    GRUPOS.forEach((g, gi) => {
      const el = host.appendChild(novo("div", "grupo", `grupo-${gi + 1}`)), cx = el.appendChild(novo("div", "caixa", `grupo-${gi + 1}-caixa`));
      g.forEach((p, pi) => (p.el = cx.appendChild(novo("span", "p", `grupo-${gi + 1}-p${pi + 1}`, p.txt))));
      const prox = GRUPOS[gi + 1], sai = Math.min(prox ? prox[0].ini : c.TOTAL, g[g.length - 1].fim + 0.6);
      tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: Math.min(0.07, (sai - g[0].ini) / 2), ease: "none" }, g[0].ini);
      tl.set(el, { opacity: 0 }, sai);
      g.forEach((p, pi) => {
        tl.set(p.el, { color: COR }, p.ini);
        tl.set(p.el, { color: BASE }, Math.min(g[pi + 1] ? g[pi + 1].ini : sai, p.fim + 0.25));
      });
    });
  }

  // Legenda corrida do Corte seco (estilo 3), também nos estilos com muitos elementos na tela (4, 7, 9, 12 e a opção do 8),
  // no lugar da legenda em caixa (2026-10-26): linhas de até maxPal palavras e maxLetras letras, sem
  // caixa, no claro da marca com um leve contorno no escuro e sombra; a palavra de ênfase ganha o traço de 8 px na cor
  // destaque no instante em que é dita. O contorno fica numa camada atrás da letra (::before; o Chrome do render não aplica
  // paint-order em texto HTML) e a letra da frente leva um fio dele, que a conferência de contraste da HyperFrames lê como
  // parte da letra. reforcar: a faixa da legenda no vídeo é clara (o montar.mjs mede), contorno e sombra mais fortes.
  // fortes: os índices, na fala inteira, das palavras de ênfase. Monta em #legenda. c: o que o iniciar() devolve.
  function legendaCorrida(tl, c, { fortes = [], familia, tamanho = 66, maxPal = 5, maxLetras = 24, reforcar = false } = {}) {
    const K = coresLegenda(c).CONTORNO.join(","), host = document.getElementById("legenda"), ENF = new Set(fortes);
    const sombra = reforcar ? `0 0 4px rgba(${K},.95), 0 0 16px rgba(${K},.85), 0 4px 14px rgba(${K},.9)` : `0 0 14px rgba(${K},.55), 0 3px 9px rgba(${K},.7)`;
    document.head.appendChild(novo("style", "", "legenda-estilo")).textContent = `
      #legenda .linha { position: absolute; inset: 0; display: flex; flex-wrap: wrap; justify-content: center; align-content: center; column-gap: 0.24em; row-gap: 6px; opacity: 0;
        font-family: "${familia}", sans-serif; font-weight: 800; font-size: ${tamanho}px; line-height: 1.14; color: ${c.CLARO}; }
      #legenda .p { display: inline-block; position: relative; z-index: 0; -webkit-text-stroke: 0.6px rgb(${K}); }
      #legenda .p::before { content: attr(data-t); position: absolute; left: 0; top: 0; z-index: -1; color: rgb(${K}); -webkit-text-stroke: ${reforcar ? 10 : 5}px rgb(${K}); text-shadow: ${sombra}; }
      #legenda .sublinha { position: absolute; left: 0; bottom: -4px; width: 0; height: 8px; border-radius: 4px; background: ${c.DESTAQUE}; }`;
    const LINHAS = agrupar(c.PAL.map((p, k) => ({ ...p, k })), maxPal, maxLetras);
    LINHAS.forEach((g, gi) => {
      const el = host.appendChild(novo("div", "linha", `linha-${gi + 1}`));
      g.forEach((p, pi) => {
        const s = el.appendChild(novo("span", "p", `linha-${gi + 1}-p${pi + 1}`, p.txt));
        s.dataset.t = p.txt;
        if (ENF.has(p.k)) tl.fromTo(s.appendChild(novo("span", "sublinha", `linha-${gi + 1}-p${pi + 1}-traco`)), { width: "0%" }, { width: "100%", duration: 0.25, ease: "power2.out" }, p.ini);
      });
      const prox = LINHAS[gi + 1], sai = Math.min(prox ? prox[0].ini : c.TOTAL, g[g.length - 1].fim + 0.6);
      tl.fromTo(el, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: Math.min(0.07, (sai - g[0].ini) / 2), ease: "none" }, g[0].ini);
      // sai do layout, e não só fica transparente: a linha que subiu com y ganha camada própria, e a gravação rápida da
      // HyperFrames (900 quadros ou mais) a mostrava com a pintura velha por trás da seguinte
      tl.set(el, { opacity: 0, display: "none" }, sai);
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

  // Aproximação no rosto (só no navegador): o invólucro #aproximar, que o montar.mjs põe em volta dos trechos, cresce até z
  // com o centro no rosto (ox, oy, em px da janela) de "de" a "ate" e volta de "volta" a "fim" (planejarAproximacao, no rosto.mjs)
  function aproximar(tl, lista) {
    for (const a of lista) {
      const centro = `${a.ox}px ${a.oy}px`;
      tl.fromTo("#aproximar", { scale: 1, transformOrigin: centro }, { scale: a.z, transformOrigin: centro, duration: a.ate - a.de, ease: "power2.inOut", immediateRender: false }, a.de);
      tl.fromTo("#aproximar", { scale: a.z, transformOrigin: centro }, { scale: 1, transformOrigin: centro, duration: a.fim - a.volta, ease: "power2.inOut", immediateRender: false }, a.volta);
    }
  }

  const api = { aproximar, naEdicao, mapear, marcar, agrupar, trocas, efeitos, SONS, contraste, legivel, mistura, coresMotion, coresPapelaria, semDestaques, iniciar, novo, capa, COM_CARTOES, batidas, ENTRA_TITULO, numero, escrever, legendaEmCaixa, ICONES, NEUTROS,
    PECA, alturaPeca, coresPecas, coresLegenda, palavraPorVez, legendaCorrida };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.EditorChefe = api;
})(this);
