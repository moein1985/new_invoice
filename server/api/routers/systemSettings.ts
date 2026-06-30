import { z } from 'zod';
import {
  createTRPCRouter,
  protectedProcedure,
  managerProcedure,
} from '@/server/api/trpc';

export const systemSettingsRouter = createTRPCRouter({
  // Get AMI settings (any authenticated user - needed by originate)
  getAmiSettings: protectedProcedure.query(async ({ ctx }) => {
    const settings = await ctx.prisma.systemSettings.findUnique({
      where: { id: 'default' },
    });
    // Non-admin users only get a boolean indicating if AMI is configured
    if (ctx.session.user.role !== 'ADMIN' && ctx.session.user.role !== 'MANAGER') {
      return {
        configured: !!(settings?.amiHost && settings?.amiUsername && settings?.amiSecret),
      };
    }
    return {
      configured: !!(settings?.amiHost && settings?.amiUsername && settings?.amiSecret),
      amiHost: settings?.amiHost || '',
      amiPort: settings?.amiPort || 5038,
      amiUsername: settings?.amiUsername || '',
      amiSecret: settings?.amiSecret || '',
    };
  }),

  // Update AMI settings (admin/manager only)
  updateAmiSettings: managerProcedure
    .input(
      z.object({
        amiHost: z.string().max(255).optional().nullable(),
        amiPort: z.number().int().min(1).max(65535).optional().nullable(),
        amiUsername: z.string().max(100).optional().nullable(),
        amiSecret: z.string().max(100).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.systemSettings.upsert({
        where: { id: 'default' },
        create: {
          id: 'default',
          ...input,
        },
        update: input,
      });
    }),
});
