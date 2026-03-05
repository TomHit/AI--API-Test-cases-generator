export function buildGeneratorPrompt({
  project,
  options,
  endpointRecords,
  schemaText,
}) {
  return `
You are an API QA test case generator.

GOAL:
Generate a SINGLE JSON object that matches the provided JSON Schema exactly.

HARD RULES (must follow):
- Output MUST be valid JSON only (no markdown, no commentary).
- Methods must be uppercase (GET/POST/PUT/PATCH/DELETE).
- request.query and request.headers MUST always be objects (use {} if none).
- request.body MUST be omitted for GET/DELETE unless the endpoint explicitly requires a body.
- If endpoint records show required query params, include realistic values.
- If unsure about a required value, set needs_review=true and add review_notes explaining what is missing.
- Write steps/expected in simple manual-QA language.

TEST PACK RULES:
For EACH selected endpoint, generate at least:
1) smoke (P0): valid request, status 200, required keys exist
2) contract (P1): validate critical fields and types (ok:boolean, rows:array if present)
3) negative (P1/P2): missing required query param -> expect 4xx
4) auth (P1): missing auth header -> expect 401/403

ASSERTIONS FORMAT (use objects, not strings):
Use an array of objects like:
- { "type":"status", "equals":200 }
- { "type":"jsonpath_exists", "path":"$.ok" }
- { "type":"jsonpath_type", "path":"$.ok", "equals":"boolean" }
- { "type":"jsonpath_type", "path":"$.rows", "equals":"array" }
- { "type":"jsonpath_equals", "path":"$.ok", "equals":true }

AUTH:
If project.auth_profile is "device", include header:
  "X-Device-Id": "{{DEVICE_ID}}"
Do not include cookies unless explicitly required.

PROJECT:
${JSON.stringify(project, null, 2)}

OPTIONS:
${JSON.stringify(options, null, 2)}

ENDPOINT RECORDS:
${JSON.stringify(endpointRecords, null, 2)}

JSON SCHEMA:
${schemaText}

OUTPUT:
Return ONLY the JSON object.
`.trim();
}

/**
 * Used when model returns invalid JSON or fails schema validation.
 * Must return ONLY fixed JSON.
 */
export function buildRepairPrompt({ badJsonText, schemaText }) {
  return `
Fix the following output to become VALID JSON that conforms to the JSON Schema.
Do not add commentary. Return ONLY the fixed JSON object.

BAD OUTPUT:
${badJsonText}

JSON SCHEMA:
${schemaText}
`.trim();
}
