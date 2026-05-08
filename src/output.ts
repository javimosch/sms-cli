import type { SmsError, SmsResult, ProviderConfig } from "./types.ts";

const isTTY = process.stdout.isTTY;

export function printResult(result: SmsResult, json: boolean): void {
  if (json || !isTTY) {
    process.stdout.write(JSON.stringify(result) + "\n");
    return;
  }
  process.stdout.write(
    `status: ${result.status}\nprovider: ${result.provider}\nto: ${result.to}\nfrom: ${result.from}\nmessage_id: ${result.message_id ?? "n/a"}\ntimestamp: ${result.timestamp}\n`
  );
}

export function printError(err: SmsError, json: boolean): void {
  if (json || !isTTY) {
    process.stderr.write(JSON.stringify(err) + "\n");
    return;
  }
  const e = err.error;
  process.stderr.write(
    `error: ${e.message}\ncode: ${e.code}\ntype: ${e.type}\nrecoverable: ${e.recoverable}\n`
  );
  if (e.suggestions.length > 0) {
    process.stderr.write("suggestions:\n" + e.suggestions.map((s) => `  - ${s}`).join("\n") + "\n");
  }
}

export function printProviders(providers: ProviderConfig[], json: boolean): void {
  if (json || !isTTY) {
    process.stdout.write(JSON.stringify({ version: "1.0", providers }) + "\n");
    return;
  }
  for (const p of providers) {
    process.stdout.write(
      `provider: ${p.name}\nconfigured: ${p.configured}${p.from ? `\nfrom: ${p.from}` : ""}\n\n`
    );
  }
}

export function printHelpJson(): void {
  const schema = {
    version: "1.0.0",
    name: "sms-cli",
    description: "Agent-friendly SMS CLI supporting Twilio, Vonage, MailerSend, and Clickatell",
    commands: {
      send: {
        description: "Send an SMS message",
        flags: {
          "--to": "Recipient phone number in E.164 format (required)",
          "--message": "Message body text (required)",
          "--from": "Sender phone number or ID (overrides env default)",
          "--provider": "SMS provider: twilio|vonage|mailersend|clickatell (overrides SMS_PROVIDER env)",
          "--json": "Output result as JSON",
          "--no-interactive": "Disable prompts (always active in this CLI)",
        },
        env: {
          SMS_PROVIDER: "Default provider name",
          TWILIO_ACCOUNT_SID: "Twilio account SID",
          TWILIO_AUTH_TOKEN: "Twilio auth token",
          TWILIO_FROM: "Twilio sender number",
          VONAGE_API_KEY: "Vonage API key",
          VONAGE_API_SECRET: "Vonage API secret",
          VONAGE_FROM: "Vonage sender name or number",
          MAILERSEND_API_KEY: "MailerSend API key",
          MAILERSEND_FROM: "MailerSend SMS sender number",
          CLICKATELL_API_KEY: "Clickatell API key",
          CLICKATELL_FROM: "Clickatell sender ID (optional)",
        },
      },
      "providers list": {
        description: "List all SMS providers and their configuration status",
        flags: {
          "--json": "Output as JSON",
        },
      },
      "providers check": {
        description: "Check configuration for a specific provider",
        flags: {
          "--json": "Output as JSON",
        },
        args: [{ name: "provider", required: true, description: "Provider name" }],
      },
    },
    output_formats: ["text", "json"],
    exit_codes: {
      "0": "success",
      "81": "missing_required_argument",
      "82": "invalid_argument",
      "83": "missing_provider_config",
      "91": "provider_not_found",
      "101": "api_error",
      "102": "auth_failed",
      "105": "timeout",
      "111": "internal_error",
    },
  };
  process.stdout.write(JSON.stringify(schema, null, 2) + "\n");
}

export function printHelp(): void {
  process.stdout.write(`sms-cli — Send SMS via Twilio, Vonage, MailerSend, or Clickatell

USAGE
  sms-cli send --to <phone> --message <text> [--provider <name>] [--from <phone>] [--json]
  sms-cli providers list [--json]
  sms-cli providers check <provider> [--json]
  sms-cli --help-json

COMMANDS
  send               Send an SMS message
  providers list     List configured providers
  providers check    Check a provider's configuration

FLAGS
  --to              Recipient phone (E.164, e.g. +15551234567)  [required]
  --message         Message body                                 [required]
  --from            Sender phone/ID (overrides env default)
  --provider        Provider: twilio|vonage|mailersend|clickatell
  --json            Machine-readable JSON output
  --help-json       Print JSON schema and exit

ENV VARS
  SMS_PROVIDER          Default provider
  TWILIO_ACCOUNT_SID    Twilio account SID
  TWILIO_AUTH_TOKEN     Twilio auth token
  TWILIO_FROM           Twilio sender number
  VONAGE_API_KEY        Vonage API key
  VONAGE_API_SECRET     Vonage API secret
  VONAGE_FROM           Vonage sender name/number
  MAILERSEND_API_KEY    MailerSend API key
  MAILERSEND_FROM       MailerSend sender number
  CLICKATELL_API_KEY    Clickatell API key
  CLICKATELL_FROM       Clickatell sender ID (optional)

EXIT CODES
  0    Success
  81   Missing required argument
  82   Invalid argument
  83   Missing provider configuration
  91   Provider not found
  101  API error
  102  Authentication failed
  105  Timeout
  111  Internal error

EXAMPLES
  sms-cli send --to +15551234567 --message "Hello" --provider twilio
  sms-cli send --to +15551234567 --message "Hello" --json
  sms-cli providers list --json
  sms-cli --help-json
`);
}
