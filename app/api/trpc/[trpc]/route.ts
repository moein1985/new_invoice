import { type NextRequest } from 'next/server';
import { appRouter } from '@/server/api/root';
import { createTRPCContext } from '@/server/api/trpc';
import { TRPCError } from '@trpc/server';
import { getHTTPStatusCodeFromError } from '@trpc/server/http';

async function handler(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop() || '';
    const isBatch = url.searchParams.get('batch') === '1';

    console.log(`[Custom Handler] ${req.method} ${path}, batch: ${isBatch}`);

    // Create context
    const ctx = await createTRPCContext({ headers: req.headers });
    const caller = appRouter.createCaller(ctx);

    // Parse input from URL query params (GET) or request body (POST)
    const inputParam = url.searchParams.get('input');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let batchedInputs: any = {};
    
    if (inputParam) {
      // GET request: input in query params
      const decoded = decodeURIComponent(inputParam);
      batchedInputs = JSON.parse(decoded);
      console.log('[Custom Handler] Parsed input from query:', JSON.stringify(batchedInputs));
    } else if (req.method === 'POST') {
      // POST request: input in body
      batchedInputs = await req.json();
      console.log('[Custom Handler] Parsed input from body:', JSON.stringify(batchedInputs));
    }

    // Transform date strings to Date objects
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function transformDates(obj: any): any {
      if (!obj || typeof obj !== 'object') return obj;
      
      const transformed: any = Array.isArray(obj) ? [] : {};
      
      for (const key in obj) {
        const value = obj[key];
        
        // Check if value is a date string
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(value)) {
          transformed[key] = new Date(value);
        } else if (typeof value === 'object' && value !== null) {
          transformed[key] = transformDates(value);
        } else {
          transformed[key] = value;
        }
      }
      
      return transformed;
    }

    // Apply date transformation to all inputs
    batchedInputs = transformDates(batchedInputs);

    if (isBatch) {
      // Handle multiple procedures in batch
      // Path format: "procedure1.method1,procedure2.method2"
      const procedures = path.split(',');
      const results = [];

      for (let i = 0; i < procedures.length; i++) {
        const procedurePath = procedures[i];
        const rawInput = batchedInputs[i.toString()];
        // Extract actual input from superjson format
        const input = rawInput?.json !== undefined ? rawInput.json : rawInput;
        
        const [routerName, procedureName] = procedurePath.split('.');
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const router = (caller as any)[routerName];
        if (!router || !router[procedureName]) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `No procedure found on path "${procedurePath}"`,
          });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (router as any)[procedureName](input);
        results.push({ result: { data: { json: result } } });
      }

      console.log('[Custom Handler] Batch success!');
      return new Response(JSON.stringify(results), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      // Single procedure call
      const [routerName, procedureName] = path.split('.');
      const rawInput = batchedInputs['0'] !== undefined ? batchedInputs['0'] : batchedInputs;
      // Extract actual input from superjson format
      const input = rawInput?.json !== undefined ? rawInput.json : rawInput;
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const router = (caller as any)[routerName];
      if (!router || !router[procedureName]) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `No procedure found on path "${path}"`,
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (router as any)[procedureName](input);

      console.log('[Custom Handler] Success!');
      return new Response(JSON.stringify({ result: { data: { json: result } } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('[Custom Handler] Error:', error);

    const trpcError = error instanceof TRPCError
      ? error
      : new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        });

    const statusCode = getHTTPStatusCodeFromError(trpcError);
    const isBatch = new URL(req.url).searchParams.get('batch') === '1';

    const errorResponse = isBatch
      ? [{ error: { json: { message: trpcError.message, code: trpcError.code } } }]
      : { error: { json: { message: trpcError.message, code: trpcError.code } } };

    return new Response(JSON.stringify(errorResponse), {
      status: statusCode,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export { handler as GET, handler as POST };
