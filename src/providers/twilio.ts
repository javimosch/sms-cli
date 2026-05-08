import type { SmsResult, SmsError } from "../types.ts";
import { EXIT } from "../types.ts";

export function getTwilioConfig() {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    from: process.env.TWILIO_FROM,
  };
}

export function isTwilioConfigured(): boolean {
  const c = getTwilioConfig();
  return !!(c.accountSid && c.authToken && c.from);
}

export async function sendTwilio(
  to: string,
  message: string,
  from?: string
): Promise<{ result?: SmsResult; error?: SmsError; exitCode: number }> {
  const config = getTwilioConfig();
  const sender = from ?? config.from;

  if (!config.accountSid || !config.authToken) {
    return {
      exitCode: EXIT.MISSING_CONFIG,
      error: {
        error: {
          code: EXIT.MISSING_CONFIG,
          type: "missing_provider_config",
          message: "Twilio requires TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN",
          recoverable: false,
          retry_after: null,
          suggestions: [
            "Set TWILIO_ACCOUNT_SID=<your-sid>",
            "Set TWILIO_AUTH_TOKEN=<your-token>",
            "Set TWILIO_FROM=<your-number>",
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
          message: "Twilio sender number required: set TWILIO_FROM or pass --from",
          recoverable: false,
          retry_after: null,
          suggestions: ["Set TWILIO_FROM=+1xxxxxxxxxx", "Pass --from +1xxxxxxxxxx"],
        },
      },
    };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;
  const credentials = Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64");

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: sender, Body: message }),
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
            message: "Twilio API request timed out",
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
          message: `Twilio request failed: ${e?.message ?? e}`,
          recoverable: true,
          retry_after: 2,
          suggestions: ["Check network connectivity", "Verify Twilio API status"],
        },
      },
    };
  }

  const body = await resp.json() as any;

  if (!resp.ok) {
    const isAuth = resp.status === 401 || resp.status === 403;
    return {
      exitCode: isAuth ? EXIT.AUTH_FAILED : EXIT.API_ERROR,
      error: {
        error: {
          code: isAuth ? EXIT.AUTH_FAILED : EXIT.API_ERROR,
          type: isAuth ? "auth_failed" : "api_error",
          message: body?.message ?? `Twilio API error: HTTP ${resp.status}`,
          recoverable: !isAuth,
          retry_after: isAuth ? null : 2,
          suggestions: isAuth
            ? ["Verify TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN"]
            : ["Check Twilio console for details"],
        },
      },
    };
  }

  return {
    exitCode: EXIT.OK,
    result: {
      version: "1.0",
      provider: "twilio",
      to,
      from: sender,
      message_id: body.sid,
      status: "sent",
      timestamp: new Date().toISOString(),
    },
  };
}
