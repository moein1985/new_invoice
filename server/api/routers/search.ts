import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { prisma } from '@/lib/prisma';

export const searchRouter = createTRPCRouter({
  // Global search across all entities
  globalSearch: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().default(10),
      })
    )
    .query(async ({ input }) => {
      const { query, limit } = input;
      const searchTerm = query.toLowerCase();

      // Search in customers
      const customers = await prisma.customer.findMany({
        where: {
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { code: { contains: searchTerm, mode: 'insensitive' } },
            { phone: { contains: searchTerm, mode: 'insensitive' } },
            { email: { contains: searchTerm, mode: 'insensitive' } },
            { address: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        take: limit,
        select: {
          id: true,
          name: true,
          code: true,
          phone: true,
          email: true,
          address: true,
        },
      });

      // Search in documents
      const documents = await prisma.document.findMany({
        where: {
          OR: [
            { documentNumber: { contains: searchTerm, mode: 'insensitive' } },
            { projectName: { contains: searchTerm, mode: 'insensitive' } },
            { notes: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        take: limit,
        select: {
          id: true,
          documentNumber: true,
          documentType: true,
          projectName: true,
          totalAmount: true,
          approvalStatus: true,
          createdAt: true,
          customer: {
            select: {
              name: true,
            },
          },
        },
      });

      // Search in document items
      const documentItems = await prisma.documentItem.findMany({
        where: {
          OR: [
            { productName: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } },
            { supplier: { contains: searchTerm, mode: 'insensitive' } },
            { unit: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        take: limit,
        select: {
          id: true,
          productName: true,
          description: true,
          supplier: true,
          documentId: true,
          document: {
            select: {
              documentNumber: true,
              customer: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });

      // Search in users (only username and fullName for privacy)
      const users = await prisma.user.findMany({
        where: {
          OR: [
            { username: { contains: searchTerm, mode: 'insensitive' } },
            { fullName: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        take: limit,
        select: {
          id: true,
          username: true,
          fullName: true,
          role: true,
        },
      });

      return {
        customers: customers.map((c) => ({
          ...c,
          type: 'customer' as const,
          title: c.name,
          subtitle: `کد: ${c.code} | ${c.phone || 'بدون تلفن'}`,
          link: `/customers/${c.id}`,
        })),
        documents: documents.map((d) => ({
          ...d,
          type: 'document' as const,
          title: `سند ${d.documentNumber}`,
          subtitle: `${d.customer.name} | ${d.totalAmount} ریال`,
          link: `/documents/${d.id}`,
        })),
        documentItems: documentItems.map((i) => ({
          ...i,
          type: 'item' as const,
          title: i.productName,
          subtitle: `سند: ${i.document.documentNumber} | مشتری: ${i.document.customer.name}`,
          link: `/documents/${i.documentId}`,
        })),
        users: users.map((u) => ({
          ...u,
          type: 'user' as const,
          title: u.fullName || u.username,
          subtitle: `${u.username} | ${u.role}`,
          link: `/users/${u.id}`,
        })),
        totalResults:
          customers.length + documents.length + documentItems.length + users.length,
      };
    }),
});
