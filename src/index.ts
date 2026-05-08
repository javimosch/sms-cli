#!/usr/bin/env bun
import { EXIT } from "./types.ts";
import {
  printResult,
  printError,
  printProviders,
  printHelp,
  printHelpJson,
} from "./output.ts";
import {
  PROVIDERS,
  resolveProvider,
  autoDetectProvider,
  listProviders,
  checkProvider,
  sendSms,
} from "./providers/index.ts";

const args = process.argv.slice(2);

function getFlag(flag: string): string | undefined {
  const i = args.indexOf(flag);
  if (i !== -1 && i + 1 < args.length && !args[i + 1].startsWith("--")) {
    return args[i + 1];
  }
  return undefined;
}

function hasFlag(flag: string): boolean {
  return args.includes(flag);
}

async function main() {
  if (hasFlag("--help-json")) {
    printHelpJson();
    process.exit(EXIT.OK);
  }

  if (hasFlag("--help") || hasFlag("-h") || args.length === 0) {
    printHelp();
    process.exit(EXIT.OK);
  }

  const json = hasFlag("--json");
  const command = args[0];

  // sms-cli send
  if (command === "send") {
    const to = getFlag("--to");
    const message = getFlag("--message");
    const from = getFlag("--from");
    const providerArg = getFlag("--provider");

    if (!to) {
      const err = {
        error: {
          code: EXIT.MISSING_ARG,
          type: "missing_required_argument",
          message: "Missing required flag: --to",
          recoverable: false,
          retry_after: null,
          suggestions: ["Provide recipient: --to +15551234567"],
        },
      };
      printError(err, json);
      process.exit(EXIT.MISSING_ARG);
    }

    if (!message) {
      const err = {
        error: {
          code: EXIT.MISSING_ARG,
          type: "missing_required_argument",
          message: "Missing required flag: --message",
          recoverable: false,
          retry_after: null,
          suggestions: ['Provide message: --message "Hello"'],
        },
      };
      printError(err, json);
      process.exit(EXIT.MISSING_ARG);
    }

    let provider = resolveProvider(providerArg);

    if (providerArg && !provider) {
      const err = {
        error: {
          code: EXIT.INVALID_ARG,
          type: "invalid_argument",
          message: `Unknown provider: ${providerArg}`,
          recoverable: false,
          retry_after: null,
          suggestions: [`Valid providers: ${PROVIDERS.join(", ")}`],
        },
      };
      printError(err, json);
      process.exit(EXIT.INVALID_ARG);
    }

    if (!provider) {
      provider = autoDetectProvider();
    }

    if (!provider) {
      const err = {
        error: {
          code: EXIT.MISSING_CONFIG,
          type: "missing_provider_config",
          message: "No SMS provider configured. Set SMS_PROVIDER and provider credentials.",
          recoverable: false,
          retry_after: null,
          suggestions: [
            "Set SMS_PROVIDER=twilio and TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM",
            "Set SMS_PROVIDER=vonage and VONAGE_API_KEY, VONAGE_API_SECRET, VONAGE_FROM",
            "Set SMS_PROVIDER=mailersend and MAILERSEND_API_KEY, MAILERSEND_FROM",
            "Set SMS_PROVIDER=clickatell and CLICKATELL_API_KEY",
            "Run: sms-cli providers list --json",
          ],
        },
      };
      printError(err, json);
      process.exit(EXIT.MISSING_CONFIG);
    }

    process.stderr.write(`[sms-cli] Sending via ${provider}...\n`);

    const { result, error, exitCode } = await sendSms(provider, to, message, from);

    if (error) {
      printError(error, json);
      process.exit(exitCode);
    }

    if (result) {
      printResult(result, json);
      process.exit(EXIT.OK);
    }

    process.exit(EXIT.INTERNAL);
    return;
  }

  // sms-cli providers list
  if (command === "providers" && args[1] === "list") {
    const providers = listProviders();
    printProviders(providers, json);
    process.exit(EXIT.OK);
  }

  // sms-cli providers check <name>
  if (command === "providers" && args[1] === "check") {
    const name = args[2];
    if (!name) {
      const err = {
        error: {
          code: EXIT.MISSING_ARG,
          type: "missing_required_argument",
          message: "Missing provider name argument",
          recoverable: false,
          retry_after: null,
          suggestions: [`Usage: sms-cli providers check <provider>`, `Providers: ${PROVIDERS.join(", ")}`],
        },
      };
      printError(err, json);
      process.exit(EXIT.MISSING_ARG);
    }

    const p = checkProvider(name);
    if (!p) {
      const err = {
        error: {
          code: EXIT.PROVIDER_NOT_FOUND,
          type: "provider_not_found",
          message: `Unknown provider: ${name}`,
          recoverable: false,
          retry_after: null,
          suggestions: [`Valid providers: ${PROVIDERS.join(", ")}`],
        },
      };
      printError(err, json);
      process.exit(EXIT.PROVIDER_NOT_FOUND);
    }

    printProviders([p], json);
    process.exit(EXIT.OK);
  }

  // Unknown command
  const err = {
    error: {
      code: EXIT.INVALID_ARG,
      type: "invalid_argument",
      message: `Unknown command: ${command}`,
      recoverable: false,
      retry_after: null,
      suggestions: ["Run: sms-cli --help", "Run: sms-cli --help-json"],
    },
  };
  printError(err, json);
  process.exit(EXIT.INVALID_ARG);
}

main().catch((e) => {
  process.stderr.write(`[sms-cli] Unexpected error: ${e?.message ?? e}\n`);
  process.exit(EXIT.INTERNAL);
});
