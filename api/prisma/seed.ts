import { prisma } from '../src/lib/prisma.js';
import { runWithTenant } from '../src/lib/tenant-context.js';
import { encryptField, hashForLookup } from '../src/lib/crypto.js';

const FORMAS_PAGAMENTO_DEFAULT = ['Pix', 'Cartão', 'Dinheiro', 'Transferência'];
const CATEGORIAS_DESPESA_DEFAULT = ['Hotel', 'Ingressos', 'Seguro', 'Alimentação', 'Apoio/Transporte', 'Outros'];

async function seedTenant(nomeFantasia: string, documento: string, cpfCliente: string) {
  const tenant = await prisma.tenant.create({
    data: {
      nomeFantasia,
      documento,
      emailContato: `contato@${nomeFantasia.toLowerCase().replace(/\s+/g, '-')}.com.br`,
    },
  });

  await runWithTenant(tenant.id, async () => {
    await prisma.tenantSettings.create({
      data: {
        tenantId: tenant.id,
        formasPagamento: FORMAS_PAGAMENTO_DEFAULT,
        categoriasDespesa: CATEGORIAS_DESPESA_DEFAULT,
      },
    });

    await prisma.user.create({
      data: {
        // senha_hash real (argon2id) só existe a partir do P2; aqui é placeholder de seed.
        senhaHash: 'seed-placeholder-substituido-no-P2',
        nome: `Admin ${nomeFantasia}`,
        email: `admin@${nomeFantasia.toLowerCase().replace(/\s+/g, '-')}.com.br`,
        papel: 'admin',
      },
    });

    await prisma.cliente.create({
      data: {
        nome: `Cliente exemplo (${nomeFantasia})`,
        telefone: '11999990000',
        cpf: encryptField(cpfCliente),
        cpfHash: hashForLookup(cpfCliente),
      },
    });
  });

  return tenant;
}

async function main() {
  console.log('Seed: criando 2 tenants isolados para validar RLS manualmente...');

  const tenantA = await seedTenant('Excursões da Serra', '11.111.111/0001-11', '11111111111');
  const tenantB = await seedTenant('MotoClube Estrada Livre', '22.222.222/0001-22', '22222222222');

  console.log(`Tenant A: ${tenantA.id} (${tenantA.nomeFantasia})`);
  console.log(`Tenant B: ${tenantB.id} (${tenantB.nomeFantasia})`);
  console.log('\nValidação manual de isolamento:');
  console.log(`  runWithTenant('${tenantA.id}', () => prisma.cliente.findMany())`);
  console.log('  → deve retornar só o cliente do Tenant A, nunca o do Tenant B.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
