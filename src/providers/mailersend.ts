import type { SmsResult, SmsError } from "../types.ts";
import { EXIT } from "../types.ts";

export function getMailerSendConfig() {
  return {
    apiKey: process.env.MAILERSEND_API_KEY,
    from: process.env.MAILERSEND_FROM,
  };
}

export function isMailerSendConfigured(): boolean {
  const c = getMailerSendConfig();
  return !!(c.apiKey && c.from);
}

export async function sendMailerSend(
  to: string,
  message: string,
  from?: string
): Promise<{ result?: SmsResult; error?: SmsError; exitCode: number }> {
  const config = getMailerSendConfig();
  const sender = from ?? config.from;

  if (!config.apiKey) {
    return {
      exitCode: EXIT.MISSING_CONFIG,
      error: {
        error: {
          code: EXIT.MISSING_CONFIG,
          type: "missing_provider_config",
          message: "MailerSend requires MAILERSEND_API_KEY",
          recoverable: false,
          retry_after: null,
          suggestions: [
            "Set MAILERSEND_API_KEY=<your-key>",
            "Set MAILERSEND_FROM=<your-sender-number>",
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
          message: "MailerSend sender required: set MAILERSEND_FROM or pass --from",
          recoverable: false,
          retry_after: null,
          suggestions: ["Set MAILERSEND_FROM=+1xxxxxxxxxx", "Pass --from +1xxxxxxxxxx"],
        },
      },
    };
  }

  let resp: Response;
  try {
    resp = await fetch("https://api.mailersend.com/v1/sms", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: sender, to: [to], text: message }),
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
            message: "MailerSend API request timed out",
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
          message: `MailerSend request failed: ${e?.message ?? e}`,
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
          message: "MailerSend authentication failed",
          recoverable: false,
          retry_after: null,
          suggestions: ["Verify MAILERSEND_API_KEY is correct and active"],
        },
      },
    };
  }

  if (!resp.ok) {
    let detail = "";
    try {
      const body = await resp.json() as any;
      detail = body?.message ?? "";
    } catch {}
    return {
      exitCode: EXIT.API_ERROR,
      error: {
        error: {
          code: EXIT.API_ERROR,
          type: "api_error",
          message: `MailerSend API error: HTTP ${resp.status}${detail ? ` - ${detail}` : ""}`,
          recoverable: true,
          retry_after: 2,
          suggestions: ["Check MailerSend dashboard for details"],
        },
      },
    };
  }

  let messageId: string | undefined;
  try {
    const body = await resp.json() as any;
    messageId = body?.data?.id ?? body?.id;
  } catch {}

  return {
    exitCode: EXIT.OK,
    result: {
      version: "1.0",
      provider: "mailersend",
      to,
      from: sender,
      message_id: messageId,
      status: "sent",
      timestamp: new Date().toISOString(),
    },
  };
}
