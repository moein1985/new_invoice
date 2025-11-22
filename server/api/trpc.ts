import { initTRPC, TRPCError } from '@trpc/server';
import { type NextRequest } from 'next/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';

/**
 * Context for tRPC requests
 * Contains database client and user session
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await getServerSession(authOptions);

  console.log('[tRPC Context] Session:', session?.user?.name);
  console.log('[tRPC Context] Prisma:', !!prisma);

  return {
    prisma,
    session,
    headers: opts.headers,
  };
};

/**
 * Infer context type
 */
type Context = Awaited<ReturnType<typeof createTRPCContext>>;

/**
 * Initialize tRPC instance
 */
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Router and procedure helpers
 */
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

/**
 * Public procedure - no authentication required
 */
export const publicProcedure = t.procedure;

/**
 * Protected procedure - requires authentication
 */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session || !ctx.session.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'لطفاً وارد شوید' });
  }

  return next({
    ctx: {
      ...ctx,
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

/**
 * Admin procedure - requires admin role
 */
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.session.user.role !== 'ADMIN') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'فقط مدیران سیستم به این بخش دسترسی دارند',
    });
  }

  return next({ ctx });
});

/**
 * Manager procedure - requires manager or admin role
 */
export const managerProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.session.user.role !== 'ADMIN' && ctx.session.user.role !== 'MANAGER') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'فقط مدیران به این بخش دسترسی دارند',
    });
  }

  return next({ ctx });
});
