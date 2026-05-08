import type { SmsResult, SmsError } from "../types.ts";
import { EXIT } from "../types.ts";

export function getClickatellConfig() {
  return {
    apiKey: process.env.CLICKATELL_API_KEY,
    from: process.env.CLICKATELL_FROM,
  };
}

export function isClickatellConfigured(): boolean {
  const c = getClickatellConfig();
  return !!(c.apiKey);
}

export async function sendClickatell(
  to: string,
  message: string,
  from?: string
): Promise<{ result?: SmsResult; error?: SmsError; exitCode: number }> {
  const config = getClickatellConfig();
  const sender = from ?? config.from;

  if (!config.apiKey) {
    return {
      exitCode: EXIT.MISSING_CONFIG,
      error: {
        error: {
          code: EXIT.MISSING_CONFIG,
          type: "missing_provider_config",
          message: "Clickatell requires CLICKATELL_API_KEY",
          recoverable: false,
          retry_after: null,
          suggestions: ["Set CLICKATELL_API_KEY=<your-api-key>"],
        },
      },
    };
  }

  const payload: Record<string, any> = { to: [to], content: message };
  if (sender) payload.from = sender;

  let resp: Response;
  try {
    resp = await fetch("https://platform.clickatell.com/messages", {
      method: "POST",
      headers: {
        Authorization: config.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
  } catch (e: any) {
    if (e?.name === "TimeoutError") {
      return {
        exitCode: EXIT.TIMEOUT,
        error: {
          error: {
            code: EXIT.TIMEOUT,
            type: "timeout",
            message: "Clickatell API request timed out",
            recoverable: true,
            retry_after: 5,
            suggestions: ["Retry after 5 seconds"],
          },
        },
      };
    }
    return {
      exitCode: EXIT.API_ERROR,
      error: {
        error: {
          code: EXIT.API_ERROR,
          type: "api_error",
          message: `Clickatell request failed: ${e?.message ?? e}`,
          recoverable: true,
          retry_after: 2,
          suggestions: ["Check network connectivity"],
        },
      },
    };
  }

  if (resp.status === 401 || resp.status === 403) {
    return {
      exitCode: EXIT.AUTH_FAILED,
      error: {
        error: {
          code: EXIT.AUTH_FAILED,
          type: "auth_failed",
          message: "Clickatell authentication failed",
          recoverable: false,
          retry_after: null,
          suggestions: ["Verify CLICKATELL_API_KEY is correct"],
        },
      },
    };
  }

  if (!resp.ok) {
    let detail = "";
    try {
      const body = await resp.json() as any;
      detail = body?.error ?? body?.message ?? "";
    } catch {}
    return {
      exitCode: EXIT.API_ERROR,
      error: {
        error: {
          code: EXIT.API_ERROR,
          type: "api_error",
          message: `Clickatell API error: HTTP ${resp.status}${detail ? ` - ${detail}` : ""}`,
          recoverable: true,
          retry_after: 2,
          suggestions: ["Check Clickatell portal for details"],
        },
      },
    };
  }

  const body = await resp.json() as any;
  const msg = body?.messages?.[0];

  return {
    exitCode: EXIT.OK,
    result: {
      version: "1.0",
      provider: "clickatell",
      to,
      from: sender ?? "clickatell",
      message_id: msg?.apiMessageId ?? msg?.id,
      status: "sent",
      timestamp: new Date().toISOString(),
    },
  };
}
