# Lista de presentes — instruções para o Claude

Site público (GitHub Pages) da lista de presentes do chá de casa nova: **https://murilo-amaral.github.io/Lista-de-presentes/**

- O site fica em `docs/`. O GitHub Pages publica o branch **`claude/keen-johnson-072qfl`**, pasta `/docs`.
- **Todo commit precisa ser enviado para `claude/keen-johnson-072qfl`**, senão não aparece no site. O dono do repositório autoriza commits e pushes diretos nesse branch, sem pull request.
- As reservas ficam numa Planilha Google (`backend/Codigo.gs`). Não mexa nela nem no `urlBackend` de `docs/config.js` sem pedido.
- Fale com o usuário em português do Brasil, em mensagens curtas.

## Cadastro de produtos (tarefa principal)

O usuário manda uma ou mais URLs de anúncio. Para cada uma:

1. **Abra o anúncio** e extraia:
   - **nome**: curto e claro, sem frases de marketing (ex.: "Panela de Pressão Brinox 4,2 L");
   - **descricao**: uma frase curta em português (material, tamanho, cor ou capacidade). Não invente: use só o que está no anúncio;
   - **preco**: número com ponto decimal (ex.: `189.9`). Use o preço à vista mostrado. Se não houver, omita o campo;
   - **imagem**: URL da foto principal do produto, em alta resolução (meta `og:image` ou JSON-LD `image`).
   - **categoria**: uma destas (use exatamente o texto): `Cozinha`, `Eletrodomésticos`, `Cama e banho`, `Casa e decoração`, `Limpeza e lavanderia`. Só crie uma categoria nova se nenhuma servir.
2. **Salve a foto no repositório**: baixe para `docs/img/<id>.<ext>` e use `"imagem": "img/<id>.<ext>"`. Se não for possível baixar, use a URL externa da foto.
3. **Link limpo**: remova parâmetros de rastreamento e afiliado (`tag=`, `utm_*`, `ref=` etc.). Na Amazon, use `https://www.amazon.com.br/dp/<ASIN>`.
4. **Edite `docs/produtos.json`**:
   - Se já existir um item com o mesmo nome ou equivalente (ex.: "Micro-ondas", "Edredom Casal"), **complete esse item**: adicione imagem, link, preço e descrição, **mantendo o `id`**.
   - Senão, adicione um item novo no fim, com `id` em minúsculas, sem acento e com hífens (ex.: `jarra-de-agua`). O `id` precisa ser único.
   - **Nunca mude o `id` de um item existente**: as reservas são guardadas por `id`.
   - **Limite de reservas**: por padrão, 1 pessoa por presente (não escreva nada). Se várias pessoas puderem dar o mesmo presente, use `"limite": N` (ex.: `"limite": 3`). Não mexa no `limite` de itens existentes sem pedido.
5. Valide o JSON (`python3 -m json.tool docs/produtos.json`), faça o commit e o push para `claude/keen-johnson-072qfl`.
6. Responda com uma tabela curta (nome, preço, se completou um item existente ou criou um novo) e lembre que o site atualiza em 1 ou 2 minutos.

Formato de cada item:

```json
{
  "id": "panela-de-pressao-brinox",
  "nome": "Panela de Pressão Brinox",
  "categoria": "Cozinha",
  "descricao": "Alumínio com revestimento antiaderente, 4,2 litros.",
  "preco": 192.9,
  "imagem": "img/panela-de-pressao-brinox.jpg",
  "link": "https://www.amazon.com.br/dp/B08YFLVSBP"
}
```

### Quando o site da loja bloquear

- Se o domínio da loja ou do CDN das fotos for recusado pela rede da sessão, peça para liberar o host exato (ex.: `www.amazon.com.br`, `m.media-amazon.com`, `www.mercadolivre.com.br`, `http2.mlstatic.com`) com as ferramentas de ambiente, no ambiente **Lista-de-presentes**.
- Se a loja bloquear a leitura automática (captcha, página vazia), peça ao usuário um print ou o nome e o preço, e cadastre com o que ele mandar.

## Outros pedidos comuns

- **Remover um presente**: apague o item de `produtos.json`. Antes, avise se ele já pode estar reservado.
- **Mudar textos, título ou Pix**: `docs/config.js`.
- **Cancelar uma reserva**: é feito pelo usuário, apagando a linha na planilha.
