const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/app/api/auth/\[\.\.\.nextauth\]/auth-options$': '<rootDir>/__tests__/mocks/auth-options.ts',
    '^@/(.*)$': '<rootDir>/$1',
    '^superjson$': '<rootDir>/__tests__/mocks/superjson.ts',
    '^\\./server/(.*)$': '<rootDir>/server/$1',
    '^\\./app/api/auth/\\[\\.\\.\\.nextauth\\]/auth-options$': '<rootDir>/__tests__/mocks/auth-options.ts',
    '^\\./lib/prisma$': '<rootDir>/lib/prisma.ts',
    '^\\./lib/services/pdf-puppeteer$': '<rootDir>/lib/services/pdf-puppeteer.ts',
    '^\\./lib/services/work-report-pdf$': '<rootDir>/lib/services/work-report-pdf.ts',
    '^\\./lib/data/iran-holidays-1405$': '<rootDir>/lib/data/iran-holidays-1405.ts',
  },
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)(spec|test).[jt]s?(x)',
    '!**/e2e/**',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/e2e/',
    '/.next/',
  ],
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    'server/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
  ],
  transformIgnorePatterns: [
    '/node_modules/(?!(superjson|copy-anything|is-what)/).+\\.js$',
  ],
  transform: {
    '^.+\\.(ts|tsx)$': ['@swc/jest', {
      jsc: {
        parser: {
          syntax: 'typescript',
          tsx: true,
        },
      },
    }],
    '^.+\\.(js|jsx)$': ['@swc/jest', {
      jsc: {
        parser: {
          syntax: 'ecmascript',
          jsx: true,
        },
      },
    }],
  },
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);
