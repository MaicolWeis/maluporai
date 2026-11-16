/** @type {import('tailwindcss').Config} */

// Tokens do NSDS (design system do TMS LTL) com a cor de marca trocada pelo
// azul BMW. Os neutros zinc/stone usados nas telas foram remapeados para a
// escala slate do NSDS, assim todo o app adota a mesma paleta sem reescrever
// classe por classe.
const slate = {
  50: '#F8FAFC',
  100: '#F1F5F9',
  200: '#E2E8F0',
  300: '#CBD5E1',
  400: '#94A3B8',
  500: '#64748B',
  600: '#475569',
  700: '#334155',
  800: '#1E293B',
  900: '#1F2937', // texto principal do NSDS
};

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        zinc: slate,
        stone: slate,
        brand: {
          DEFAULT: '#1C69D4', // azul BMW
          hover: '#1659B8',
          soft: '#EBF3FD',
          border: '#A9C8F2',
          ink: '#0F3F80',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      // Escala do NSDS: rótulos 11px, corpo 13px.
      fontSize: {
        xs: ['11px', '16px'],
        sm: ['13px', '20px'],
        base: ['14px', '22px'],
      },
      borderRadius: {
        md: '6.4px',
        lg: '6.4px',
        xl: '11.2px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,0.05)',
        pop: '0 12px 32px rgba(15,23,42,0.18)',
      },
    },
  },
  plugins: [],
};
