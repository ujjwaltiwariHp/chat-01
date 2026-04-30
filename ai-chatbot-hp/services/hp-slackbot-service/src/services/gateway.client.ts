import { config } from "@config/index.js";
import { logger } from "@hp-intelligence/core";
import { parseSSE } from "../lib/sse-parser.js";

export interface InvokeOptions {
  message: string;
  tenantId: string;
  userId: string;
  sessionId: string;
}

export class GatewayClient {
  private log = logger.child({ ns: "gateway:client" });

  async *invokeHRPolicyStream(
    options: InvokeOptions,
  ): AsyncGenerator<string, void, unknown> {
    const { message, tenantId, userId, sessionId } = options;
    const url = `${config.GATEWAY_URL}/api/v1/bots/hr-policy/invoke`;

    this.log.info(
      { tenantId, userId, sessionId },
      "Invoking HR Policy Stream through Gateway",
    );

    const response = await fetch(url, {
      method: "POST",
      signal: AbortSignal.timeout(25_000),
      headers: {
        "Content-Type": "application/json",
        "X-Service-Token": config.INTERNAL_SERVICE_TOKEN,
        "X-Tenant-ID": tenantId,
        "X-Customer-ID": userId,
        "X-Session-ID": sessionId,
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.log.error(
        { status: response.status, error },
        "Gateway invocation failed",
      );
      throw new Error(`Gateway Error: ${response.status} - ${error}`);
    }

    if (!response.body) {
      throw new Error("Empty response body from Gateway");
    }

    const stream = parseSSE(
      response.body as unknown as AsyncIterable<Uint8Array>,
    );

    for await (const data of stream) {
      // 1. Handle raw content chunks (unwrapped)
      if (data.type === "content" && typeof data.content === "string") {
        yield data.content;
      }
      // 2. Handle [DONE] signal
      else if (data.type === "done") {
        return;
      }
      // 3. Handle data wrapped in ApiResponse (contains statusCode/message)
      // This catches errors like DB failures or AI provider errors before they are yielded as content
      else if (data.statusCode && data.statusCode >= 400) {
        const errorMsg = data.message || "AI Service Error";
        this.log.error(
          { statusCode: data.statusCode, error: errorMsg },
          "AI Service returned error via SSE",
        );
        throw new Error(errorMsg);
      }
    }
  }

  /**
   * Routes all messages directly to the HR Policy AI service.
   * Logic for greetings/safety is now handled via the System Prompt in the AI service.
   */
  async *invokeSmartStream(options: InvokeOptions): AsyncGenerator<string> {
    try {
      yield* this.invokeHRPolicyStream(options);
    } catch (err: any) {
      if (err.name === "TimeoutError" || err.message?.includes("timeout")) {
        yield "⏱️ The request took too long. Please try again.";
      } else {
        throw err;
      }
    }
  }

  async invokeHRPolicy(options: InvokeOptions): Promise<string> {
    this.log.info(
      {
        tenantId: options.tenantId,
        userId: options.userId,
        sessionId: options.sessionId,
      },
      "Invoking HR Policy through Gateway",
    );
    let fullContent = "";
    try {
      const stream = this.invokeHRPolicyStream(options);
      for await (const chunk of stream) {
        fullContent += chunk;
      }
      return fullContent.trim();
    } catch (err: any) {
      this.log.error(
        { err: err.message },
        "Failed to communicate with AI Gateway",
      );
      throw err;
    }
  }
}

export const gatewayClient = new GatewayClient();
