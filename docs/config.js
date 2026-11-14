// =====================================================================
//  CONFIGURAÇÃO DA LISTA — edite apenas os textos entre aspas.
// =====================================================================
window.LISTA_CONFIG = {
  // Título principal. A última palavra aparece em destaque (itálico).
  titulo: "Nosso cantinho novo",

  // Etiqueta pequena acima do título (ex.: "Chá de casa nova · 6 de dezembro").
  etiqueta: "Chá de casa nova",

  // Mensagem de boas-vindas.
  mensagem:
    "Que alegria ter você por perto nesta nova fase! Preparamos esta lista com carinho. " +
    "Escolha um presente para reservar ou, se preferir, contribua com o valor via Pix.",

  // Dados do Pix. Enquanto "chave" estiver vazia, a área de Pix avisa que ainda não foi configurada.
  pix: {
    chave: "",           // CPF, celular (+5511999999999), e-mail ou chave aleatória
    nomeRecebedor: "",   // nome que aparece no app do banco (até 25 letras)
    cidade: "",          // cidade do recebedor (até 15 letras)
    // Opcional: em vez de gerar o QR Code a partir da chave, use a imagem do QR do seu banco
    // (coloque o arquivo na pasta docs/img e escreva aqui, ex.: "img/qr-pix.png").
    imagemQr: "",
  },

  // Endereço do "Web App" do Google Apps Script (veja LEIA-ME.md, passo 2).
  // Enquanto estiver vazio, o site mostra os presentes mas não aceita reservas.
  urlBackend: "https://script.google.com/macros/s/AKfycbwwgFaylcAgejKVdv3pZtcWILPeT-_pz_eMSurfBGEsbJW6CfLsgsrF1GugqbFGfQuhQQ/exec",
};
