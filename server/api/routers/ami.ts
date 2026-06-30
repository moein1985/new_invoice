import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import net from 'net';
import {
  createTRPCRouter,
  protectedProcedure,
  managerProcedure,
} from '@/server/api/trpc';

const DEFAULT_AMI_HOST = process.env.AMI_HOST || '192.168.85.89';
const DEFAULT_AMI_PORT = parseInt(process.env.AMI_PORT || '5038');
const DEFAULT_AMI_USERNAME = process.env.AMI_USERNAME || 'invoice-app';
const DEFAULT_AMI_SECRET = process.env.AMI_SECRET || 'InvoiceApp2026!';
const AMI_CONTEXT = process.env.AMI_CONTEXT || 'from-internal';

// Rate limiting: track last call time per user
const lastCallTime = new Map<string, number>();
const RATE_LIMIT_MS = 10000; // 10 seconds

function sanitizeNumber(num: string): string {
  // Only allow digits, +, -, spaces, and *#
  return num.replace(/[^\d+\-\s*#]/g, '').trim();
}

async function amiOriginate(
  extension: string,
  destination: string,
  callerName?: string,
  amiHost?: string,
  amiPort?: number,
  amiUsername?: string,
  amiSecret?: string
): Promise<{ success: boolean; message: string }> {
  const host = amiHost || DEFAULT_AMI_HOST;
  const port = amiPort || DEFAULT_AMI_PORT;
  const username = amiUsername || DEFAULT_AMI_USERNAME;
  const secret = amiSecret || DEFAULT_AMI_SECRET;

  return new Promise((resolve, reject) => {
    const socket = net.createConnection(port, host);
    let step = 'banner';
    let buffer = '';

    socket.setTimeout(15000);

    socket.on('data', (data) => {
      buffer += data.toString();

      if (step === 'banner' && buffer.includes('\r\n')) {
        // Send Login
        buffer = '';
        socket.write(
          `Action: Login\r\n` +
          `Username: ${username}\r\n` +
          `Secret: ${secret}\r\n\r\n`
        );
        step = 'login';
      } else if (step === 'login' && buffer.includes('\r\n\r\n')) {
        if (buffer.includes('Success')) {
          // Send Originate
          buffer = '';
          socket.write(
            `Action: Originate\r\n` +
            `Channel: SIP/${extension}\r\n` +
            `Context: ${AMI_CONTEXT}\r\n` +
            `Exten: ${destination}\r\n` +
            `Priority: 1\r\n` +
            `CallerID: "${callerName || extension}" <${extension}>\r\n` +
            `Timeout: 30000\r\n` +
            `Async: true\r\n\r\n`
          );
          step = 'originate';
        } else {
          socket.destroy();
          resolve({ success: false, message: 'خطا در احراز هویت AMI' });
        }
      } else if (step === 'originate' && buffer.includes('\r\n\r\n')) {
        const success = buffer.includes('Success');
        // Logoff
        socket.write('Action: Logoff\r\n\r\n');
        socket.end();
        resolve({
          success,
          message: success
            ? 'در حال برقراری تماس...'
            : 'خطا در برقراری تماس',
        });
      }
    });

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('اتصال به سیستم تلفن منقضی شد'));
    });

    socket.on('error', (err) => {
      reject(err);
    });
  });
}

export const amiRouter = createTRPCRouter({
  // Originate a call
  originate: protectedProcedure
    .input(
      z.object({
        destination: z.string().min(1, 'شماره مقصد الزامی است'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Rate limiting
      const userId = ctx.session.user.id;
      const now = Date.now();
      const lastCall = lastCallTime.get(userId);
      if (lastCall && now - lastCall < RATE_LIMIT_MS) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'لطفاً چند ثانیه صبر کنید و دوباره تلاش کنید',
        });
      }

      // Get user's physical extension and trunk prefix
      const user = await ctx.prisma.user.findUnique({
        where: { id: userId },
        select: { physicalExtension: true, trunkPrefix: true, fullName: true },
      });

      if (!user?.physicalExtension) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'ابتدا شماره داخلی فیزیکی خود را در تنظیمات SIP وارد کنید',
        });
      }

      // Get global AMI settings
      const amiSettings = await ctx.prisma.systemSettings.findUnique({
        where: { id: 'default' },
      });

      // Sanitize destination number
      let destination = sanitizeNumber(input.destination);
      if (!destination || destination.length < 2) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'شماره مقصد نامعتبر است',
        });
      }

      // Prepend trunk prefix if configured
      if (user.trunkPrefix) {
        destination = user.trunkPrefix + destination;
      }

      try {
        lastCallTime.set(userId, now);
        const result = await amiOriginate(
          user.physicalExtension,
          destination,
          user.fullName,
          amiSettings?.amiHost || undefined,
          amiSettings?.amiPort || undefined,
          amiSettings?.amiUsername || undefined,
          amiSettings?.amiSecret || undefined
        );
        return result;
      } catch (error: any) {
        lastCallTime.delete(userId);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'خطا در اتصال به سیستم تلفن',
        });
      }
    }),

  // Test AMI connection (uses global settings)
  testConnection: managerProcedure.query(async ({ ctx }) => {
    const amiSettings = await ctx.prisma.systemSettings.findUnique({
      where: { id: 'default' },
    });

    const host = amiSettings?.amiHost || DEFAULT_AMI_HOST;
    const port = amiSettings?.amiPort || DEFAULT_AMI_PORT;
    const username = amiSettings?.amiUsername || DEFAULT_AMI_USERNAME;
    const secret = amiSettings?.amiSecret || DEFAULT_AMI_SECRET;

    return new Promise<{ success: boolean; message: string }>((resolve) => {
      const socket = net.createConnection(port, host);
      let buffer = '';

      socket.setTimeout(5000);

      socket.on('data', (data) => {
        buffer += data.toString();
        if (buffer.includes('Asterisk Call Manager')) {
          // Send Login
          buffer = '';
          socket.write(
            `Action: Login\r\n` +
            `Username: ${username}\r\n` +
            `Secret: ${secret}\r\n\r\n`
          );
        } else if (buffer.includes('Success')) {
          socket.write('Action: Logoff\r\n\r\n');
          socket.end();
          resolve({ success: true, message: 'اتصال به AMI برقرار است' });
        } else if (buffer.includes('failed')) {
          socket.destroy();
          resolve({ success: false, message: 'احراز هویت AMI ناموفق بود' });
        }
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({ success: false, message: 'اتصال به AMI منقضی شد' });
      });

      socket.on('error', (err) => {
        resolve({ success: false, message: `خطا: ${err.message}` });
      });
    });
  }),
});
