# =============================================================================
# Weft Backend Multi-Stage Dockerfile
# =============================================================================
# This Dockerfile uses a multi-stage build for optimized production images.
#
# Stage 1: Dependencies - Installs and caches dependencies
# Stage 2: Builder - Compiles TypeScript
# Stage 3: Production - Final minimal runtime image
#
# Note: Uses Node.js base image with Bun installed for better compatibility
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# -----------------------------------------------------------------------------
FROM node:20-bullseye-slim AS dependencies
WORKDIR /app

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/server/package.json ./packages/server/
COPY packages/shared/package.json ./packages/shared/

# Install corepack and pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install dependencies
# Note: Using no-frozen-lockfile for development flexibility
RUN pnpm install --no-frozen-lockfile


# -----------------------------------------------------------------------------
# Stage 2: Builder
# -----------------------------------------------------------------------------
FROM node:20-bullseye-slim AS builder
WORKDIR /app

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

# Copy node_modules from dependencies stage
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/packages/server/node_modules ./packages/server/node_modules
COPY --from=dependencies /app/packages/shared/node_modules ./packages/shared/node_modules

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/server/package.json ./packages/server/
COPY packages/shared/package.json ./packages/shared/
COPY tsconfig.json ./
COPY packages/server/tsconfig.json ./packages/server/
COPY packages/shared/tsconfig.json ./packages/shared/
COPY turbo.json ./

# Copy source code
COPY packages/server/src ./packages/server/src
COPY packages/server/drizzle ./packages/server/drizzle
COPY packages/shared/src ./packages/shared/src

# Install corepack and pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Build shared package first
WORKDIR /app/packages/shared
RUN pnpm build

# Build server package
WORKDIR /app/packages/server
RUN pnpm build


# -----------------------------------------------------------------------------
# Stage 3: Production
# -----------------------------------------------------------------------------
FROM node:20-bullseye-slim AS production
WORKDIR /app

# Install dependencies and Bun
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl wget ca-certificates unzip && \
    curl -fsSL https://bun.sh/install | bash && \
    mv /root/.bun/bin/bun /usr/local/bin/bun && \
    rm -rf /root/.bun && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -s /bin/sh -d /app bun

# Set environment
ENV NODE_ENV=production
ENV PORT=4000

# Create uploads directory with proper permissions for non-root user
RUN mkdir -p /app/uploads && \
    chown -R bun:nodejs /app/uploads && \
    chmod 755 /app/uploads

# Define volume mount point
VOLUME ["/app/uploads"]

# Copy package files for workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/server/package.json ./packages/server/
COPY packages/shared/package.json ./packages/shared/

# Install production dependencies
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --prod --no-frozen-lockfile

# Copy built application from builder (preserve workspace structure)
COPY --from=builder --chown=bun:nodejs /app/packages/server/dist ./packages/server/dist
COPY --from=builder --chown=bun:nodejs /app/packages/server/drizzle ./packages/server/drizzle
COPY --from=builder --chown=bun:nodejs /app/packages/shared/dist ./packages/shared/dist

# Switch to non-root user
USER bun

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:4000/ || exit 1

# Start the server from the server package directory
WORKDIR /app/packages/server
CMD ["bun", "dist/index.js"]
