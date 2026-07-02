import { createTRPCRouter } from '@/server/api/trpc';
import { userRouter } from './routers/user';
import { customerRouter } from './routers/customer';
import { documentRouter } from './routers/document';
import { statsRouter } from './routers/stats';
import { backupRouter } from './routers/backup';
import { searchRouter } from './routers/search';
import { notificationRouter } from './routers/notification';
import { projectRouter } from './routers/project';
import { workReportRouter } from './routers/workReport';
import { calendarRouter } from './routers/calendar';
import { purchaseRouter } from './routers/purchase';
import { supplierRouter } from './routers/supplier';
import { contactRouter } from './routers/contact';
import { amiRouter } from './routers/ami';
import { systemSettingsRouter } from './routers/systemSettings';
import { contractorDocRouter } from './routers/contractorDoc';
import { ticketRouter } from './routers/ticket';
import { projectFlowRouter } from './routers/projectFlow';

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
  project: projectRouter,
  workReport: workReportRouter,
  calendar: calendarRouter,
  purchase: purchaseRouter,
  supplier: supplierRouter,
  contact: contactRouter,
  ami: amiRouter,
  systemSettings: systemSettingsRouter,
  contractorDoc: contractorDocRouter,
  ticket: ticketRouter,
  projectFlow: projectFlowRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
