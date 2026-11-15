# Deploy — ambiente de teste

Arquitetura: front na **Vercel** (`web/`) e API + Postgres no **Railway** (`api/`).
O navegador só fala com o domínio da Vercel; a Vercel repassa `/api/*` para a API
no Railway (rewrite em `web/vercel.json`). Assim o cookie de refresh
(`SameSite=Strict`, `httpOnly`, `Secure`) é first-party e funciona sem domínio próprio.

## Railway (API + Postgres)

1. Projeto novo → **Deploy from GitHub repo** → `maluporai`, *Root Directory* `api`.
   O `api/railway.json` define build, pre-deploy (`npm run release`) e start.
2. Adicionar serviço **PostgreSQL** no mesmo projeto.
3. *Networking* da API → gerar domínio público `maluporai-api.up.railway.app`
   (se mudar, atualizar o destino em `web/vercel.json`).
4. Variáveis da API:

| Variável | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `APP_USER_PASSWORD` | segredo aleatório (≥ 24 chars) |
| `MIGRATION_DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (role admin, só no release) |
| `DATABASE_URL` | `postgresql://app_user:${{APP_USER_PASSWORD}}@${{Postgres.PGHOST}}:${{Postgres.PGPORT}}/${{Postgres.PGDATABASE}}` |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | 64 hex cada, distintos |
| `ENCRYPTION_KEY` | 64 hex (**não perder**: sem ela os CPFs não descriptografam) |
| `FRONTEND_URL` | `https://<projeto>.vercel.app` |
| `REFRESH_COOKIE_PATH` | `/api/auth` |
| `TRUST_PROXY` | `2` (Vercel + borda do Railway) |
| `EMAIL_DRIVER` | `console` no teste (links nos logs); `resend` no go-live |

O release aplica as migrações com a role admin e gira a senha de `app_user`
(a migração cria a role com senha placeholder). A aplicação conecta sempre como
`app_user`, sem `BYPASSRLS`.

## Vercel (web)

1. *Add New Project* → `maluporai`, *Root Directory* `web` (framework Vite).
2. Variável `VITE_API_URL` = `/api`.

## Go-live (pendente, P12 completo)

- `EMAIL_DRIVER=resend` + `RESEND_API_KEY` + `EMAIL_FROM` com domínio verificado (SPF/DKIM).
- Domínio próprio, Sentry, uptime check, backup diário do Postgres.
