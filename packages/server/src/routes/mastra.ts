/**
 * Mastra AI Framework API routes
 *
 * Handles AI agent interactions for journal analysis and insights:
 * - POST /api/mastra/chat - Send message to journal agent
 * - GET /api/mastra/health - Check Mastra service health
 */

import { auth } from "../lib/auth.js";
import { withRequestContext } from "../lib/request-context.js";
import { mastra } from "../mastra/index.js";

interface ContextItem {
  type: 'journal' | 'note';
  id: string;
  title: string;
  content?: string;
  date?: string;
}

interface ChatRequestBody {
  message: string;
  conversationId?: string;
  agentId?: 'journalAgent' | 'assistantAgent';
  context?: {
    selectedItems?: ContextItem[];
  };
  // Note: History is now managed by Mastra memory on the backend
}

/**
 * Chat with AI Agent
 *
 * POST /api/mastra/chat
 *
 * Body:
 * {
 *   "message": "Summarize my last 3 journals",
 *   "conversationId": "optional-conversation-id",
 *   "agentId": "assistantAgent" | "journalAgent",
 *   "context": {
 *     "selectedItems": [...]
 *   }
 * }
 *
 * @returns Streaming response with agent text
 */
export async function handleChatWithAgent(request: Request): Promise<Response> {
  try {
    // Verify authentication
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          code: "PERMISSION_DENIED",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body = (await request.json().catch(() => ({}))) as ChatRequestBody;

    const { message, conversationId, agentId = 'assistantAgent', context } = body;

    // Validate message
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return new Response(
        JSON.stringify({
          error: "Message is required",
          code: "VALIDATION_ERROR",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Limit message length
    if (message.length > 5000) {
      return new Response(
        JSON.stringify({
          error: "Message too long (max 5000 characters)",
          code: "VALIDATION_ERROR",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    try {
      // Get the specified agent
      const agent = mastra.getAgent(agentId);

      if (!agent) {
        return new Response(
          JSON.stringify({
            error: `${agentId} not available`,
            code: "SERVICE_UNAVAILABLE",
          }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        );
      }

      // Build current message with context
      let currentMessage = message;

      // Add context information if provided
      if (context?.selectedItems && context.selectedItems.length > 0) {
        const contextInfo = buildContextString(context.selectedItems);
        currentMessage = `Context from user's selected items:\n${contextInfo}\n\nUser message: ${message}`;
      }

      // Use the provided conversation ID or generate a new one
      const threadId = conversationId || crypto.randomUUID();

      // Check if thinking mode is enabled (default: true for models like Qwen3)
      const enableThinking = process.env.OLLAMA_THINKING !== 'false';

      // Get maxSteps from env or use default (higher for multi-tool scenarios)
      const maxSteps = parseInt(process.env.OLLAMA_MAX_STEPS || '10', 10);

      // Wrap the entire streaming operation with request context
      // This ensures tools can access the authenticated userId securely
      return await withRequestContext(session.user.id, async () => {
        const result = await agent.stream(currentMessage, {
          // Memory configuration for conversation persistence
          memory: {
            thread: threadId,
            resource: session.user.id,
          },
          maxSteps,
          ...(enableThinking && {
            providerOptions: {
              ollama: {
                think: true,
              },
            },
          }),
          onStepFinish: ({ text, toolCalls, toolResults, finishReason }: {
            text?: string;
            toolCalls?: unknown[];
            toolResults?: unknown[];
            finishReason?: string;
          }) => {
            console.log("[Mastra] Step finished:", {
              hasText: !!text,
              toolCallsCount: toolCalls?.length || 0,
              toolResultsCount: toolResults?.length || 0,
              finishReason,
            });
          },
        });

        // Use fullStream to get structured chunks including reasoning
        const fullStream = result.fullStream;
        const reader = fullStream.getReader();
        const encoder = new TextEncoder();

        // Track what we've seen for the workaround
        let hasToolCalls = false;
        let hasTextContent = false;
        let hasReasoningContent = false;
        const toolResults: Array<{ toolName: string; result: unknown }> = [];

        // Create a TransformStream to allow us to continue the stream after it ends
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();

        // Process the initial stream - defined inside withRequestContext so it maintains context
        const processStream = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                console.log("[Mastra] Stream completed, tool calls:", hasToolCalls, "text:", hasTextContent);

                // Check if we need the workaround
                if (hasToolCalls && !hasTextContent && toolResults.length > 0) {
                  console.log("[Mastra] Applying Ollama tool-call workaround: making follow-up stream call...");
                  console.log("[Mastra] Tool results collected:", toolResults.length);

                  // If we had reasoning content, close it before the follow-up
                  // This ensures the follow-up's reasoning appears in a separate block
                  if (hasReasoningContent) {
                    await writer.write(encoder.encode(JSON.stringify({ type: 'reasoning-end' }) + '\n'));
                    console.log("[Mastra] Closed initial reasoning block");
                  }

                  try {
                    // Build a follow-up message that includes the tool results
                    const toolResultsSummary = toolResults.map(tr =>
                      `Tool: ${tr.toolName}\nResult: ${JSON.stringify(tr.result, null, 2)}`
                    ).join('\n\n');

                    const followUpMessage = `The following tool calls were executed and returned these results:

${toolResultsSummary}

Based on these results, please provide your response to my original question.`;

                    // Make a follow-up STREAM call with memory for context
                    // Memory will include the previous conversation from this thread
                    const followUpResult = await agent.stream(followUpMessage, {
                      memory: {
                        thread: threadId,
                        resource: session.user.id,
                      },
                      maxSteps: 1,
                      ...(enableThinking && {
                        providerOptions: {
                          ollama: {
                            think: true,
                          },
                        },
                      }),
                    });

                    // Stream the follow-up response
                    const followUpReader = followUpResult.fullStream.getReader();

                    while (true) {
                      const { done: followUpDone, value: followUpValue } = await followUpReader.read();
                      if (followUpDone) {
                        console.log("[Mastra] Follow-up stream completed");
                        break;
                      }

                      // Forward all chunks from the follow-up stream
                      const chunk: Record<string, unknown> = { type: followUpValue.type };
                      if ('payload' in followUpValue && followUpValue.payload !== undefined) {
                        chunk.payload = followUpValue.payload;
                      }
                      if ('object' in followUpValue && followUpValue.object !== undefined) {
                        chunk.object = followUpValue.object;
                      }

                      await writer.write(encoder.encode(JSON.stringify(chunk) + '\n'));
                    }
                  } catch (followUpError) {
                    console.error("[Mastra] Follow-up stream error:", followUpError);
                  }
                }

                // Send finish and close
                await writer.write(encoder.encode(JSON.stringify({ type: 'finish' }) + '\n'));
                await writer.close();
                return;
              }

              // Track what we've seen
              if (value.type.startsWith('tool-')) {
                hasToolCalls = true;
              }
              if (value.type === 'text-delta' && (value as { payload?: { text?: string } }).payload?.text) {
                hasTextContent = true;
              }
              // Track if we have reasoning content (to properly close it before follow-up)
              if (value.type === 'reasoning-delta' || value.type === 'reasoning-start') {
                hasReasoningContent = true;
              }

              // Collect tool results for potential follow-up
              if (value.type === 'tool-result') {
                const payload = (value as { payload?: { toolName?: string; result?: unknown } }).payload;
                if (payload?.toolName && payload?.result) {
                  toolResults.push({
                    toolName: payload.toolName,
                    result: payload.result
                  });
                }
              }

              // Forward the chunk to the client
              const chunk: Record<string, unknown> = { type: value.type };
              if ('payload' in value && value.payload !== undefined) {
                chunk.payload = value.payload;
              }
              if ('object' in value && value.object !== undefined) {
                chunk.object = value.object;
              }

              await writer.write(encoder.encode(JSON.stringify(chunk) + '\n'));
            }
          } catch (error) {
            console.error("[Mastra] Stream error:", error);
            await writer.write(encoder.encode(JSON.stringify({
              type: 'error',
              payload: { error: error instanceof Error ? error.message : 'Stream error' }
            }) + '\n'));
            await writer.close();
          }
        };

        // Start processing in the background
        // This async function is created within withRequestContext, so it maintains the context
        processStream();

        return new Response(readable, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Conversation-ID': threadId,
            'X-Agent-ID': agentId,
          },
        });
      });
    } catch (agentError) {
      console.error("Agent execution error:", agentError);

      // Provide helpful error messages for common issues
      let errorMessage = "Failed to generate response";

      if (agentError instanceof Error) {
        if (agentError.message.includes("ECONNREFUSED") || agentError.message.includes("ollama")) {
          errorMessage = "Cannot connect to Ollama. Please ensure Ollama is running and accessible.";
        } else if (agentError.message.includes("API key")) {
          errorMessage = "Invalid or missing API key for the configured provider.";
        } else if (agentError.message.includes("model")) {
          errorMessage = "Model not found. Please check your model configuration.";
        } else {
          errorMessage = agentError.message;
        }
      }

      return new Response(
        JSON.stringify({
          error: errorMessage,
          code: "AGENT_ERROR",
          details: agentError instanceof Error ? agentError.message : "Unknown error",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Chat handler error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        code: "INTERNAL_ERROR",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * Build a context string from selected items
 */
function buildContextString(items: ContextItem[]): string {
  return items.map(item => {
    const header = `## ${item.type === 'journal' ? '📹 Journal' : '📝 Note'}: ${item.title}`;
    const metadata = item.date ? `\nDate: ${new Date(item.date).toLocaleDateString()}` : '';
    const content = item.content ? `\n\n${item.content}` : '\n\n(No content available)';
    return `${header}${metadata}${content}`;
  }).join('\n\n');
}

/**
 * Mastra Health Check
 *
 * GET /api/mastra/health
 *
 * @returns Response with Mastra service status
 */
export async function handleMastraHealth(): Promise<Response> {
  try {
    const provider = process.env.MASTRA_PROVIDER || "ollama";
    const model = process.env.MASTRA_DEFAULT_MODEL || "ollama/llama3.2:3b";

    // Check provider-specific configuration
    const health: {
      status: string;
      provider: string;
      model: string;
      configured: boolean;
      details: Record<string, string>;
    } = {
      status: "healthy",
      provider,
      model,
      configured: true,
      details: {},
    };

    if (provider === "ollama") {
      const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
      const ollamaModel = process.env.OLLAMA_MODEL || "llama3.2:3b";
      const ollamaThinking = process.env.OLLAMA_THINKING !== 'false';

      health.details = {
        baseUrl: ollamaBaseUrl,
        model: ollamaModel,
        thinking: ollamaThinking ? 'enabled' : 'disabled',
      };

      // Try to connect to Ollama
      try {
        const response = await fetch(`${ollamaBaseUrl}/api/tags`, {
          signal: AbortSignal.timeout(5000), // 5 second timeout
        });

        if (!response.ok) {
          health.status = "degraded";
          health.configured = false;
          health.details.error = "Ollama service not responding correctly";
        } else {
          const data = (await response.json()) as { models?: Array<{ name: string }> };
          const models = data.models || [];

          if (models.length === 0) {
            health.details.warning = "Ollama is running but no models found";
          } else {
            health.details.availableModels = models.map((m) => m.name).join(", ");
          }
        }
      } catch {
        health.status = "unhealthy";
        health.configured = false;
        health.details.error = "Cannot connect to Ollama service";
      }
    } else if (provider === "openrouter") {
      const apiKey = process.env.OPENROUTER_API_KEY;
      const openrouterModel = process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4";

      health.details = {
        model: openrouterModel,
      };

      if (!apiKey) {
        health.status = "unhealthy";
        health.configured = false;
        health.details.error = "OPENROUTER_API_KEY not configured";
      } else {
        health.details.apiKeyConfigured = "true";
      }
    } else {
      health.status = "unhealthy";
      health.configured = false;
      health.details.error = `Unknown provider: ${provider}`;
    }

    const statusCode = health.configured ? 200 : health.status === "degraded" ? 503 : 503;

    return new Response(
      JSON.stringify(health),
      { status: statusCode, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Health check error:", error);
    return new Response(
      JSON.stringify({
        status: "error",
        error: "Health check failed",
        code: "HEALTH_CHECK_ERROR",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * List User's Threads
 *
 * GET /api/mastra/threads
 *
 * Returns a list of conversation threads for the authenticated user.
 *
 * @returns Response with threads list
 */
export async function handleListThreads(request: Request): Promise<Response> {
  try {
    // Verify authentication
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          code: "PERMISSION_DENIED",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get the assistant agent to access its memory
    const agent = mastra.getAgent('assistantAgent');
    if (!agent) {
      return new Response(
        JSON.stringify({
          error: "Agent not available",
          code: "SERVICE_UNAVAILABLE",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

    const memory = await agent.getMemory();
    if (!memory) {
      return new Response(
        JSON.stringify({
          threads: [],
          total: 0,
          hasMore: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get pagination params from query string
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '0', 10);
    const perPage = parseInt(url.searchParams.get('perPage') || '20', 10);

    // List threads filtered by user ID
    const result = await memory.listThreads({
      filter: { resourceId: session.user.id },
      page,
      perPage,
      orderBy: { field: 'updatedAt', direction: 'DESC' },
    });

    return new Response(
      JSON.stringify({
        threads: result?.threads || [],
        total: result?.total || 0,
        page: result?.page || page,
        perPage: result?.perPage || perPage,
        hasMore: result?.hasMore || false,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("List threads error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        code: "INTERNAL_ERROR",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * Get Thread Messages
 *
 * GET /api/mastra/threads/:id/messages
 *
 * Returns messages for a specific thread.
 *
 * @returns Response with thread messages
 */
export async function handleGetThreadMessages(request: Request, threadId: string): Promise<Response> {
  try {
    // Verify authentication
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          code: "PERMISSION_DENIED",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get the assistant agent to access its memory
    const agent = mastra.getAgent('assistantAgent');
    if (!agent) {
      return new Response(
        JSON.stringify({
          error: "Agent not available",
          code: "SERVICE_UNAVAILABLE",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

    const memory = await agent.getMemory();
    if (!memory) {
      return new Response(
        JSON.stringify({
          thread: null,
          messages: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // First verify thread ownership
    const thread = await memory.getThreadById({ threadId });
    if (!thread) {
      return new Response(
        JSON.stringify({
          error: "Thread not found",
          code: "NOT_FOUND",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Verify the thread belongs to this user
    if (thread.resourceId !== session.user.id) {
      return new Response(
        JSON.stringify({
          error: "Thread not found",
          code: "NOT_FOUND",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get messages for this thread
    const result = await memory.recall({
      threadId,
      resourceId: session.user.id,
      perPage: false, // Get all messages
    });

    return new Response(
      JSON.stringify({
        thread: {
          id: thread.id,
          title: thread.title,
          createdAt: thread.createdAt,
          updatedAt: thread.updatedAt,
        },
        messages: result?.messages || [],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Get thread messages error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        code: "INTERNAL_ERROR",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * Get Available Models
 *
 * GET /api/mastra/models
 *
 * Returns available models for the configured provider.
 *
 * @returns Response with available models or error
 */
export async function handleGetModels(): Promise<Response> {
  try {
    const provider = process.env.MASTRA_PROVIDER || "ollama";

    if (provider === "ollama") {
      const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

      try {
        const response = await fetch(`${ollamaBaseUrl}/api/tags`, {
          signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
          return new Response(
            JSON.stringify({
              error: "Failed to fetch models from Ollama",
              code: "PROVIDER_ERROR",
            }),
            { status: 503, headers: { "Content-Type": "application/json" } }
          );
        }

        const data = (await response.json()) as { models?: Array<{ name: string }> };
        const models = data.models || [];

        return new Response(
          JSON.stringify({
            provider,
            models: models.map((m) => m.name),
            count: models.length,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      } catch {
        return new Response(
          JSON.stringify({
            error: "Cannot connect to Ollama",
            code: "CONNECTION_ERROR",
          }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        );
      }
    } else if (provider === "openrouter") {
      // OpenRouter has many models - return common ones
      return new Response(
        JSON.stringify({
          provider,
          models: [
            "anthropic/claude-sonnet-4",
            "anthropic/claude-3.5-sonnet",
            "openai/gpt-4o",
            "openai/gpt-4o-mini",
            "google/gemini-pro-1.5",
          ],
          note: "This is a partial list. See https://openrouter.ai/models for all available models.",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        error: "Unknown provider",
        code: "INVALID_PROVIDER",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Get models error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        code: "INTERNAL_ERROR",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
