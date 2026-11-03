# Ranking de Troféus — integração pendente no Zeus Bot

O site e o Supabase estão preparados. Nenhuma alteração foi realizada no MySQL ou na VPS.

## Origem

No sincronismo diário, recolha de cada clube da Celestial Host somente os membros atuais, com tag, nome e troféus retornados pela API do Brawl Stars. A divisão vem da configuração que associa cada clube à respectiva divisão no Zeus Bot. Não use os troféus históricos dos treinos.

## Banco

Supabase: Celestial BOT (iuddgopacxcopbuogoxd).
Tabela: public.trophy_ranking_players, com colunas player_tag (PK), player_name, division, club_tag (opcional), trophies, synced_at.

## Publicação atômica

Após consultar com sucesso TODOS os clubes e validar a lista completa de membros, envie a lista inteira de jogadores para:

POST https://iuddgopacxcopbuogoxd.supabase.co/rest/v1/rpc/publish_trophy_ranking

JSON:
{
  "p_players": [
    { "player_tag": "#2P9LQ8", "player_name": "Jogador Exemplo", "division": "Divisão Exemplo", "club_tag": "#2Y8P9Q", "trophies": 75000 }
  ]
}

O exemplo é ilustrativo; não o publique. Envie todos os jogadores, não apenas o Top 10. Use autenticação de serviço do Supabase somente no servidor do bot, nunca no frontend ou GitHub. Headers: apikey com a chave privada e Content-Type: application/json; para chave JWT legada, também Authorization: Bearer <SERVICE_ROLE_KEY>.

A função publica o snapshot em uma transação, substituindo a lista anterior integralmente; falhas provocam rollback. Lista vazia é rejeitada. Permite 1 a 1500 jogadores, troféus de 0 a 1000000, tags com 3-20 caracteres, nomes de 1-100 caracteres e divisões de 1-80 caracteres. Tags não podem se repetir. Se qualquer clube falhar, NÃO publique: mantenha o último ranking completo.

## Leitura

GET /api/trophies retorna somente 10 jogadores (ordenados por troféus) e updatedAt. O navegador não recebe a chave secreta, que permanece no backend Vercel (SUPABASE_URL e SUPABASE_SECRET_KEY ou SUPABASE_SERVICE_ROLE_KEY). Antes do primeiro sync: players vazio, updatedAt nulo. A aba Treinos e o Ranking de Eventos permanecem independentes.
