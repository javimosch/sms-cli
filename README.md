# sms-cli

Agent-friendly SMS sender. Non-interactive by design. Send SMS via **Twilio**, **Vonage**, **MailerSend**, or **Clickatell**.

```bash
sms-cli send --to +15551234567 --message "Hello" --provider twilio --json
```

## Features

- **Agent-first design**: No stdin reads, structured JSON output, semantic exit codes
- **Auto-detect provider**: Reads env vars, picks first configured provider
- **Zero dependencies**: Compiled Bun binary, no runtime requirements
- **Semantic exit codes**: 0 (ok), 81-83 (config), 91 (not found), 101-105 (API), 111 (bug)
- **Structured errors**: `code`, `type`, `message`, `recoverable`, `retry_after`, `suggestions`
- **TTY-aware**: Human-readable output on terminal, JSON when piped/non-interactive

## Installation

### From Release (prebuilt binary)

```bash
# Download from GitHub releases
wget https://github.com/javimosch/sms-cli/releases/download/v1.0.0/sms-cli
chmod +x sms-cli
sudo mv sms-cli /usr/local/bin/
```

### From Source

```bash
git clone https://github.com/javimosch/sms-cli
cd sms-cli
bun build src/index.ts --compile --outfile bin/sms-cli
sudo mv bin/sms-cli /usr/local/bin/
```

## Quick Start

Set provider credentials as env vars (see `.env.example`):

```bash
export TWILIO_ACCOUNT_SID=AC...
export TWILIO_AUTH_TOKEN=...
export TWILIO_FROM=+1234567890
```

Send SMS:

```bash
sms-cli send --to +15551234567 --message "Hello world"
```

Get JSON output:

```bash
sms-cli send --to +15551234567 --message "Hello" --json
```

Check configured providers:

```bash
sms-cli providers list --json
```

## Commands

### send

Send an SMS message.

```bash
sms-cli send --to <phone> --message <text> [--provider <name>] [--from <phone>] [--json]
```

**Flags:**
- `--to` (required): Recipient in E.164 format (e.g., `+15551234567`)
- `--message` (required): Message body
- `--provider`: Override SMS provider (twilio|vonage|mailersend|clickatell)
- `--from`: Override sender phone/ID
- `--json`: Machine-readable JSON output

**Examples:**
```bash
sms-cli send --to +33782809054 --message "Test" --provider twilio
sms-cli send --to +33782809054 --message "Test" --json
sms-cli send --to +33782809054 --message "Test" --provider vonage --from BrandName
```

### providers list

List all configured SMS providers.

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

Check configuration for one provider.

```bash
sms-cli providers check <provider> [--json]
```

### --help-json

Get machine-readable schema: commands, flags, env vars, exit codes.

```bash
sms-cli --help-json
```

## Environment Variables

### Twilio

```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  # required
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx    # required
TWILIO_FROM=+1xxxxxxxxxx                              # required
```

### Vonage

```bash
VONAGE_API_KEY=xxxxxxxx                               # required
VONAGE_API_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx    # required
VONAGE_FROM=BrandName                                 # required (name or number)
```

### MailerSend

```bash
MAILERSEND_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  # required
MAILERSEND_FROM=+1xxxxxxxxxx                                 # required
```

### Clickatell

```bash
CLICKATELL_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  # required
CLICKATELL_FROM=YourBrand                           # optional
```

### Global

```bash
SMS_PROVIDER=twilio                                 # optional: default provider
```

## Exit Codes

| Code | Type | Recoverable? |
|------|------|--------------|
| 0 | success | — |
| 81 | missing_required_argument | No |
| 82 | invalid_argument | No |
| 83 | missing_provider_config | No |
| 91 | provider_not_found | No |
| 101 | api_error | Yes |
| 102 | auth_failed | No |
| 105 | timeout | Yes |
| 111 | internal_error | No |

## Error Response Structure

Errors go to stderr as JSON (when `--json`):

```json
{
  "error": {
    "code": 83,
    "type": "missing_provider_config",
    "message": "Twilio requires TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN",
    "recoverable": false,
    "retry_after": null,
    "suggestions": [
      "Set TWILIO_ACCOUNT_SID=<your-sid>",
      "Set TWILIO_AUTH_TOKEN=<your-token>",
      "Set TWILIO_FROM=<your-number>"
    ]
  }
}
```

## Success Response

Success goes to stdout as JSON (when `--json`):

```json
{
  "version": "1.0",
  "provider": "twilio",
  "to": "+33782809054",
  "from": "+18452535441",
  "message_id": "SM1234567890abcdef",
  "status": "sent",
  "timestamp": "2026-05-08T23:45:00.000Z"
}
```

## Agent Integration

Designed for AI agents. See [`docs/AGENTS_FRIENDLY_TOOLS.md`](docs/AGENTS_FRIENDLY_TOOLS.md) for design principles.

### supercli Plugin

Install as supercli plugin:

```bash
supercli plugins install sms-cli
sc sms message send --to +15551234567 --message "Hello"
sc sms providers list --json
sc sms schema get --json
```

### Decision Logic

```
exit 0        → success, parse stdout JSON
exit 81-83    → don't retry, fix input/config first
exit 91       → invalid provider
exit 101,105  → retry with backoff (check retry_after)
exit 102      → don't retry, fix credentials
exit 111      → report bug
```

## Examples

### Single send

```bash
sms-cli send --to +15551234567 --message "Hello" --provider twilio --json
```

### Batch send

```bash
cat numbers.txt | while read n; do
  sms-cli send --to "$n" --message "Broadcast" --provider twilio --json
done
```

### Check if provider is ready

```bash
sms-cli providers check twilio --json | jq '.providers[0].configured'
```

### Parse message_id from response

```bash
result=$(sms-cli send --to +15551234567 --message "Test" --json)
message_id=$(echo "$result" | jq -r '.message_id')
echo "Sent with ID: $message_id"
```

## Development

### Build

```bash
bun build src/index.ts --compile --outfile bin/sms-cli
```

### Test

```bash
# Test without provider config
./bin/sms-cli send --to +15551234567 --message "test" --json

# List providers
./bin/sms-cli providers list --json

# Show schema
./bin/sms-cli --help-json
```

## License

MIT
