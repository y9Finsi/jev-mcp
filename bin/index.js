#!/usr/bin/env node

/**
 * Universal MCP Server for TypeSafe Jev (System One)
 * Compatible with Antigravity, Cursor, Claude Code, Windsurf, Zed.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import fs from "fs";
import path from "path";

let API_KEY = process.env.TYPESAFE_API_KEY;
if (!API_KEY) {
  const envCandidates = [
    path.join(process.cwd(), ".env"),
    "/Users/bogdan/Flow V1/.env",
    path.join(process.env.HOME || "", ".env")
  ];
  for (const envPath of envCandidates) {
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, "utf-8").split("\n");
      for (const line of lines) {
        if (line.startsWith("TYPESAFE_API_KEY=")) {
          API_KEY = line.split("=")[1].trim().replace(/^["']|["']$/g, "");
          break;
        }
      }
      if (API_KEY) break;
    }
  }
}
const API_ENDPOINT = process.env.TYPESAFE_ENDPOINT || "https://api.typesafe.ai/v1/systemone";

const EXCLUDE_DIRS = new Set([
  "node_modules", ".git", ".gradle", "build", ".idea", ".next", "dist",
  "bin", "obj", ".turbo", "__pycache__", ".venv", "venv", ".gemini"
]);

const VALID_EXTENSIONS = new Set([
  ".kt", ".kts", ".java", ".go", ".ts", ".tsx", ".js", ".jsx",
  ".swift", ".py", ".rs", ".cpp", ".h", ".c", ".proto", ".md", ".json"
]);

async function callJev(state, questions, model = "jev-latest") {
  if (!API_KEY) {
    throw new Error("TYPESAFE_API_KEY environment variable is missing!");
  }

  const response = await fetch(API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`
    },
    body: JSON.stringify({ state, questions, model })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`TypeSafe API error (${response.status}): ${errText}`);
  }

  return await response.json();
}

function splitQueryTokens(query) {
  const tokens = new Set();
  const rawWords = query.split(/[\s_]+/);
  for (const w of rawWords) {
    if (!w) continue;
    tokens.add(w.toLowerCase());
    // Split camelCase / PascalCase
    const sub = w.match(/[A-Z]?[a-z]+|[A-Z]+(?=[A-Z][a-z]|\d|\W|$)|[0-9]+/g) || [];
    for (const s of sub) {
      if (s.length > 1) tokens.add(s.toLowerCase());
    }
  }
  return [...tokens].filter(t => t.length > 1);
}

function findCandidates(rootDir, query, maxCandidates = 25) {
  const tokens = splitQueryTokens(query);
  const rawLower = query.toLowerCase();
  const candidates = [];

  function walk(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (!EXCLUDE_DIRS.has(entry.name)) {
            walk(path.join(dir, entry.name));
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (VALID_EXTENSIONS.has(ext)) {
            const fname = entry.name.toLowerCase();
            const fpath = path.join(dir, entry.name).toLowerCase();
            let score = 0;
            if (fname.includes(rawLower)) score += 50;
            for (const w of tokens) {
              if (fname.includes(w)) score += 8;
              if (fpath.includes(w)) score += 2;
            }

            try {
              const content = fs.readFileSync(path.join(dir, entry.name), "utf-8");
              const contentLower = content.toLowerCase();
              if (contentLower.includes(rawLower)) score += 40;
              for (const w of tokens) {
                if (contentLower.includes(w)) score += 1;
              }
            } catch (_) {}

            if (score > 0 || candidates.length < 60) {
              candidates.push({ score, fullPath: path.join(dir, entry.name) });
            }
          }
        }
      }
    } catch (_) {}
  }

  walk(rootDir);
  candidates.sort((a, b) => b.score - a.score);
  const picked = candidates.slice(0, maxCandidates);

  const results = [];
  for (const item of picked) {
    try {
      const content = fs.readFileSync(item.fullPath, "utf-8");
      const symbolMatches = [...content.matchAll(/(?:fun|func|def|class|interface|fn|struct|type)\s+([a-zA-Z0-9_]+)/g)];
      const symbols = [...new Set(symbolMatches.map(m => m[1]))].slice(0, 8);
      const relPath = path.relative(rootDir, item.fullPath);

      results.push({
        path: item.fullPath,
        relPath: relPath || path.basename(item.fullPath),
        name: path.basename(item.fullPath),
        symbols,
        sample: content.slice(0, 500),
        fullContent: content
      });
    } catch (_) {}
  }
  return results;
}

const server = new Server(
  {
    name: "jev-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search_codebase",
        description: "MANDATORY FIRST-CHOICE TOOL FOR CODE EXPLORATION. Use this INSTEAD of grep, ripgrep, or find_by_name when searching for features, functions, classes, or concepts. Powered by TypeSafe Jev (System One), it ranks files via AI and returns exact target lines and methods across any language without wasting context on blind scans.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "What feature, function, class, symbol (e.g. addLocalVideoCircle) or concept to search for" },
            directory_path: { type: "string", description: "Root folder to search within (defaults to current working directory)" }
          },
          required: ["query"]
        }
      },
      {
        name: "validate_code_targets",
        description: "CRITICAL ANTI-HALLUCINATION GATE. Call this before reading or modifying multiple candidate files. Takes your hypothesis files and discards irrelevant ones using TypeSafe Jev, returning exact verified lines so you never loop across wrong files.",
        inputSchema: {
          type: "object",
          properties: {
            goal: { type: "string", description: "The task, bug, or feature you intend to solve" },
            candidate_files: {
              type: "array",
              items: { type: "string" },
              description: "List of file paths the agent is thinking of reading or editing"
            }
          },
          required: ["goal", "candidate_files"]
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "search_codebase") {
      const rootDir = path.resolve(args.directory_path || process.cwd());
      const candidates = findCandidates(rootDir, args.query);

      if (candidates.length === 0) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `No files found in ${rootDir}` }) }] };
      }

      const questions = {};
      candidates.slice(0, 12).forEach((c, idx) => {
        questions[`is_target_${idx}`] = {
          type: "noul",
          instructions: `The user wants to find code or documentation for: '${args.query}'. Does file '${c.relPath}' with symbols [${c.symbols.join(", ")}] directly implement or define this?`,
          criteria: {
            true: "Yes, this file directly contains the core logic or UI implementation.",
            false: "No, this file is unrelated or just an indirect dependency."
          }
        };
      });

      const jevResp = await callJev(
        {
          query: args.query,
          root_context: rootDir,
          files: candidates.slice(0, 12).map((c, idx) => ({ id: `is_target_${idx}`, path: c.relPath, symbols: c.symbols }))
        },
        questions
      );

      const scored = [];
      candidates.slice(0, 12).forEach((c, idx) => {
        const prob = jevResp.answers?.[`is_target_${idx}`]?.noul ?? 0;
        if (prob >= 0.2) {
          c.jev_score = Math.round(prob * 1000) / 1000;
          scored.push(c);
        }
      });

      scored.sort((a, b) => b.jev_score - a.jev_score);
      const topItems = scored.slice(0, 3);

      const finalResults = [];
      for (const item of topItems) {
        const lines = item.fullContent.split("\n");
        const methodMatches = [];
        const pattern = /^\s*(?:@\w+\s+)?(?:public\s+|private\s+|protected\s+)?(?:fun|func|def|class|interface|fn)\s+([a-zA-Z0-9_]+)/;
        lines.forEach((line, lineIdx) => {
          const match = line.match(pattern);
          if (match) {
            methodMatches.push({ symbol: match[1], line: lineIdx + 1, preview: lines.slice(lineIdx, lineIdx + 10).join("\n") });
          }
        });

        let target = { line: 1, symbol: item.name };
        if (methodMatches.length > 0) {
          const subCandidates = methodMatches.slice(0, 6);
          const criteria = {};
          subCandidates.forEach(m => {
            criteria[m.symbol] = `Line ${m.line}: ${m.preview.slice(0, 60)}...`;
          });

          const choiceResp = await callJev(
            { query: args.query, file: item.relPath },
            {
              pick: {
                type: "choice",
                instructions: `Which symbol/function in '${item.relPath}' is the primary entry point for: '${args.query}'?`,
                criteria
              }
            }
          );
          const chosen = choiceResp.answers?.pick?.choice;
          const found = subCandidates.find(m => m.symbol === chosen) || subCandidates[0];
          target = { symbol: found.symbol, line: found.line, confidence: choiceResp.answers?.pick?.confidence };
        }

        finalResults.push({
          name: item.name,
          path: item.path,
          rel_path: item.relPath,
          jev_score: item.jev_score,
          target
        });
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            engine: "TypeSafe System One (Jev-latest)",
            query: args.query,
            search_root: rootDir,
            instructions_for_agent: "DO NOT run grep or search loops. Read ONLY the specific target lines in the top results using your file viewing tool.",
            results: finalResults
          }, null, 2)
        }]
      };
    }

    if (name === "validate_code_targets") {
      const rootDir = process.cwd();
      const resolved = [];
      for (const fp of args.candidate_files) {
        let p = path.resolve(rootDir, fp);
        if (!fs.existsSync(p)) {
          // fallback find
          const candidates = findCandidates(rootDir, path.basename(fp), 1);
          if (candidates.length > 0) p = candidates[0].fullPath;
        }
        if (fs.existsSync(p) && fs.statSync(p).isFile()) {
          const content = fs.readFileSync(p, "utf-8");
          const symbolMatches = [...content.matchAll(/(?:fun|func|class)\s+([a-zA-Z0-9_]+)/g)];
          resolved.push({
            path: p,
            relPath: path.relative(rootDir, p),
            name: path.basename(p),
            symbols: [...new Set(symbolMatches.map(m => m[1]))].slice(0, 8),
            content
          });
        }
      }

      const questions = {};
      resolved.forEach((rf, idx) => {
        questions[`valid_${idx}`] = {
          type: "noul",
          instructions: `The developer wants to: '${args.goal}'. Does the file '${rf.relPath}' directly implement or require modification for this goal?`,
          criteria: {
            true: "Yes, this file is directly relevant.",
            false: "No, this file is unrelated or an indirect caller."
          }
        };
      });

      const jevResp = await callJev(
        { goal: args.goal, files: resolved.map(r => ({ path: r.relPath, symbols: r.symbols })) },
        questions
      );

      const approved = [];
      const rejected = [];
      resolved.forEach((rf, idx) => {
        const prob = jevResp.answers?.[`valid_${idx}`]?.noul ?? 0;
        if (prob >= 0.4) {
          approved.push({ file: rf.relPath, relevance: Math.round(prob * 1000) / 1000 });
        } else {
          rejected.push(rf.relPath);
        }
      });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            engine: "TypeSafe System One (Jev-latest)",
            goal: args.goal,
            instructions_for_agent: "Inspect ONLY the approved_targets. DO NOT inspect or read rejected_files.",
            approved_targets: approved,
            rejected_files: rejected
          }, null, 2)
        }]
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (err) {
    return {
      content: [{ type: "text", text: JSON.stringify({ error: err.message }) }],
      isError: true
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error starting Jev MCP server:", err);
  process.exit(1);
});
