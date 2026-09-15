maluporai — SaaS de Gestão de Viagens em Grupo
Documento de construção orientado a prompts. Cada feature vira um prompt autocontido, na ordem de execução. Projeto: maluporai.
1. Visão geral
SaaS multi-tenant para guias e empresas de turismo que organizam viagens em grupo (excursões, motoclubes, agências pequenas). Cada tenant gerencia suas próprias viagens, clientes, inscrições e despesas, com isolamento total de dados entre tenants.
Stack definida:
Camada
Tecnologia
Frontend
React 18 + Vite + TypeScript + Tailwind
Backend
Node.js 20 + Express + TypeScript + Prisma
Banco
PostgreSQL 16 (single database, shared schema, RLS)
Auth
JWT (access 15min + refresh 7d httpOnly cookie), senha com argon2id
Deploy sugerido
Vercel (front) + Railway (API + Postgres)
Justificativa do Node sobre Java: time de uma pessoa, reaproveitamento do padrão já validado no PulseOps (Express/Prisma/Postgres), velocidade de iteração. Se no futuro houver requisito corporativo (cliente enterprise exigindo Java/Spring), a separação clara entre API REST e front permite reescrever o backend sem tocar no front.
Estratégia multi-tenant: single database + shared schema + Row Level Security
Todas as tabelas de negócio carregam tenant_id. O isolamento acontece em duas camadas (defesa em profundidade):
Postgres RLS — política tenant_isolation em cada tabela, filtrando por current_setting('app.tenant_id'). Mesmo que a aplicação tenha um bug, o banco não devolve dados de outro tenant.
Middleware Prisma — toda query recebe tenant_id injetado automaticamente a partir do JWT. Nenhum endpoint aceita tenant_id vindo do client.
Alternativa descartada por ora: schema-per-tenant. Aumenta complexidade de migração e operação sem ganho real no volume esperado (dezenas a centenas de tenants pequenos). Revisar se surgir tenant com exigência de isolamento físico.
2. Modelo de dados
tenants
  id (uuid pk), nome_fantasia, razao_social, documento (cnpj/cpf),
  email_contato, telefone, plano, status (ativo|suspenso|cancelado),
  created_at, updated_at

users
  id (uuid pk), tenant_id (fk), nome, email (unique global),
  senha_hash, papel (admin|operador), status (ativo|inativo|convidado),
  ultimo_login_at, created_at, updated_at

tenant_settings
  id (uuid pk), tenant_id (fk unique), logo_url, cor_primaria,
  formas_pagamento (jsonb), categorias_despesa (jsonb),
  texto_termo_inscricao, prazo_retencao_dados_meses (default 60),
  created_at, updated_at

clientes
  id (uuid pk), tenant_id (fk), nome, cpf (criptografado), telefone,
  email, cidade, uf, data_nascimento, contato_emergencia_nome,
  contato_emergencia_telefone, observacoes,
  consentimento_marketing (bool), consentimento_em (timestamptz),
  anonimizado_em (timestamptz null), created_at, updated_at

viagens
  id (uuid pk), tenant_id (fk), nome, destino_cidade, destino_uf,
  data_inicio, data_fim, capacidade, preco_titular, preco_acompanhante,
  status (planejamento|inscricoes|confirmada|concluida|cancelada),
  descricao, created_at, updated_at

viagem_hoteis
  id (uuid pk), tenant_id, viagem_id (fk), nome, cidade, telefone,
  check_in, check_out, valor_negociado, observacoes

viagem_atracoes
  id (uuid pk), tenant_id, viagem_id (fk), nome, tipo (parque|passeio|
  refeicao|outro), valor_entrada, incluso (bool), observacoes

viagem_inclusos
  id (uuid pk), tenant_id, viagem_id (fk), descricao, ordem

inscricoes
  id (uuid pk), tenant_id, viagem_id (fk), cliente_id (fk),
  leva_acompanhante (bool), nome_acompanhante, doc_acompanhante,
  seguro_viagem (bool), seguradora, numero_apolice,
  valor_total, status (confirmada|cancelada|lista_espera),
  created_at, updated_at
  -- unique (viagem_id, cliente_id)

pagamentos
  id (uuid pk), tenant_id, inscricao_id (fk), valor, forma
  (pix|cartao|dinheiro|transferencia), parcelas, data_pagamento,
  comprovante_url, observacoes, created_at

despesas
  id (uuid pk), tenant_id, viagem_id (fk), categoria, descricao,
  valor, data_despesa, comprovante_url, created_at, updated_at

audit_logs
  id (bigserial pk), tenant_id, user_id, acao (create|update|delete|
  login|export|anonimizacao), entidade, entidade_id, dados_antes (jsonb),
  dados_depois (jsonb), ip, created_at
​
Observações de modelagem:
Pagamentos viram tabela própria (não campos na inscrição) porque o caso real é parcelado: sinal no Pix + restante no cartão. Status de pagamento da inscrição é derivado: sum(pagamentos) vs valor_total → pago / parcial / pendente.
"Garupa" vira acompanhante no modelo (genérico para qualquer nicho de turismo), mas a UI do tenant pode renomear via settings se quisermos no futuro.
CPF criptografado em repouso (pgcrypto ou criptografia na aplicação com chave em env). É o dado mais sensível do sistema.
audit_logs sem RLS de escrita pela aplicação comum — apenas insert via trigger/serviço, nunca update/delete.
3. Segurança e LGPD — requisitos transversais
Estes requisitos valem para todos os prompts e devem ser repetidos no contexto de cada um:
Isolamento
RLS ativo em todas as tabelas com tenant_id; conexão da aplicação usa role sem BYPASSRLS.
tenant_id sempre extraído do JWT no middleware, nunca do body/query.
Testes automatizados de isolamento: usuário do tenant A tentando acessar recurso do tenant B recebe 404 (não 403, para não vazar existência).
Autenticação e sessão
Senha: argon2id, mínimo 8 caracteres, verificação contra senhas vazadas comuns.
Rate limit: 5 tentativas de login por e-mail/15min, com resposta genérica ("credenciais inválidas") para não revelar se o e-mail existe.
Access token JWT 15min em memória; refresh token 7d em cookie httpOnly, Secure, SameSite=Strict, com rotação a cada uso e revogação no logout.
Reset de senha por token de uso único com expiração de 30min.
LGPD
Base legal: execução de contrato (dados de cliente/inscrição) e consentimento (marketing). Registrar consentimento com timestamp.
Minimização: coletar apenas o necessário. CPF é opcional no cadastro do cliente, obrigatório só quando o seguro exigir.
Direitos do titular: endpoint de exportação dos dados de um cliente (JSON/PDF) e anonimização (substitui nome/cpf/telefone/email por hash, preserva valores financeiros para contabilidade do tenant). Exclusão física só após prazo de retenção configurável.
O tenant é o controlador dos dados dos clientes dele; a plataforma é operadora. Refletir isso nos Termos de Uso e na Política de Privacidade.
Trilha de auditoria de todo acesso de escrita e das ações de exportação/anonimização.
TLS obrigatório, headers de segurança (helmet), CORS restrito ao domínio do front.
Geral
Validação de entrada com Zod em todas as rotas.
Nenhum dado sensível em logs de aplicação.
IDs públicos sempre UUID (nunca sequencial).
4. Ordem de execução e prompts
P0  Fundação do projeto (repos, tooling, CI básico)
P1  Banco de dados, Prisma, multi-tenancy e RLS
P2  Autenticação e registro de tenant (signup, login, refresh, reset)
P3  Gestão de usuários do tenant (convites, papéis)
P4  Configurações do tenant
P5  CRUD de Clientes (+ LGPD: consentimento, export, anonimização)
P6  CRUD de Viagens (com hotéis, atrações, inclusos)
P7  Inscrições (vínculo cliente↔viagem, acompanhante, seguro)
P8  Pagamentos
P8.5 Uploads (Supabase Storage: comprovantes e logo)
P9  Despesas
P10 Dashboard financeiro e visão geral
P11 Auditoria, hardening e checklist LGPD
P12 Deploy e observabilidade
​
A regra de dependência: P1 e P2 destravam tudo; P5 e P6 podem andar em paralelo depois de P4; P7 depende de P5+P6; P8 depende de P7.
Fluxo de trabalho por fase: cada fase roda numa branch própria criada a partir da main (nome indicado na primeira linha de cada prompt), vira um Pull Request, aguarda o CI verde (suíte completa com Postgres, incluindo testes de isolamento RLS) e passa por revisão antes do merge. Só iniciar a fase seguinte com a anterior mergeada — exceto P5 e P6, que podem correr em paralelo em branches separadas.
P0 — Fundação do projeto
Crie a branch p0-fundacao a partir da main e trabalhe nela.

Crie a estrutura inicial de um SaaS chamado maluporai, com dois projetos:

/api — Node.js 20 + Express + TypeScript + Prisma (PostgreSQL)
/web — React 18 + Vite + TypeScript + Tailwind CSS

Requisitos do /api:
- Estrutura em camadas: routes → controllers → services → repositories (Prisma)
- Middlewares base: helmet, cors (origem via env), express-rate-limit,
  request-id, logger estruturado (pino) sem dados sensíveis
- Validação de entrada com Zod em um middleware reutilizável validate(schema)
- Tratamento global de erros com classe AppError (statusCode, code, message)
  e resposta JSON padronizada { error: { code, message } }
- Healthcheck GET /health
- Variáveis de ambiente tipadas e validadas com Zod no boot (DATABASE_URL,
  JWT_SECRET, JWT_REFRESH_SECRET, FRONTEND_URL, ENCRYPTION_KEY)
- Scripts: dev (tsx watch), build, start, lint, test (vitest)

Requisitos do /web:
- React Router com estrutura de rotas públicas (/login, /signup,
  /esqueci-senha) e privadas (layout autenticado com sidebar)
- Axios com instância única: baseURL via env, interceptor que injeta o
  access token e, em 401, tenta refresh uma única vez antes de deslogar
- Estado de auth em contexto (user, tenant, papel) — token só em memória
- Tailwind configurado com tokens do design já aprovado: fundo stone-100,
  superfícies brancas, texto zinc-900, ação primária zinc-900 com texto
  amber-400, status emerald/amber/red. Fonte Archivo via Google Fonts.
- Componentes base: Button, Input, Select, Modal, Drawer (lateral direito),
  Pill (badge de status), Table, EmptyState, e a faixa "RoadStrip"
  (linha de estrada amarela tracejada sobre fundo zinc-900) usada como
  elemento de identidade no topo de cards, drawers e modais

Não implemente nenhuma feature de negócio ainda. Entregue o esqueleto
rodando com a tela de login estática e o healthcheck respondendo.
​
P1 — Banco, Prisma, multi-tenancy e RLS
Crie a branch p1-banco-rls a partir da main e trabalhe nela.

No projeto /api (Express + TypeScript + Prisma + PostgreSQL), implemente
a fundação multi-tenant.

1. Schema Prisma com as tabelas: tenants, users, tenant_settings,
   clientes, viagens, viagem_hoteis, viagem_atracoes, viagem_inclusos,
   inscricoes, pagamentos, despesas, audit_logs.
   [colar aqui a seção 2 — Modelo de dados — deste documento]
   Todas as tabelas de negócio têm tenant_id uuid not null com index.
   IDs são uuid v4 gerados pelo banco.

2. Migração SQL adicional (prisma migrate + script raw) que:
   - Habilita ROW LEVEL SECURITY em todas as tabelas com tenant_id
   - Cria política tenant_isolation USING
     (tenant_id = current_setting('app.tenant_id', true)::uuid)
     para SELECT, INSERT, UPDATE e DELETE
   - Cria a role app_user sem BYPASSRLS; a DATABASE_URL da aplicação
     usa essa role (migrações usam role separada de admin)
   - audit_logs: política que permite INSERT, nega UPDATE e DELETE

3. Tenant context na aplicação:
   - Middleware tenantContext que lê o tenant_id do JWT já validado e o
     armazena em AsyncLocalStorage
   - Prisma Client Extension que, em toda query, executa
     SET LOCAL app.tenant_id = '<uuid>' dentro de transação, e injeta
     tenant_id automaticamente em creates
   - Erro explícito se uma query de negócio rodar sem tenant no contexto

4. Criptografia de campo para clientes.cpf: helper encrypt/decrypt
   AES-256-GCM com ENCRYPTION_KEY do env, aplicado no service (o banco
   armazena apenas o ciphertext; busca por CPF usa hash determinístico
   em coluna separada cpf_hash).

5. Testes (vitest + banco de teste):
   - Query com tenant A não retorna registros do tenant B
   - Insert herda tenant_id do contexto mesmo se o payload tentar
     sobrescrever
   - Conexão app_user com app.tenant_id ausente não lê nenhuma linha

Entregue também um seed de desenvolvimento com 2 tenants e dados
mínimos para validar o isolamento manualmente.
​
P2 — Autenticação e registro de tenant
Crie a branch p2-auth a partir da main e trabalhe nela.

Implemente o fluxo de autenticação do maluporai (API + telas React).

Backend:
- POST /auth/signup — cria tenant + primeiro usuário admin em transação.
  Payload: nome_fantasia, documento, nome, email, senha. Senha com
  argon2id. E-mail único global. Cria tenant_settings com defaults
  (formas_pagamento: Pix, Cartão, Dinheiro, Transferência;
  categorias_despesa: Hotel, Ingressos, Seguro, Alimentação,
  Apoio/Transporte, Outros).
- POST /auth/login — valida credenciais, retorna access token (JWT 15min
  com sub, tenant_id, papel) no body e refresh token (7 dias) em cookie
  httpOnly Secure SameSite=Strict. Resposta de falha sempre genérica.
  Rate limit 5 tentativas/15min por e-mail+IP. Registra login no audit_log.
- POST /auth/refresh — rotação de refresh token (invalida o anterior,
  emite par novo). Refresh reutilizado = revoga a família inteira de
  tokens (detecção de roubo).
- POST /auth/logout — revoga refresh token e limpa cookie.
- POST /auth/esqueci-senha — gera token de uso único (hash no banco,
  expiração 30min) e envia e-mail via Resend (EmailService com driver
  Resend em produção e driver console em dev; RESEND_API_KEY e
  EMAIL_FROM no env validado). Resposta idêntica exista ou não o e-mail.
- POST /auth/redefinir-senha — valida token, troca senha, revoga todas
  as sessões do usuário.
- Middleware requireAuth (valida JWT, popula tenant context) e
  requireRole('admin').

Frontend:
- /signup — formulário em card com RoadStrip no topo, em duas etapas:
  dados da empresa → dados do usuário admin. Validação com mensagens
  inline. Ao concluir, login automático e redirect para /viagens.
- /login — e-mail e senha, link para esqueci-senha. Erro genérico.
- /esqueci-senha e /redefinir-senha/:token.
- Guard de rotas privadas: sem sessão → /login preservando a rota de
  destino para redirect pós-login.

Critérios de aceite:
- Tokens nunca em localStorage
- Signup cria tenant isolado verificável pelos testes de RLS do P1
- Todas as rotas de auth com validação Zod e respostas padronizadas
​
P3 — Gestão de usuários do tenant
Crie a branch p3-usuarios a partir da main e trabalhe nela.

Implemente a gestão de usuários internos do tenant (apenas papel admin).

Backend:
- GET /usuarios — lista usuários do tenant (nome, email, papel, status,
  ultimo_login_at)
- POST /usuarios/convites — cria usuário com status 'convidado' e envia
  e-mail com token de ativação (72h). Payload: nome, email, papel
  (admin|operador)
- POST /auth/ativar-conta — valida token, define senha, ativa usuário
- PATCH /usuarios/:id — alterar papel ou status (ativo|inativo).
  Regras: não pode rebaixar/inativar o último admin ativo; usuário não
  altera o próprio papel
- DELETE /usuarios/:id — apenas se nunca logou (senão, inativar)
- Toda mutação registrada em audit_logs

Papéis nesta fase:
- admin: tudo, incluindo usuários, configurações e exclusões
- operador: CRUD de clientes, viagens, inscrições, pagamentos e
  despesas; sem acesso a usuários, configurações e anonimização LGPD
- Implementar como middleware requireRole + helper can(user, acao)
  centralizado em um único arquivo de policies, para facilitar a
  evolução futura para permissões granulares

Frontend:
- /configuracoes/usuarios — tabela com Pill de status e papel, botão
  "Convidar usuário" abrindo Modal (nome, email, papel), ações de
  inativar/reativar com confirmação
- /ativar-conta/:token — definição de senha do convidado
- Menu lateral esconde itens sem permissão; API continua validando
  no servidor (defesa em profundidade)
​
P4 — Configurações do tenant
Crie a branch p4-configuracoes a partir da main e trabalhe nela.

Implemente a tela e API de configurações do tenant (papel admin).

Backend:
- GET /configuracoes — retorna tenant + tenant_settings
- PATCH /configuracoes/empresa — nome_fantasia, razao_social, documento,
  email_contato, telefone
- PATCH /configuracoes/preferencias — logo_url (upload em P12; por ora
  URL), cor_primaria, formas_pagamento (lista editável),
  categorias_despesa (lista editável), texto_termo_inscricao,
  prazo_retencao_dados_meses (mínimo 12)
- Regra: remover uma forma de pagamento/categoria em uso não apaga
  registros históricos — apenas a tira das opções de novos lançamentos

Frontend:
- /configuracoes com abas: Empresa | Preferências | Usuários (P3) |
  Privacidade
- Preferências: edição das listas como chips adicionáveis/removíveis,
  preview da cor primária aplicada em um Card de exemplo
- Privacidade: campo do prazo de retenção com explicação em linguagem
  simples do que acontece (anonimização automática de clientes sem
  inscrição ativa após o prazo), e link para a Política de Privacidade
  da plataforma
​
P5 — CRUD de Clientes + LGPD
Crie a branch p5-clientes a partir da main e trabalhe nela.

Implemente o cadastro de clientes do tenant.

Backend:
- GET /clientes — paginação, busca por nome/telefone/cidade, filtro
  "com inscrição ativa". Nunca retorna CPF descriptografado em listagem
- GET /clientes/:id — detalhe completo (CPF mascarado: ***.***.***-12;
  endpoint separado GET /clientes/:id/cpf para revelar, registrado em
  audit_log)
- POST /clientes — nome e telefone obrigatórios; cpf, email, cidade,
  uf, data_nascimento, contato de emergência e observações opcionais;
  consentimento_marketing com timestamp quando true
- PATCH /clientes/:id
- DELETE /clientes/:id — bloqueado se houver inscrição; orientar
  anonimização
- POST /clientes/:id/anonimizar (admin) — substitui nome, cpf, telefone,
  email e contatos por valores anonimizados, marca anonimizado_em,
  preserva inscrições e valores para histórico financeiro. Irreversível,
  exige confirmação por senha do admin. Audit log obrigatório
- GET /clientes/:id/exportar (admin) — JSON com todos os dados do
  titular: cadastro, inscrições, pagamentos. Atende pedido de acesso
  do titular (LGPD art. 18). Audit log obrigatório

Frontend:
- /clientes — tabela (nome, telefone, cidade, viagens vinculadas como
  Pills, status de consentimento), busca e botão "Novo cliente"
- Drawer de detalhe do cliente com abas: Dados | Viagens | Privacidade
  - Dados: formulário de edição
  - Viagens: histórico de inscrições com status de pagamento
  - Privacidade (admin): consentimento, exportar dados, anonimizar
    (modal de confirmação destrutiva com digitação do nome do cliente)
- Formulário de novo cliente em Modal, com checkbox de consentimento
  de marketing desmarcado por padrão e texto claro do que significa
​
P6 — CRUD de Viagens
Crie a branch p6-viagens a partir da main e trabalhe nela.

Implemente o cadastro de viagens com seus agregados.

Backend:
- GET /viagens — lista com filtros por status e período; cada item já
  retorna agregados: pessoas confirmadas (titulares + acompanhantes),
  capacidade, total recebido, total de despesas
- GET /viagens/:id — detalhe com hoteis, atracoes, inclusos e agregados
- POST /viagens, PATCH /viagens/:id
- PATCH /viagens/:id/status — transições válidas: planejamento →
  inscricoes → confirmada → concluida; cancelada a partir de qualquer
  estado não concluído. Cancelar viagem com inscrições exige motivo e
  marca inscrições como canceladas
- Sub-recursos com CRUD próprio:
  /viagens/:id/hoteis, /viagens/:id/atracoes, /viagens/:id/inclusos
- DELETE /viagens/:id apenas em planejamento sem inscrições

Frontend (reaproveitar o protótipo aprovado):
- /viagens — grid de cards: RoadStrip no topo, nome, Pill de status,
  destino/UF, datas, barra de ocupação âmbar, recebido (emerald) vs
  despesas (red)
- Card abre Drawer com abas: Resumo | Clientes | Despesas | Financeiro
  (Clientes em P7, Despesas em P9, Financeiro em P10 — nesta fase as
  abas futuras mostram EmptyState)
- Aba Resumo: hospedagem (cards de hotel com check-in/out), parques e
  atrações (marcando o que está incluso), chips escuros de "o que está
  incluso", valores titular/acompanhante
- Modal "Nova viagem" e edição inline no drawer
- Mudança de status com select no header do drawer respeitando as
  transições válidas
​
P7 — Inscrições
Crie a branch p7-inscricoes a partir da main e trabalhe nela.

Implemente o vínculo cliente ↔ viagem (inscrições).

Backend:
- GET /viagens/:id/inscricoes — lista com dados do cliente, flags de
  acompanhante e seguro, valor_total, valor pago (soma de pagamentos)
  e status de pagamento derivado (pago|parcial|pendente)
- POST /viagens/:id/inscricoes — payload: cliente_id, leva_acompanhante,
  nome_acompanhante, doc_acompanhante, seguro_viagem, seguradora,
  numero_apolice, valor_total (default: preco_titular + se acompanhante
  preco_acompanhante; editável). Regras:
  - unique cliente por viagem
  - bloquear acima da capacidade (titular + acompanhante contam);
    opção explícita de lista_espera
  - viagem precisa estar em status inscricoes ou confirmada
- PATCH /inscricoes/:id — alterar acompanhante, seguro, valor
- POST /inscricoes/:id/cancelar — exige motivo; mantém pagamentos
  registrados e sinaliza saldo a devolver no financeiro

Frontend (aba Clientes do drawer da viagem):
- Lista de inscritos: nome, telefone, Pills de forma de pagamento
  predominante, acompanhante (com nome), seguro; status de pagamento
  como Pill colorida; valor total e pago
- Form de vínculo: select de clientes do tenant ainda não inscritos
  com busca, atalho para cadastrar cliente novo (abre o Modal do P5 e
  volta com o cliente selecionado), checkboxes de acompanhante (campo
  de nome condicional) e seguro (seguradora/apólice condicionais),
  valor calculado automaticamente e editável
- Indicador de vagas restantes no topo da aba; ao atingir a capacidade,
  oferecer lista de espera
​
P8 — Pagamentos
Crie a branch p8-pagamentos a partir da main e trabalhe nela.

Implemente o registro de pagamentos por inscrição.

Backend:
- GET /inscricoes/:id/pagamentos
- POST /inscricoes/:id/pagamentos — valor, forma (das formas do tenant),
  parcelas (para cartão), data_pagamento, observacoes. Regras:
  - soma dos pagamentos não pode exceder valor_total (a não ser flag
    explícita de ajuste, registrada em observação)
  - cada pagamento gera audit_log
- DELETE /pagamentos/:id — apenas admin, com motivo, audit log
- O status derivado da inscrição (pago/parcial/pendente) é recalculado
  e refletido nas listagens do P7

Frontend:
- No card do inscrito (aba Clientes do drawer): expandir para ver a
  linha do tempo de pagamentos (data, forma, valor) e botão "Registrar
  pagamento" abrindo mini-form inline (valor com atalho "quitar saldo",
  forma, data, parcelas se cartão)
- Barra de progresso de pagamento no card do inscrito (pago/total)
​
P8.5 — Uploads (Supabase Storage)
Crie a branch p8-5-uploads a partir da main e trabalhe nela.

Implemente upload de arquivos usando Supabase Storage (apenas o
Storage — o banco continua sendo o Postgres próprio da aplicação).

Backend:
- Cliente Supabase com service role key apenas no servidor
  (SUPABASE_URL e SUPABASE_SERVICE_KEY no env validado); o front
  nunca fala direto com o Storage
- Buckets privados: comprovantes e logos, com estrutura de pastas
  por tenant: {tenant_id}/{entidade}/{uuid}.{ext}
- POST /uploads — multipart, valida tipo (jpg, png, webp, pdf) e
  tamanho (máx 5MB), gera nome aleatório, sobe para o bucket e
  retorna o path. Vincular o path em pagamentos.comprovante_url,
  despesas.comprovante_url ou tenant_settings.logo_url
- GET /uploads/signed-url?path= — gera URL assinada com expiração
  de 10min, validando que o path pertence ao tenant do JWT antes
  de assinar (o prefixo {tenant_id}/ é a fronteira de isolamento)
- DELETE acompanha a exclusão da entidade dona do arquivo
- Audit log em upload e exclusão de comprovantes

Frontend:
- Componente FileUpload reutilizável (drag and drop + clique,
  preview de imagem, estado de progresso e erro)
- Anexar comprovante no form de pagamento (P8) e de despesa (P9);
  visualização abre a URL assinada em nova aba
- Upload de logo em /configuracoes/preferencias com preview

Critério de aceite de segurança:
- Usuário do tenant A não consegue obter URL assinada de arquivo
  do tenant B (teste automatizado)
​
P9 — Despesas
Crie a branch p9-despesas a partir da main e trabalhe nela.

Implemente o lançamento de despesas por viagem.

Backend:
- GET /viagens/:id/despesas — lista + total por categoria
- POST /viagens/:id/despesas — categoria (das categorias do tenant),
  descricao, valor, data_despesa
- PATCH /despesas/:id, DELETE /despesas/:id (com audit log)

Frontend (aba Despesas do drawer):
- Lista com Pill de categoria, descrição, valor em vermelho, data
- Form de lançamento rápido no rodapé da lista (categoria, descrição,
  valor) — replicar o padrão do protótipo aprovado
- Rodapé fixo escuro com total de despesas
- Mini-resumo por categoria (Hotel R$ X · Ingressos R$ Y ...)
​
P10 — Dashboard financeiro e visão geral
Crie a branch p10-dashboard a partir da main e trabalhe nela.

Implemente a consolidação financeira.

Backend:
- GET /viagens/:id/financeiro — receita prevista (soma valor_total das
  inscrições confirmadas), recebido, a receber, despesas, resultado
  atual (recebido − despesas), resultado previsto (previsto − despesas),
  margem prevista %, e a devolver (pagamentos de inscrições canceladas)
- GET /dashboard — visão do tenant: próximas viagens com ocupação,
  total a receber no mês, inadimplentes (inscrições pendentes com
  viagem a menos de 30 dias), resultado consolidado por viagem

Frontend:
- Aba Financeiro do drawer: tabela de linhas (prevista, recebido,
  a receber, despesas, a devolver) + dois cards de resultado
  (atual emerald/red e previsto) com a nota explicando a diferença —
  manter o layout do protótipo
- /dashboard como home autenticada: cards das próximas viagens,
  lista de pendências de pagamento com atalho para a inscrição,
  gráfico simples (recharts) de resultado por viagem
​
P11 — Auditoria, hardening e checklist LGPD
Crie a branch p11-auditoria-lgpd a partir da main e trabalhe nela.

Feche o ciclo de segurança antes do deploy.

1. Auditoria:
- Garantir que todas as mutações de negócio gravam audit_log
  (varredura nos services + teste de integração por entidade)
- GET /auditoria (admin) — filtros por usuário, entidade e período,
  paginado; tela em /configuracoes/auditoria

2. Hardening:
- Revisar rate limits por rota (auth mais agressivo, escrita moderado)
- Garantir 404 em recursos de outro tenant (teste e2e dedicado)
- Dependabot/npm audit no CI; headers verificados (CSP mínima no front)
- Backup automático do Postgres (diário, retenção 30 dias) e teste
  de restore documentado

3. Rotina LGPD:
- Job diário: anonimizar clientes sem inscrição ativa cujo updated_at
  exceda o prazo_retencao_dados_meses do tenant, com aviso ao admin
  por e-mail 30 dias antes
- Página pública /privacidade (política da plataforma: papel de
  operadora, subprocessadores — host, e-mail —, canal do encarregado)
- Termo de uso no signup com aceite registrado (versão + timestamp)
- Documento interno: Registro de Operações de Tratamento (tabela:
  dado, finalidade, base legal, retenção) — gerar em markdown no repo
​
P12 — Deploy e observabilidade
Crie a branch p12-deploy a partir da main e trabalhe nela.

Prepare o deploy de produção.

- /web na Vercel (build Vite, env VITE_API_URL)
- /api + Postgres no Railway: variáveis de ambiente (incluindo
  RESEND_API_KEY, EMAIL_FROM, SUPABASE_URL, SUPABASE_SERVICE_KEY),
  role da aplicação sem BYPASSRLS, migração executada por job
  separado com role admin
- Resend: domínio de envio verificado (SPF/DKIM) antes do go-live
- Domínios: app.<dominio>.com.br (front) e api.<dominio>.com.br;
  TLS automático; CORS travado no domínio do front; cookies Secure
- Logs estruturados agregados (Railway logs ou Better Stack), alerta
  de erro 5xx
- Sentry no front e na API (scrub de dados pessoais ativado)
- Uptime check no /health
- Checklist final de smoke test em produção: signup de tenant de teste,
  fluxo viagem → cliente → inscrição → pagamento → despesa → financeiro,
  isolamento entre dois tenants reais, reset de senha por e-mail
​
5. Decisões tomadas e evoluções planejadas
Decidido:
E-mail transacional: Resend. Necessário a partir do P2 (convites, reset de senha, avisos LGPD). Driver console em dev, Resend em produção. Pendência operacional: verificar o domínio de envio no painel do Resend antes do deploy.
Arquivos: Supabase Storage (somente Storage; o banco segue no Postgres da aplicação). Implementação no P8.5, com buckets privados, pastas por tenant e URLs assinadas.
Evolução pós-MVP (não construir agora):
Cobrança dos tenants (monetização do SaaS): campo plano já existe no tenant para não exigir migração depois.
Portal do viajante (cliente final consultando a própria inscrição e pagando online): maior diferencial competitivo, mas só após validar o MVP com a primeira guia.
Documento de construção · maluporai v0.3 · Setembro/2026
