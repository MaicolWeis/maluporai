import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Testes de isolamento de tenant compartilham o banco de teste — rodar
    // em série evita transações concorrentes pisando nos mesmos dados.
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
