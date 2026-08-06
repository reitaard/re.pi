# Telegram gateway

Recode includes a small Telegram gateway that connects one private Telegram user to Aizen through the existing RPC runtime. It uses long polling, so it does not require a public webhook.

## Architecture

This is Recode's first channel adapter and follows the narrow part of the OpenClaw model that is useful now:

```text
Telegram Bot API -> Recode Gateway -> Aizen RPC -> AgentHarness -> JSONL session
```

- Telegram authenticates at the edge with one allowed numeric user id.
- Recode Gateway owns channel-neutral session routing, queueing, runtime lifecycle, and cancellation.
- The Telegram adapter owns Bot API polling, authentication, command translation, and streaming delivery.
- Aizen RPC owns the agent request and typed lifecycle stream.
- AgentHarness owns the model/tool loop; the gateway performs no AI reasoning.
- The existing JSONL session remains conversation truth. `telegram-state.json` stores the polling cursor and a legacy route map for migration; SQLite is authoritative for current routes and accepted work.

The first version intentionally supports one private user and one Telegram adapter. OpenClaw's multi-account plugin registry, pairing service, web control plane, scheduler, and broader channel stack remain later scaling work.

The same Aizen RPC runtime is used by the TUI and Telegram, so coding tools, loaded skills, and named workers remain available without Telegram-specific implementations.

## Configuration

Set the bot token and numeric Telegram user id through the environment:

```bash
export TELEGRAM_BOT_TOKEN="123456:token"
export TELEGRAM_ALLOWED_USER_ID="123456789"
export TELEGRAM_ALLOWED_GROUP_IDS="-1001234567890,-1009876543210"
export RECODE_TELEGRAM_CWD="/path/to/project"
recode telegram
```

`RECODE_TELEGRAM_CWD` is optional and defaults to the operating-system user's home directory (`~`). Set it when Telegram should operate inside a specific project.

The same values can be stored in `~/.pi/agent/telegram.json`:

```json
{
  "botToken": "123456:token",
  "allowedUserId": 123456789,
  "allowedGroupIds": [-1001234567890],
  "workingDirectory": "/path/to/project"
}
```

Keep this file private. Messages from every user except `allowedUserId` are ignored.

Groups are fail-closed. A group must be listed in `allowedGroupIds`, and the sender must still be `allowedUserId`. Forum topics are opt-in: run `/connect` inside a topic before its ordinary messages can reach Aizen. Connected topics receive independent sessions in `<workingDirectory>/Topics/sessions/<group-id>-<topic-id>/` and independent working directories in `<workingDirectory>/Topics/workspaces/<group-id>-<topic-id>/`; place topic-local `AGENTS.md` and `.pi/skills/` resources in the workspace. The stable numeric identifiers prevent topic renames from breaking session routing. Direct messages remain active without `/connect`. `/new` rotates only the current DM or connected topic session.

## Commands

- `/start` shows connection readiness.
- `/connect` enables the current forum topic and creates a session if it has none; reconnecting resumes its prior session.
- `/connect new` enables the current forum topic with a new session.
- `/disconnect` disables the current forum topic without deleting its session.
- `/new` starts a new Recode session in the current DM or connected forum topic.
- `/reload` reloads the current route's runtime without changing its session, picking up changed project instructions, skills, and MCP configuration for the next turn.
- `/status` reports whether Aizen is running and how many turns are queued.
- `/stop` aborts the active turn and clears the queue.

### Attachments

The gateway accepts authorized Telegram photos and documents up to the cloud Bot API's 20 MB download limit. Photos are stored under `uploads/` in the active workspace and attached to the agent's prompt as validated image data. Documents are stored in the same directory and supplied as untrusted local paths; the gateway does not execute, unpack, or parse them automatically. Captions become the accompanying prompt. Topic attachments stay under `<workingDirectory>/Topics/workspaces/<group-id>-<topic-id>/uploads/`; direct-chat attachments use `<workingDirectory>/uploads/`.

Normal messages are processed sequentially. Messages received while Aizen is running are queued instead of steering or interrupting the active turn. Streaming assistant text updates one Telegram preview message, and long final replies are split without losing content.

At startup the gateway validates the bot token with `getMe`, removes any existing webhook without discarding pending updates, recovers accepted work, and then starts long polling. The polling cursor remains in `~/.pi/agent/telegram-state.json`. Durable routes and accepted jobs are stored in `~/.pi/agent/recode-gateway.sqlite`.

The job record is committed before the polling cursor advances. Repeated Telegram updates are ignored by their channel, conversation, and message identity. Accepted but unstarted jobs resume after restart; work that was already running is marked interrupted and is never silently replayed because its tool effects may be uncertain.
