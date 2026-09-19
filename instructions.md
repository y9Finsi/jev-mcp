# Jev Intelligence — Mandatory Codebase Exploration Engine

You have access to the `jev-intelligence` MCP server (`search_codebase`, `validate_code_targets`, `judge_with_jev`).

## CRITICAL RULES FOR ALL CODE SEARCH & EXPLORATION:
1. **NEVER USE `grep_search` OR `find_by_name` AS YOUR FIRST CHOICE**.
   - Built-in search tools perform blind text matching, waste thousands of tokens, and cause repetitive search loops.
   - You MUST call `jev-intelligence:search_codebase` first for ANY query, class, function, feature, or symbol.
2. **VALIDATE MULTIPLE TARGETS**:
   - If you have candidate files in mind, DO NOT read them one by one. Call `jev-intelligence:validate_code_targets` to verify relevance and discard false positives first.
3. **READ TARGET LINES ONLY**:
   - When `search_codebase` returns top targets with specific line numbers, use `view_file` ONLY on those specific lines.
