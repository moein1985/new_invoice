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
    const ctx = await createTRPCContext({ req });
    const caller = appRouter.createCaller(ctx);

    // Parse input from URL query params (GET) or request body (POST)
    const inputParam = url.searchParams.get('input');
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

    if (isBatch) {
      // Handle multiple procedures in batch
      // Path format: "procedure1.method1,procedure2.method2"
      const procedures = path.split(',');
      const results = [];

      for (let i = 0; i < procedures.length; i++) {
        const procedurePath = procedures[i];
        const input = batchedInputs[i.toString()];
        
        const [routerName, procedureName] = procedurePath.split('.');
        
        // @ts-ignore - dynamic procedure access
        const router = caller[routerName];
        if (!router || !router[procedureName]) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `No procedure found on path "${procedurePath}"`,
          });
        }

        // @ts-ignore - dynamic procedure call
        const result = await router[procedureName](input);
        results.push({ result: { data: result } });
      }

      console.log('[Custom Handler] Batch success!');
      return new Response(JSON.stringify(results), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      // Single procedure call
      const [routerName, procedureName] = path.split('.');
      const input = batchedInputs['0'] !== undefined ? batchedInputs['0'] : batchedInputs;
      
      // @ts-ignore - dynamic procedure access
      const router = caller[routerName];
      if (!router || !router[procedureName]) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `No procedure found on path "${path}"`,
        });
      }

      // @ts-ignore - dynamic procedure call
      const result = await router[procedureName](input);

      console.log('[Custom Handler] Success!');
      return new Response(JSON.stringify({ result: { data: result } }), {
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
