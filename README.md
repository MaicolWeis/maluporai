# maluporai

SaaS multi-tenant de gestão de viagens em grupo (excursões, motoclubes, agências pequenas).

## Estrutura

- `api/` — Node.js 20 + Express + TypeScript + Prisma (PostgreSQL)
- `web/` — React 18 + Vite + TypeScript + Tailwind CSS

## Rodando em desenvolvimento

```bash
# API
cd api
cp .env.example .env   # ajustar DATABASE_URL e secrets
npm install
npm run dev            # http://localhost:3333/health

# Web
cd web
cp .env.example .env
npm install
npm run dev            # http://localhost:5173
```

## Documento de construção

O plano completo (prompts P0–P12, modelo de dados, requisitos de segurança e LGPD)
está em `docs/maluporai-prompts-construcao.md`. Status atual: **P0 concluído**.
