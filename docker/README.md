# Weft Docker Setup with Ollama

This guide explains how to set up Weft with Ollama for local AI model support.

## Prerequisites

- Docker and Docker Compose installed
- At least 32GB of RAM available (for qwen3:30b model)
- At least 100GB of free disk space
- For network access: Configure your firewall to allow port 11434

## Quick Start

1. **Copy environment file:**
   ```bash
   cp docker/.env.example docker/.env
   ```

2. **Review and customize settings in `docker/.env`:**
   - Adjust resource limits if needed
   - Set the OLLAMA_PORT if you want a different port

3. **Start all services:**
   ```bash
   cd docker
   docker compose up -d
   ```

4. **Wait for services to be healthy:**
   ```bash
   docker compose ps
   ```

5. **Pull the qwen3:30b model:**
   ```bash
   ./scripts/setup-ollama-model.sh
   ```

   The model is approximately 60GB, so this may take a while depending on your internet connection.

6. **Verify Ollama is working:**
   ```bash
   docker exec weft-ollama ollama list
   ```

7. **Test the Mastra integration:**
   ```bash
   curl http://localhost:11434/api/mastra/health
   ```

## Services

### Ollama Service

- **Container Name:** `weft-ollama`
- **Image:** `ollama/ollama:latest`
- **Port:** 11434 (default)
- **URL:** http://192.168.5.104:11434 (from your network)
- **Memory:** 32GB limit, 16GB reservation
- **Volume:** `weft_ollama_data` for model storage

### Backend Service

Updated with Mastra environment variables:
- `MASTRA_PROVIDER=ollama`
- `OLLAMA_BASE_URL=http://ollama:11434`
- `OLLAMA_MODEL=qwen3:30b`
- `MASTRA_DEFAULT_MODEL=ollama/qwen3:30b`

## Network Configuration

### Accessing Ollama from Your Network

To access Ollama at `http://192.168.5.104:11434`:

1. **Find your host machine's IP:**
   ```bash
   # Linux
   hostname -I

   # macOS
   ipconfig getifaddr en0

   # Windows
   ipconfig
   ```

2. **Update `docker/.env` if needed:**
   ```bash
   # If your host IP is different from 192.168.5.104
   HOST_IP=192.168.5.104
   ```

3. **The Ollama service will be accessible at:**
   - `http://<HOST_IP>:11434`
   - Example: `http://192.168.5.104:11434`

### Firewall Configuration

Ensure your firewall allows:
- Port 11434 for Ollama
- Port 3001 for the Backend API

## Model Information

### qwen3:30b

- **Size:** ~60GB
- **Parameters:** 30 billion
- **RAM Usage:** ~16-20GB
- **Performance:** Excellent for journaling, summarization, and insights
- **Language:** Strong multilingual support

## Management Commands

### View Logs
```bash
# All services
docker compose logs -f

# Ollama only
docker compose logs -f ollama

# Backend only
docker compose logs -f backend
```

### Restart Services
```bash
# Restart all
docker compose restart

# Restart Ollama only
docker compose restart ollama

# Restart Backend only
docker compose restart backend
```

### Stop Services
```bash
docker compose down
```

### Update Model
```bash
# Pull latest version of the model
docker exec weft-ollama ollama pull qwen3:30b
```

### Remove Model (to free space)
```bash
docker exec weft-ollama ollama rm qwen3:30b
```

## Troubleshooting

### Ollama Container Not Starting

**Check logs:**
```bash
docker compose logs ollama
```

**Verify resources:**
```bash
docker stats weft-ollama
```

### Out of Memory Errors

**Reduce model size:**
1. Update `docker/.env`:
   ```bash
   OLLAMA_MODEL=qwen3:14b
   MASTRA_DEFAULT_MODEL=ollama/qwen3:14b
   ```
2. Restart the backend:
   ```bash
   docker compose restart backend
   ```
3. Pull the new model:
   ```bash
   docker exec weft-ollama ollama pull qwen3:14b
   ```

### Model Pull Fails

**Check internet connection:**
```bash
docker exec weft-ollama curl -I https://ollama.ai
```

**Retry the pull:**
```bash
./scripts/setup-ollama-model.sh
```

### Backend Can't Connect to Ollama

**Verify Ollama is healthy:**
```bash
docker exec weft-ollama curl http://localhost:11434/api/tags
```

**Check backend environment:**
```bash
docker exec weft-backend env | grep OLLAMA
```

**Test from backend container:**
```bash
docker exec weft-backend curl http://ollama:11434/api/tags
```

## Monitoring

### Resource Usage
```bash
# Real-time stats
docker stats

# Ollama container stats
docker stats weft-ollama

# Backend container stats
docker stats weft-backend
```

### Disk Usage
```bash
# Ollama data volume
docker volume inspect weft_ollama_data

# Check disk usage
du -sh /var/lib/docker/volumes/weft_ollama_data
```

## Alternative Models

If `qwen3:30b` is too large for your system, consider these alternatives:

| Model | Size | RAM | Quality |
|-------|------|-----|----------|
| qwen3:14b | ~26GB | ~10GB | Very Good |
| qwen3:7b | ~14GB | ~6GB | Good |
| llama3.2:3b | ~2GB | ~4GB | Fair |
| phi3:3.8b | ~2.3GB | ~4GB | Good |

To switch models:
1. Update `OLLAMA_MODEL` and `MASTRA_DEFAULT_MODEL` in `docker/.env`
2. Pull the new model: `docker exec weft-ollama ollama pull <model-name>`
3. Restart backend: `docker compose restart backend`

## Security Notes

- Ollama is accessible on your network at port 11434
- Ensure your firewall is configured appropriately
- For production, consider using a reverse proxy with authentication
- Never expose Ollama directly to the internet

## Production Deployment

For production deployments:

1. **Use a managed Ollama instance** behind your firewall
2. **Configure authentication** for Ollama
3. **Use OpenRouter** instead of local Ollama for better scalability
4. **Set up monitoring** for resource usage
5. **Configure backups** for the Ollama data volume

## Additional Resources

- [Ollama Documentation](https://github.com/ollama/ollama)
- [Qwen Models](https://ollama.com/library/qwen3)
- [Weft Documentation](../README.MD)
- [Mastra Provider Guide](../docs/MASTRA_PROVIDERS.md)
