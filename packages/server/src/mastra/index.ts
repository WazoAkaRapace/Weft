/**
 * Mastra AI Framework Configuration
 *
 * This module initializes and configures the Mastra AI framework with support for
 * multiple providers (Ollama for local models, OpenRouter for cloud models).
 */

import { Mastra } from "@mastra/core";
import { PostgresStore } from "@mastra/pg";
import { journalAgent } from "./agents/journal-agent.js";
import { assistantAgent } from "./agents/assistant-agent.js";

// Get database URL from environment
const databaseUrl = process.env.DATABASE_URL;

/**
 * Mastra instance with all configured agents and storage
 */
export const mastra = new Mastra({
  agents: { journalAgent, assistantAgent },
  // Configure PostgreSQL storage for memory persistence
  ...(databaseUrl && {
    storage: new PostgresStore({
      id: 'mastra-storage',
      connectionString: databaseUrl,
    }),
  }),
});
