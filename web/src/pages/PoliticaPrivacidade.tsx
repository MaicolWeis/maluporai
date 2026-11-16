import { Link } from 'react-router-dom';

// Dados do operador da plataforma e do canal do encarregado (DPO).
// Preencher antes do go-live com os dados reais.
const OPERADOR = 'maluporai';
const CONTATO_ENCARREGADO = 'privacidade@maluporai.com.br';
const ATUALIZADA_EM = 'novembro de 2026';

const SUBPROCESSADORES = [
  { nome: 'Railway', finalidade: 'Hospedagem da API e do banco de dados', local: 'Estados Unidos' },
  { nome: 'Vercel', finalidade: 'Hospedagem da interface web', local: 'Estados Unidos (rede global)' },
  { nome: 'Supabase', finalidade: 'Armazenamento de arquivos (comprovantes e logos)', local: 'Brasil (São Paulo)' },
  {
    nome: 'OpenStreetMap (Nominatim)',
    finalidade: 'Localizar cidades no mapa — recebe só "cidade, estado, país", nunca dados de pessoas',
    local: 'Europa',
  },
  {
    nome: 'OpenStreetMap (mapas)',
    finalidade: 'Imagens do mapa exibidas no navegador (recebe o IP de quem abre o mapa)',
    local: 'Europa / rede global',
  },
  { nome: 'Resend', finalidade: 'Envio de e-mails transacionais (convites, redefinição de senha, avisos)', local: 'Estados Unidos' },
];

export function PoliticaPrivacidade() {
  return (
    <div className="min-h-screen bg-stone-100 py-10 px-4">
      <article className="max-w-3xl mx-auto bg-white rounded-xl border border-stone-200 shadow-card overflow-hidden">
        <div className="p-8 space-y-6 text-sm text-zinc-700 leading-relaxed">
          <header>
            <h1 className="text-2xl font-semibold text-zinc-900">Política de Privacidade</h1>
            <p className="text-xs text-zinc-400 mt-1">Atualizada em {ATUALIZADA_EM}</p>
          </header>

          <section className="space-y-2">
            <h2 className="font-bold text-zinc-900">Quem é quem</h2>
            <p>
              O {OPERADOR} é uma plataforma usada por guias, agências e organizadores de viagens em grupo (os
              <strong> clientes da plataforma</strong>) para gerir viagens, inscrições e pagamentos.
            </p>
            <p>
              Em relação aos dados dos <strong>viajantes</strong> cadastrados por cada organizador, o organizador é o{' '}
              <strong>controlador</strong> (decide quais dados coleta e para quê) e o {OPERADOR} atua como{' '}
              <strong>operador</strong>, tratando esses dados apenas para prestar o serviço, conforme as instruções do
              controlador (LGPD, art. 39). Pedidos de viajantes sobre seus dados devem ser feitos ao organizador da
              viagem — a plataforma oferece a ele as ferramentas de exportação e anonimização.
            </p>
            <p>
              Em relação aos dados dos <strong>usuários da plataforma</strong> (nome, e-mail e registros de acesso de
              quem usa o sistema), o {OPERADOR} é o controlador.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold text-zinc-900">Quais dados tratamos e por quê</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Viajantes</strong> (cadastrados pelo organizador): nome, telefone, e-mail, cidade, data de
                nascimento, contato de emergência, CPF (opcional, quando exigido pelo seguro), inscrições e pagamentos.
                Base legal: execução de contrato entre o viajante e o organizador. Comunicações de marketing só com
                consentimento registrado.
              </li>
              <li>
                <strong>Usuários da plataforma</strong>: nome, e-mail, senha (guardada apenas como hash irreversível),
                papel, data do último acesso, aceite destes termos. Base legal: execução do contrato de uso da
                plataforma.
              </li>
              <li>
                <strong>Registros de auditoria e de acesso</strong>: quem fez qual alteração ou abriu qual ficha de
                cliente, quando e de qual IP, e um registro técnico de cada chamada ao sistema (usuário, tela/rota,
                horário e IP, sem o conteúdo). Base legal:
                legítimo interesse e cumprimento de obrigação legal (segurança e rastreabilidade).
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold text-zinc-900">Como protegemos</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Isolamento entre organizadores no próprio banco de dados (cada um só acessa os próprios dados).</li>
              <li>CPF criptografado; arquivos em armazenamento privado com links temporários de 10 minutos.</li>
              <li>Conexões sempre criptografadas (HTTPS) e trilha de auditoria de todas as alterações.</li>
              <li>
                Fotos de comprovante tiradas pelo celular são redimensionadas no próprio aparelho antes do envio, o que
                também remove os metadados da foto (como a localização).
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold text-zinc-900">Dados guardados no celular (lista de embarque)</h2>
            <p>
              Para o guia conferir o embarque mesmo sem internet, a lista de embarque de uma viagem fica salva no
              navegador do aparelho de quem a abriu, com o mínimo necessário: nome do viajante, telefone, nome do
              acompanhante, se já pagou (sem valores) e se já embarcou. CPF, documentos, e-mail e valores nunca são
              guardados no aparelho. A lista é apagada quando a pessoa sai da conta, quando outro usuário entra no
              mesmo aparelho e, de qualquer forma, dois dias após o fim da viagem. O app não guarda outros dados
              pessoais no aparelho.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold text-zinc-900">Por quanto tempo guardamos</h2>
            <p>
              Cada organizador define o prazo de retenção dos dados dos viajantes (mínimo de 12 meses, padrão de 60
              meses). Passado o prazo sem inscrição ativa, os dados pessoais do viajante são anonimizados
              automaticamente; os valores financeiros são preservados para a contabilidade do organizador. O
              organizador é avisado 30 dias antes.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold text-zinc-900">Com quem compartilhamos (subprocessadores)</h2>
            <p>Usamos estes fornecedores para operar a plataforma:</p>
            <table className="w-full text-xs border border-stone-200 rounded">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left p-2">Fornecedor</th>
                  <th className="text-left p-2">Finalidade</th>
                  <th className="text-left p-2">Local</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {SUBPROCESSADORES.map((s) => (
                  <tr key={s.nome}>
                    <td className="p-2 font-semibold">{s.nome}</td>
                    <td className="p-2">{s.finalidade}</td>
                    <td className="p-2">{s.local}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              Parte desses fornecedores processa dados fora do Brasil. Essa transferência internacional ocorre para a
              execução do serviço, com fornecedores que adotam medidas de segurança compatíveis com a LGPD (art. 33).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold text-zinc-900">Seus direitos e o encarregado</h2>
            <p>
              Você pode pedir confirmação, acesso, correção, anonimização, portabilidade ou eliminação dos seus dados
              (LGPD, art. 18). Viajantes: falem com o organizador da sua viagem. Usuários da plataforma e dúvidas
              gerais: escreva para o encarregado de dados em{' '}
              <a className="font-semibold text-brand" href={`mailto:${CONTATO_ENCARREGADO}`}>
                {CONTATO_ENCARREGADO}
              </a>
              .
            </p>
          </section>

          <footer className="pt-4 border-t border-stone-200">
            <Link to="/login" className="text-sm font-semibold text-brand hover:text-brand-hover">
              Voltar ao maluporai
            </Link>
          </footer>
        </div>
      </article>
    </div>
  );
}
