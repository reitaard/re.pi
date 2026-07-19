# Telegram gateway

Recode includes a small Telegram gateway that connects one private Telegram user to Aizen through the existing RPC runtime. It uses long polling, so it does not require a public webhook.

## Configuration

Set the bot token and numeric Telegram user id through the environment:

```bash
export TELEGRAM_BOT_TOKEN="123456:token"
export TELEGRAM_ALLOWED_USER_ID="123456789"
export RECODE_TELEGRAM_CWD="/path/to/project"
recode telegram
```

`RECODE_TELEGRAM_CWD` is optional and defaults to the directory where the gateway starts.

The same values can be stored in `~/.pi/agent/telegram.json`:

```json
{
  "botToken": "123456:token",
  "allowedUserId": 123456789,
  "workingDirectory": "/path/to/project"
}
```

Keep this file private. Messages from every user except `allowedUserId` are ignored.

## Commands

- `/start` shows connection readiness.
- `/new` starts a new Recode session.
- `/status` reports whether Aizen is running and how many turns are queued.
- `/stop` aborts the active turn and clears the queue.

Normal messages are processed sequentially. Messages received while Aizen is running are queued instead of steering or interrupting the active turn. Streaming assistant text updates one Telegram preview message, and long final replies are split without losing content.
