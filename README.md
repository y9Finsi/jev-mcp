# jev-mcp ⚡️

Universal **Model Context Protocol (MCP)** Server for **TypeSafe Jev (System One)** semantic code search and validation.

Works seamlessly in **Antigravity, Cursor, Claude Code, Windsurf, Zed**, and any MCP-compatible harness.

---

## What it does

Traditional AI agents waste thousands of tokens doing blind `grep_search` and getting stuck in loops. **jev-mcp** introduces **System One** instant judgments:

1. **`search_codebase`**: Semantic search across any repo and any language (Kotlin, Go, TS, Python, Swift, Rust, etc.). Returns exact file paths, target methods, and line numbers.
2. **`validate_code_targets`**: Anti-hallucination filter. When an agent guesses 10 candidate files, Jev discards 80% of false positives and pinpoints exact lines in valid files.

---

## Quick Start (For You & Friends)

### 1. Antigravity / Cursor / Claude Code Configuration

Simply add this to your MCP settings (e.g., `~/.gemini/config/mcp_config.json`, `claude_desktop_config.json`, or `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "jev": {
      "command": "npx",
      "args": ["-y", "jev-mcp"],
      "env": {
        "TYPESAFE_API_KEY": "your_typesafe_api_key_here"
      }
    }
  }
}
```

Or run directly from source:

```json
{
  "mcpServers": {
    "jev": {
      "command": "node",
      "args": ["/path/to/jev-mcp/bin/index.js"],
      "env": {
        "TYPESAFE_API_KEY": "your_typesafe_api_key_here"
      }
    }
  }
}
```

---

## License

MIT © [y9Finsi](https://github.com/y9Finsi)
