(function () {
  "use strict";

  var CFG = window.LISTA_CONFIG || {};
  var estado = { produtos: [], reservados: new Set(), minhas: lerMinhas(), filtro: "todos", atual: null, backendOk: null };
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
  // Reservas feitas neste aparelho: { idReservado: codigoSecreto }. Só quem tem o código consegue retirar.
  function lerMinhas() { try { var o = JSON.parse(localStorage.getItem("lista:minhas") || "{}"); return o && typeof o === "object" ? o : {}; } catch (e) { return {}; } }
  function salvarMinhas() { try { localStorage.setItem("lista:minhas", JSON.stringify(estado.minhas)); } catch (e) {} }
  function novoCodigo() {
    var b = new Uint8Array(18); (window.crypto || window.msCrypto).getRandomValues(b);
    return btoa(String.fromCharCode.apply(null, b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function minhaReserva(p) {
    if (!p.repetivel) return estado.minhas[p.id] ? p.id : null;
    var ids = Object.keys(estado.minhas).filter(function (k) { return k.indexOf(p.id + "#") === 0; });
    return ids.length ? ids[0] : null;
  }
  function lembrarNome(v) { try { if (v) localStorage.setItem("lista:nome", v); } catch (e) {} }
  function nomeLembrado() { try { return localStorage.getItem("lista:nome") || ""; } catch (e) { return ""; } }

  // Presentes "repetíveis" (várias pessoas podem escolher) nunca ficam travados:
  // cada escolha é registrada com um id próprio, no formato "<id>#<data>".
  function reservado(p) { return !p.repetivel && estado.reservados.has(p.id); }
  function vezes(p) { var n = 0; estado.reservados.forEach(function (id) { if (id.indexOf(p.id + "#") === 0) n++; }); return n; }

  // ---------- textos do topo ----------
  function textos() {
    var t = (CFG.titulo || "Socorro, viramos donos de casa").trim();
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
      Object.keys(estado.minhas).forEach(function (k) { if (!estado.reservados.has(k)) delete estado.minhas[k]; });
      salvarMinhas();
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
    var res = reservado(p);
    var ph = el("div", { class: "ph" });
    if (p.imagem) {
      var img = el("img", { src: p.imagem, alt: p.nome, loading: "lazy", referrerpolicy: "no-referrer" });
      img.onerror = function () { img.remove(); ph.appendChild(el("span", { class: "sem" }, [icone("gift")])); };
      ph.appendChild(img);
    } else { ph.classList.add("vazia"); ph.appendChild(el("span", { class: "sem" }, [icone("gift")])); }
    ph.appendChild(res
      ? el("span", { class: "badge own" }, [icone("lock"), "Tem dono"])
      : el("span", { class: "badge av" }, [el("i"), "Disponível"]));
    if (p.importado !== false && p.link) ph.appendChild(el("span", { class: "imp" }, [icone("link"), "Importado do anúncio"]));

    var cb = el("div", { class: "cb" }, [el("h3", { text: p.nome })]);
    if (p.descricao) cb.appendChild(el("p", { text: p.descricao }));
    if (preco(p.preco)) cb.appendChild(el("div", { class: "price" }, [el("b", { text: preco(p.preco) }), el("span", { text: "valor de referência" })]));
    if (p.repetivel) {
      var n = vezes(p);
      cb.appendChild(el("span", { class: "chip s multi" }, ["∞ Várias pessoas podem escolher" + (n ? " · " + n + (n === 1 ? " já escolheu" : " já escolheram") : "")]));
      var minha = minhaReserva(p);
      if (minha) {
        var desistir = el("button", { class: "link-acao", type: "button", text: "Cancelar minha escolha" });
        desistir.addEventListener("click", function () { abrirCancelar(p, minha); });
        cb.appendChild(el("p", { class: "minha" }, [icone("check"), "Você escolheu este presente · ", desistir]));
      }
    }

    if (res && minhaReserva(p)) {
      var retirar = el("button", { class: "btn sec", type: "button" }, [icone("undo"), "Retirar reserva"]);
      retirar.addEventListener("click", function () { abrirCancelar(p, p.id); });
      cb.appendChild(el("div", { class: "acoes" }, [
        el("div", { class: "resbox meu" }, [
          el("span", { class: "ic" }, [icone("check")]),
          el("div", null, [el("b", { text: "Reservado por você" }), el("span", { text: "Obrigado pelo carinho!" })])
        ]),
        retirar
      ]));
    } else if (res) {
      cb.appendChild(el("div", { class: "resbox" }, [
        el("span", { class: "ic" }, [icone("check")]),
        el("div", null, [el("b", { text: "Reservado por outra pessoa" }), el("span", { text: "Este presente já foi escolhido" })])
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
    var livres = estado.produtos.filter(function (p) { return !reservado(p); }).length;
    $("#contagem").textContent = total ? (livres === 1 ? "1 de " + total + " ainda disponível" : livres + " de " + total + " ainda disponíveis") : "";
    var lista = estado.produtos.filter(function (p) {
      var r = reservado(p);
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
    if (e && e.codigo === "nao_autorizado") return "Não encontramos esta reserva. Talvez os anfitriões já tenham cancelado — atualize a página.";
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
    var idEnvio = p.repetivel ? p.id + "#" + Date.now() : p.id;
    var codigo = novoCodigo();
    api({ acao: "reservar", id: idEnvio, presente: p.nome, nome: nome, codigo: codigo })
      .then(function (r) {
        if (!r || !r.ok) throw { codigo: (r && r.erro) || "falha" };
        lembrarNome(nome); estado.minhas[idEnvio] = codigo; salvarMinhas();
        estado.reservados.add(idEnvio); render();
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
    var bt = $("[data-enviar]", f); bt.disabled = true; erro(f, "");
    api({ acao: "pix", id: p ? p.id : "", presente: p ? p.nome : "", nome: nome })
      .then(function (r) {
        if (!r || !r.ok) throw { codigo: (r && r.erro) || "falha" };
        lembrarNome(nome);
        $("#modalPix").close();
        toast("Obrigado pelo Pix!", "Os anfitriões vão adorar saber.", r.telegram);
      })
      .catch(function (e) { erro(f, mensagemErro(e)); })
      .then(function () { bt.disabled = false; });
  });

  // ---------- retirar reserva ----------
  var cancelando = null;
  function abrirCancelar(p, idReserva) {
    cancelando = { p: p, id: idReserva };
    var f = $("#formCancelar");
    preencherItem($("[data-item]", f), p);
    $("#mcTitulo").textContent = p.repetivel ? "Cancelar sua escolha?" : "Retirar reserva?";
    erro(f, "");
    $("#modalCancelar").showModal();
  }
  $("#formCancelar").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var f = ev.target, c = cancelando; if (!c) return;
    var bt = $("[data-enviar]", f); bt.disabled = true; erro(f, "");
    api({ acao: "cancelar", id: c.id, codigo: estado.minhas[c.id] })
      .then(function (r) {
        if (!r || !r.ok) throw { codigo: (r && r.erro) || "falha" };
        delete estado.minhas[c.id]; salvarMinhas();
        estado.reservados.delete(c.id); render();
        $("#modalCancelar").close();
        toast("Reserva retirada", "O presente voltou a ficar disponível na lista.", r.telegram);
      })
      .catch(function (e) {
        erro(f, mensagemErro(e));
        if (e && e.codigo === "nao_autorizado") { delete estado.minhas[c.id]; salvarMinhas(); carregarReservas(); }
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
