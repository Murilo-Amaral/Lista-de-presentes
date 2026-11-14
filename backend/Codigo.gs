/**
 * Backend da lista de presentes — Google Apps Script ligado a uma Planilha Google.
 *
 * Guarda as reservas na aba "Reservas" e avisa os anfitriões pelo Telegram.
 * Para cancelar uma reserva, basta apagar a linha correspondente na planilha.
 *
 * Configuração (Projeto > Configurações do projeto > Propriedades do script):
 *   TELEGRAM_TOKEN   = token do bot criado no @BotFather
 *   TELEGRAM_CHAT_ID = id da conversa (rode a função descobrirChatId)
 */

var ABA = 'Reservas';
var CABECALHO = ['Data/hora', 'ID do presente', 'Presente', 'Nome', 'Tipo', 'Reserva o presente?'];

function aba_() {
  var planilha = SpreadsheetApp.getActiveSpreadsheet();
  var a = planilha.getSheetByName(ABA);
  if (!a) {
    a = planilha.insertSheet(ABA);
    a.appendRow(CABECALHO);
    a.setFrozenRows(1);
    a.getRange(1, 1, 1, CABECALHO.length).setFontWeight('bold');
  }
  return a;
}

function reservados_() {
  var a = aba_();
  var n = a.getLastRow();
  if (n < 2) return [];
  var linhas = a.getRange(2, 1, n - 1, CABECALHO.length).getValues();
  var ids = {};
  linhas.forEach(function (l) {
    if (l[1] && String(l[5]).toLowerCase() === 'sim') ids[String(l[1])] = true;
  });
  return Object.keys(ids);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function limpa_(v, max) {
  // Remove quebras de linha e evita que o texto vire fórmula na planilha.
  var s = String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

// GET ?acao=lista  ->  { ok: true, reservados: [ids] }
function doGet(e) {
  return json_({ ok: true, reservados: reservados_() });
}

// POST (corpo JSON em text/plain)
//   { acao: "reservar", id, presente, nome }
//   { acao: "pix", id, presente, nome, reservar }
function doPost(e) {
  var d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, erro: 'dados_invalidos' }); }

  var acao = d.acao;
  var id = limpa_(d.id, 80);
  var presente = limpa_(d.presente, 120);
  var nome = limpa_(d.nome, 60);
  if (!nome) return json_({ ok: false, erro: 'sem_nome' });
  if (acao !== 'reservar' && acao !== 'pix') return json_({ ok: false, erro: 'acao_invalida' });
  if (acao === 'reservar' && !id) return json_({ ok: false, erro: 'sem_presente' });

  var reserva = acao === 'reservar' || (acao === 'pix' && d.reservar === true && !!id);

  var jaReservado = false;
  var trava = LockService.getScriptLock();
  trava.waitLock(15000);
  try {
    if (reserva && reservados_().indexOf(id) >= 0) {
      // Reserva comum: recusa. Pix: registra o aviso mesmo assim, sem reservar de novo.
      if (acao === 'reservar') return json_({ ok: false, erro: 'ja_reservado' });
      reserva = false;
      jaReservado = true;
    }
    aba_().appendRow([new Date(), id, presente, nome, acao === 'pix' ? 'Pix' : 'Reserva', reserva ? 'sim' : 'não']);
  } finally {
    trava.releaseLock();
  }

  var msg;
  if (acao === 'reservar') msg = '🎁 ' + nome + ' reservou: ' + presente;
  else if (reserva) msg = '💸 ' + nome + ' enviou um Pix pelo presente: ' + presente + ' (marcado como reservado)';
  else if (presente) msg = '💸 ' + nome + ' avisou que enviou um Pix para ajudar com: ' + presente;
  else msg = '💸 ' + nome + ' avisou que enviou um Pix de valor livre';

  return json_({ ok: true, jaReservado: jaReservado, telegram: telegram_(msg) });
}

function telegram_(texto) {
  var p = PropertiesService.getScriptProperties();
  var token = p.getProperty('TELEGRAM_TOKEN');
  var chat = p.getProperty('TELEGRAM_CHAT_ID');
  if (!token || !chat) return false;
  try {
    var r = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'post',
      payload: { chat_id: chat, text: texto },
      muteHttpExceptions: true
    });
    return r.getResponseCode() === 200;
  } catch (err) {
    return false;
  }
}

/** Mande qualquer mensagem para o seu bot no Telegram e rode esta função: o id aparece no registro. */
function descobrirChatId() {
  var token = PropertiesService.getScriptProperties().getProperty('TELEGRAM_TOKEN');
  if (!token) throw new Error('Cadastre primeiro a propriedade TELEGRAM_TOKEN.');
  var r = JSON.parse(UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/getUpdates').getContentText());
  var vistos = {};
  (r.result || []).forEach(function (u) {
    var c = (u.message || u.channel_post || {}).chat;
    if (c && !vistos[c.id]) { vistos[c.id] = 1; Logger.log('Chat: ' + (c.title || c.first_name || '') + '  →  TELEGRAM_CHAT_ID = ' + c.id); }
  });
  if (!Object.keys(vistos).length) Logger.log('Nenhuma mensagem encontrada. Mande um "oi" para o bot e rode de novo.');
}

/** Envia uma mensagem de teste para conferir a configuração do Telegram. */
function testarTelegram() {
  Logger.log(telegram_('✅ Teste da lista de presentes: as notificações estão funcionando!') ? 'Enviado!' : 'Falhou — confira o token e o chat id.');
}
