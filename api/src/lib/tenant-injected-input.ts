/**
 * A extensão de tenant (lib/prisma.ts) injeta tenant_id em todo create,
 * então os repositories nunca passam esse campo explicitamente — mas o
 * tipo gerado pelo Prisma (UncheckedCreateInput) exige tenantId como
 * obrigatório, porque ele não sabe da extensão. Este helper isola, num só
 * lugar documentado, o cast que diz ao TypeScript "confie que o runtime
 * preenche o resto" — sem perder a checagem de tipo dos demais campos.
 */
export function withInjectedTenant<T extends { tenantId: string }>(data: Omit<T, 'tenantId'>): T {
  return data as unknown as T;
}
