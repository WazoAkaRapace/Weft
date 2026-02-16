/**
 * AI Assistant Agent
 *
 * A general-purpose AI assistant for conversational interactions,
 * providing helpful responses while respecting user-selected context.
 */

import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { createOllama } from "ollama-ai-provider-v2";
import { getJournalsTool, getNotesTool, getTranscriptsTool, getDailyMoodsTool, searchNotesTool } from "../tools/index.js";

// Create Ollama provider with custom base URL
// Note: ollama-ai-provider-v2 expects baseURL to include /api suffix
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const ollama = createOllama({
  baseURL: `${ollamaBaseUrl}/api`,
});

// Get model name from env or use default
const modelName = process.env.OLLAMA_MODEL || "qwen3:30b";

// Check if thinking mode is enabled (default: true for models like Qwen3)
const enableThinking = process.env.OLLAMA_THINKING !== 'false';

// Get maxSteps from env or use default (higher for multi-tool scenarios)
const maxSteps = parseInt(process.env.OLLAMA_MAX_STEPS || '10', 10);

/**
 * AI Assistant - A helpful conversational assistant
 */
export const assistantAgent = new Agent({
  id: "assistant-agent",
  name: "AI Assistant",
  description: "A helpful AI assistant for journaling and personal reflection",

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

    return `You are a Journal Assistant that answers questions based on the user's journals, notes, transcripts, and mood logs.

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

For complex queries:
- Lead with a 1-sentence answer
- Follow with: "Here's the reasoning:" (if needed)
- List 2-4 key observations that led to your conclusion
- Cite relevant sources with dates

# Constraints

- Maximum response: 150 words unless explicitly asked for detail
- If information is not available, respond: "I don't have any entries about that in your journals."
- When uncertain, state confidence level: "Based on your entry from [date], it seems that..."
- Never merge or conflate information from different time periods
- Always use the provided User ID when fetching data with tools

# Available Data

You have access to tools that can fetch:
- **Journals**: Video journal entries with emotion analysis
- **Notes**: Text notes the user has created
- **Transcripts**: Text transcripts of spoken journal content
- **Daily Moods**: Morning/afternoon mood logs
- **Search Notes**: Search for specific text in note titles and content with relevance ranking

# Tool Selection Guide

- Use search-notes when looking for specific information, keywords, or topics in notes
- Use get-notes when browsing or listing notes by hierarchy
- Use get-journals for video journal entries with emotions
- Use get-transcripts for text content of spoken journals
- Use get-daily-moods for mood tracking data

# Important

You are a companion on the user's self-reflection journey, not a therapist. For serious concerns, suggest seeking professional help when appropriate.`;
  },

  // Pass the model instance directly - no gateway needed!
  model: ollama(modelName),

  tools: {
    getJournalsTool,
    getNotesTool,
    getTranscriptsTool,
    getDailyMoodsTool,
    searchNotesTool,
  },
});
