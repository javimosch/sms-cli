import type { SmsResult, SmsError } from "../types.ts";
import { EXIT } from "../types.ts";

export function getTelnyxConfig() {
  return {
    apiKey: process.env.TELNYX_API_KEY,
    from: process.env.TELNYX_FROM,
  };
}

export function isTelnyxConfigured(): boolean {
  const c = getTelnyxConfig();
  return !!(c.apiKey && c.from);
}

export async function sendTelnyx(
  to: string,
  message: string,
  from?: string
): Promise<{ result?: SmsResult; error?: SmsError; exitCode: number }> {
  const config = getTelnyxConfig();
  const sender = from ?? config.from;

  if (!config.apiKey) {
    return {
      exitCode: EXIT.MISSING_CONFIG,
      error: {
        error: {
          code: EXIT.MISSING_CONFIG,
          type: "missing_provider_config",
          message: "Telnyx requires TELNYX_API_KEY",
          recoverable: false,
          retry_after: null,
          suggestions: [
            "Set TELNYX_API_KEY=<your-api-key>",
            "Set TELNYX_FROM=<your-number>",
          ],
        },
      },
    };
  }

  if (!sender) {
    return {
      exitCode: EXIT.MISSING_CONFIG,
      error: {
        error: {
          code: EXIT.MISSING_CONFIG,
          type: "missing_provider_config",
          message: "Telnyx sender required: set TELNYX_FROM or pass --from",
          recoverable: false,
          retry_after: null,
          suggestions: ["Set TELNYX_FROM=+1xxxxxxxxxx", "Pass --from +1xxxxxxxxxx"],
        },
      },
    };
  }

  let resp: Response;
  try {
    resp = await fetch("https://api.telnyx.com/v2/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: sender,
        to,
        text: message,
      }),
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
            message: "Telnyx API request timed out",
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
          message: `Telnyx request failed: ${e?.message ?? e}`,
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
          message: "Telnyx authentication failed",
          recoverable: false,
          retry_after: null,
          suggestions: ["Verify TELNYX_API_KEY is correct and active"],
        },
      },
    };
  }

  if (!resp.ok) {
    let detail = "";
    try {
      const body = await resp.json() as any;
      detail = body?.errors?.[0]?.detail ?? body?.message ?? "";
    } catch {}
    return {
      exitCode: EXIT.API_ERROR,
      error: {
        error: {
          code: EXIT.API_ERROR,
          type: "api_error",
          message: `Telnyx API error: HTTP ${resp.status}${detail ? ` - ${detail}` : ""}`,
          recoverable: true,
          retry_after: 2,
          suggestions: ["Check Telnyx dashboard for details"],
        },
      },
    };
  }

  const body = await resp.json() as any;
  const msgData = body?.data;

  if (!msgData) {
    return {
      exitCode: EXIT.API_ERROR,
      error: {
        error: {
          code: EXIT.API_ERROR,
          type: "api_error",
          message: "Telnyx API returned invalid response structure",
          recoverable: true,
          retry_after: 2,
          suggestions: ["Check Telnyx API documentation"],
        },
      },
    };
  }

  return {
    exitCode: EXIT.OK,
    result: {
      version: "1.0",
      provider: "telnyx",
      to,
      from: sender,
      message_id: msgData.id,
      status: "sent",
      timestamp: new Date().toISOString(),
    },
  };
}
