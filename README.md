# Ponto

Planning poker enxuto: uma única sala, o primeiro participante vira admin e os demais entram com a senha compartilhada.

## Publicar na Vercel

1. Importe este repositório na Vercel.
2. No projeto, abra **Storage → Marketplace** e adicione **Upstash Redis** no plano gratuito.
3. Conecte o banco ao projeto. A integração cria `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` automaticamente.
4. Faça o redeploy.

Não existe autenticação, servidor separado ou configuração adicional. A senha é armazenada em texto simples e serve somente como barreira casual contra pessoas entrando por engano.

## Comportamento

- Só existe uma sala global por vez.
- Quem cria a sala vira admin.
- O admin revela votos, inicia rodadas e encerra a sala.
- Os jogadores podem alterar o voto mesmo depois da revelação.
- O admin vê o título e os votos da rodada anterior.
- Os clientes consultam o estado a cada 3 segundos.
- A sala expira automaticamente após 6 horas.
