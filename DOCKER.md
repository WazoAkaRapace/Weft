# Weft Docker Setup

Complete Docker Compose configuration for local development environment with PostgreSQL, Redis, and backend service.

## Table of Contents

- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [Services](#services)
- [Configuration](#configuration)
- [Usage](#usage)
- [Development Workflow](#development-workflow)
- [Troubleshooting](#troubleshooting)
- [Production Considerations](#production-considerations)

## Quick Start

```bash
# 1. Copy environment template
cp docker/.env.example .env

# 2. Start all services
docker compose -f docker/docker-compose.yml up -d

# 3. View logs
docker compose -f docker/docker-compose.yml logs -f

# 4. Stop services
docker compose -f docker/docker-compose.yml down
```

## Prerequisites

- **Docker Engine** 24.0+
- **Docker Compose** v2.0+
- **Disk Space**: ~2GB for images and volumes

### Check Installation

```bash
docker --version
docker compose version
```

## Services

### PostgreSQL 16 (`db`)

| Setting | Value |
|---------|-------|
| Image | `postgres:16-alpine` |
| Port | `5432` |
| User | `weft` |
| Password | `weft_dev_password` |
| Database | `weft` |
| Volume | `weft_postgres_data` |

**Features:**
- Optimized settings for development
- Health checks for service readiness
- Persistent data storage
- Connection pooling ready

### Redis 7 (`redis`)

| Setting | Value |
|---------|-------|
| Image | `redis:7-alpine` |
| Port | `6379` |
| Volume | `weft_redis_data` |

**Features:**
- AOF persistence
- LRU eviction policy
- Health checks
- Max memory: 256MB

### Backend (`backend`)

| Setting | Value |
|---------|-------|
| Runtime | Bun |
| Port | `4000` |
| Health Check | HTTP `/` endpoint |

**Features:**
- Multi-stage build for optimization
- Hot-reload in development
- Health checks
- Non-root user execution

## Configuration

### Environment Variables

Create `.env` in project root (copy from `docker/.env.example`):

```bash
# Application
NODE_ENV=development

# PostgreSQL
POSTGRES_USER=weft
POSTGRES_PASSWORD=weft_dev_password
POSTGRES_DB=weft
POSTGRES_PORT=5432

# Redis
REDIS_PORT=6379

# Backend
BACKEND_PORT=4000
```

### Custom Ports

Change service ports in `.env`:

```bash
POSTGRES_PORT=15432  # Avoid conflicts with local PostgreSQL
REDIS_PORT=16379     # Avoid conflicts with local Redis
BACKEND_PORT=4001    # Avoid conflicts with local backend
```

## Usage

### Starting Services

```bash
# Start all services in detached mode
docker compose -f docker/docker-compose.yml up -d

# Start specific service
docker compose -f docker/docker-compose.yml up -d db

# Start with log output
docker compose -f docker/docker-compose.yml up
```

### Stopping Services

```bash
# Stop all services (preserve volumes)
docker compose -f docker/docker-compose.yml down

# Stop and remove volumes (⚠️ deletes data)
docker compose -f docker/docker-compose.yml down -v
```

### Viewing Logs

```bash
# All services
docker compose -f docker/docker-compose.yml logs -f

# Specific service
docker compose -f docker/docker-compose.yml logs -f backend

# Last 100 lines
docker compose -f docker/docker-compose.yml logs --tail=100 backend
```

### Executing Commands

```bash
# Access PostgreSQL
docker compose -f docker/docker-compose.yml exec db psql -U weft -d weft

# Access Redis CLI
docker compose -f docker/docker-compose.yml exec redis redis-cli

# Access backend shell
docker compose -f docker/docker-compose.yml exec backend sh

# Run database migrations
docker compose -f docker/docker-compose.yml exec backend bun db:migrate
```

### Rebuilding Images

```bash
# Rebuild after code changes
docker compose -f docker/docker-compose.yml build backend

# Rebuild without cache
docker compose -f docker/docker-compose.yml build --no-cache backend

# Rebuild and restart
docker compose -f docker/docker-compose.yml up -d --build backend
```

## Development Workflow

### Database Operations

```bash
# Generate migration
docker compose -f docker/docker-compose.yml exec backend bun db:generate

# Apply migrations
docker compose -f docker/docker-compose.yml exec backend bun db:migrate

# Push schema (development only)
docker compose -f docker/docker-compose.yml exec backend bun db:push

# Seed database
docker compose -f docker/docker-compose.yml exec backend bun db:seed

# Open Drizzle Studio
docker compose -f docker/docker-compose.yml exec backend bun db:studio
```

### Resetting Environment

```bash
# Complete reset (⚠️ deletes all data)
docker compose -f docker/docker-compose.yml down -v
docker compose -f docker/docker-compose.yml up -d
docker compose -f docker/docker-compose.yml exec backend bun db:migrate
docker compose -f docker/docker-compose.yml exec backend bun db:seed
```

### Connecting from Host

**PostgreSQL:**
```bash
# Using psql
psql -h localhost -p 5432 -U weft -d weft

# Using pgAdmin
# Host: localhost
# Port: 5432
# User: weft
# Password: weft_dev_password
# Database: weft
```

**Redis:**
```bash
# Using redis-cli
redis-cli -p 6379

# Using Redis Insight
# Host: localhost
# Port: 6379
```

**Backend API:**
```bash
# Test health endpoint
curl http://localhost:4000/

# Example API call
curl http://localhost:4000/api/journals
```

## Troubleshooting

### Service Won't Start

**Issue:** Ports already in use

```bash
# Check what's using the ports
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
lsof -i :4000  # Backend

# Solution: Change ports in .env
POSTGRES_PORT=15432
REDIS_PORT=16379
BACKEND_PORT=4001
```

**Issue:** Container exits immediately

```bash
# Check logs
docker compose -f docker/docker-compose.yml logs backend

# Common fix: Rebuild image
docker compose -f docker/docker-compose.yml up -d --build backend
```

### Database Connection Issues

**Issue:** Backend can't connect to database

```bash
# Verify database is healthy
docker compose -f docker/docker-compose.yml ps db

# Check database logs
docker compose -f docker/docker-compose.yml logs db

# Verify connection from backend container
docker compose -f docker/docker-compose.yml exec backend sh
# In container: wget -O- http://db:5432
```

**Issue:** Connection refused

```bash
# Verify DATABASE_URL in backend
docker compose -f docker/docker-compose.yml exec backend env | grep DATABASE_URL

# Should show: postgresql://weft:weft_dev_password@db:5432/weft
```

### Build Failures

**Issue:** Out of memory during build

```bash
# Increase Docker memory limit
# Docker Desktop > Settings > Resources > Memory > 4GB+
```

**Issue:** Module not found

```bash
# Clean build
docker compose -f docker/docker-compose.yml down
docker system prune -f
docker compose -f docker/docker-compose.yml build --no-cache
```

### Health Checks Failing

**Issue:** Service marked as unhealthy

```bash
# Check health status
docker compose -f docker/docker-compose.yml ps

# Inspect health check
docker inspect weft-backend | jq '.[0].State.Health'

# Manual health check
docker compose -f docker/docker-compose.yml exec backend wget -O- http://localhost:4000/
```

### Volume Issues

**Issue:** Data persists after `down`

```bash
# Remove volumes (⚠️ deletes data)
docker compose -f docker/docker-compose.yml down -v

# List volumes
docker volume ls | grep weft

# Remove specific volume
docker volume rm weft_postgres_data
```

### Hot Reload Not Working

**Issue:** Code changes not reflected

```bash
# Rebuild and restart
docker compose -f docker/docker-compose.yml up -d --build backend

# Check volume mounts
docker inspect weft-backend | jq '.[0].Mounts'
```

## Production Considerations

This Docker setup is optimized for **local development**. For production:

### Security

- [ ] Change default passwords
- [ ] Use secrets manager (AWS Secrets, Vault, etc.)
- [ ] Enable SSL/TLS for database connections
- [ ] Restrict network access (private networks)
- [ ] Scan images for vulnerabilities (`docker scan`)

### Performance

- [ ] Adjust PostgreSQL settings based on resources
- [ ] Enable connection pooling (PgBouncer)
- [ ] Use read replicas for scaling
- [ ] Configure Redis persistence for production workload
- [ ] Set resource limits in docker-compose.yml

### Monitoring

- [ ] Add logging aggregation (ELK, CloudWatch, etc.)
- [ ] Implement metrics collection (Prometheus)
- [ ] Set up alerting (PagerDuty, etc.)
- [ ] Configure health check endpoints for load balancers

### Backup

- [ ] Automated database backups
- [ ] Backup strategy for Redis data
- [ ] Documented restore procedures
- [ ] Test backup/restore regularly

### Example Production Overrides

Create `docker/docker-compose.prod.yml`:

```yaml
services:
  db:
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password
    resource:
      limits:
        cpus: '2'
        memory: 2G
  backend:
    environment:
      NODE_ENV: production
    volumes:  # Remove dev mounts
    resource:
      limits:
        cpus: '1'
        memory: 512M

secrets:
  db_password:
    file: ./secrets/db_password.txt
```

## Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [PostgreSQL Docker Images](https://hub.docker.com/_/postgres)
- [Redis Docker Images](https://hub.docker.com/_/redis)
- [Bun Documentation](https://bun.sh/docs)
- [Project Architecture](./ARCHITECTURE.md)
- [Database Documentation](./DATABASE.md)
