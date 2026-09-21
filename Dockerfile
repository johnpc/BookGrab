FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line to disable telemetry during the build.
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Writable location for the rotating MAM session cookie. MAM issues a new
# mam_id on every refresh, so this must survive container recreation - mount
# a named volume here or the token resets to the MAM_TOKEN seed on restart.
ENV MAM_TOKEN_FILE=/data/mam_token
RUN mkdir -p /data

# Set proper permissions
RUN chown -R nextjs:nodejs /app /data

VOLUME ["/data"]

# Switch to non-root user
USER nextjs

# Expose the port the app will run on
EXPOSE 3000

# Environment variables will be passed at runtime
ENV PORT=3000

# Start the application
CMD ["node", "server.js"]
