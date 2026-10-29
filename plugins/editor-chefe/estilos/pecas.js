// Editor Chefe: as peças animadas (selo, cartão de lista, capítulo numerado, "Comenta PALAVRA", objeto 3D, ícone do
// aplicativo em órbita, janela de navegador e esquema) e a legenda de uma palavra por vez. Desenhadas para o Editor
// Chefe, na marca do cliente; nenhum desenho de terceiros, só os arquivos da pasta pecas/ (objetos 3D e logos, com a
// licença em pecas/LICENCAS.md). Só no navegador: window.EditorChefePecas. O plano de cada peça (tempo, escala,
// posição, instantes de cada item e os sons) vem do montar.mjs; os tempos de cada movimento depois da entrada vêm da
// tabela EC.PECA do comum.js, a mesma que o montador usa para pôr o pico de cada som no quadro do movimento.
(function (raiz) {
  const EC = raiz.EditorChefe, PECA = EC.PECA, novo = EC.novo, NS = "http://www.w3.org/2000/svg";
  const em = (x, a) => (a == null ? `rgb(${x.join(",")})` : `rgba(${x.join(",")},${a})`);
  const svg = (pai, tag, id, at = {}) => { const e = pai.appendChild(document.createElementNS(NS, tag)); if (id) e.id = id; for (const k in at) e.setAttribute(k, at[k]); return e; };
  // Traço que se desenha (pathLength 1, stroke-dashoffset de 1 a 0)
  const traco = (s, id, d, cor, g) => svg(s, "path", id, { d, fill: "none", stroke: cor, "stroke-width": g, "stroke-linecap": "round", "stroke-linejoin": "round", pathLength: 1, "stroke-dasharray": 1, "stroke-dashoffset": 1 });
  // Texto que encolhe de 2 em 2 px até caber na largura (e na altura, se dada), até o mínimo (na lista, no esquema e na janela,
  // o mínimo subiu junto com a letra, para ela não voltar ao tamanho antigo)
  function caber(el, larg, alt, min) {
    let s = parseFloat(getComputedStyle(el).fontSize);
    while (s > min && (el.scrollWidth > larg + 1 || (alt && el.scrollHeight > alt + 1))) el.style.fontSize = (s -= 2) + "px";
  }
  // Ícone neutro do aplicativo sem logo liberado (o "desenho" do manifest.json): os traços de EC.NEUTROS
  const NEUTROS = EC.NEUTROS;

  const CSS = `
      #pecas, #pecas-canto { position: absolute; inset: 0; pointer-events: none; }
      .peca { position: absolute; transform-origin: 50% 100%; }
      .peca-corpo { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
      .cartao { background: #fff; border-radius: 30px; box-shadow: 0 20px 44px rgba(0,0,0,.32); }
      .selo { display: flex; align-items: center; gap: 24px; padding: 20px 44px 20px 24px; background: #fff; border-radius: 30px;
        box-shadow: inset 0 0 0 8px var(--cor), inset 0 0 0 15px #fff, inset 0 0 0 19px var(--cor), 0 20px 44px rgba(0,0,0,.32); }
      .selo-icone { flex: none; }
      .selo-rotulo { font-family: var(--cond), sans-serif; font-weight: var(--cond-peso); font-size: 104px; line-height: 1; color: var(--cor); white-space: nowrap; }
      .lista { position: absolute; inset: 0; padding: 30px 40px; box-sizing: border-box; }
      .lista-titulo { height: 90px; font-family: var(--titulo), sans-serif; font-weight: 800; font-size: 54px; line-height: 1.1; color: var(--texto); white-space: nowrap; overflow: hidden; }
      .lista-titulo::after { content: ""; display: block; width: 100px; height: 9px; margin-top: 8px; border-radius: 5px; background: var(--linha); }
      .lista-item { height: 84px; display: flex; align-items: center; gap: 22px; }
      .lista-marca { flex: none; }
      .lista-texto { font-family: var(--titulo), sans-serif; font-weight: 800; font-size: 52px; color: var(--texto); white-space: nowrap; }
      .capitulo { display: flex; align-items: center; gap: 32px; padding: 14px 46px 14px 40px; max-width: 900px; box-sizing: border-box; }
      .capitulo-num { font-family: var(--cond), sans-serif; font-weight: var(--cond-peso); font-size: 220px; line-height: 0.95; color: var(--linha); }
      .capitulo-titulo { width: 540px; font-family: var(--cond), sans-serif; font-weight: var(--cond-peso); font-size: 80px; line-height: 0.98; color: var(--texto); text-transform: uppercase; text-wrap: balance; }
      .pilula { position: absolute; left: 90px; top: 240px; height: 64px; display: flex; align-items: center; padding: 0 28px 0 8px;
        background: #fff; border-radius: 32px; box-shadow: 0 10px 24px rgba(0,0,0,.28); opacity: 0; }
      .pilula-num { width: 48px; height: 48px; border-radius: 24px; display: flex; align-items: center; justify-content: center; background: var(--linha);
        color: var(--sobre-linha); font-family: var(--cond), sans-serif; font-weight: var(--cond-peso); font-size: 32px; }
      .pilula-titulo { max-width: 760px; margin-left: 14px; overflow: hidden; font-family: var(--cond), sans-serif; font-weight: var(--cond-peso); font-size: 34px; color: var(--texto); text-transform: uppercase; white-space: nowrap; }
      .comenta { flex-direction: column; gap: 14px; }
      .comenta-chamada { display: flex; align-items: center; gap: 14px; height: 84px; padding: 0 12px 0 32px; border-radius: 42px; background: #fff; box-shadow: 0 16px 36px rgba(0,0,0,.3); }
      .comenta-rotulo { font-family: var(--cond), sans-serif; font-weight: var(--cond-peso); font-size: 48px; color: var(--texto); }
      .comenta-palavra { padding: 2px 24px; border-radius: 30px; font-family: var(--cond), sans-serif; font-weight: var(--cond-peso); font-size: 56px; line-height: 1.1;
        background: var(--forte); color: var(--texto); white-space: nowrap; }
      .notificacao { width: 760px; height: 96px; display: flex; align-items: center; gap: 20px; padding: 0 24px; box-sizing: border-box; border-radius: 26px;
        background: #fff; box-shadow: 0 16px 36px rgba(0,0,0,.3); }
      .notificacao-icone { flex: none; width: 64px; height: 64px; border-radius: 16px; background: var(--linha); display: flex; align-items: center; justify-content: center; }
      .notificacao-textos { flex: 1; min-width: 0; }
      .notificacao-nome { font-family: var(--titulo), sans-serif; font-weight: 800; font-size: 30px; color: var(--texto); white-space: nowrap; overflow: hidden; }
      .notificacao-linha { font-family: var(--titulo), sans-serif; font-weight: 800; font-size: 24px; color: var(--apagado); }
      .barra { width: 760px; height: 52px; display: flex; align-items: center; gap: 18px; padding: 0 20px; box-sizing: border-box; border-radius: 26px; background: #fff; box-shadow: 0 16px 36px rgba(0,0,0,.3); }
      .barra-trilho { flex: 1; height: 16px; border-radius: 8px; background: var(--forte); overflow: hidden; }
      .barra-cheia { width: 100%; height: 100%; border-radius: 8px; background: var(--linha); transform-origin: 0 50%; }
      .barra-rotulo { position: relative; width: 160px; height: 36px; }
      .barra-pct, .barra-pronto { position: absolute; inset: 0; display: flex; align-items: center; justify-content: flex-end; gap: 8px;
        font-family: var(--titulo), sans-serif; font-weight: 800; font-size: 28px; color: var(--texto); }
      .barra-pronto { opacity: 0; }
      .objeto-img { position: absolute; left: 20px; top: 4px; width: 300px; height: 300px; object-fit: contain; filter: drop-shadow(0 18px 22px rgba(0,0,0,.35)); }
      .objeto-disco { position: absolute; left: 30px; top: 4px; width: 280px; height: 280px; border-radius: 50%; background: #fff; box-shadow: 0 18px 36px rgba(0,0,0,.32);
        display: flex; align-items: center; justify-content: center; }
      .objeto-disco svg { width: 170px; height: 170px; color: var(--texto); }
      .objeto-disco svg [opacity="0.2"] { fill: var(--linha); opacity: 1; }
      .objeto-sombra { position: absolute; left: 80px; bottom: 4px; width: 180px; height: 28px; border-radius: 50%; background: radial-gradient(closest-side, rgba(0,0,0,.6), rgba(0,0,0,0)); }
      .app-anel { position: absolute; left: 0; top: 0; }
      .app-orbita { position: absolute; left: 380px; top: 150px; width: 0; height: 0;
        transform: translate(calc(cos(var(--a) * 1deg) * 320px), calc(sin(var(--a) * 1deg) * 84px)) scale(calc(0.8 + 0.2 * sin(var(--a) * 1deg))); }
      .app-tile { position: absolute; display: flex; align-items: center; justify-content: center; background: #fff; box-shadow: 0 14px 30px rgba(0,0,0,.32); }
      .app-tile img { width: 64%; height: 64%; object-fit: contain; }
      .app-ponto { position: absolute; left: -11px; top: -11px; width: 22px; height: 22px; border-radius: 11px; background: var(--linha); box-shadow: 0 0 0 5px rgba(255,255,255,.8); }
      .janela { width: 860px; height: 344px; border-radius: 22px; overflow: hidden; background: #fff; box-shadow: 0 26px 54px rgba(0,0,0,.42); }
      .janela-barra { height: 56px; display: flex; align-items: center; gap: 12px; padding: 0 24px; background: #ECECEC; }
      .janela-ponto { width: 18px; height: 18px; border-radius: 9px; flex: none; }
      .janela-endereco { flex: 1; min-width: 0; height: 38px; margin: 0 80px 0 40px; padding: 0 12px; box-sizing: border-box; border-radius: 12px; background: #fff; text-align: center;
        font-family: var(--titulo), sans-serif; font-weight: 800; font-size: 26px; line-height: 38px; color: #4D4D4D; white-space: nowrap; overflow: hidden; }
      .janela-tela { width: 860px; height: 288px; overflow: hidden; }
      .janela-tela img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 0; transform-origin: 50% 0; }
      .esquema { position: absolute; inset: 0; }
      .esquema-meio { position: absolute; left: 300px; top: 0; width: 300px; height: 330px; display: flex; align-items: center; justify-content: center; }
      .esquema-centro { min-width: 150px; max-width: 290px; height: 150px; padding: 0 24px; box-sizing: border-box; border-radius: 75px; display: flex; align-items: center; justify-content: center;
        background: var(--linha); box-shadow: 0 16px 36px rgba(0,0,0,.32); }
      .esquema-centro-texto { max-width: 242px; text-align: center; font-family: var(--titulo), sans-serif; font-weight: 800; font-size: 44px; line-height: 1.05; color: var(--sobre-linha); overflow-wrap: normal; hyphens: none; }
      .vaga { position: absolute; width: 290px; height: 100px; box-sizing: border-box; border-radius: 26px; border: 4px dashed rgba(255,255,255,.92); background: var(--veu); }
      .vaga-cheia { position: absolute; inset: -4px; border-radius: 26px; background: #fff; display: flex; align-items: center; justify-content: center; padding: 0 18px;
        box-shadow: 0 14px 30px rgba(0,0,0,.3); opacity: 0; }
      .vaga-texto { overflow-wrap: normal; text-align: center; font-family: var(--titulo), sans-serif; font-weight: 800; font-size: 40px; line-height: 1.05; color: var(--texto); }
      #legenda .palavra { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; opacity: 0; white-space: nowrap;
        font-family: var(--cond), sans-serif; font-weight: var(--cond-peso); font-size: 150px; line-height: 1; text-transform: uppercase; color: var(--leg-texto); }
      /* O contorno grosso vai numa camada atrás da letra (o Chrome do render não aplica paint-order em texto HTML, e o contorno
         por cima comia a letra por dentro); a letra da frente leva só 1 px do contorno, que a conferência de contraste lê */
      #legenda .palavra span { position: relative; z-index: 0; -webkit-text-stroke: 1px var(--leg-contorno); }
      #legenda .palavra span::before { content: attr(data-t); position: absolute; left: 0; top: 0; z-index: -1; color: var(--leg-contorno);
        -webkit-text-stroke: 16px var(--leg-contorno); text-shadow: var(--leg-sombra); }
      #legenda .palavra.chave span { color: var(--leg-chave); }`;

  // As cores e as fontes das peças, em variáveis do CSS da página. f: { titulo, cond, condPeso }
  function preparar(c, f) {
    const K = EC.coresPecas(c), L = EC.coresLegenda(c), css = document.documentElement.style;
    const st = document.head.appendChild(document.createElement("style"));
    st.id = "pecas-estilo";
    st.textContent = CSS;
    const vars = { "--titulo": `"${f.titulo}"`, "--cond": `"${f.cond}"`, "--cond-peso": f.condPeso, "--texto": em(K.TEXTO), "--linha": em(K.LINHA), "--forte": em(K.FORTE),
      "--apagado": em(K.APAGADO), "--sobre-linha": em(K.SOBRE_LINHA), "--veu": em(K.VEU, 0.45), "--leg-texto": em(L.TEXTO), "--leg-chave": em(L.CHAVE) };
    // Contorno da legenda: um traço de verdade em volta da letra (desenhado por fora dela, paint-order), que a conferência
    // de contraste da HyperFrames lê como parte da letra, e uma sombra suave por baixo
    vars["--leg-contorno"] = em(L.CONTORNO);
    vars["--leg-sombra"] = `0 10px 26px ${em(L.CONTORNO, 0.55)}`;
    for (const k in vars) css.setProperty(k, vars[k]);
    return K;
  }

  const DESENHO = {
    selo(tl, p, corpo, id, K) {
      const COR = { aprovado: K.VERDE, reprovado: K.VERMELHO, atencao: K.LINHA, novo: K.LINHA }[p.selo];
      const ROT = { aprovado: "APROVADO", reprovado: "REPROVADO", atencao: "ATENÇÃO", novo: "NOVO" }[p.selo];
      const s = corpo.appendChild(novo("div", "selo", `${id}-selo`));
      s.style.setProperty("--cor", em(COR));
      const ic = svg(s, "svg", `${id}-icone`, { class: "selo-icone", width: 112, height: 112, viewBox: "0 0 100 100" });
      svg(ic, "circle", `${id}-icone-fundo`, { cx: 50, cy: 50, r: 47, fill: em(COR) });
      if (p.selo === "novo") svg(ic, "path", `${id}-icone-traco`, { d: "M50 16 C53 39 61 47 84 50 C61 53 53 61 50 84 C47 61 39 53 16 50 C39 47 47 39 50 16 Z", fill: "#fff" });
      else svg(ic, "path", `${id}-icone-traco`, { d: { aprovado: "M27 52 L43 68 L74 34", reprovado: "M32 32 L68 68 M68 32 L32 68", atencao: "M50 24 V58 M50 75 V76" }[p.selo], fill: "none", stroke: "#fff", "stroke-width": 12, "stroke-linecap": "round", "stroke-linejoin": "round" });
      const r = s.appendChild(novo("span", "selo-rotulo", `${id}-rotulo`, ROT));
      caber(r, PECA.selo.w - 112 - 24 - 68, 0, 60);
      // o carimbo bate: cai de grande e inclinado e pousa em PECA.selo.pousa (o pico do som), com um tranco
      tl.fromTo(s, { opacity: 0, scale: 2.4, rotation: -18 }, { opacity: 1, scale: 1, rotation: -7, duration: PECA.selo.pousa, ease: "power4.in" }, p.t);
      tl.to(s, { scale: 1.06, duration: 0.06, ease: "power2.out" }, p.t + PECA.selo.pousa);
      tl.to(s, { scale: 1, duration: 0.14, ease: "power2.inOut" }, p.t + PECA.selo.pousa + 0.06);
      tl.to(s, { opacity: 0, scale: 0.92, duration: 0.22, ease: "power2.in" }, p.sai);
    },

    lista(tl, p, corpo, id, K) {
      const card = corpo.appendChild(novo("div", "cartao lista", `${id}-cartao`)), larg = PECA.lista.w - 84;
      if (p.titulo) caber(card.appendChild(novo("div", "lista-titulo", `${id}-titulo`, p.titulo)), larg, 0, 36);
      p.itens.forEach((txt, k) => {
        const n = `${id}-item-${k + 1}`, li = card.appendChild(novo("div", "lista-item", n));
        const m = svg(li, "svg", `${n}-marca`, { class: "lista-marca", width: 60, height: 60, viewBox: "0 0 48 48" });
        svg(m, "circle", `${n}-aro`, { cx: 24, cy: 24, r: 21, fill: "none", stroke: em(K.DETALHE), "stroke-width": 3 });
        const fundo = svg(m, "circle", `${n}-fundo`, { cx: 24, cy: 24, r: 23, fill: em(K.LINHA), opacity: 0 });
        const ck = traco(m, `${n}-check`, "M14 25 L21 32 L35 17", em(K.SOBRE_LINHA), 5);
        const tx = li.appendChild(novo("span", "lista-texto", `${n}-texto`, txt));
        caber(tx, larg - 84, 0, 34);
        // o item se escreve quando começa a ser dito e ganha o check na última palavra dele
        tl.fromTo(tx, { clipPath: "inset(0% 100% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: PECA.lista.escreve, ease: "none" }, p.escreve[k]);
        tl.to(fundo, { attr: { opacity: 1 }, duration: 0.12, ease: "none" }, p.marca[k]);
        tl.to(ck, { strokeDashoffset: 0, duration: 0.22, ease: "power2.out" }, p.marca[k]);
        tl.fromTo(m, { scale: 1 }, { scale: 1.2, duration: 0.1, ease: "power2.out", immediateRender: false }, p.marca[k]);
        tl.to(m, { scale: 1, duration: 0.16, ease: "power2.inOut" }, p.marca[k] + 0.1);
      });
      tl.fromTo(card, { opacity: 0, y: 40, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: "power3.out" }, p.t);
      tl.to(card, { opacity: 0, y: -20, duration: 0.22, ease: "power2.in" }, p.sai);
    },

    capitulo(tl, p, corpo, id, K, canto) {
      const card = corpo.appendChild(novo("div", "cartao capitulo", `${id}-cartao`));
      card.appendChild(novo("div", "capitulo-num", `${id}-numero`, String(p.numero))).setAttribute("data-layout-allow-overflow", ""); // a caixa da letra de 220 px passa do cartão; o algarismo, não
      caber(card.appendChild(novo("div", "capitulo-titulo", `${id}-titulo`, p.titulo)), 540, 2 * 80 * 0.98 + 4, 44);
      const pil = canto.appendChild(novo("div", "pilula", `${id}-pilula`));
      pil.style.top = p.pilulaY + "px"; // no canto de cima, ou logo acima da legenda com as peças embaixo do queixo
      pil.appendChild(novo("span", "pilula-num", `${id}-pilula-numero`, String(p.numero)));
      const pt = pil.appendChild(novo("span", "pilula-titulo", `${id}-pilula-titulo`, p.titulo));
      const g = p.t + PECA.capitulo.grande;
      tl.fromTo(card, { opacity: 0, scale: 0.7, y: 40 }, { opacity: 1, scale: 1, y: 0, duration: 0.42, ease: "back.out(1.7)" }, p.t);
      // o cartão grande encolhe rumo ao canto e vira a pílula, que fica ali durante o capítulo (medidas no espaço do cartão, antes da escala)
      const meioY = p.y1 - (p.h * p.s) / 2, dx = (90 + pil.offsetWidth / 2 - 540) / p.s, dy = (p.pilulaY + 32 - meioY) / p.s;
      tl.to(card, { x: dx, y: dy, scale: 0.2, opacity: 0, duration: 0.38, ease: "power3.in" }, g);
      tl.fromTo(pil, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.3, ease: "back.out(2)" }, g + 0.3);
      // com outra peça ou frase na faixa de cima, a pílula encolhe para só o número e volta depois
      for (const [a, b] of p.encolhe) {
        tl.to(pt, { maxWidth: 0, marginLeft: 0, opacity: 0, duration: 0.25, ease: "power2.inOut" }, a);
        tl.to(pil, { paddingRight: 8, duration: 0.25, ease: "power2.inOut" }, a);
        if (b < p.pilula[1] - 0.3) {
          tl.to(pt, { maxWidth: 760, marginLeft: 14, opacity: 1, duration: 0.25, ease: "power2.inOut" }, b);
          tl.to(pil, { paddingRight: 28, duration: 0.25, ease: "power2.inOut" }, b);
        }
      }
      tl.to(pil, { opacity: 0, x: -24, duration: 0.25, ease: "power2.in" }, p.pilula[1]);
    },

    comenta(tl, p, corpo, id, K, canto, f) {
      corpo.classList.add("comenta");
      const Q = PECA.comenta, cha = corpo.appendChild(novo("div", "comenta-chamada", `${id}-chamada`));
      cha.appendChild(novo("span", "comenta-rotulo", `${id}-rotulo`, "COMENTA"));
      const pal = cha.appendChild(novo("span", "comenta-palavra", `${id}-palavra`, p.palavra));
      caber(pal, 440, 0, 36);
      const no = corpo.appendChild(novo("div", "notificacao", `${id}-notificacao`)), ic = no.appendChild(novo("div", "notificacao-icone", `${id}-notificacao-icone`));
      const s = svg(ic, "svg", `${id}-notificacao-desenho`, { width: 46, height: 46, viewBox: "0 0 64 64" });
      EC.ICONES.conversa.forEach((d, k) => svg(s, "path", `${id}-notificacao-traco-${k + 1}`, { d: d.replace(/^~/, ""), fill: "none", stroke: em(K.SOBRE_LINHA), "stroke-width": 4, "stroke-linecap": "round", "stroke-linejoin": "round" }));
      const tx = no.appendChild(novo("div", "notificacao-textos", `${id}-notificacao-textos`));
      caber(tx.appendChild(novo("div", "notificacao-nome", `${id}-notificacao-nome`, f.nome || "Mensagem")), 560, 0, 22);
      tx.appendChild(novo("div", "notificacao-linha", `${id}-notificacao-linha`, "nova mensagem"));
      const ba = corpo.appendChild(novo("div", "barra", `${id}-barra`)), tri = ba.appendChild(novo("div", "barra-trilho", `${id}-barra-trilho`));
      const cheia = tri.appendChild(novo("div", "barra-cheia", `${id}-barra-cheia`)), rot = ba.appendChild(novo("div", "barra-rotulo", `${id}-barra-rotulo`));
      const pct = rot.appendChild(novo("span", "barra-pct", `${id}-barra-pct`, "0%")), ok = rot.appendChild(novo("span", "barra-pronto", `${id}-barra-pronto`));
      const okc = svg(ok, "svg", `${id}-pronto-check`, { width: 34, height: 34, viewBox: "0 0 48 48" });
      svg(okc, "circle", `${id}-pronto-fundo`, { cx: 24, cy: 24, r: 23, fill: em(K.VERDE) });
      svg(okc, "path", `${id}-pronto-traco`, { d: "M14 25 L21 32 L35 17", fill: "none", stroke: "#fff", "stroke-width": 5, "stroke-linecap": "round", "stroke-linejoin": "round" });
      ok.appendChild(novo("span", "", `${id}-pronto-texto`, "PRONTO"));
      tl.fromTo(cha, { opacity: 0, scale: 0.6, y: 20 }, { opacity: 1, scale: 1, y: 0, duration: 0.35, ease: "back.out(2)" }, p.t);
      // a palavra acende: ganha a cor de destaque e um brilho em volta
      const a = p.t + Q.acende, L = em(K.LINHA, 0.3);
      tl.fromTo(pal, { backgroundColor: em(K.FORTE), color: em(K.TEXTO), boxShadow: `0 0 0 0px ${L}` }, { backgroundColor: em(K.LINHA), color: em(K.SOBRE_LINHA), boxShadow: `0 0 0 16px ${L}`, duration: 0.2, ease: "power2.out" }, a);
      tl.to(pal, { boxShadow: `0 0 0 6px ${L}`, duration: 0.3, ease: "power2.inOut" }, a + 0.2);
      tl.fromTo(pal, { scale: 1 }, { scale: 1.12, duration: 0.1, ease: "power2.out", immediateRender: false }, a);
      tl.to(pal, { scale: 1, duration: 0.2, ease: "power2.inOut" }, a + 0.1);
      // desce a notificação de mensagem e a barra enche até "pronto"
      tl.fromTo(no, { opacity: 0, y: -70 }, { opacity: 1, y: 0, duration: 0.38, ease: "power3.out" }, p.t + Q.notifica - 0.05);
      tl.fromTo(ba, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: "none" }, p.t + Q.enche[0] - 0.2);
      const dur = Q.enche[1] - Q.enche[0], conta = { v: 0 };
      tl.fromTo(cheia, { scaleX: 0 }, { scaleX: 1, duration: dur, ease: "power1.inOut" }, p.t + Q.enche[0]);
      tl.fromTo(conta, { v: 0 }, { v: 100, duration: dur, ease: "power1.inOut", onUpdate: () => (pct.textContent = Math.round(conta.v) + "%") }, p.t + Q.enche[0]);
      tl.set(pct, { opacity: 0 }, p.t + Q.enche[1]);
      tl.fromTo(ok, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.25, ease: "back.out(2.5)" }, p.t + Q.enche[1]);
      tl.to(corpo, { opacity: 0, y: -20, duration: 0.22, ease: "power2.in" }, p.sai);
    },

    objeto(tl, p, corpo, id) {
      // 3D: o PNG do Fluent Emoji. Sóbrio: o SVG do Phosphor num disco branco, com o traço no escuro da marca e a forma de
      // trás no destaque (as cores do CSS); a mesma entrada, com pulo, sombra e boia
      let img;
      if (p.svg) { img = corpo.appendChild(novo("div", "objeto-disco", `${id}-disco`)); img.innerHTML = p.svg; img.firstElementChild.id = `${id}-icone`; img.setAttribute("aria-label", p.objeto); }
      else { img = corpo.appendChild(novo("img", "objeto-img", `${id}-img`)); img.src = p.arquivo; img.alt = p.objeto; }
      const sombra = corpo.appendChild(novo("div", "objeto-sombra", `${id}-sombra`));
      // entra com um pulo (back.out: passa do ponto e volta, perto de PECA.objeto.pousa) e boia de leve enquanto fica
      tl.fromTo(img, { opacity: 0, y: 110, scale: 0.35 }, { opacity: 1, y: 0, scale: 1, duration: 0.42, ease: "back.out(2.4)" }, p.t);
      tl.fromTo(sombra, { opacity: 0, scaleX: 0.3 }, { opacity: 0.55, scaleX: 1, duration: 0.42, ease: "power2.out" }, p.t);
      const boia = p.sai - p.t - 0.45;
      if (boia > 0.4) tl.to(img, { y: -10, duration: boia / 2, ease: "sine.inOut", yoyo: true, repeat: 1 }, p.t + 0.45);
      tl.to([img, sombra], { opacity: 0, scale: 0.6, duration: 0.22, ease: "power2.in" }, p.sai);
    },

    app(tl, p, corpo, id, K) {
      const anel = svg(corpo, "svg", `${id}-anel`, { class: "app-anel", width: PECA.app.w, height: PECA.app.h, viewBox: `0 0 ${PECA.app.w} ${PECA.app.h}` });
      svg(anel, "ellipse", `${id}-anel-traco`, { cx: 380, cy: 150, rx: 320, ry: 84, fill: "none", stroke: "rgba(255,255,255,.7)", "stroke-width": 4, "stroke-dasharray": "3 16", "stroke-linecap": "round" });
      const ladrilho = (pai, a, tam, nid) => {
        const t = pai.appendChild(novo("div", "app-tile", nid));
        Object.assign(t.style, { width: tam + "px", height: tam + "px", left: -tam / 2 + "px", top: -tam / 2 + "px", borderRadius: tam * 0.24 + "px" });
        if (a.arquivo) { const i = t.appendChild(novo("img", "", `${nid}-logo`)); i.src = a.arquivo; i.alt = a.app; }
        else {
          const s = svg(t, "svg", `${nid}-desenho`, { width: tam * 0.6, height: tam * 0.6, viewBox: "0 0 64 64" });
          NEUTROS[a.desenho].forEach((d, k) => svg(s, "path", `${nid}-traco-${k + 1}`, { d: d.replace(/^~/, ""), fill: "none", stroke: em(d.startsWith("~") ? K.DETALHE : K.LINHA), "stroke-width": 4, "stroke-linecap": "round", "stroke-linejoin": "round" }));
        }
        return t;
      };
      // o primeiro aplicativo citado no meio; os outros, menores, giram na órbita (com um só, três pontos giram nela)
      const centro = corpo.appendChild(novo("div", "app-orbita", `${id}-centro`));
      centro.style.transform = "none";
      const t0 = ladrilho(centro, p.apps[0], 160, `${id}-app-1`), giram = [];
      const outros = p.apps.slice(1), n = outros.length || 3;
      for (let k = 0; k < n; k++) {
        const o = corpo.appendChild(novo("div", "app-orbita", `${id}-orbita-${k + 1}`));
        o.style.setProperty("--a", 90 + (360 * k) / n);
        giram.push(o);
        if (outros[k]) tl.fromTo(ladrilho(o, outros[k], 104, `${id}-app-${k + 2}`), { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, duration: 0.3, ease: "back.out(2.4)" }, outros[k].t);
        else tl.fromTo(o.appendChild(novo("div", "app-ponto", `${id}-ponto-${k + 1}`)), { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "none" }, p.t + 0.2);
      }
      giram.forEach((o, k) => tl.fromTo(o, { "--a": 90 + (360 * k) / n }, { "--a": 90 + (360 * k) / n + 120, duration: Math.max(0.1, p.sai - p.t), ease: "none" }, p.t));
      tl.fromTo(anel, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.35, ease: "power3.out" }, p.t);
      tl.fromTo(t0, { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(2.4)" }, p.apps[0].t);
      tl.to(corpo, { opacity: 0, scale: 0.9, duration: 0.22, ease: "power2.in" }, p.sai);
    },

    janela(tl, p, corpo, id) {
      const w = corpo.appendChild(novo("div", "janela", `${id}-janela`)), b = w.appendChild(novo("div", "janela-barra", `${id}-barra`));
      ["#FF5F57", "#FEBC2E", "#28C840"].forEach((c, k) => { b.appendChild(novo("span", "janela-ponto", `${id}-ponto-${k + 1}`)).style.background = c; });
      const end = b.appendChild(novo("div", "janela-endereco", `${id}-endereco`, p.endereco || ""));
      if (!p.endereco) end.style.visibility = "hidden";
      else caber(end, end.clientWidth, 0, 20); // endereço de 40 letras largas encolhe para caber na barra (scrollWidth e clientWidth contam o recuo)
      const tela = w.appendChild(novo("div", "janela-tela", `${id}-tela`)), img = tela.appendChild(novo("img", "", `${id}-print`));
      img.src = p.arquivo;
      img.alt = "print";
      img.setAttribute("data-layout-allow-overflow", ""); // o print cresce 5% devagar dentro da janela, de propósito
      tl.fromTo(w, { opacity: 0, scale: 0.82, y: 50 }, { opacity: 1, scale: 1, y: 0, duration: 0.42, ease: "power3.out" }, p.t);
      tl.fromTo(img, { scale: 1 }, { scale: 1.05, duration: Math.max(0.1, p.sai - p.t), ease: "none" }, p.t);
      tl.to(w, { opacity: 0, scale: 0.94, duration: 0.22, ease: "power2.in" }, p.sai);
    },

    esquema(tl, p, corpo, id, K) {
      const e = corpo.appendChild(novo("div", "esquema", `${id}-esquema`)), n = p.vagas.length;
      const POS = { 2: [[0, 115], [610, 115]], 3: [[0, 40], [0, 190], [610, 115]], 4: [[0, 40], [610, 40], [0, 190], [610, 190]] }[n];
      const linhas = svg(e, "svg", `${id}-linhas`, { width: 900, height: 330, viewBox: "0 0 900 330", style: "position:absolute;left:0;top:0" });
      const vagas = POS.map(([x, y], k) => {
        const v = e.appendChild(novo("div", "vaga", `${id}-vaga-${k + 1}`));
        Object.assign(v.style, { left: x + "px", top: y + "px" });
        const ch = v.appendChild(novo("div", "vaga-cheia", `${id}-vaga-${k + 1}-cheia`)), tx = ch.appendChild(novo("div", "vaga-texto", `${id}-vaga-${k + 1}-texto`, p.vagas[k]));
        caber(tx, 256, 86, 24);
        const xi = x ? x : x + 290, yi = y + 50, d = `M450 165 C${(450 + xi) / 2} 165 ${(450 + xi) / 2} ${yi} ${xi} ${yi}`;
        return { v, ch, l: traco(linhas, `${id}-linha-${k + 1}`, d, "#fff", 5) };
      });
      const c = e.appendChild(novo("div", "esquema-meio", `${id}-meio`)).appendChild(novo("div", "esquema-centro", `${id}-centro`));
      caber(c.appendChild(novo("div", "esquema-centro-texto", `${id}-centro-texto`, p.centro)), 242, 130, 24); // palavra longa encolhe, não quebra no meio
      tl.fromTo(c, { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.38, ease: "back.out(2)" }, p.t);
      vagas.forEach(({ v, ch, l }, k) => {
        tl.fromTo(v, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.25, ease: "power2.out" }, p.t + 0.15 + 0.06 * k);
        // a linha sai do centro quando a vaga é dita e a vaga se preenche quando a linha chega (PECA.esquema.liga, o pico do som)
        tl.to(l, { strokeDashoffset: 0, duration: PECA.esquema.liga, ease: "power2.inOut" }, p.batidas[k]);
        tl.fromTo(ch, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.25, ease: "back.out(2)" }, p.batidas[k] + PECA.esquema.liga);
      });
      tl.to(e, { opacity: 0, duration: 0.22, ease: "power2.in" }, p.sai);
    },
  };

  // As peças do plano em #pecas (acima da cabeça ou embaixo do queixo) e a pílula do capítulo em #pecas-canto. f: { titulo, cond, condPeso, nome }
  function montar(tl, lista, c, f) {
    const K = preparar(c, f), host = document.getElementById("pecas"), canto = document.getElementById("pecas-canto"), imgs = [];
    lista.forEach((p, n) => {
      const id = `peca-${n + 1}`, W = PECA[p.tipo].w, fora = host.appendChild(novo("div", "peca", id));
      Object.assign(fora.style, { left: 540 - W / 2 + "px", top: p.y1 - p.h + "px", width: W + "px", height: p.h + "px", transform: `scale(${p.s})` });
      const corpo = fora.appendChild(novo("div", "peca-corpo", `${id}-corpo`));
      DESENHO[p.tipo](tl, p, corpo, id, K, canto, f);
      imgs.push(...fora.querySelectorAll("img"));
    });
    // a HyperFrames espera as imagens antes de gravar o primeiro quadro
    window.__hf = window.__hf || {};
    window.__hf.buildReady = window.__hf.buildReady || {};
    window.__hf.buildReady["editor-chefe-pecas"] = Promise.all(imgs.map((i) => i.decode().catch(() => {})));
  }

  // Legenda de uma palavra por vez, em caixa alta e na letra condensada, na altura do peito (#legenda), fora dos intervalos
  // em "fora" (a frase ou peça embaixo do queixo) e acima da cabeça nos intervalos de "noAlto" (a janela embaixo do queixo);
  // a palavra-chave na cor de destaque, com um leve impulso. Os grupos e os tempos vêm de EC.palavraPorVez (testados no Node).
  function legenda(tl, pal, chaves, total, fora = [], noAlto = []) {
    const host = document.getElementById("legenda"), larg = host.clientWidth;
    // durante a janela embaixo do queixo, a caixa da legenda sobe para acima da cabeça ([de, ate, y], y o alto da caixa)
    for (const [a, b, y] of noAlto) { tl.set(host, { y: y - host.offsetTop }, a); tl.set(host, { y: 0 }, b); }
    EC.palavraPorVez(pal, chaves, total, fora).forEach((g, i) => {
      const el = host.appendChild(novo("div", g.chave ? "palavra chave" : "palavra", `palavra-${i + 1}`)), s = el.appendChild(novo("span", "", `palavra-${i + 1}-texto`, g.txt));
      s.dataset.t = g.txt;
      caber(el, larg, 0, 70);
      if (g.chave) tl.fromTo(el, { opacity: 0, scale: 1.25 }, { opacity: 1, scale: 1, duration: 0.18, ease: "back.out(3)" }, g.ini);
      else tl.fromTo(el, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.08, ease: "power2.out" }, g.ini);
      // sai do layout, e não só fica transparente: na gravação rápida da HyperFrames (vídeo de 900 quadros ou mais) a palavra
      // que cresceu com scale ficava numa camada própria com a pintura velha, e aparecia por trás da seguinte
      tl.set(el, { opacity: 0, display: "none" }, g.sai);
    });
  }

  raiz.EditorChefePecas = { montar, legenda, NEUTROS };
})(this);
