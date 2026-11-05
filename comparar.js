/* BuscaElétrico — lista de comparação compartilhada entre as páginas.
 *
 * Guarda até 4 carros no localStorage ("be_comparar_v1"). Como o portal de
 * abas e as páginas avulsas ficam no mesmo domínio, a lista é a mesma em
 * todas elas; o evento "storage" mantém as abas abertas sincronizadas.
 *
 * Uso nas páginas:
 *   BEComparar.btn(item)  -> HTML de um botão "+ Comparar" (estado já certo)
 *   item = { id, nome, marca, modelo, versao, ano, cat, fipe, origem, calc? }
 *   id: "f:<codigo_fipe>" (carro do mercado/FIPE) ou
 *       "s:<marca|modelo|versao|ano>" (versão da ficha técnica).
 */
(function () {
  "use strict";
  if (window.BEComparar) return;

  var KEY = "be_comparar_v1";
  var MAX = 4;
  var naPaginaComparar = /(^|\/)(tab-)?comparar\.html$/.test(location.pathname);

  function normalize(s) {
    return (s == null ? "" : String(s)).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  }
  function esc(s) {
    return (s == null ? "" : String(s)).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function load() {
    try {
      var a = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(a) ? a.filter(function (x) { return x && x.id; }).slice(0, MAX) : [];
    } catch (e) { return []; }
  }
  var lista = load();

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(lista)); } catch (e) {}
    emit();
  }

  var ouvintes = [];
  function emit() {
    atualizarBotoes();
    renderTray();
    ouvintes.forEach(function (fn) { try { fn(lista.slice()); } catch (e) { console.error(e); } });
  }

  window.addEventListener("storage", function (e) {
    if (e.key !== KEY) return;
    lista = load();
    emit();
  });

  function idSpec(marca, modelo, versao, ano) {
    return "s:" + [marca, modelo, versao, ano].map(normalize).join("|");
  }
  function idFipe(fipe, nome, cat) {
    return fipe ? "f:" + String(fipe).trim() : "n:" + normalize(nome) + "|" + (cat || "");
  }

  function has(id) { return lista.some(function (x) { return x.id === id; }); }

  function add(item) {
    if (!item || !item.id) return { ok: false, motivo: "invalido" };
    if (has(item.id)) return { ok: true, jaEstava: true };
    if (lista.length >= MAX) return { ok: false, motivo: "cheio" };
    item.adicionadoEm = new Date().toISOString();
    lista.push(item);
    save();
    return { ok: true };
  }
  function remove(id) {
    var antes = lista.length;
    lista = lista.filter(function (x) { return x.id !== id; });
    if (lista.length !== antes) save();
  }
  function clear() { lista = []; save(); }
  function set(arr) { lista = (arr || []).filter(function (x) { return x && x.id; }).slice(0, MAX); save(); }

  // Atualiza o "custo real" guardado dos carros que já estão na comparação
  // quando o usuário recalcula o ranking (map: id -> calc).
  function updateCalc(map) {
    var mudou = false;
    lista.forEach(function (x) {
      if (map[x.id]) { x.calc = map[x.id]; mudou = true; }
    });
    if (mudou) save();
  }

  // ---- Botão -------------------------------------------------------------
  function btn(item, extraClass) {
    if (!item || !item.id) return "";
    var on = has(item.id);
    return '<button type="button" class="be-cmp-btn' + (on ? " on" : "") + (extraClass ? " " + extraClass : "") +
      '" data-cmp="' + esc(JSON.stringify(item)) + '" aria-pressed="' + on + '" title="' +
      (on ? "Remover da comparação" : "Adicionar à comparação de carros") + '">' +
      (on ? "✓ Comparando" : "+ Comparar") + "</button>";
  }

  function atualizarBotoes() {
    var bs = document.querySelectorAll("[data-cmp]");
    for (var i = 0; i < bs.length; i++) {
      var b = bs[i], item;
      try { item = JSON.parse(b.getAttribute("data-cmp")); } catch (e) { continue; }
      var on = has(item.id);
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", String(on));
      b.title = on ? "Remover da comparação" : "Adicionar à comparação de carros";
      b.textContent = on ? "✓ Comparando" : "+ Comparar";
    }
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-cmp]");
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    var item;
    try { item = JSON.parse(b.getAttribute("data-cmp")); } catch (err) { return; }
    // O item pode ter ganho dados mais novos (ex.: custo recalculado) — usa o
    // que veio no botão se o carro ainda não estiver na lista.
    if (has(item.id)) {
      remove(item.id);
      toast("Removido da comparação.");
      return;
    }
    if (typeof window.BECompararEnriquecer === "function") {
      try { item = window.BECompararEnriquecer(item) || item; } catch (err) {}
    }
    var r = add(item);
    if (!r.ok && r.motivo === "cheio") {
      toast("A comparação já tem " + MAX + " carros. Remova um para adicionar outro.", true);
    } else if (r.ok) {
      toast((item.nome || "Carro") + " adicionado à comparação.", true);
    }
  }, true);

  // ---- Ir para a página de comparação ------------------------------------
  function abrirComparacao() {
    if (window.self !== window.top) {
      // Dentro do portal de abas: troca para a aba "Comparar".
      window.parent.postMessage({ portalTab: "comparar", search: "" }, "*");
    } else {
      location.href = "comparar.html";
    }
  }

  // ---- Bandeja flutuante + aviso -----------------------------------------
  var css =
    ".be-cmp-btn{appearance:none;font:inherit;font-size:12px;font-weight:700;line-height:1;cursor:pointer;" +
      "border:1px solid #b9d4f4;background:#fff;color:#0a3e91;border-radius:999px;padding:7px 11px;white-space:nowrap;" +
      "transition:background .15s,border-color .15s,color .15s}" +
    ".be-cmp-btn:hover{border-color:#1264d8;background:#e9f2ff}" +
    ".be-cmp-btn.be-cmp-mini{font-size:11px;padding:4px 8px;margin-left:4px}" +
    ".be-cmp-btn.on{background:#1264d8;border-color:#1264d8;color:#fff}" +
    ".be-cmp-btn:focus-visible{outline:2px solid #1264d8;outline-offset:2px}" +
    ".be-cmp-tray{position:fixed;right:16px;bottom:calc(16px + var(--be-cmp-offset,0px) + var(--be-anchor-h,0px));z-index:250;" +
      "display:flex;align-items:center;gap:8px;background:#0a3e91;color:#fff;border-radius:999px;padding:6px 6px 6px 14px;" +
      "box-shadow:0 10px 28px rgba(10,40,90,.28);font:600 13px/1.2 -apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,Arial,sans-serif}" +
    ".be-cmp-tray[hidden]{display:none}" +
    ".be-cmp-tray .n{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;border-radius:999px;background:#fff;color:#0a3e91;font-weight:800;font-size:12px;margin-left:2px}" +
    ".be-cmp-tray button{appearance:none;border:0;font:inherit;cursor:pointer;border-radius:999px}" +
    ".be-cmp-tray .go{background:#fff;color:#0a3e91;font-weight:800;padding:8px 13px}" +
    ".be-cmp-tray .go:hover{background:#e9f2ff}" +
    ".be-cmp-toast{position:fixed;left:50%;bottom:calc(76px + var(--be-cmp-offset,0px) + var(--be-anchor-h,0px));transform:translateX(-50%) translateY(10px);opacity:0;" +
      "z-index:260;background:#0b2036;color:#fff;padding:10px 14px;border-radius:12px;font:600 13px/1.35 -apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,Arial,sans-serif;" +
      "width:max-content;max-width:min(92vw,440px);display:flex;gap:14px;align-items:center;justify-content:space-between;transition:opacity .2s,transform .2s;pointer-events:none}" +
    ".be-cmp-toast.show{opacity:1;transform:translateX(-50%) translateY(0);pointer-events:auto}" +
    ".be-cmp-toast span{flex:1 1 auto;min-width:0}" +
    ".be-cmp-toast a{color:#9cc8ff;font-weight:800;white-space:nowrap;cursor:pointer;text-decoration:underline}" +
    "@media print{.be-cmp-tray,.be-cmp-toast,.be-cmp-btn{display:none!important}}";

  var tray, toastEl, toastTimer;

  function montar() {
    var st = document.createElement("style");
    st.textContent = css;
    document.head.appendChild(st);

    // Na página do Custo Real a barra "Calcular ranking" fica presa no rodapé;
    // a bandeja sobe para não cobrir o botão.
    if (document.querySelector(".calc-bar")) {
      document.documentElement.style.setProperty("--be-cmp-offset", "72px");
    }

    if (!naPaginaComparar) {
      tray = document.createElement("div");
      tray.className = "be-cmp-tray";
      tray.setAttribute("role", "region");
      tray.setAttribute("aria-label", "Comparação de carros");
      tray.hidden = true;
      document.body.appendChild(tray);
      tray.addEventListener("click", function (e) {
        if (e.target.closest(".go")) abrirComparacao();
      });
    }

    toastEl = document.createElement("div");
    toastEl.className = "be-cmp-toast";
    toastEl.setAttribute("role", "status");
    toastEl.setAttribute("aria-live", "polite");
    document.body.appendChild(toastEl);
    toastEl.addEventListener("click", function (e) {
      if (e.target.closest("a")) { e.preventDefault(); abrirComparacao(); }
    });

    renderTray();
    atualizarBotoes();
  }

  function renderTray() {
    if (!tray) return;
    var n = lista.length;
    tray.hidden = n === 0;
    tray.innerHTML = '<span>Comparação <span class="n">' + n + "</span></span>" +
      '<button type="button" class="go">Comparar →</button>';
  }

  function toast(msg, comLink) {
    if (!toastEl) return;
    toastEl.innerHTML = "<span>" + esc(msg) + "</span>" +
      (comLink && !naPaginaComparar && lista.length ? '<a href="comparar.html">Ver comparação</a>' : "");
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 3200);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montar);
  else montar();

  window.BEComparar = {
    MAX: MAX,
    list: function () { return lista.slice(); },
    has: has, add: add, remove: remove, clear: clear, set: set,
    updateCalc: updateCalc,
    btn: btn, idSpec: idSpec, idFipe: idFipe, normalize: normalize,
    onChange: function (fn) { ouvintes.push(fn); },
    abrir: abrirComparacao, toast: toast,
  };
})();
