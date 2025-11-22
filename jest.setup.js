import '@testing-library/jest-dom';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
    };
  },
  useSearchParams() {
    return {
      get: jest.fn(),
    };
  },
  usePathname() {
    return '';
  },
}));

// Mock NextAuth
jest.mock('next-auth/react', () => ({
  useSession() {
    return {
      data: {
        user: {
          id: 1,
          username: 'admin',
          name: 'System Administrator',
          email: 'admin@example.com',
          role: 'ADMIN',
        },
        expires: '2099-01-01',
      },
      status: 'authenticated',
    };
  },
  signIn: jest.fn(),
  signOut: jest.fn(),
}));
