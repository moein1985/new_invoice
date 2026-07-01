# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:20-alpine AS deps

WORKDIR /app

# Install OpenSSL and CA certificates
RUN sh -c 'attempt=1; until [ "$attempt" -gt 5 ]; do apk add --no-cache openssl ca-certificates && exit 0; echo "apk add failed (attempt $attempt/5), retrying in 10s..."; attempt=$((attempt+1)); sleep 10; done; echo "apk add failed after 5 attempts"; exit 1'

# Use pre-cached node_modules (offline build — no npm ci needed)
COPY node_modules_cache.tar.gz /tmp/
RUN tar xzf /tmp/node_modules_cache.tar.gz -C /app && rm /tmp/node_modules_cache.tar.gz \
    && chmod -R +x node_modules/.bin 2>/dev/null || true

# Pre-generate Prisma client with engines
COPY prisma ./prisma
COPY package*.json ./
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
RUN npx prisma generate || echo "Prisma generate failed but continuing..."

# Self-heal stale node_modules cache for dependencies added after cache creation.
RUN sh -c 'if [ ! -d node_modules/date-holidays ]; then echo "date-holidays missing in cache, installing..."; npm install --no-audit --no-fund date-holidays@^3.27.0; fi'

# ============================================
# Stage 2: Builder
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install OpenSSL and libc6-compat for SWC native bindings
RUN sh -c 'attempt=1; until [ "$attempt" -gt 5 ]; do apk add --no-cache openssl ca-certificates libc6-compat && exit 0; echo "apk add failed (attempt $attempt/5), retrying in 10s..."; attempt=$((attempt+1)); sleep 10; done; echo "apk add failed after 5 attempts"; exit 1'

# Copy dependencies and generated Prisma client from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma

# Install SWC binaries from local tarballs (avoids unreliable CDN downloads)
COPY swc-linux-x64-musl-15.0.3.tgz swc-linux-x64-gnu-15.0.3.tgz /tmp/
RUN mkdir -p node_modules/@next/swc-linux-x64-musl node_modules/@next/swc-linux-x64-gnu && \
    tar xzf /tmp/swc-linux-x64-musl-15.0.3.tgz -C node_modules/@next/swc-linux-x64-musl --strip-components=1 && \
    tar xzf /tmp/swc-linux-x64-gnu-15.0.3.tgz -C node_modules/@next/swc-linux-x64-gnu --strip-components=1 && \
    rm /tmp/swc-linux-x64-musl-15.0.3.tgz /tmp/swc-linux-x64-gnu-15.0.3.tgz

# Fix permissions for node_modules binaries
RUN chmod -R +x node_modules/.bin && \
    find node_modules -name "*.js" -path "*/bin/*" -exec chmod +x {} \; && \
    find node_modules/.bin -type l -exec sh -c 'chmod +x "$(readlink -f "$0")"' {} \;

# Copy source code
COPY . .

# Build Next.js application
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ============================================
# Stage 3: Runner (Production)
# ============================================
FROM node:20-alpine AS runner

WORKDIR /app

# Install dumb-init, OpenSSL, and Chromium for PDF generation (using IUT mirror for Iran)
RUN sh -c '\
  echo "https://repo.iut.ac.ir/repo/alpine/v3.23/main" > /etc/apk/repositories && \
  echo "https://repo.iut.ac.ir/repo/alpine/v3.23/community" >> /etc/apk/repositories && \
  apk add --no-cache dumb-init openssl chromium nss freetype harfbuzz ca-certificates ttf-freefont'

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --chown=nextjs:nodejs --from=builder /app/public ./public
COPY --chown=nextjs:nodejs --from=builder /app/.next/standalone ./
COPY --chown=nextjs:nodejs --from=builder /app/.next/static ./.next/static
COPY --chown=nextjs:nodejs --from=builder /app/prisma ./prisma
# Copy entire node_modules to ensure all Prisma dependencies are available
COPY --chown=nextjs:nodejs --from=builder /app/node_modules ./node_modules

# Generate Prisma Client in production stage with correct binary target
RUN npx prisma generate

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "const http=require('http');const host=process.env.HOSTNAME||'127.0.0.1';http.get('http://'+host+':3000/api/health',(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["/usr/local/bin/docker-entrypoint.sh"]
