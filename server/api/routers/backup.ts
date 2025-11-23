import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, adminProcedure } from '../trpc';
import { prisma } from '@/lib/prisma';

export const backupRouter = createTRPCRouter({
  // Export database to JSON - همه کاربران می‌توانند بکاپ بگیرند
  exportDatabase: protectedProcedure.mutation(async () => {
    try {
      const [customers, documents, users, documentItems] = await Promise.all([
        prisma.customer.findMany(),
        prisma.document.findMany(),
        prisma.user.findMany(),
        prisma.documentItem.findMany(),
      ]);

      const backup = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        data: {
          customers,
          documents,
          users,
          documentItems,
        },
      };

      return {
        success: true,
        backup,
        filename: `backup-${new Date().toISOString().split('T')[0]}.json`,
      };
    } catch (error) {
      throw new Error('خطا در ایجاد بکاپ');
    }
  }),

  // Import/Restore database from JSON
  importDatabase: adminProcedure
    .input(
      z.object({
        data: z.object({
          customers: z.array(z.any()).optional(),
          documents: z.array(z.any()).optional(),
          users: z.array(z.any()).optional(),
          documentItems: z.array(z.any()).optional(),
        }),
        clearExisting: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      try {
        // Clear existing data if requested
        if (input.clearExisting) {
          await prisma.$transaction([
            prisma.documentItem.deleteMany(),
            prisma.document.deleteMany(),
            prisma.customer.deleteMany(),
            // Don't delete users for safety
          ]);
        }

        const results = {
          customers: 0,
          documents: 0,
          users: 0,
          documentItems: 0,
        };

        // Import customers
        if (input.data.customers && input.data.customers.length > 0) {
          for (const customer of input.data.customers) {
            try {
              await prisma.customer.upsert({
                where: { id: customer.id },
                update: customer,
                create: customer,
              });
              results.customers++;
            } catch (error) {
              console.error('Error importing customer:', error);
            }
          }
        }

        // Import documents
        if (input.data.documents && input.data.documents.length > 0) {
          for (const document of input.data.documents) {
            try {
              await prisma.document.upsert({
                where: { id: document.id },
                update: document,
                create: document,
              });
              results.documents++;
            } catch (error) {
              console.error('Error importing document:', error);
            }
          }
        }

        // Import document items
        if (input.data.documentItems && input.data.documentItems.length > 0) {
          for (const item of input.data.documentItems) {
            try {
              await prisma.documentItem.upsert({
                where: { id: item.id },
                update: item,
                create: item,
              });
              results.documentItems++;
            } catch (error) {
              console.error('Error importing document item:', error);
            }
          }
        }

        return {
          success: true,
          results,
        };
      } catch (error) {
        throw new Error('خطا در بازیابی بکاپ');
      }
    }),

  // Get list of backups (if stored on server)
  listBackups: adminProcedure.query(async () => {
    // This would list files from a backups directory
    // For now, returning empty array as we're doing client-side storage
    return {
      backups: [],
    };
  }),
});
