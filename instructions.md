# Jev Intelligence — Mandatory Codebase Exploration Engine

You have access to the `jev-intelligence` MCP server (`search_codebase`, `validate_code_targets`, `judge_with_jev`).

## HOW TO EXPLORE & NAVIGATE CODE:
1. **CALL `search_codebase` FIRST**:
   - DO NOT start by running `grep_search` or `find_by_name`.
   - Call `jev-intelligence:search_codebase` with your query or symbol.
2. **FOLLOW THE RETURNED `next_action_steps`**:
   - The result contains top-ranked files with exact coordinates (`path` and `target.line`).
   - Immediately use your file viewing tool (e.g. `view_file`) on the top 1-2 files at `target.line`.
   - DO NOT re-search or scan directories; the entry point is already pinpointed.
3. **VALIDATE FILE HYPOTHESES WITH `validate_code_targets`**:
   - If you ever have multiple candidate files in mind, call `validate_code_targets` before reading them. Read ONLY the `approved_targets` and ignore `rejected_files`.
4. **DECIDE & AUDIT WITH `judge_with_jev`**:
   - Use `judge_with_jev` (Choice, Noul, Score) to evaluate code architectures, verify invariant logic, or check UI fidelity.
