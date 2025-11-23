import { createTRPCRouter } from '@/server/api/trpc';
import { userRouter } from './routers/user';
import { customerRouter } from './routers/customer';
import { documentRouter } from './routers/document';
import { statsRouter } from './routers/stats';
import { backupRouter } from './routers/backup';
import { searchRouter } from './routers/search';
import { notificationRouter } from './routers/notification';

/**
 * This is the primary router for your server.
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  user: userRouter,
  customer: customerRouter,
  document: documentRouter,
  stats: statsRouter,
  backup: backupRouter,
  search: searchRouter,
  notification: notificationRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
