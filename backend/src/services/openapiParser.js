function pick(obj, keys) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined) return obj[k];
  }
  return undefined;
}

function normalizeMethod(m) {
  return String(m || "").toUpperCase();
}

function summarizeSchema(schema) {
  // Keep it short; do NOT dump full OpenAPI
  if (!schema || typeof schema !== "object") return null;

  const type = schema.type || (schema.properties ? "object" : undefined);
  const required = Array.isArray(schema.required)
    ? schema.required.slice(0, 20)
    : [];
  const props =
    schema.properties && typeof schema.properties === "object"
      ? Object.keys(schema.properties).slice(0, 30)
      : [];

  return { type, required, properties: props };
}

function pickBestResponse(op) {
  const responses = op?.responses || {};
  const ok = responses["200"] || responses["201"] || responses["204"] || null;
  const any = ok || responses["default"] || null;
  if (!any) return null;

  const content = any.content || {};
  const json =
    content["application/json"] || content["application/*+json"] || null;
  const schema = pick(json, ["schema"]) || null;

  return {
    status: ok
      ? responses["200"]
        ? 200
        : responses["201"]
          ? 201
          : 204
      : "default",
    contentType: json ? "application/json" : Object.keys(content)[0] || null,
    schemaSummary: summarizeSchema(schema),
  };
}

function parseParams(op) {
  const out = { query: [], path: [], header: [] };

  const params = Array.isArray(op?.parameters) ? op.parameters : [];
  for (const p of params) {
    const where = p?.in;
    const name = p?.name;
    if (!where || !name) continue;

    out[where] = out[where] || [];
    out[where].push({
      name,
      required: !!p.required,
      schema: summarizeSchema(p.schema),
      description: p.description
        ? String(p.description).slice(0, 120)
        : undefined,
    });
  }

  return out;
}

export function extractEndpoints(openapiDoc) {
  const paths = openapiDoc?.paths || {};
  const out = [];

  for (const pth of Object.keys(paths)) {
    const item = paths[pth] || {};
    for (const m of Object.keys(item)) {
      const method = normalizeMethod(m);
      if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) continue;

      const op = item[m];
      const tags = Array.isArray(op?.tags) ? op.tags : [];
      const summary = op?.summary || op?.operationId || "";

      const params = parseParams(op);
      const resp = pickBestResponse(op);

      out.push({
        id: `${method} ${pth}`,
        method,
        path: pth,
        tags,
        summary: summary ? String(summary).slice(0, 120) : "",
        params,
        response: resp,
      });
    }
  }

  return out;
}
