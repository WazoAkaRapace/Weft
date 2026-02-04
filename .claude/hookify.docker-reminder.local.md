---
name: docker-reminder
enabled: true
event: stop
pattern: .
action: warn
---

⚠️ **Docker Rebuild Reminder**

If you modified server code or completed backend changes, remember to rebuild and restart the Docker containers:

```bash
docker compose -f docker/docker-compose.yml up -d --build
```

**Why this is necessary:**
- Docker images must be rebuilt to include new code changes
- `docker restart` only restarts containers with old code
- Backend changes require rebuilding the image

**Check if rebuild is needed:**
- Modified files in `packages/server/`? → **Rebuild required**
- Modified `packages/shared/`? → **Rebuild required**
- Modified database schema/migrations? → **Rebuild required**

**Frontend changes only?**
```bash
docker compose -f docker/docker-compose.yml up -d --build frontend
```

**Backend changes only?**
```bash
docker compose -f docker/docker-compose.yml up -d --build backend
```
