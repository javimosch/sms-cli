import type { SmsResult, SmsError } from "../types.ts";
import { EXIT } from "../types.ts";

export function getVonageConfig() {
  return {
    apiKey: process.env.VONAGE_API_KEY,
    apiSecret: process.env.VONAGE_API_SECRET,
    from: process.env.VONAGE_FROM,
  };
}

export function isVonageConfigured(): boolean {
  const c = getVonageConfig();
  return !!(c.apiKey && c.apiSecret && c.from);
}

export async function sendVonage(
  to: string,
  message: string,
  from?: string
): Promise<{ result?: SmsResult; error?: SmsError; exitCode: number }> {
  const config = getVonageConfig();
  const sender = from ?? config.from;

  if (!config.apiKey || !config.apiSecret) {
    return {
      exitCode: EXIT.MISSING_CONFIG,
      error: {
        error: {
          code: EXIT.MISSING_CONFIG,
          type: "missing_provider_config",
          message: "Vonage requires VONAGE_API_KEY and VONAGE_API_SECRET",
          recoverable: false,
          retry_after: null,
          suggestions: [
            "Set VONAGE_API_KEY=<your-key>",
            "Set VONAGE_API_SECRET=<your-secret>",
            "Set VONAGE_FROM=<your-sender>",
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
          message: "Vonage sender required: set VONAGE_FROM or pass --from",
          recoverable: false,
          retry_after: null,
          suggestions: ["Set VONAGE_FROM=MyCompany", "Pass --from MyCompany"],
        },
      },
    };
  }

  let resp: Response;
  try {
    resp = await fetch("https://rest.nexmo.com/sms/json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: config.apiKey,
        api_secret: config.apiSecret,
        to,
        from: sender,
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
            message: "Vonage API request timed out",
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
          message: `Vonage request failed: ${e?.message ?? e}`,
          recoverable: true,
          retry_after: 2,
          suggestions: ["Check network connectivity"],
        },
      },
    };
  }

  const body = await resp.json() as any;
  const msg = body?.messages?.[0];

  if (!resp.ok || !msg) {
    return {
      exitCode: EXIT.API_ERROR,
      error: {
        error: {
          code: EXIT.API_ERROR,
          type: "api_error",
          message: `Vonage API error: HTTP ${resp.status}`,
          recoverable: true,
          retry_after: 2,
          suggestions: ["Check Vonage dashboard for details"],
        },
      },
    };
  }

  if (msg.status !== "0") {
    const isAuth = msg.status === "4" || msg.status === "5";
    return {
      exitCode: isAuth ? EXIT.AUTH_FAILED : EXIT.API_ERROR,
      error: {
        error: {
          code: isAuth ? EXIT.AUTH_FAILED : EXIT.API_ERROR,
          type: isAuth ? "auth_failed" : "api_error",
          message: msg["error-text"] ?? `Vonage error status: ${msg.status}`,
          recoverable: !isAuth,
          retry_after: isAuth ? null : 2,
          suggestions: isAuth
            ? ["Verify VONAGE_API_KEY and VONAGE_API_SECRET"]
            : ["Check Vonage SMS error codes documentation"],
        },
      },
    };
  }

  return {
    exitCode: EXIT.OK,
    result: {
      version: "1.0",
      provider: "vonage",
      to,
      from: sender,
      message_id: msg["message-id"],
      status: "sent",
      timestamp: new Date().toISOString(),
    },
  };
}
