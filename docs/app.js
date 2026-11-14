(function () {
  "use strict";

  var CFG = window.LISTA_CONFIG || {};
  var estado = { produtos: [], reservados: new Set(), meus: new Set(lerMeus()), filtro: "todos", atual: null, backendOk: null };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // ---------- utilidades ----------
  function el(tag, attrs, filhos) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "class") n.className = attrs[k];
      else if (k === "text") n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (filhos || []).forEach(function (f) { if (f) n.appendChild(typeof f === "string" ? document.createTextNode(f) : f); });
    return n;
  }
  function icone(nome) {
    var ns = "http://www.w3.org/2000/svg";
    var s = document.createElementNS(ns, "svg"); s.setAttribute("class", "i");
    var u = document.createElementNS(ns, "use"); u.setAttribute("href", "#i-" + nome);
    s.appendChild(u); return s;
  }
  function preco(v) {
    if (v === null || v === undefined || v === "" || isNaN(Number(v))) return "";
    return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  function lerMeus() { try { return JSON.parse(localStorage.getItem("lista:meus") || "[]"); } catch (e) { return []; } }
  function marcarMeu(id) { estado.meus.add(id); try { localStorage.setItem("lista:meus", JSON.stringify(Array.from(estado.meus))); } catch (e) {} }
  function lembrarNome(v) { try { if (v) localStorage.setItem("lista:nome", v); } catch (e) {} }
  function nomeLembrado() { try { return localStorage.getItem("lista:nome") || ""; } catch (e) { return ""; } }

  // ---------- textos do topo ----------
  function textos() {
    var t = (CFG.titulo || "Nosso cantinho novo").trim();
    var i = t.lastIndexOf(" ");
    var h1 = $("#titulo");
    if (i > 0) { h1.appendChild(document.createTextNode(t.slice(0, i + 1))); h1.appendChild(el("em", { text: t.slice(i + 1) })); }
    else h1.textContent = t;
    document.title = t + " · Lista de presentes";
    $("#etiqueta").textContent = CFG.etiqueta || "Chá de casa nova";
    $("#mensagem").textContent = CFG.mensagem || "";
  }

  // ---------- backend (Google Apps Script) ----------
  function api(dados) {
    if (!CFG.urlBackend) return Promise.reject({ codigo: "sem_backend" });
    var req = dados
      ? fetch(CFG.urlBackend, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(dados) })
      : fetch(CFG.urlBackend + (CFG.urlBackend.indexOf("?") < 0 ? "?" : "&") + "acao=lista&t=" + Date.now());
    return req.then(function (r) { if (!r.ok) throw { codigo: "http_" + r.status }; return r.json(); });
  }
  function carregarReservas() {
    if (!CFG.urlBackend) { estado.backendOk = false; aviso("As reservas ainda não foram ativadas pelos anfitriões. Você já pode ver os presentes."); return Promise.resolve(); }
    return api(null).then(function (r) {
      estado.reservados = new Set((r && r.reservados) || []);
      estado.backendOk = true; aviso(""); render();
    }).catch(function () {
      estado.backendOk = false;
      aviso("Não conseguimos verificar as reservas agora. Atualize a página em instantes.");
    });
  }
  function aviso(txt) { var a = $("#aviso"); a.textContent = txt; a.hidden = !txt; }

  // ---------- produtos ----------
  function carregarProdutos() {
    return fetch("produtos.json?t=" + Date.now()).then(function (r) { return r.json(); })
      .then(function (lista) { estado.produtos = Array.isArray(lista) ? lista.filter(function (p) { return p && p.id && p.nome; }) : []; })
      .catch(function () { estado.produtos = []; });
  }

  function cartao(p) {
    var res = estado.reservados.has(p.id);
    var ph = el("div", { class: "ph" });
    if (p.imagem) {
      var img = el("img", { src: p.imagem, alt: p.nome, loading: "lazy", referrerpolicy: "no-referrer" });
      img.onerror = function () { img.remove(); ph.appendChild(el("span", { class: "sem" }, [icone("gift")])); };
      ph.appendChild(img);
    } else ph.appendChild(el("span", { class: "sem" }, [icone("gift")]));
    ph.appendChild(res
      ? el("span", { class: "badge own" }, [icone("lock"), "Tem dono"])
      : el("span", { class: "badge av" }, [el("i"), "Disponível"]));
    if (p.importado !== false && p.link) ph.appendChild(el("span", { class: "imp" }, [icone("link"), "Importado do anúncio"]));

    var cb = el("div", { class: "cb" }, [el("h3", { text: p.nome })]);
    if (p.descricao) cb.appendChild(el("p", { text: p.descricao }));
    if (preco(p.preco)) cb.appendChild(el("div", { class: "price" }, [el("b", { text: preco(p.preco) }), el("span", { text: "valor de referência" })]));

    if (res) {
      cb.appendChild(el("div", { class: "resbox" }, [
        el("span", { class: "ic" }, [icone("check")]),
        estado.meus.has(p.id)
          ? el("div", null, [el("b", { text: "Reservado por você" }), el("span", { text: "Obrigado pelo carinho!" })])
          : el("div", null, [el("b", { text: "Reservado por outra pessoa" }), el("span", { text: "Este presente já foi escolhido" })])
      ]));
    } else {
      var b1 = el("button", { class: "btn pri", type: "button" }, [icone("gift"), "Reservar presente"]);
      var b2 = el("button", { class: "btn sec", type: "button" }, [icone("qr"), "Contribuir via Pix"]);
      b1.addEventListener("click", function () { abrirReserva(p); });
      b2.addEventListener("click", function () { abrirPix(p); });
      cb.appendChild(el("div", { class: "acoes" }, [b1, b2]));
    }
    return el("article", { class: "card" + (res ? " res" : "") }, [ph, cb]);
  }

  function render() {
    var g = $("#grade"); g.textContent = "";
    var total = estado.produtos.length;
    var livres = estado.produtos.filter(function (p) { return !estado.reservados.has(p.id); }).length;
    $("#contagem").textContent = total ? (livres === 1 ? "1 de " + total + " ainda disponível" : livres + " de " + total + " ainda disponíveis") : "";
    var lista = estado.produtos.filter(function (p) {
      var r = estado.reservados.has(p.id);
      return estado.filtro === "todos" || (estado.filtro === "reservados" ? r : !r);
    });
    lista.forEach(function (p) { g.appendChild(cartao(p)); });
    $("#vazio").hidden = total > 0;
    if (total > 0 && lista.length === 0) g.appendChild(el("p", { class: "vazio", text: estado.filtro === "reservados" ? "Nenhum presente reservado ainda." : "Todos os presentes já têm dono. Que tal contribuir via Pix?" }));
  }

  // ---------- modais ----------
  function preencherItem(box, p) {
    box.textContent = "";
    if (!p) return;
    if (p.imagem) box.appendChild(el("img", { src: p.imagem, alt: "", referrerpolicy: "no-referrer" }));
    box.appendChild(el("div", null, [el("b", { text: p.nome }), preco(p.preco) ? el("span", { text: "Valor de referência: " + preco(p.preco) }) : null]));
  }
  function erro(form, txt) { var e = $("[data-erro]", form); e.textContent = txt || ""; e.hidden = !txt; }
  function mensagemErro(e) {
    if (e && e.codigo === "sem_backend") return "As reservas ainda não foram ativadas pelos anfitriões.";
    if (e && e.codigo === "ja_reservado") return "Poxa, alguém acabou de reservar este presente. Escolha outro ou contribua via Pix.";
    return "Não foi possível concluir agora. Verifique sua conexão e tente de novo.";
  }

  function abrirReserva(p) {
    estado.atual = p;
    var m = $("#modalReserva"), f = $("#formReserva");
    preencherItem($("[data-item]", f), p);
    var a = $("#mrAnuncio");
    if (p.link) { a.href = p.link; a.hidden = false; } else a.hidden = true;
    $$(".opt", f).forEach(function (o) { o.classList.toggle("on", o.dataset.modo === "comprar"); });
    f.nome.value = nomeLembrado();
    erro(f, "");
    m.showModal();
  }

  function abrirPix(p) {
    estado.atual = p || null;
    var m = $("#modalPix"), f = $("#formPix");
    preencherItem($("[data-item]", f), p);
    $("#mpTitulo").textContent = p ? "Contribuir via Pix" : "Contribuir com um valor livre";
    var chave = CFG.pix && (CFG.pix.chave || CFG.pix.imagemQr);
    $("[data-pix-ok]", f).hidden = !chave;
    $("[data-pix-off]", f).hidden = !!chave;
    if (chave) {
      $("#mpChave").textContent = CFG.pix.chave || "";
      $(".keyrow", f).hidden = $(".orlbl", f).hidden = !CFG.pix.chave;
      $("#mpSugerido").textContent = p && preco(p.preco) ? "Valor do presente: " + preco(p.preco) : "";
      if (CFG.pix.imagemQr) { var q = $("#qr"); q.textContent = ""; q.appendChild(el("img", { src: CFG.pix.imagemQr, alt: "QR Code Pix" })); }
      else desenharQr(codigoPix());
    }
    $("[data-so-item]", f).hidden = !p;
    f.reservar.checked = false;
    f.nome.value = nomeLembrado();
    erro(f, "");
    m.showModal();
  }

  $$("[data-fechar]").forEach(function (b) { b.addEventListener("click", function () { b.closest("dialog").close(); }); });

  // Fechar ao clicar fora
  $$(".modal").forEach(function (m) {
    m.addEventListener("click", function (e) { if (e.target === m) m.close(); });
  });

  // Alternar para Pix dentro do modal de reserva
  $$("#formReserva .opt").forEach(function (o) {
    o.addEventListener("click", function () {
      if (o.dataset.modo === "pix") { var p = estado.atual; $("#modalReserva").close(); abrirPix(p); }
    });
  });

  $("#formReserva").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var f = ev.target, p = estado.atual, nome = f.nome.value.trim();
    if (!nome) { erro(f, "Conte pra gente o seu nome."); f.nome.focus(); return; }
    var bt = $("[data-enviar]", f); bt.disabled = true; erro(f, "");
    api({ acao: "reservar", id: p.id, presente: p.nome, nome: nome })
      .then(function (r) {
        if (!r || !r.ok) throw { codigo: (r && r.erro) || "falha" };
        lembrarNome(nome); marcarMeu(p.id);
        estado.reservados.add(p.id); render();
        $("#modalReserva").close();
        toast("Reservado com sucesso", "Presente reservado com sucesso. Obrigado pelo carinho!", r.telegram);
      })
      .catch(function (e) {
        erro(f, mensagemErro(e));
        if (e && e.codigo === "ja_reservado") { estado.reservados.add(p.id); render(); }
      })
      .then(function () { bt.disabled = false; });
  });

  $("#formPix").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var f = ev.target, p = estado.atual, nome = f.nome.value.trim();
    if (!nome) { erro(f, "Conte pra gente o seu nome."); f.nome.focus(); return; }
    var reservar = !!(p && f.reservar.checked);
    var bt = $("[data-enviar]", f); bt.disabled = true; erro(f, "");
    api({ acao: "pix", id: p ? p.id : "", presente: p ? p.nome : "", nome: nome, reservar: reservar })
      .then(function (r) {
        if (!r || !r.ok) throw { codigo: (r && r.erro) || "falha" };
        lembrarNome(nome);
        if (reservar && !r.jaReservado) { marcarMeu(p.id); estado.reservados.add(p.id); render(); }
        $("#modalPix").close();
        if (r.jaReservado) return toast("Obrigado pelo Pix!", "Os anfitriões foram avisados. Este presente já tinha sido reservado por outra pessoa.", r.telegram);
        toast(reservar ? "Reservado com sucesso" : "Obrigado pelo Pix!", reservar ? "Seu Pix foi registrado e o presente ficou reservado." : "Os anfitriões vão adorar saber.", r.telegram);
      })
      .catch(function (e) {
        erro(f, mensagemErro(e));
        if (e && e.codigo === "ja_reservado" && p) { estado.reservados.add(p.id); render(); }
      })
      .then(function () { bt.disabled = false; });
  });

  // ---------- Pix (BR Code estático, valor livre) ----------
  function semAcento(s, max) {
    return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 .-]/g, "").trim().slice(0, max).toUpperCase();
  }
  function campo(id, v) { return id + String(v.length).padStart(2, "0") + v; }
  function crc16(s) {
    var crc = 0xffff;
    for (var i = 0; i < s.length; i++) {
      crc ^= s.charCodeAt(i) << 8;
      for (var j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
    return crc.toString(16).toUpperCase().padStart(4, "0");
  }
  function codigoPix() {
    var px = CFG.pix || {};
    var corpo = campo("00", "01") +
      campo("26", campo("00", "br.gov.bcb.pix") + campo("01", String(px.chave).trim())) +
      campo("52", "0000") + campo("53", "986") + campo("58", "BR") +
      campo("59", semAcento(px.nomeRecebedor, 25) || "RECEBEDOR") +
      campo("60", semAcento(px.cidade, 15) || "BRASIL") +
      campo("62", campo("05", "***")) + "6304";
    return corpo + crc16(corpo);
  }
  function desenharQr(txt) {
    var box = $("#qr"); box.textContent = "";
    if (typeof window.qrcode !== "function") return;
    var q = window.qrcode(0, "M"); q.addData(txt); q.make();
    box.innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true, alt: "QR Code Pix" });
  }
  function copiar(txt, botao, rotulo) {
    var ok = function () { var s = botao.querySelector("span") || botao; var o = s.textContent; s.textContent = rotulo || "Copiado!"; setTimeout(function () { s.textContent = o; }, 1800); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(ok, function () { antigo(txt); ok(); });
    else { antigo(txt); ok(); }
  }
  function antigo(txt) { var t = el("textarea"); t.value = txt; t.style.position = "fixed"; t.style.opacity = "0"; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); } catch (e) {} t.remove(); }
  $("#btnCopiar").addEventListener("click", function () { copiar(String(CFG.pix.chave).trim(), this, "Chave copiada!"); });

  // ---------- toast ----------
  var tmr;
  function toast(titulo, texto, telegram) {
    $("#toastTitulo").textContent = titulo; $("#toastTexto").textContent = texto || "";
    $("#toastTg").hidden = !telegram;
    var t = $("#toast"); t.hidden = false;
    clearTimeout(tmr); tmr = setTimeout(function () { t.hidden = true; }, 7000);
  }
  $("#toastFechar").addEventListener("click", function () { $("#toast").hidden = true; });

  // ---------- outros controles ----------
  $$("[data-abrir-pix]").forEach(function (b) { b.addEventListener("click", function (e) { e.preventDefault(); abrirPix(null); }); });
  $$(".filters button").forEach(function (b) {
    b.addEventListener("click", function () {
      estado.filtro = b.dataset.filtro;
      $$(".filters button").forEach(function (x) { x.classList.toggle("on", x === b); });
      render();
    });
  });
  $("#btnCompartilhar").addEventListener("click", function () {
    var url = location.href.split("#")[0];
    if (navigator.share) navigator.share({ title: document.title, text: "Nossa lista de presentes do chá de casa nova", url: url }).catch(function () {});
    else copiar(url, this, "Link copiado!");
  });

  // ---------- início ----------
  textos();
  carregarProdutos().then(function () { render(); return carregarReservas(); });
  document.addEventListener("visibilitychange", function () { if (!document.hidden && estado.backendOk) carregarReservas(); });
  setInterval(function () { if (!document.hidden && estado.backendOk) carregarReservas(); }, 60000);
})();
