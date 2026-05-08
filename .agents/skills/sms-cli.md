# sms-cli Skill

Agent-friendly SMS sender. Send messages via Twilio, Vonage, MailerSend, Clickatell, or Telnyx.

## Quick Start

```bash
# Set credentials
export TWILIO_ACCOUNT_SID=AC...
export TWILIO_AUTH_TOKEN=...
export TWILIO_FROM=+1234567890

# Send SMS
sms-cli send --to +15551234567 --message "Hello" --json
```

## Build & Setup

```bash
# Build from source
bun build src/index.ts --compile --outfile bin/sms-cli

# Add to PATH
export PATH=$PATH:/path/to/sms-cli/bin

# Or use directly
./bin/sms-cli send --to +15551234567 --message "test"
```

## Commands

### send

Send an SMS message.

```bash
sms-cli send --to <phone> --message <text> [--provider <name>] [--from <phone>] [--json]
```

**Required:**
- `--to`: Recipient in E.164 format (e.g., `+15551234567`)
- `--message`: Message body text

**Optional:**
- `--provider`: twilio|vonage|mailersend|clickatell|telnyx (auto-detects if unset)
- `--from`: Override sender (env default otherwise)
- `--json`: Machine-readable JSON output

**Examples:**
```bash
sms-cli send --to +33782809054 --message "Hello" --provider twilio --json
sms-cli send --to +33782809054 --message "Hello"  # Auto-detect provider
```

### providers list

List all configured providers and their status.

```bash
sms-cli providers list [--json]
```

Output:
```json
{
  "version": "1.0",
  "providers": [
    {"name": "twilio", "configured": true, "from": "+1234567890"},
    {"name": "vonage", "configured": false}
  ]
}
```

### providers check

Check a specific provider's configuration.

```bash
sms-cli providers check <provider> [--json]
```

### --help-json

Get full schema: commands, flags, env vars, exit codes.

```bash
sms-cli --help-json
```

## Environment Variables

### Twilio
```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_FROM=+1xxxxxxxxxx
```

### Vonage
```bash
VONAGE_API_KEY=xxxxxxxx
VONAGE_API_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VONAGE_FROM=BrandName
```

### MailerSend
```bash
MAILERSEND_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MAILERSEND_FROM=+1xxxxxxxxxx
```

### Clickatell
```bash
CLICKATELL_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CLICKATELL_FROM=YourBrand  # optional
```

### Telnyx
```bash
TELNYX_API_KEY=KEY...
TELNYX_FROM=+1xxxxxxxxxx
```

### Global
```bash
SMS_PROVIDER=twilio  # optional: default provider
```

## Exit Codes

```
0    Success
81   Missing required argument
82   Invalid argument
83   Missing provider configuration
91   Provider not found
101  API error (recoverable)
102  Authentication failed
105  Timeout (recoverable)
111  Internal error
```

## Error Response Structure

Errors to stderr as JSON:

```json
{
  "error": {
    "code": 83,
    "type": "missing_provider_config",
    "message": "Twilio requires TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN",
    "recoverable": false,
    "retry_after": null,
    "suggestions": [
      "Set TWILIO_ACCOUNT_SID=<sid>",
      "Set TWILIO_AUTH_TOKEN=<token>",
      "Set TWILIO_FROM=<number>"
    ]
  }
}
```

## Success Response

Success to stdout as JSON:

```json
{
  "version": "1.0",
  "provider": "twilio",
  "to": "+33782809054",
  "from": "+18452535441",
  "message_id": "SM1234567890abc",
  "status": "sent",
  "timestamp": "2026-05-09T12:34:56.789Z"
}
```

## Agent Decision Logic

```
exit 0        → success, parse stdout JSON
exit 81-83    → don't retry, fix input/config
exit 91       → invalid provider
exit 101,105  → retry with backoff (check retry_after)
exit 102      → don't retry, fix credentials
exit 111      → report bug
```

## Usage Patterns

### Batch send to multiple recipients
```bash
cat numbers.txt | while read n; do
  sms-cli send --to "$n" --message "Broadcast" --json | jq .
done
```

### Check provider readiness before sending
```bash
sms-cli providers list --json | jq '[.providers[] | select(.configured)] | length'
```

### Extract message ID from response
```bash
result=$(sms-cli send --to +15551234567 --message "test" --json)
msg_id=$(echo "$result" | jq -r '.message_id')
echo "Sent: $msg_id"
```

### Pipe results for processing
```bash
sms-cli send --to +15551234567 --message "test" --json | \
  jq '{id: .message_id, provider: .provider, time: .timestamp}'
```

## Troubleshooting

**"Missing required argument"** (exit 81)
- Missing `--to` or `--message`
- Check command: `sms-cli send --to <phone> --message <text>`

**"Missing provider config"** (exit 83)
- No provider has all required env vars set
- Run: `sms-cli providers list --json`
- Set env vars for your chosen provider

**"Provider not found"** (exit 91)
- Invalid provider name
- Valid: twilio|vonage|mailersend|clickatell|telnyx

**"API error"** (exit 101, recoverable)
- Transient API issue, retry with backoff
- Check provider dashboard/status page

**"Authentication failed"** (exit 102)
- Invalid API key or credentials
- Verify env vars are correct
- Check provider account status (billing, verification)

**"Timeout"** (exit 105, recoverable)
- API took too long, retry after `retry_after` seconds
- Check network connectivity

## Design Principles

- **Non-interactive**: No prompts, perfect for scripts/agents
- **Structured output**: JSON schema with version number
- **Semantic exit codes**: Decision-making info for callers
- **Error richness**: code, type, recoverable, retry_after, suggestions
- **TTY-aware**: Human text on terminal, JSON when piped
- **Zero deps**: Compiled Bun binary, runs anywhere

See: [AGENTS_FRIENDLY_TOOLS.md](docs/AGENTS_FRIENDLY_TOOLS.md)

## Resources

- GitHub: https://github.com/jarancibia/sms-cli
- Docs: [README.md](README.md)
- Twilio: https://www.twilio.com/docs/sms
- Vonage: https://developer.nexmo.com/messaging/sms/overview
- MailerSend: https://www.mailersend.com/help/sms-api
- Clickatell: https://www.clickatell.com/developers/sms-api
- Telnyx: https://developers.telnyx.com/docs/messaging/messages/send-message
