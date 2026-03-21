function normalizeMethod(method) {
  return String(method || "GET").toUpperCase();
}

function normalizePath(path) {
  return String(path || "/");
}

function normalizePriority(priority) {
  const p = String(priority || "")
    .trim()
    .toUpperCase();

  if (["P0", "P1", "P2", "P3"].includes(p)) return p;
  return "P1";
}

function normalizeTestType(category) {
  const value = String(category || "")
    .trim()
    .toLowerCase();

  if (["contract", "schema", "negative", "auth"].includes(value)) {
    return value;
  }

  return "contract";
}

function slug(value) {
  return String(value || "")
    .replace(/[{}]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

function buildCaseId(rule, endpoint) {
  const ruleId = slug(rule?.rule_id || "RULE");
  const method = slug(endpoint?.method || "GET");
  const path = slug(endpoint?.path || "/");
  return `TC_${ruleId}_${method}_${path}`;
}

function buildModuleName(endpoint) {
  const tags = Array.isArray(endpoint?.tags) ? endpoint.tags : [];
  const firstTag = tags.find((tag) => String(tag || "").trim());

  if (firstTag) return `${String(firstTag).trim()} API`;

  const firstPathSegment = String(endpoint?.path || "")
    .split("/")
    .filter(Boolean)[0];

  return firstPathSegment ? `${firstPathSegment} API` : "Default API";
}

function buildBaseSteps(method, path) {
  return [
    "Open an API client such as Postman or another approved API testing tool.",
    `Select the ${method} method.`,
    `Enter the request URL using the configured base URL and path ${path}.`,
    "Add the required request data shown in the test data section.",
    "Send the request.",
    "Capture the response status, headers, and body.",
  ];
}

function buildBaseExpected(rule, endpoint) {
  const templateKey = String(rule?.template_key || "").trim();
  const category = String(rule?.category || "")
    .trim()
    .toLowerCase();
  const method = normalizeMethod(endpoint?.method);
  const path = normalizePath(endpoint?.path);

  if (templateKey.startsWith("negative.") || category === "negative") {
    return [
      `The ${method} ${path} request returns a controlled validation or error response.`,
      "The response matches the documented negative or error handling behavior.",
      "No unexpected server crash or unhandled failure occurs.",
    ];
  }

  if (templateKey.startsWith("auth.") || category === "auth") {
    return [
      `The ${method} ${path} request enforces the documented authentication or authorization behavior.`,
      "The response status and error behavior match the API contract.",
      "No protected resource is exposed when credentials are missing or invalid.",
    ];
  }

  return [
    `The ${method} ${path} response follows the documented contract for this scenario.`,
    "The returned status code, headers, and body structure match the API specification.",
  ];
}

function buildPathParams(endpoint) {
  const params = Array.isArray(endpoint?.params?.path)
    ? endpoint.params.path
    : [];
  const out = {};

  for (const p of params) {
    const name = String(p?.name || "").trim();
    if (!name) continue;
    out[name] = `<valid_${name}>`;
  }

  return out;
}

function buildQueryParams(endpoint) {
  const params = Array.isArray(endpoint?.params?.query)
    ? endpoint.params.query
    : [];
  const out = {};

  for (const p of params) {
    const name = String(p?.name || "").trim();
    if (!name) continue;
    out[name] = p?.required ? `<valid_${name}>` : `<optional_${name}>`;
  }

  return out;
}

function buildHeaders(endpoint) {
  const headers = {};
  const security = Array.isArray(endpoint?.security) ? endpoint.security : [];

  if (security.length > 0) {
    headers.Authorization = "Bearer <valid_token>";
  }

  const headerParams = Array.isArray(endpoint?.params?.header)
    ? endpoint.params.header
    : [];

  for (const p of headerParams) {
    const name = String(p?.name || "").trim();
    if (!name) continue;

    const lower = name.toLowerCase();

    if (lower === "authorization") {
      headers[name] = headers[name] || "Bearer <valid_token>";
      continue;
    }

    if (lower === "accept") {
      headers[name] = "application/json";
      continue;
    }

    if (lower === "content-type") {
      headers[name] = "application/json";
      continue;
    }

    if (p?.required) {
      headers[name] = `<valid_${name}>`;
    }
  }

  if (!Object.keys(headers).some((k) => k.toLowerCase() === "accept")) {
    headers.Accept = "application/json";
  }

  return headers;
}

function getRequestSchema(endpoint) {
  return (
    endpoint?.requestBody?.content?.["application/json"]?.schema ||
    endpoint?.requestBody?.content?.["application/*+json"]?.schema ||
    null
  );
}

function buildRequestBodyFromSchema(schema, fieldName = "value") {
  if (!schema || typeof schema !== "object") {
    return `<valid_${fieldName}>`;
  }

  if (schema.example !== undefined) return schema.example;

  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return schema.enum[0];
  }

  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    return buildRequestBodyFromSchema(schema.oneOf[0], fieldName);
  }

  if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    return buildRequestBodyFromSchema(schema.anyOf[0], fieldName);
  }

  if (Array.isArray(schema.allOf) && schema.allOf.length > 0) {
    const merged = {};

    for (const item of schema.allOf) {
      const value = buildRequestBodyFromSchema(item, fieldName);
      if (value && typeof value === "object" && !Array.isArray(value)) {
        Object.assign(merged, value);
      }
    }

    if (Object.keys(merged).length > 0) return merged;
  }

  if (schema.type === "object" || schema.properties) {
    const out = {};
    const props = schema.properties || {};

    for (const [key, value] of Object.entries(props)) {
      out[key] = buildRequestBodyFromSchema(value, key);
    }

    return out;
  }

  if (schema.type === "array" || schema.items) {
    return [
      buildRequestBodyFromSchema(schema.items || {}, `${fieldName}_item`),
    ];
  }

  if (schema.format === "email") return "qa.user@example.com";
  if (schema.format === "uuid") return "123e4567-e89b-12d3-a456-426614174000";
  if (schema.format === "date-time") return "2026-01-01T00:00:00Z";
  if (schema.format === "date") return "2026-01-01";

  if (schema.type === "boolean") return false;
  if (schema.type === "integer") return 1;
  if (schema.type === "number") return 1;

  return `<valid_${fieldName}>`;
}

function buildRequestBody(endpoint) {
  const schema = getRequestSchema(endpoint);
  if (!schema) return null;
  return buildRequestBodyFromSchema(schema, "request_body");
}

function shouldNeedReview(rule) {
  const templateKey = String(rule?.template_key || "").toLowerCase();
  const appliesWhen = String(rule?.applies_when || "").toLowerCase();

  return (
    templateKey.includes("composition") || appliesWhen.includes("composition")
  );
}

function buildReviewNotes(rule) {
  const notes = [];

  if (String(rule?.notes || "").trim()) {
    notes.push(String(rule.notes).trim());
  }

  if (
    String(rule?.template_key || "")
      .toLowerCase()
      .includes("composition")
  ) {
    notes.push("Verify composed schema branch selection manually.");
  }

  return notes.join(" ");
}

export function buildTestCaseFromRule(rule, endpoint) {
  const method = normalizeMethod(endpoint?.method);
  const path = normalizePath(endpoint?.path);

  return {
    id: buildCaseId(rule, endpoint),
    title:
      String(rule?.test_case_title || "").trim() ||
      `Verify ${method} ${path} behavior`,
    module: buildModuleName(endpoint),

    test_type: normalizeTestType(rule?.category),
    priority: normalizePriority(rule?.priority),

    objective:
      String(rule?.scenario || "").trim() ||
      String(rule?.test_case_title || "").trim() ||
      `Validate ${method} ${path} according to the API contract.`,

    preconditions: [
      "The API base URL is configured for the selected environment.",
      "Required credentials and headers are available if the endpoint is protected.",
    ],

    test_data: {
      path_params: buildPathParams(endpoint),
      query_params: buildQueryParams(endpoint),
      headers: buildHeaders(endpoint),
      cookies: {},
      request_body: buildRequestBody(endpoint),
    },

    steps: buildBaseSteps(method, path),
    expected_results: buildBaseExpected(rule, endpoint),

    api_details: {
      method,
      path,
    },

    validation_focus: [],

    references: [
      ...(rule?.rule_id ? [`rule:${rule.rule_id}`] : []),
      ...(rule?.template_key ? [`template:${rule.template_key}`] : []),
    ],

    needs_review: shouldNeedReview(rule),
    review_notes: buildReviewNotes(rule),
  };
}
