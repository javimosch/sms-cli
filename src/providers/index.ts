import type { SmsResult, SmsError, ProviderConfig } from "../types.ts";
import { EXIT } from "../types.ts";
import { sendTwilio, getTwilioConfig, isTwilioConfigured } from "./twilio.ts";
import { sendVonage, getVonageConfig, isVonageConfigured } from "./vonage.ts";
import { sendMailerSend, getMailerSendConfig, isMailerSendConfigured } from "./mailersend.ts";
import { sendClickatell, getClickatellConfig, isClickatellConfigured } from "./clickatell.ts";
import { sendTelnyx, getTelnyxConfig, isTelnyxConfigured } from "./telnyx.ts";

export const PROVIDERS = ["twilio", "vonage", "mailersend", "clickatell", "telnyx"] as const;
export type ProviderName = (typeof PROVIDERS)[number];

export function resolveProvider(name?: string): ProviderName | null {
  const candidate = (name ?? process.env.SMS_PROVIDER ?? "").toLowerCase();
  if (PROVIDERS.includes(candidate as ProviderName)) return candidate as ProviderName;
  return null;
}

export function autoDetectProvider(): ProviderName | null {
  if (isTwilioConfigured()) return "twilio";
  if (isVonageConfigured()) return "vonage";
  if (isMailerSendConfigured()) return "mailersend";
  if (isClickatellConfigured()) return "clickatell";
  if (isTelnyxConfigured()) return "telnyx";
  return null;
}

export function listProviders(): ProviderConfig[] {
  const tw = getTwilioConfig();
  const vo = getVonageConfig();
  const ms = getMailerSendConfig();
  const cl = getClickatellConfig();
  const te = getTelnyxConfig();

  return [
    { name: "twilio", configured: isTwilioConfigured(), from: tw.from },
    { name: "vonage", configured: isVonageConfigured(), from: vo.from },
    { name: "mailersend", configured: isMailerSendConfigured(), from: ms.from },
    { name: "clickatell", configured: isClickatellConfigured(), from: cl.from },
    { name: "telnyx", configured: isTelnyxConfigured(), from: te.from },
  ];
}

export function checkProvider(name: string): ProviderConfig | null {
  switch (name) {
    case "twilio": {
      const c = getTwilioConfig();
      return { name: "twilio", configured: isTwilioConfigured(), from: c.from };
    }
    case "vonage": {
      const c = getVonageConfig();
      return { name: "vonage", configured: isVonageConfigured(), from: c.from };
    }
    case "mailersend": {
      const c = getMailerSendConfig();
      return { name: "mailersend", configured: isMailerSendConfigured(), from: c.from };
    }
    case "clickatell": {
      const c = getClickatellConfig();
      return { name: "clickatell", configured: isClickatellConfigured(), from: c.from };
    }
    case "telnyx": {
      const c = getTelnyxConfig();
      return { name: "telnyx", configured: isTelnyxConfigured(), from: c.from };
    }
    default:
      return null;
  }
}

export async function sendSms(
  provider: ProviderName,
  to: string,
  message: string,
  from?: string
): Promise<{ result?: SmsResult; error?: SmsError; exitCode: number }> {
  switch (provider) {
    case "twilio":
      return sendTwilio(to, message, from);
    case "vonage":
      return sendVonage(to, message, from);
    case "mailersend":
      return sendMailerSend(to, message, from);
    case "clickatell":
      return sendClickatell(to, message, from);
    case "telnyx":
      return sendTelnyx(to, message, from);
    default:
      return {
        exitCode: EXIT.PROVIDER_NOT_FOUND,
        error: {
          error: {
            code: EXIT.PROVIDER_NOT_FOUND,
            type: "provider_not_found",
            message: `Unknown provider: ${provider}`,
            recoverable: false,
            retry_after: null,
            suggestions: [`Valid providers: ${PROVIDERS.join(", ")}`],
          },
        },
      };
  }
}
