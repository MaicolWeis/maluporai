# Backup e restore do Postgres (P11)

Meta do documento de construção: **backup diário, retenção de 30 dias, teste de restore documentado.**

## Situação atual (nov/2026)

- Banco: Postgres no Railway, projeto da API, região US West.
- Plano do Railway: **Hobby**. No Hobby, os *volume backups* agendados e o restore deles não estão
  liberados (recurso do plano Pro). **Hoje não há backup automático configurado.**

## Opções

| Opção | Como | Custo | Atende "diário + 30 dias"? |
|---|---|---|---|
| A. Railway Pro + volume backups | Backups tab do serviço Postgres → agendar diário/semanal | assinatura Pro | Parcial: diário guardado ~6 dias, semanal ~1 mês. Backups ficam no mesmo volume/região (somem se o volume for excluído). |
| B. `pg_dump` agendado para bucket externo (**recomendado**) | Template oficial `railwayapp-templates/postgres-s3-backups` (serviço cron no próprio projeto) enviando dumps para um bucket S3-compatível | baixo | Sim, com regra de expiração de 30 dias no bucket. Fica fora do volume do Railway. |
| C. A + B | Os dois | — | Sim, com duas camadas. |

Para a opção B, o destino pode ser um bucket **privado** no próprio Supabase de São Paulo (Storage é
S3-compatível) — mantém os dumps no Brasil, separados do Railway.

### Configuração da opção B (quando aprovada)

1. Supabase → Storage → criar bucket privado `backups-db` e gerar credenciais S3 (Storage → S3 Connection).
2. Railway → projeto → **New → Template → Postgres S3 Backups**.
3. Variáveis do serviço de backup:
   - `BACKUP_DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (role admin — o dump precisa ler tudo, sem RLS)
   - `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_S3_BUCKET=backups-db`
   - `AWS_S3_ENDPOINT` = endpoint S3 do Supabase · `AWS_S3_REGION=sa-east-1`
   - `BACKUP_CRON_SCHEDULE=0 6 * * *` (03:00 BRT)
4. Retenção: rotina semanal apagando objetos com mais de 30 dias (ou regra de lifecycle, se disponível).

## Teste de restore (fazer a cada trimestre e após qualquer mudança no backup)

1. Baixar o dump mais recente do bucket.
2. Subir um Postgres **temporário** (novo serviço Postgres no Railway, ou local).
3. Restaurar: `pg_restore --no-owner --dbname "$URL_TEMPORARIA" dump.backup`
   (ou `psql "$URL_TEMPORARIA" < dump.sql` para dumps em texto).
4. Conferir: `SELECT count(*) FROM tenants; SELECT count(*) FROM inscricoes;` e comparar com produção.
5. Conferir que RLS e a role `app_user` vieram junto (`\dp inscricoes`, `SELECT rolname FROM pg_roles`).
   Se a role não existir no destino, criar antes do restore (ver migração `multi_tenant_rls`).
6. Apagar o Postgres temporário e registrar data, tamanho do dump e tempo de restore no fim deste arquivo.

> Lembrete: o dump contém CPFs **criptografados**. Sem a `ENCRYPTION_KEY` (variável da API no Railway) eles
> não podem ser lidos — guarde a chave num cofre fora do Railway; perder a chave = perder os CPFs.

## Registro dos testes de restore

| Data | Origem do dump | Tamanho | Tempo | Resultado |
|---|---|---|---|---|
| — | — | — | — | pendente (backup ainda não configurado) |
