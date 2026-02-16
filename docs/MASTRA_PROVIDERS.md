# Mastra AI Provider Configuration Guide

This guide explains how to configure and use different AI providers with Weft's Mastra AI integration.

## Overview

Weft supports two AI providers for powering the Journal Assistant:

1. **Ollama** - Local, free, privacy-focused (recommended for most users)
2. **OpenRouter** - Cloud-based, more powerful models (requires subscription)

## Quick Comparison

| Feature | Ollama | OpenRouter |
|---------|--------|------------|
| **Cost** | Free | Paid (usage-based) |
| **Privacy** | 100% local | Data sent to cloud |
| **Performance** | Depends on hardware | Consistent, fast |
| **Model Quality** | Good (smaller models) | Excellent (frontier models) |
| **Setup Difficulty** | Easy | Very Easy |
| **Internet Required** | No (after setup) | Yes |
| **Hardware Requirements** | 8GB+ RAM recommended | None |

---

## Ollama Setup (Recommended)

Ollama runs AI models locally on your machine, providing complete privacy and no ongoing costs.

### Prerequisites

- macOS, Linux, or Windows (with WSL2)
- 8GB+ RAM recommended
- 10GB+ free disk space

### Installation

1. **Install Ollama:**

   **macOS/Linux:**
   ```bash
   curl -fsSL https://ollama.ai/install.sh | sh
   ```

   **Windows:**
   Download from [ollama.ai](https://ollama.ai)

2. **Start Ollama Service:**

   Ollama usually starts automatically. Verify:
   ```bash
   ollama serve
   ```

3. **Pull a Model:**

   ```bash
   # Recommended for Weft (good balance of speed and quality)
   ollama pull llama3.2:3b

   # Alternative: Even smaller/faster (less capable)
   ollama pull phi3:3.8b

   # Alternative: More capable (slower)
   ollama pull llama3.2:7b
   ```

4. **Verify Installation:**

   ```bash
   ollama list
   ollama run llama3.2:3b "Hello, world!"
   ```

### Configuration

Add to `packages/server/.env.local`:

```bash
MASTRA_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
MASTRA_DEFAULT_MODEL=ollama/llama3.2:3b
```

### Recommended Models for Ollama

| Model | Size | RAM | Speed | Quality | Best For |
|-------|------|-----|-------|---------|----------|
| `llama3.2:3b` | 2GB | 6GB | Fast | Good | Most users |
| `phi3:3.8b` | 2.3GB | 6GB | Very Fast | Good | Quick responses |
| `llama3.2:1b` | 700MB | 4GB | Very Fast | Fair | Low-end hardware |
| `llama3.2:7b` | 4.5GB | 10GB | Medium | Excellent | Better insights |
| `qwen2.5:7b` | 4.5GB | 10GB | Medium | Excellent | Alternative |

### Troubleshooting Ollama

**Problem:** "Cannot connect to Ollama"
- **Solution:** Ensure Ollama is running: `ollama serve`

**Problem:** Responses are slow
- **Solution:** Try a smaller model (e.g., `llama3.2:1b`)

**Problem:** Out of memory errors
- **Solution:** Close other applications or use a smaller model

**Problem:** Model not found
- **Solution:** Run `ollama pull <model-name>`

---

## OpenRouter Setup

OpenRouter provides access to frontier AI models (Claude, GPT-4, etc.) via a unified API.

### Prerequisites

- OpenRouter account
- API key
- Internet connection
- Credits or subscription

### Installation

1. **Create Account:**

   Visit [openrouter.ai](https://openrouter.ai) and sign up.

2. **Get API Key:**

   - Go to Settings → API Keys
   - Create a new API key
   - Copy the key (starts with `sk-or-v1-...`)

3. **Add Credits:**

   OpenRouter is pay-per-use. Add credits via the dashboard.

### Configuration

Add to `packages/server/.env.local`:

```bash
MASTRA_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-your-key-here
OPENROUTER_MODEL=anthropic/claude-sonnet-4
MASTRA_DEFAULT_MODEL=openrouter/anthropic/claude-sonnet-4
```

### Recommended Models for OpenRouter

| Model | Quality | Speed | Cost (per 1M tokens) | Best For |
|-------|---------|-------|---------------------|----------|
| `anthropic/claude-sonnet-4` | Excellent | Fast | ~$3 | Most users |
| `anthropic/claude-3.5-sonnet` | Excellent | Fast | ~$3 | Most users |
| `openai/gpt-4o` | Excellent | Fast | ~$2.50 | General use |
| `openai/gpt-4o-mini` | Good | Very Fast | ~$0.15 | Quick responses |
| `google/gemini-pro-1.5` | Excellent | Fast | ~$1.25 | Long context |
| `meta-llama/llama-3.1-70b` | Good | Medium | ~$0.60 | Cost-effective |

### Troubleshooting OpenRouter

**Problem:** "Invalid API key"
- **Solution:** Verify your API key in OpenRouter dashboard

**Problem:** "Insufficient credits"
- **Solution:** Add credits to your OpenRouter account

**Problem:** Model not available
- **Solution:** Check [openrouter.ai/models](https://openrouter.ai/models) for available models

**Problem:** Rate limiting
- **Solution:** Wait a few minutes or upgrade your plan

---

## Switching Providers

To switch between providers:

1. Update `MASTRA_PROVIDER` in `.env.local`
2. Update provider-specific variables
3. Update `MASTRA_DEFAULT_MODEL`
4. Restart the server

Example (Ollama → OpenRouter):

```bash
# Before (Ollama)
MASTRA_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
MASTRA_DEFAULT_MODEL=ollama/llama3.2:3b

# After (OpenRouter)
MASTRA_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=anthropic/claude-sonnet-4
MASTRA_DEFAULT_MODEL=openrouter/anthropic/claude-sonnet-4
```

---

## Advanced Configuration

### Custom Ollama Base URL

If Ollama is running on a different machine:

```bash
OLLAMA_BASE_URL=http://192.168.1.100:11434
```

### Model Parameters

You can customize model behavior by setting environment variables:

```bash
# Temperature (0.0 - 2.0, lower = more focused)
MASTRA_TEMPERATURE=0.7

# Maximum tokens in response
MASTRA_MAX_TOKENS=1000
```

### Multiple Providers (Advanced)

For advanced users, you can configure different agents to use different providers by modifying `src/mastra/agents/journal-agent.ts`.

---

## Security Considerations

### Ollama
- ✅ Data never leaves your machine
- ✅ No API keys to manage
- ✅ No ongoing costs
- ❌ Limited to smaller models

### OpenRouter
- ✅ Access to frontier models
- ✅ Consistent performance
- ❌ Data sent to third party
- ❌ Requires API key management
- ❌ Ongoing costs

---

## Performance Tips

### For Ollama

1. **Use appropriate model size:**
   - Low RAM: `llama3.2:1b`
   - Medium RAM: `llama3.2:3b`
   - High RAM: `llama3.2:7b`

2. **Close unnecessary apps:**
   Free up RAM for model inference

3. **Use SSD storage:**
   Ollama models load faster from SSDs

### For OpenRouter

1. **Choose appropriate model:**
   - Quick tasks: `gpt-4o-mini`
   - Deep analysis: `claude-sonnet-4`

2. **Monitor usage:**
   Check OpenRouter dashboard to track costs

3. **Implement caching:**
   Reduce API calls for repeated queries

---

## Testing Your Setup

After configuration, test with:

```bash
# Check Mastra health
curl http://localhost:3001/api/mastra/health

# List available models
curl http://localhost:3001/api/mastra/models

# Send a test chat
curl -X POST http://localhost:3001/api/mastra/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, can you help me?"}'
```

---

## Getting Help

- **Ollama Issues:** [Ollama GitHub](https://github.com/ollama/ollama)
- **OpenRouter Issues:** [OpenRouter Discord](https://discord.gg/openrouter)
- **Weft Issues:** [Weft GitHub](https://github.com/your-repo)

---

## Appendix: Environment Variable Reference

### Ollama Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MASTRA_PROVIDER` | `ollama` | Provider selection |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API endpoint |
| `OLLAMA_MODEL` | `llama3.2:3b` | Default model name |
| `MASTRA_DEFAULT_MODEL` | `ollama/llama3.2:3b` | Full model identifier |

### OpenRouter Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MASTRA_PROVIDER` | `openrouter` | Provider selection |
| `OPENROUTER_API_KEY` | (required) | Your OpenRouter API key |
| `OPENROUTER_MODEL` | `anthropic/claude-sonnet-4` | Default model name |
| `MASTRA_DEFAULT_MODEL` | `openrouter/anthropic/claude-sonnet-4` | Full model identifier |

### Common Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MASTRA_TEMPERATURE` | `0.7` | Response randomness (0-2) |
| `MASTRA_MAX_TOKENS` | `1000` | Maximum response length |
