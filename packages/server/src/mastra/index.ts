/**
 * Mastra AI Framework Configuration
 *
 * This module initializes and configures the Mastra AI framework with support for
 * multiple providers (Ollama for local models, OpenRouter for cloud models).
 */

import { Mastra } from "@mastra/core";
import { PostgresStore, PgVector } from "@mastra/pg";
import { journalAgent } from "./agents/journal-agent.js";
import { assistantAgent } from "./agents/assistant-agent.js";

// Get database URL from environment
const databaseUrl = process.env.DATABASE_URL;

// Vector store for RAG (semantic search)
let pgVector: PgVector | undefined;
if (databaseUrl) {
  pgVector = new PgVector({
    id: "weft-vector-store",
    connectionString: databaseUrl,
  });
}

/**
 * Mastra instance with all configured agents and storage
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const mastra: any = new Mastra({
  agents: { journalAgent, assistantAgent },
  // Configure PostgreSQL storage for memory persistence
  ...(databaseUrl && {
    storage: new PostgresStore({
      id: 'mastra-storage',
      connectionString: databaseUrl,
    }),
  }),
  // Configure vector store for RAG
  ...(pgVector && {
    vectors: { pgVector },
  }),
});

// Export vector store for use in other modules
export { pgVector };
