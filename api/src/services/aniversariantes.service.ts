import { prisma } from '../lib/prisma.js';
import { hojeBrasil } from './financeiro.service.js';

/**
 * Aniversariantes de um mês (padrão: mês atual no fuso de Brasília), em
 * ordem de dia. Só clientes ativos (anonimizados ficam de fora). A data de
 * nascimento é DATE no banco: dia/mês vêm dos campos UTC, sem fuso.
 */
export async function aniversariantesDoMes(mes?: number) {
  const hoje = hojeBrasil();
  const mesAlvo = mes ?? hoje.getUTCMonth() + 1;

  const clientes = await prisma.cliente.findMany({
    where: { anonimizadoEm: null, dataNascimento: { not: null } },
    select: { id: true, nome: true, telefone: true, dataNascimento: true },
  });

  const aniversariantes = clientes
    .filter((c) => c.dataNascimento!.getUTCMonth() + 1 === mesAlvo)
    .map((c) => {
      const nasc = c.dataNascimento!;
      const dia = nasc.getUTCDate();
      // Idade que completa no aniversário deste ano.
      const idade = hoje.getUTCFullYear() - nasc.getUTCFullYear();
      const ehHoje = mesAlvo === hoje.getUTCMonth() + 1 && dia === hoje.getUTCDate();
      const jaPassou =
        mesAlvo < hoje.getUTCMonth() + 1 || (mesAlvo === hoje.getUTCMonth() + 1 && dia < hoje.getUTCDate());
      return {
        clienteId: c.id,
        nome: c.nome,
        telefone: c.telefone,
        dia,
        dataNascimento: nasc.toISOString().slice(0, 10),
        idade,
        hoje: ehHoje,
        jaPassou,
      };
    })
    .sort((a, b) => a.dia - b.dia || a.nome.localeCompare(b.nome, 'pt-BR'));

  return { mes: mesAlvo, ano: hoje.getUTCFullYear(), aniversariantes };
}
