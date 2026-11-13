# Temporadas anuais e segurança — Celestial Rankings

## Virada do ano
- **Fuso oficial:** `America/Sao_Paulo`.
- Em 1º de janeiro, a interface passa automaticamente para o ano novo (verificação a cada 30s, e ao reabrir a aba).
- `/api/dashboard` e `/api/player` aceitam somente o ano atual para o ranking de treinos; `period=all` significa **temporada atual**, não o histórico de todos os anos.
- A view `public.active_training_player_season_ranking` soma a view mensal, agrupada por ano de encerramento do treino em horário de São Paulo. O ranking mensal também é limitado à temporada.
- O histórico público inclui apenas sessões `finished` da temporada atual. O ranking de troféus é independente.

## Exclusão física anual
- `pg_cron` executa diariamente às **03h05 UTC** (00h05 no horário de Brasília UTC−3) o job `celestial-training-season-cleanup`.
- A função interna `app_private.cleanup_expired_training_seasons()` está bloqueada para `anon`, `authenticated` e `service_role` e retorna **0 durante 2026**. A primeira limpeza é a partir de **01/01/2027**.
- São removidas as sessões encerradas em anos anteriores e, após 24 horas, sessões antigas que ficaram abertas. `ON DELETE CASCADE` remove times, integrantes, confrontos, mapas e escalações correspondentes.
- Treinos iniciados em dezembro e encerrados em janeiro pertencem à temporada do **encerramento**. Sessões em andamento têm 24 horas de proteção antes de qualquer limpeza.
- Permanecem os cadastros `ranking_players`, os dados de `trophy_ranking_players` e a estrutura das tabelas. O objetivo do reset é limpar **resultados de treinos**, não contas de jogadores ou troféus.
- A tabela privada `app_private.training_season_cleanup_log` registra os dias em que sessões foram de fato excluídas; também é possível consultar `cron.job_run_details`.
- `DELETE` libera espaço **para reutilização interna pelo PostgreSQL**, sem garantir redução imediata do arquivo em disco. O volume histórico era ~512 KB em 13/11/2026.

## Consultas de verificação (somente leitura)
```sql
SELECT jobid, jobname, schedule, active FROM cron.job
WHERE jobname = 'celestial-training-season-cleanup';

SELECT * FROM app_private.training_season_cleanup_log
ORDER BY executed_at DESC LIMIT 5;

SELECT EXTRACT(YEAR FROM finished_at AT TIME ZONE 'America/Sao_Paulo')::integer AS ano,
       COUNT(*) AS treinos
FROM public.training_sessions WHERE status = 'finished'
GROUP BY 1 ORDER BY 1;

SELECT season_year, COUNT(*) AS jogadores
FROM public.active_training_player_season_ranking
GROUP BY 1 ORDER BY 1;
```

## Segurança
- O gatilho `ensure_rls` e a função `public.rls_auto_enable()` foram **preservados**.
- `EXECUTE` público da função foi revogado.
- `TRUNCATE`, `TRIGGER`, `REFERENCES` e `MAINTAIN` foram revogados de `anon` e `authenticated` para tabelas antigas de treinos e `ranking_players`.
- As permissões padrão do papel `postgres` no schema `public` também foram ajustadas.
- APIs do site continuam usando a chave privada **somente no backend** da Vercel.

## Operação, recuperação e limites
- **Backup:** salve/exporte os dados desejados antes de 01/01/2027. A exclusão não tem lixeira e não é restaurável sem backup.
- Para interromper futuros expurgos, um operador autorizado pode executar `SELECT cron.unschedule('celestial-training-season-cleanup');` no Supabase. Isso não restaura sessões excluídas.
- Se um job falhar, o site continuará mostrando apenas o ano atual; a próxima execução diária poderá concluir a exclusão.
- Uma alteração no frontend/backend pode ser revertida pelo histórico do GitHub. Alterações destrutivas no banco requerem backup próprio.
