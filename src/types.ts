export interface SmsResult {
  version: "1.0";
  provider: string;
  to: string;
  from: string;
  message_id?: string;
  status: "sent" | "failed";
  timestamp: string;
}

export interface SmsError {
  error: {
    code: number;
    type: string;
    message: string;
    recoverable: boolean;
    retry_after: number | null;
    suggestions: string[];
  };
}

export interface ProviderConfig {
  name: string;
  configured: boolean;
  from?: string;
}

export interface SendOptions {
  to: string;
  message: string;
  from?: string;
  provider?: string;
  json: boolean;
}

// Exit codes per AGENTS_FRIENDLY_TOOLS.md
export const EXIT = {
  OK: 0,
  // 80-89: Input/validation errors
  MISSING_ARG: 81,
  INVALID_ARG: 82,
  MISSING_CONFIG: 83,
  // 90-99: Resource/state errors
  PROVIDER_NOT_FOUND: 91,
  // 100-109: Integration/external errors
  API_ERROR: 101,
  AUTH_FAILED: 102,
  TIMEOUT: 105,
  // 110-119: Internal software errors
  INTERNAL: 111,
} as const;
