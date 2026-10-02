/* ads-guard.js — BuscaElétrico
 *
 * Mantém o AdSense discreto em todas as páginas de conteúdo:
 *
 * 1. Bloco manual único por página (<div class="ad-slot"></div>), sempre no
 *    fim do conteúdo, com o rótulo "Publicidade", espaço reservado (evita o
 *    conteúdo "pular" quando o anúncio carrega) e colapso automático quando o
 *    Google não tem anúncio para mostrar. Enquanto BE_ADS.slot estiver vazio
 *    o bloco nem aparece — nenhum espaço em branco na página.
 * 2. O anúncio só é pedido quando o leitor chega perto do fim da página
 *    (IntersectionObserver), então não pesa no carregamento inicial.
 * 3. Se o Google exibir um anúncio-âncora (faixa fixa no rodapé da tela),
 *    a barra "Calcular ranking" e o rodapé do site sobem a mesma altura,
 *    em vez de ficarem cobertos por ele.
 *
 * Para ativar os blocos manuais: crie no painel do AdSense um bloco de
 * "Anúncio de display" responsivo e cole o número dele em BE_ADS.slot.
 */
(function () {
  "use strict";

  var BE_ADS = {
    client: "ca-pub-5861836196723250",
    slot: "" // ex.: "1234567890" — ID do bloco de display criado no painel
  };

  var css =
    ".ad-slot{display:none;max-width:900px;margin:40px auto 8px;padding:22px 0 0;position:relative;border-top:1px solid #d9e4ef;min-height:120px}" +
    ".ad-slot.ad-on{display:block}" +
    ".ad-slot::before{content:'Publicidade';position:absolute;top:4px;left:0;font:600 11px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#64778c}" +
    ".ad-slot:has(ins[data-ad-status='unfilled']){display:none}" +
    "@media(max-width:640px){.ad-slot{min-height:280px;margin-top:32px}}" +
    ":root{--be-anchor-h:0px}" +
    ".calc-bar{transform:translateY(calc(-1 * var(--be-anchor-h)))}" +
    ".site-footer{margin-bottom:var(--be-anchor-h)}";
  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  function pedirAnuncio(slotEl) {
    var ins = document.createElement("ins");
    ins.className = "adsbygoogle";
    ins.style.display = "block";
    ins.setAttribute("data-ad-client", BE_ADS.client);
    ins.setAttribute("data-ad-slot", BE_ADS.slot);
    ins.setAttribute("data-ad-format", "auto");
    ins.setAttribute("data-full-width-responsive", "true");
    slotEl.appendChild(ins);
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
  }

  function iniciarBlocos() {
    if (!BE_ADS.slot) return; // sem ID configurado: nenhum bloco, nenhum espaço vazio
    var slots = document.querySelectorAll(".ad-slot");
    if (!slots.length) return;
    // Uma página = no máximo um bloco manual.
    var slotEl = slots[0];
    for (var i = 1; i < slots.length; i++) slots[i].remove();
    slotEl.classList.add("ad-on");
    if (!("IntersectionObserver" in window)) { pedirAnuncio(slotEl); return; }
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) {
        io.disconnect();
        pedirAnuncio(slotEl);
      }
    }, { rootMargin: "600px 0px" });
    io.observe(slotEl);
  }

  // Âncora no rodapé da tela: mede a altura e empurra os elementos fixos.
  function medirAncora() {
    var h = 0;
    var ancoras = document.querySelectorAll("ins.adsbygoogle[data-anchor-status]");
    for (var i = 0; i < ancoras.length; i++) {
      var a = ancoras[i];
      if (a.getAttribute("data-anchor-status") !== "displayed") continue;
      var r = a.getBoundingClientRect();
      if (r.height > 0 && r.top > window.innerHeight / 2) h = Math.max(h, Math.round(r.height));
    }
    document.documentElement.style.setProperty("--be-anchor-h", h + "px");
  }

  function iniciarGuardaAncora() {
    var agendado = false;
    var mo = new MutationObserver(function () {
      if (agendado) return;
      agendado = true;
      requestAnimationFrame(function () { agendado = false; medirAncora(); });
    });
    mo.observe(document.body, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ["data-anchor-status", "style"]
    });
    window.addEventListener("resize", medirAncora);
  }

  function iniciar() { iniciarBlocos(); iniciarGuardaAncora(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
