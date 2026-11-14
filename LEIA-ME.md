# Lista de presentes — Nosso cantinho novo

Site público da lista de presentes do chá de casa nova. Os convidados abrem o link, sem login e sem cadastro, e podem:

- ver os presentes (foto, nome, descrição, valor de referência e link do anúncio);
- **reservar** um presente: ele passa a aparecer como "Tem dono" para todo mundo;
- **contribuir via Pix**: QR Code da sua chave e botão "Copiar chave", com a opção de avisar que enviou e de marcar o presente como reservado.

A cada reserva ou aviso de Pix, você recebe uma mensagem no **Telegram**.

Tudo é gratuito:

| Parte | Onde fica | Custo |
|---|---|---|
| Site (o link que você manda) | GitHub Pages, pasta `docs/` | grátis |
| Reservas (quem reservou o quê) | Planilha Google + Apps Script, arquivo `backend/Codigo.gs` | grátis |
| Avisos | Bot do Telegram | grátis |

---

## Passo 1 — Publicar o site (GitHub Pages)

1. No GitHub, abra o repositório **Lista-de-presentes** → **Settings** → **Pages**.
2. Em **Source**, escolha **Deploy from a branch**.
3. Em **Branch**, escolha `claude/keen-johnson-072qfl` e a pasta **`/docs`**. Clique em **Save**.
4. Espere 1 a 2 minutos. O link fica:
   **https://murilo-amaral.github.io/Lista-de-presentes/**

Nessa etapa o site já mostra os presentes, mas ainda não aceita reservas.

## Passo 2 — Ativar as reservas (Planilha Google)

1. Acesse **https://sheets.new** para criar uma planilha nova. Dê um nome, por exemplo "Reservas — chá de casa nova".
2. Menu **Extensões → Apps Script**.
3. Apague o conteúdo que aparecer, cole todo o arquivo [`backend/Codigo.gs`](backend/Codigo.gs) e clique no disquete para salvar.
4. Clique em **Implantar → Nova implantação**.
   - Na engrenagem ao lado de "Selecione o tipo", escolha **App da Web**.
   - **Executar como:** Eu.
   - **Quem pode acessar:** **Qualquer pessoa**.
   - Clique em **Implantar** e autorize com sua conta Google. Se aparecer "o Google não verificou este app", clique em **Avançado → Acessar (não seguro)**: o app é seu, então pode seguir.
5. Copie a **URL do app da Web** (termina em `/exec`) e mande para o Claude, ou cole você mesmo em `docs/config.js`, no campo `urlBackend`.

As reservas aparecem na aba **Reservas** da planilha. **Para cancelar uma reserva, apague a linha dela.**

> Se um dia você mudar o código do Apps Script, use **Implantar → Gerenciar implantações → editar (lápis) → Versão: Nova versão**. Assim a URL continua a mesma.

## Passo 3 — Avisos no Telegram

1. No Telegram, abra o **@BotFather**, mande `/newbot` e siga as instruções. Ele te dá um **token**, algo como `123456:ABC...`.
   **Não mande o token para ninguém, nem para o Claude.**
2. No Apps Script, clique na engrenagem **Configurações do projeto** → **Propriedades do script** → **Adicionar propriedade**:
   - `TELEGRAM_TOKEN` = o token do BotFather.
3. Abra o seu bot no Telegram e mande um "oi".
4. No editor do Apps Script, escolha a função **`descobrirChatId`** no menu de funções e clique em **Executar**. O **Registro de execução** mostra o número do chat.
5. Adicione outra propriedade:
   - `TELEGRAM_CHAT_ID` = esse número.
6. Execute a função **`testarTelegram`**. Deve chegar uma mensagem de teste no Telegram.

> Quer que os dois anfitriões recebam os avisos? Crie um grupo no Telegram com vocês dois e o bot, mande um "oi" no grupo e use o id do grupo (é um número negativo).

## Passo 4 — Pix

Em `docs/config.js`, preencha:

```js
pix: {
  chave: "sua chave Pix",      // CPF, celular (+55...), e-mail ou chave aleatória
  nomeRecebedor: "Seu Nome",
  cidade: "Sua Cidade",
},
```

O site gera o QR Code da sua chave. O convidado digita o valor no app do banco. Se preferir usar a imagem do QR Code que o seu banco gera, salve a imagem em `docs/img/` e escreva o caminho em `imagemQr`.

Também dá para mudar no mesmo arquivo o título, a etiqueta (ex.: "Chá de casa nova · 6 de dezembro") e a mensagem de boas-vindas.

---

## Cadastrar presentes

O jeito mais fácil: **mande o link do anúncio para o Claude.** Ele lê nome, descrição, preço e foto, salva a foto em `docs/img/` e adiciona o item em `docs/produtos.json`.

Se preferir editar você mesmo, cada presente em `docs/produtos.json` segue este formato:

```json
{
  "id": "jogo-de-panelas",
  "nome": "Jogo de panelas",
  "descricao": "Caçarola e panela em cerâmica antiaderente.",
  "preco": 389.90,
  "imagem": "img/jogo-de-panelas.jpg",
  "link": "https://link-do-anuncio"
}
```

- `id`: identificador único, sem espaços. **Não mude o id de um presente que já foi reservado**, senão a reserva se perde.
- `preco`: opcional. Use ponto como separador decimal.
- Para remover um presente, apague o bloco dele.

## Estrutura

```
docs/            ← o site publicado
  index.html
  estilo.css
  app.js
  config.js      ← textos, Pix e URL das reservas
  produtos.json  ← lista de presentes
  img/           ← fotos dos produtos e imagem de compartilhamento
  vendor/        ← gerador de QR Code (qrcode-generator, licença MIT)
backend/
  Codigo.gs      ← código para colar no Google Apps Script
mockup/          ← mockup visual da proposta de design
```
