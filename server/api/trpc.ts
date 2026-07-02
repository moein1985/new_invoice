import { initTRPC, TRPCError } from '@trpc/server';
import { type NextRequest } from 'next/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';

/**
 * Check if user is superuser (the original admin account)
 */
export function isSuperuser(username?: string | null): boolean {
  return username === 'admin';
}

/**
 * Get project IDs that a user has access to.
 * Returns null for MANAGER and superuser (no filter needed).
 * Returns empty array if user has no projects.
 */
export async function getUserProjectIds(
  userId: string,
  role: string,
  username?: string | null
): Promise<string[] | null> {
  // MANAGER and superuser see all projects
  if (role === 'MANAGER') return null;
  if (role === 'ADMIN' && isSuperuser(username)) return null;

  // EMPLOYER: projects where they are the employer
  if (role === 'EMPLOYER') {
    const projects = await prisma.project.findMany({
      where: { employerUserId: userId },
      select: { id: true },
    });
    return projects.map((p) => p.id);
  }

  // ADMIN (project-scoped), USER, CONTRACTOR, TECHNICAL: via ProjectMember
  const memberships = await prisma.projectMember.findMany({
    where: { userId },
    select: { projectId: true },
  });
  return memberships.map((m) => m.projectId);
}

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
 * Superuser procedure - requires the original admin account (username === 'admin')
 */
export const superuserProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!isSuperuser(ctx.session.user.username)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'فقط سوپرمدیر سیستم به این بخش دسترسی دارد',
    });
  }

  return next({ ctx });
});

/**
 * Admin procedure - requires superuser (original admin account)
 * Kept for backward compatibility but now means superuser only
 */
export const adminProcedure = superuserProcedure;

/**
 * Manager procedure - requires MANAGER role or superuser
 * MANAGER has full access. Superuser (admin account) also has full access.
 * Project-scoped ADMINs do NOT have manager-level access.
 */
export const managerProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const hasAccess = ctx.session.user.role === 'MANAGER' || isSuperuser(ctx.session.user.username);
  if (!hasAccess) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'فقط مدیران به این بخش دسترسی دارند',
    });
  }

  return next({ ctx });
});

/**
 * Project admin procedure - requires ADMIN, MANAGER, or superuser
 * Used for operations that project-scoped ADMINs can perform (approve reports, etc.)
 */
export const projectAdminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const hasAccess =
    ctx.session.user.role === 'ADMIN' ||
    ctx.session.user.role === 'MANAGER' ||
    isSuperuser(ctx.session.user.username);
  if (!hasAccess) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'دسترسی غیرمجاز',
    });
  }

  return next({ ctx });
});
