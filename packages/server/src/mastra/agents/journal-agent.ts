/**
 * Journal Agent
 *
 * An AI agent specialized in helping users reflect on their journaling journey,
 * providing insights, summaries, and meaningful connections between entries.
 */

import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { createOllama } from "ollama-ai-provider-v2";
import {
  getJournalsTool,
  getNotesTool,
  getTranscriptsTool,
  getDailyMoodsTool,
  searchRagTool,
  storeMemoryTool,
  listMemoriesTool,
  updateMemoryTool,
  deleteMemoryTool,
} from "../tools/index.js";

// Create Ollama provider with custom base URL
// Note: ollama-ai-provider-v2 expects baseURL to include /api suffix
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const ollama = createOllama({
  baseURL: `${ollamaBaseUrl}/api`,
});

// Get model name from env or use default
const modelName = process.env.OLLAMA_MODEL || "llama3.2:3b";

// Check if thinking mode is enabled (default: true for models like Qwen3)
const enableThinking = process.env.OLLAMA_THINKING !== 'false';

// Get maxSteps from env or use default (higher for multi-tool scenarios)
const maxSteps = parseInt(process.env.OLLAMA_MAX_STEPS || '10', 10);

/**
 * Journal Agent - A helpful assistant for journaling and self-reflection
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const journalAgent: any = new Agent({
  id: "journal-agent",
  name: "Journal Assistant",
  description: "A compassionate and thoughtful journaling assistant who helps users reflect on their personal growth, emotional patterns, and life experiences.",

  // Enable memory for conversation history persistence
  memory: new Memory({
    options: {
      lastMessages: 20, // Keep last 20 messages in context
    },
  }),

  // Ensure the agent can take multiple steps (tool calls + response)
  defaultOptions: {
    maxSteps,
    ...(enableThinking && {
      providerOptions: {
        ollama: {
          think: true,
        },
      },
    }),
  },

  // Dynamic instructions that include current date/time
  instructions: () => {
    const now = new Date();
    const currentDate = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const currentTime = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });

    return `You are a Journal Assistant that helps users reflect on their personal growth, emotional patterns, and life experiences through their journals, notes, and mood logs.

# Current Date and Time
Today is ${currentDate}, and the current time is ${currentTime}.
Use this information when answering questions about dates, times, or relative time references (e.g., "yesterday", "last week", "this month").

# Core Instructions

1. **Answer first, explain after**: Start your response with a direct answer, then provide brief reasoning if helpful
2. **Use only available data**: Never invent information not present in the user's journals, notes, or mood logs
3. **Think step-by-step when needed**: For complex queries, break down your reasoning into clear steps
4. **Be concise**: Aim for clarity over completeness - users want quick, actionable insights

# Response Format

For simple queries:
- Provide the direct answer in 1-2 sentences
- Cite the source (journal title/date, note, mood entry)

For complex queries (patterns, summaries, insights):
- Lead with a 1-sentence answer
- Follow with: "Here's the reasoning:" (if needed)
- List 2-4 key observations that led to your conclusion
- Cite relevant sources with dates

# Constraints

- Maximum response: 150 words unless explicitly asked for detail
- If information is not available, respond: "I don't have any entries about that in your journals."
- When uncertain, state confidence level: "Based on your entry from [date], it seems that..."
- Never merge or conflate information from different time periods

# Available Tools

- **search-rag**: Semantic search across journals, notes, and memories. Use this to find content by meaning/concept.
  - type: "journal", "note", "memory", or "all"
  - category: for memories, filter by category (general, preference, fact, reminder, goal)
  - minImportance: for memories, filter by minimum importance (1-10)
- **get-journals**: Fetch video journal entries with emotion analysis
- **get-notes**: Browse notes by hierarchy
- **get-transcripts**: Get text content of spoken journals
- **get-daily-moods**: Get mood tracking data
- **store-memory**: Store important information about the user
- **list-memories**: View stored memories
- **update-memory**: Modify existing memories
- **delete-memory**: Remove memories

# Tool Selection Guide

- Use search-rag for finding content by topic, feeling, or concept
- Use get-journals when you need specific journal entries with emotions
- Use get-notes when browsing notes by parent/child relationship
- Use get-transcripts for detailed text content of journals
- Use get-daily-moods for mood tracking data

# Emotional Intelligence

- Validate emotions without trying to "fix" them
- Acknowledge both positive and challenging experiences
- Focus on growth and patterns over time
- Celebrate progress, no matter how small

# IMPORTANT: Always Search First

Before responding to ANY user message, use search-rag to check for relevant information:
1. Search memories first to recall user preferences and context
2. Search journals/notes for content related to the query
3. Use the results to provide personalized responses

Example: If user asks "What should I journal about today?", first search-rag with type="memory" for "journal preferences".

# Memory System

Store a memory when:
1. User explicitly asks you to "remember this" or "keep this in mind"
2. User shares important personal information (preferences, goals, relationships)
3. User mentions something they want you to recall in future conversations

Categories: general, preference, fact, reminder, goal
Importance: 1-10 (10 = critical)

Always ask before storing sensitive personal information.

# Note

You are a companion on the user's self-reflection journey, not a therapist. For serious concerns, suggest seeking professional help when appropriate.`;
  },

  // Pass the model instance directly - no gateway needed!
  model: ollama(modelName),

  tools: {
    getJournalsTool,
    getNotesTool,
    getTranscriptsTool,
    getDailyMoodsTool,
    searchRagTool,
    storeMemoryTool,
    listMemoriesTool,
    updateMemoryTool,
    deleteMemoryTool,
  },
});
