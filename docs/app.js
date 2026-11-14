(function () {
  "use strict";

  var CFG = window.LISTA_CONFIG || {};
  var estado = { produtos: [], reservados: new Set(), minhas: lerMinhas(), filtro: "todos", busca: "", categoria: "", valor: "", ordem: "", atual: null, backendOk: null };
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
    if (limite(p) <= 1) return estado.minhas[p.id] ? p.id : null;
    var ids = Object.keys(estado.minhas).filter(function (k) { return k.indexOf(p.id + "#") === 0; });
    return ids.length ? ids[0] : null;
  }
  function lembrarNome(v) { try { if (v) localStorage.setItem("lista:nome", v); } catch (e) {} }
  function nomeLembrado() { try { return localStorage.getItem("lista:nome") || ""; } catch (e) { return ""; } }

  // Presentes "repetíveis" (várias pessoas podem escolher) nunca ficam travados:
  // cada escolha é registrada com um id próprio, no formato "<id>#<data>".
  // "limite": quantas pessoas podem reservar o mesmo presente (padrão 1).
  // "repetivel": true (formato antigo) = sem limite.
  function limite(p) {
    var l = parseInt(p.limite, 10);
    if (l >= 1) return l;
    return p.repetivel ? Infinity : 1;
  }
  function reservado(p) { return limite(p) > 1 ? vezes(p) >= limite(p) : estado.reservados.has(p.id); }
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
    var res = reservado(p), multi = limite(p) > 1, minha = minhaReserva(p);
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
    if (multi) {
      var n = vezes(p), L = limite(p);
      var txt = L === Infinity
        ? "Várias pessoas podem escolher" + (n ? " · " + n + (n === 1 ? " já escolheu" : " já escolheram") : "")
        : "Até " + L + " pessoas podem dar · " + n + " de " + L + " já " + (n === 1 ? "escolheu" : "escolheram");
      cb.appendChild(el("span", { class: "chip s multi" }, [icone("users"), txt]));
      if (minha) {
        var desistir = el("button", { class: "link-acao", type: "button", text: "Cancelar minha escolha" });
        desistir.addEventListener("click", function () { abrirCancelar(p, minha); });
        cb.appendChild(el("p", { class: "minha" }, [icone("check"), "Você escolheu este presente · ", desistir]));
      }
    }

    var podeReservar = !res && !(multi && minha);
    if (!multi && res && minha) {
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
      var titulo = multi ? (minha ? "Reservado por você e mais pessoas" : "Reservado por outras pessoas") : "Reservado por outra pessoa";
      var sub = multi ? "Todas as " + limite(p) + " vagas já foram preenchidas" : "Este presente já foi escolhido";
      cb.appendChild(el("div", { class: "resbox" + (minha ? " meu" : "") }, [
        el("span", { class: "ic" }, [icone("check")]),
        el("div", null, [el("b", { text: titulo }), el("span", { text: sub })])
      ]));
    } else {
      var filhos = [];
      if (podeReservar) {
        var b1 = el("button", { class: "btn pri", type: "button" }, [icone("gift"), "Reservar presente"]);
        b1.addEventListener("click", function () { abrirReserva(p); });
        filhos.push(b1);
      }
      var b2 = el("button", { class: "btn sec", type: "button" }, [icone("qr"), "Contribuir via Pix"]);
      b2.addEventListener("click", function () { abrirPix(p); });
      filhos.push(b2);
      cb.appendChild(el("div", { class: "acoes" }, filhos));
    }
    var card = el("article", { class: "card" + (res ? " res" : "") }, [ph, cb]);
    if (podeReservar) {
      // Clicar em qualquer parte do cartão (foto incluída) abre a reserva.
      card.classList.add("clicavel");
      card.setAttribute("tabindex", "0");
      card.setAttribute("aria-label", "Reservar " + p.nome);
      card.addEventListener("click", function (e) { if (!e.target.closest("button, a")) abrirReserva(p); });
      card.addEventListener("keydown", function (e) {
        if ((e.key === "Enter" || e.key === " ") && e.target === card) { e.preventDefault(); abrirReserva(p); }
      });
    }
    return card;
  }

  function render() {
    var g = $("#grade"); g.textContent = "";
    var total = estado.produtos.length;
    var livres = estado.produtos.filter(function (p) { return !reservado(p); }).length;
    $("#contagem").textContent = total ? (livres === 1 ? "1 de " + total + " ainda disponível" : livres + " de " + total + " ainda disponíveis") : "";
    var termos = normaliza(estado.busca).split(/\s+/).filter(Boolean);
    var faixa = estado.valor ? estado.valor.split("-").map(function (x) { return x === "" ? null : Number(x); }) : null;
    var lista = estado.produtos.filter(function (p) {
      var r = reservado(p);
      if (estado.filtro !== "todos" && (estado.filtro === "reservados" ? !r : r)) return false;
      if (estado.categoria && p.categoria !== estado.categoria) return false;
      if (faixa) {
        var v = Number(p.preco);
        if (!p.preco || isNaN(v)) return false;
        if (faixa[0] !== null && v < faixa[0]) return false;
        if (faixa[1] !== null && v > faixa[1]) return false;
      }
      if (termos.length) {
        var alvo = normaliza([p.nome, p.descricao, p.categoria].join(" "));
        if (!termos.every(function (t) { return alvo.indexOf(t) >= 0; })) return false;
      }
      return true;
    });
    if (estado.ordem) {
      var pr = function (p) { var v = Number(p.preco); return p.preco && !isNaN(v) ? v : null; };
      lista = lista.slice().sort(function (a, b) {
        if (estado.ordem === "az") return a.nome.localeCompare(b.nome, "pt-BR");
        var x = pr(a), y = pr(b);
        if (x === null && y === null) return 0;
        if (x === null) return 1;
        if (y === null) return -1;
        return estado.ordem === "menor" ? x - y : y - x;
      });
    }
    var refinado = !!(termos.length || estado.categoria || estado.valor);
    if (refinado && total) $("#contagem").textContent = lista.length === 1 ? "1 encontrado" : lista.length + " encontrados";
    lista.forEach(function (p) { g.appendChild(cartao(p)); });
    $("#vazio").hidden = total > 0;
    if (total > 0 && lista.length === 0) {
      var msg = refinado ? "Nenhum presente encontrado com esses filtros." : estado.filtro === "reservados" ? "Nenhum presente reservado ainda." : "Todos os presentes já têm dono. Que tal contribuir via Pix?";
      var caixa = el("div", { class: "vazio" }, [el("span", { text: msg })]);
      if (refinado) {
        var lp = el("button", { class: "btn claro", type: "button", text: "Limpar filtros" });
        lp.addEventListener("click", limparFiltros);
        caixa.appendChild(lp);
      }
      g.appendChild(caixa);
    }
  }

  function normaliza(t) { return (t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }
  function limparFiltros() {
    estado.busca = estado.categoria = estado.valor = "";
    $("#busca").value = ""; $("#selCategoria").value = ""; $("#selValor").value = "";
    $("#limparBusca").hidden = true;
    render();
  }
  function montarCategorias() {
    var cats = [];
    estado.produtos.forEach(function (p) { if (p.categoria && cats.indexOf(p.categoria) < 0) cats.push(p.categoria); });
    cats.sort(function (a, b) { return a.localeCompare(b, "pt-BR"); });
    var sel = $("#selCategoria");
    cats.forEach(function (c) { sel.appendChild(el("option", { value: c, text: c })); });
    $("#selCategoriaWrap").hidden = cats.length === 0;
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
    // Avisar o Pix de um presente disponível também reserva o presente para quem enviou.
    estado.pixReserva = !!(p && !reservado(p) && !(limite(p) > 1 && minhaReserva(p)));
    $("#mpNotaReserva").hidden = !estado.pixReserva;
    $("#mpEnviarTxt").textContent = estado.pixReserva ? "Avisar que enviei e reservar" : "Avisar que enviei";
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
    var multi = limite(p) > 1;
    var idEnvio = multi ? p.id + "#" + Date.now() : p.id;
    var codigo = novoCodigo();
    api({ acao: "reservar", id: idEnvio, presente: p.nome, nome: nome, codigo: codigo, limite: multi && limite(p) !== Infinity ? limite(p) : undefined })
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
    var dados = { acao: "pix", id: p ? p.id : "", presente: p ? p.nome : "", nome: nome };
    if (estado.pixReserva) {
      var multi = limite(p) > 1;
      dados.id = multi ? p.id + "#" + Date.now() : p.id;
      dados.reservar = true;
      dados.codigo = novoCodigo();
      if (multi && limite(p) !== Infinity) dados.limite = limite(p);
    }
    api(dados)
      .then(function (r) {
        if (!r || !r.ok) throw { codigo: (r && r.erro) || "falha" };
        lembrarNome(nome);
        $("#modalPix").close();
        if (dados.reservar && r.reservado) {
          estado.minhas[dados.id] = dados.codigo; salvarMinhas();
          estado.reservados.add(dados.id); render();
          toast("Reservado com sucesso", "Obrigado pelo Pix! O presente ficou reservado para você.", r.telegram);
        } else if (r.jaReservado) {
          toast("Obrigado pelo Pix!", "Os anfitriões foram avisados. Este presente já tinha sido reservado por outra pessoa.", r.telegram);
          carregarReservas();
        } else {
          toast("Obrigado pelo Pix!", "Os anfitriões vão adorar saber.", r.telegram);
        }
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
    $("#mcTitulo").textContent = limite(p) > 1 ? "Cancelar sua escolha?" : "Retirar reserva?";
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
  var tBusca;
  $("#busca").addEventListener("input", function () {
    var v = this.value; $("#limparBusca").hidden = !v;
    clearTimeout(tBusca); tBusca = setTimeout(function () { estado.busca = v; render(); }, 120);
  });
  $("#limparBusca").addEventListener("click", function () { $("#busca").value = ""; this.hidden = true; estado.busca = ""; render(); $("#busca").focus(); });
  $("#selCategoria").addEventListener("change", function () { estado.categoria = this.value; render(); });
  $("#selValor").addEventListener("change", function () { estado.valor = this.value; render(); });
  $("#selOrdem").addEventListener("change", function () { estado.ordem = this.value; render(); });

  $("#btnCompartilhar").addEventListener("click", function () {
    var url = location.href.split("#")[0];
    if (navigator.share) navigator.share({ title: document.title, text: "Nossa lista de presentes do chá de casa nova", url: url }).catch(function () {});
    else copiar(url, this, "Link copiado!");
  });

  // ---------- início ----------
  textos();
  carregarProdutos().then(function () { montarCategorias(); render(); return carregarReservas(); });
  document.addEventListener("visibilitychange", function () { if (!document.hidden && estado.backendOk) carregarReservas(); });
  setInterval(function () { if (!document.hidden && estado.backendOk) carregarReservas(); }, 60000);
})();
