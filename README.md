# claude-ops-mcp

MCP server that indexes Claude Code operation history (file edits/writes, Bash runs, reads) from local Claude Desktop logs and exposes it as queryable tools. Designed to help agents inspect what happened, generate diffs, and assist with rollback or failure analysis.

Status: early preview. Available on npm.

## Features

- Operation history indexing: parses Claude Code JSONL session logs under `~/.claude/projects/*`.
- File-change queries: list recent creates/updates/deletes for any file or glob-like pattern.
- Bash history: list commands with summaries, then drill down to stdout/stderr details.
- Diff views: retrieve detailed diffs for Edit/Write/MultiEdit operations in a unified format.
- Session discovery: automatically locates the active session via Claude’s tool-use metadata.
- MCP-first: communicates over stdio and advertises tools via the Model Context Protocol.

## How It Works

- Claude Code writes session logs per project at `~/.claude/projects/<projectHash>/<sessionId>.jsonl`.
- When this server initializes, it emits a session UID and can later resolve the correct session using the tool-use id (`_meta["claudecode/toolUseId"]`) that Claude passes to MCP tools.
- Handlers parse the JSONL log stream, map operations to a compact index (`OperationIndex`), and provide detailed diffs on demand.
- Supported MCP protocol version: `2024-11-05`.

## Requirements

- Node.js >= 18
- Claude Code (or another MCP client) running on the same machine

## Installation

From npm (recommended):

```bash
npm install -g claude-ops-mcp
```

From source:

```bash
git clone https://github.com/pppp606/claude-ops-mcp.git
cd claude-ops-mcp
npm ci
npm run build
```

## Configure With Claude Code

Option A — after global npm install:

```json
{
  "mcpServers": {
    "claude-ops-mcp": {
      "command": "claude-ops-mcp",
      "args": [],
      "env": {}
    }
  }
}
```

Option B — from source (for development):

```json
{
  "mcpServers": {
    "claude-ops-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/claude-ops-mcp/dist/index.js"],
      "env": {}
    }
  }
}
```

Place the JSON into Claude Code's `.mcp.json` configuration file in your project root. See the [Claude Code MCP documentation](https://docs.claude.com/en/docs/claude-code/mcp) for details. A minimal example is also provided in `.mcp.example.json`.

## Available Tools

The server advertises these tools via MCP’s `list_tools`:

1) `listFileChanges`
- Input: `{ filePath: string, limit?: number }`
- Returns: recent non-READ file operations (CREATE/UPDATE/DELETE) matching the path or pattern.

Example response:

```json
{
  "operations": [
    {
      "id": "toolu_01UGt...",
      "timestamp": "2025-01-01T12:34:56.789Z",
      "tool": "Edit",
      "filePath": "/path/to/project/src/index.ts",
      "summary": "Edit operation on /path/to/project/src/index.ts",
      "changeType": "update"
    }
  ],
  "totalCount": 1,
  "hasMore": false,
  "limit": 100,
  "filePath": "src/index.ts"
}
```

2) `listBashHistory`
- Input: `{ limit?: number }`
- Returns: recent Bash commands with concise summaries.

Example response:

```json
{
  "commands": [
    {
      "id": "toolu_01Vabc...",
      "timestamp": "2025-01-01T12:35:01.000Z",
      "command": "npm test",
      "exitCode": 0,
      "workingDirectory": "/path/to/project",
      "summary": "PASS src/foo.test.ts"
    }
  ],
  "totalCount": 3,
  "hasMore": false,
  "limit": 100
}
```

3) `showBashResult`
- Input: `{ id: string }` (use an id returned by `listBashHistory`)
- Returns: stdout/stderr and exit code for the specific Bash operation.

Example response:

```json
{
  "id": "toolu_01Vabc...",
  "timestamp": "2025-01-01T12:35:01.000Z",
  "command": "npm test",
  "exitCode": 0,
  "workingDirectory": "/path/to/project",
  "stdout": "PASS src/foo.test.ts\n...",
  "stderr": ""
}
```

4) `showOperationDiff`
- Input: `{ id: string }` (use an id returned by `listFileChanges` or `listBashHistory`)
- Returns: tool-specific diff details. For Edit/Write/MultiEdit, includes `oldString`, `newString`, and a unified diff; for Bash, includes `stdout`, `stderr`, and `exitCode`.

Example (Edit/Write style):

```json
{
  "id": "toolu_01UGt...",
  "timestamp": "2025-01-01T12:34:56.789Z",
  "tool": "Edit",
  "filePath": "/path/to/project/src/index.ts",
  "diff": {
    "oldString": "console.log('old')",
    "newString": "console.log('new')",
    "unified": "--- /path/to/project/src/index.ts\n+++ /path/to/project/src/index.ts\n- console.log('old')\n+ console.log('new')\n"
  },
  "_debug": {
    "hasToolResult": true
  }
}
```

## Notes on Session Discovery

- Primary path: the server expects Claude to pass `_meta["claudecode/toolUseId"]` with each tool call; it uses this to find the active session file and caches it for subsequent calls.
- Fallbacks: the server can also discover the most recent session for the current project path, but toolUseId-based discovery is the most reliable.
- Cache: discovery results are cached in-memory; tune TTL with `CLAUDE_OPS_CACHE_TTL_MS` (milliseconds).

## Environment Variables

- `CLAUDE_OPS_CACHE_TTL_MS`: override the session discovery cache TTL in milliseconds.

## Development

Scripts:

```bash
npm run dev          # run with tsx (stdio MCP)
npm run build        # compile to dist/
npm test             # run Jest tests
npm run lint         # eslint
npm run format       # prettier
npm run ci           # typecheck + lint + coverage + build
```

Local MCP config examples:

- `.mcp.example.json` (Claude Code / generic MCP client)
- `claude_desktop_config.example.json` (for reference only)

## Dependency Management

This repository consolidates dependency updates and security checks to keep CI signal clean:

- Weekly npm updates: single PR grouping all patch/minor updates; majors ignored by default
- Monthly GitHub Actions updates: single PR grouping all actions
- PR-time Dependency Review: blocks introducing known vulnerabilities (requires Dependency graph enabled)
- CI `npm audit`: production dependencies only, threshold `moderate`

See `docs/dependency-management.md` for details and how to adjust thresholds and schedules.

## Roadmap

This project targets the goals described in issue #1:

- MCP server foundation, session log identification via UID/toolUseId
- Operation index API and detailed diff API
- File change and Bash history APIs with unified diff format
- Future: rollback helpers, performance tuning, security hardening

## Security and Privacy

- Reads local Claude logs only; does not send data to external services.
- Standard file access permissions apply; no elevated privileges are required.

## License

MIT
