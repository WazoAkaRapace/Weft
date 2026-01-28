# =============================================================================
# Weft Frontend Multi-Stage Dockerfile
# =============================================================================
# This Dockerfile uses a multi-stage build for optimized production images.
#
# Stage 1: Dependencies - Installs and caches dependencies
# Stage 2: Builder - Builds the React + Vite application
# Stage 3: Production - Serves static files with nginx
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# -----------------------------------------------------------------------------
FROM node:20-bullseye-slim AS dependencies
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/web/package.json ./packages/web/
COPY packages/shared/package.json ./packages/shared/

# Install corepack and pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install dependencies
RUN pnpm install --no-frozen-lockfile


# -----------------------------------------------------------------------------
# Stage 2: Builder
# -----------------------------------------------------------------------------
FROM node:20-bullseye-slim AS builder
WORKDIR /app

# Copy node_modules from dependencies stage
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/packages/web/node_modules ./packages/web/node_modules
COPY --from=dependencies /app/packages/shared/node_modules ./packages/shared/node_modules

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/web/package.json ./packages/web/
COPY packages/shared/package.json ./packages/shared/
COPY tsconfig.json ./
COPY packages/web/tsconfig.json ./packages/web/
COPY packages/shared/tsconfig.json ./packages/shared/
COPY turbo.json ./

# Copy source code
COPY packages/web/src ./packages/web/src
COPY packages/web/index.html ./packages/web/
COPY packages/web/vite.config.ts ./packages/web/
COPY packages/web/tailwind.config.js ./packages/web/
COPY packages/web/postcss.config.js ./packages/web/
COPY packages/shared/src ./packages/shared/src

# Install corepack and pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Build shared package first (required dependency)
WORKDIR /app/packages/shared
RUN pnpm build

# Build web package
WORKDIR /app/packages/web
RUN pnpm build


# -----------------------------------------------------------------------------
# Stage 3: Production
# -----------------------------------------------------------------------------
FROM nginx:alpine AS production

# Install wget for health check
RUN apk add --no-cache wget

# Copy nginx configuration
RUN rm -f /etc/nginx/conf.d/default.conf

# Create nginx config for SPA routing
RUN echo 'server { \
    listen 3000; \
    server_name localhost; \
    root /usr/share/nginx/html; \
    index index.html; \
    \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    \
    location /assets/ { \
        expires 1y; \
        add_header Cache-Control "public, immutable"; \
    } \
    \
    gzip on; \
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript; \
    gzip_min_length 1000; \
}' > /etc/nginx/conf.d/default.conf

# Copy built application from builder
COPY --from=builder /app/packages/web/dist /usr/share/nginx/html

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
