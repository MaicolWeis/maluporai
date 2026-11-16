# Registro das Operações de Tratamento de Dados Pessoais (ROPA)

Documento interno exigido pela LGPD (art. 37). Mantido junto ao código: atualizar sempre que um campo,
finalidade, fornecedor ou prazo mudar. Última revisão: novembro/2026 (P11).

## Papéis

- **Tenant (organizador de viagens)** — controlador dos dados dos viajantes que cadastra.
- **maluporai (plataforma)** — operador desses dados; controlador dos dados dos próprios usuários da
  plataforma e dos registros de acesso.

## Operações

| Dado | Titular | Finalidade | Base legal (LGPD) | Retenção | Onde fica |
|---|---|---|---|---|---|
| Nome, telefone, e-mail, cidade/UF | Viajante | Organizar a viagem e falar com o viajante | Execução de contrato (art. 7º, V) | Prazo do tenant (mín. 12, padrão 60 meses sem inscrição ativa), depois anonimização automática | Postgres (Railway, EUA) |
| Data de nascimento | Viajante | Seguro viagem, faixa etária de ingressos | Execução de contrato | Idem | Postgres |
| CPF (opcional) | Viajante | Seguro viagem / emissão quando exigido | Execução de contrato | Idem; armazenado **criptografado** (AES-256-GCM) + hash para busca | Postgres |
| Contato de emergência (nome, telefone) | Terceiro indicado pelo viajante | Segurança durante a viagem | Proteção da vida (art. 7º, VII) / execução de contrato | Idem | Postgres |
| Nome e documento do acompanhante | Acompanhante | Inscrição na viagem | Execução de contrato | Idem (vinculado à inscrição) | Postgres |
| Seguradora e nº de apólice | Viajante | Controle do seguro | Execução de contrato | Idem | Postgres |
| Consentimento de marketing + data | Viajante | Envio de comunicações | Consentimento (art. 7º, I) | Até revogação ou anonimização | Postgres |
| Inscrições, valores, pagamentos | Viajante | Gestão financeira do tenant | Execução de contrato / obrigação legal (art. 7º, II) | Preservados após anonimização (sem identificar o titular) | Postgres |
| Comprovantes de pagamento/despesa | Viajante / fornecedores | Conferência financeira | Execução de contrato / obrigação legal | Enquanto o pagamento/despesa existir | Supabase Storage (São Paulo), bucket privado |
| Embarque (horário em que o guia marcou) | Viajante | Conferir quem embarcou no dia da viagem | Execução de contrato / proteção da vida | Idem (vinculado à inscrição) | Postgres |
| Cópia local da lista de embarque: nome, telefone, nome do acompanhante, situação do pagamento (sem valores) e embarque — **sem CPF/documentos/e-mail/valores** | Viajante / acompanhante | Consulta e marcação de embarque sem internet | Execução de contrato | Apagada no logout, na troca de usuário e 2 dias após o fim da viagem | `localStorage` do aparelho do usuário que abriu a aba Embarque |
| Nome, e-mail, senha (hash argon2id), papel, último login | Usuário da plataforma | Acesso ao sistema | Execução de contrato | Enquanto a conta existir | Postgres |
| Aceite dos termos (versão + data) | Usuário admin | Comprovar aceite | Execução de contrato / exercício regular de direitos | Enquanto a conta existir | Postgres |
| Log de acesso à API (usuário, empresa, rota em modelo sem IDs, status, duração, IP, data) — sem corpo, tokens ou respostas | Usuários | Segurança, investigação de incidentes e monitoramento de uso | Legítimo interesse (art. 7º, IX) | Retenção de logs do provedor (dias) | Logs do Railway (EUA) |
| Logs de auditoria (ação, usuário, IP, data; inclui consulta de ficha de cliente e ativação de conta) | Usuários | Segurança, rastreabilidade | Legítimo interesse (art. 7º, IX) / obrigação legal | Indefinido hoje — **definir prazo** (sugestão: 5 anos) | Postgres (append-only) |
| E-mails transacionais (destinatário, conteúdo) | Usuários | Convites, reset de senha, avisos LGPD | Execução de contrato | Conforme retenção do provedor | Resend (EUA) — ainda em modo log |

## Subprocessadores e transferência internacional

| Fornecedor | Uso | Região | Transferência internacional? |
|---|---|---|---|
| Railway | API + Postgres | EUA (US West) | Sim |
| Vercel | Front-end / proxy da API | EUA / rede global | Sim (dados em trânsito) |
| Supabase | Arquivos | Brasil (sa-east-1) | Não |
| Resend | E-mail | EUA | Sim (quando ativado) |

Fundamento das transferências: art. 33 da LGPD — revisar os DPAs de cada fornecedor e registrar aqui a
cláusula/mecanismo utilizado. **Pendente.**

## Direitos do titular — como atendemos

| Direito | Como |
|---|---|
| Acesso / portabilidade | Admin do tenant: `GET /clientes/:id/exportar` (JSON) — auditado |
| Correção | Edição do cadastro pelo tenant |
| Anonimização / eliminação | `POST /clientes/:id/anonimizar` (confirmação por senha) — auditado; rotina automática após o prazo |
| Revogação do consentimento | Desmarcar consentimento de marketing no cadastro |

## Medidas de segurança

RLS no Postgres por tenant + role sem BYPASSRLS; JWT de curta duração com refresh rotativo em cookie
httpOnly/SameSite=Strict; argon2id; CPF criptografado; buckets privados com URL assinada de 10 min e
fronteira por tenant; rate limit por rota; CSP e cabeçalhos de segurança; trilha de auditoria append-only;
validação de entrada com Zod; Dependabot + `npm audit` no CI. PWA: o service worker só guarda a
casca do app (HTML/JS/CSS/fontes), nunca respostas da API; fotos de comprovante são regravadas em JPEG no
aparelho antes do upload, descartando EXIF/GPS.

## Pendências

- [ ] Backup automático do banco (ver `docs/backup-restore.md`).
- [ ] Definir prazo de retenção dos logs de auditoria.
- [ ] Registrar mecanismo do art. 33 para Railway, Vercel e Resend.
- [ ] Nomear o encarregado e publicar o canal real em `/privacidade`.
