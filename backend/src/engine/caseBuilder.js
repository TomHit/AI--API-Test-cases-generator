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

function normalizeSeverity(severity) {
  const s = String(severity || "")
    .trim()
    .toLowerCase();
  if (["critical", "high", "medium", "low"].includes(s)) return s;
  return "medium";
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildModuleName(endpoint) {
  const tags = Array.isArray(endpoint?.tags) ? endpoint.tags : [];
  if (tags.length > 0) return `${tags[0]} API`;

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

  if (templateKey.startsWith("negative.") || category === "negative") {
    return [
      "The API returns a controlled validation or error response.",
      "The response matches the documented negative/error handling behavior.",
      "No unexpected server crash or unhandled failure occurs.",
    ];
  }

  if (templateKey.startsWith("auth.") || category === "auth") {
    return [
      "The API enforces the documented authentication or authorization behavior.",
      "The response status and error behavior match the API contract.",
      "No protected resource is exposed when credentials are missing or invalid.",
    ];
  }

  return [
    "The API response follows the documented contract for this scenario.",
    "The returned status code, headers, and body structure match the API specification.",
  ];
}

export function buildTestCaseFromRule(rule, endpoint) {
  const method = normalizeMethod(endpoint?.method);
  const path = normalizePath(endpoint?.path);

  return {
    id: String(rule?.rule_id || ""),
    title:
      String(rule?.test_case_title || "").trim() ||
      `Verify ${method} ${path} behavior`,
    module: buildModuleName(endpoint),

    test_type: String(rule?.category || "contract").toLowerCase(),
    priority: normalizePriority(rule?.priority),
    severity: normalizeSeverity(rule?.severity),

    objective:
      String(rule?.scenario || "").trim() ||
      String(rule?.test_case_title || "").trim() ||
      `Validate ${method} ${path} according to the API contract.`,

    api_details: {
      method,
      path,
    },

    request: {
      path_params: {},
      query_params: {},
      headers: {},
      cookies: {},
      request_body: null,
    },

    steps: buildBaseSteps(method, path),
    expected_results: buildBaseExpected(rule, endpoint),
    assertions: [],

    references: [
      ...(rule?.rule_id ? [`rule_id:${rule.rule_id}`] : []),
      ...(rule?.template_key ? [`template_key:${rule.template_key}`] : []),
      ...(rule?.scenario ? [`scenario:${rule.scenario}`] : []),
    ],

    needs_review: false,
    review_notes: String(rule?.notes || "").trim(),
    meta: {
      rule_id: String(rule?.rule_id || ""),
      template_key: String(rule?.template_key || ""),
      applies_when: String(rule?.applies_when || ""),
      method_filter: String(rule?.method_filter || ""),
    },
  };
}
