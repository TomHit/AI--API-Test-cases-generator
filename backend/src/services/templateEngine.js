import { TEMPLATE_REGISTRY } from "./templateRegistry.js";
import { resolveEndpointTestData } from "./testDataResolver.js";
import { generateNegativeCases } from "./negativeCaseGenerator.js";
import { evaluateRules } from "../engine/evaluateRules.js";

/* ------------------ BASIC HELPERS ------------------ */

function firstItem(list) {
  return Array.isArray(list) && list.length > 0 ? list[0] : null;
}

function firstByLocation(list, location) {
  const items = Array.isArray(list) ? list : [];
  return items.find((x) => x?.location === location) || items[0] || null;
}

function mergeObjects(base, extra) {
  return {
    ...(base && typeof base === "object" ? base : {}),
    ...(extra && typeof extra === "object" ? extra : {}),
  };
}

function lc(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function paramName(param) {
  return String(param?.name || "").trim();
}

function isInternalOrDebugParam(name) {
  const n = lc(name);
  return (
    n.startsWith("debug_") || n.startsWith("trace_") || n.startsWith("test_")
  );
}

function findParamByName(list, name) {
  const target = lc(name);
  return (Array.isArray(list) ? list : []).find((p) => lc(p?.name) === target);
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function ensureObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

/* ------------------ GENERIC VALUE RESOLVER ------------------ */

function semanticSampleValue(name, schema = {}) {
  const n = lc(name);
  const type = lc(schema?.type);
  const format = lc(schema?.format);

  if (Array.isArray(schema?.enum) && schema.enum.length > 0) {
    return schema.enum[0];
  }

  if (schema?.example !== undefined) return schema.example;
  if (schema?.default !== undefined) return schema.default;

  if (n === "accept") return "application/json";
  if (n === "content-type") return "application/json";
  if (n.includes("email")) return "qa.user@example.com";
  if (n === "id" || n.endsWith("id") || n.endsWith("_id")) return "12345";

  if (format === "uuid") return "123e4567-e89b-12d3-a456-426614174000";
  if (format === "date-time") return "2026-01-01T00:00:00Z";
  if (format === "date") return "2026-01-01";

  if (type === "boolean") return false;
  if (type === "integer" || type === "number") return 1;
  if (type === "array") return [];
  if (type === "object") return {};

  return "sample_value";
}

function normalizeParamValue(name, schema, currentValue) {
  if (
    currentValue === undefined ||
    currentValue === null ||
    currentValue === ""
  ) {
    return semanticSampleValue(name, schema);
  }

  if (Array.isArray(schema?.enum) && schema.enum.length > 0) {
    return schema.enum.includes(currentValue) ? currentValue : schema.enum[0];
  }

  const n = lc(name);

  if (n === "accept") return "application/json";
  if (n === "content-type") return "application/json";

  return currentValue;
}

/* ------------------ REQUEST BUILDERS ------------------ */

function buildPositiveParams(
  paramDefs,
  resolvedValues = {},
  { includeOptional = false } = {},
) {
  const out = {};
  const defs = Array.isArray(paramDefs) ? paramDefs : [];

  for (const param of defs) {
    const name = paramName(param);
    if (!name) continue;
    if (isInternalOrDebugParam(name)) continue;
    if (!includeOptional && !param?.required) continue;

    const schema = param?.schema || {};
    const existing = resolvedValues?.[name];
    out[name] = normalizeParamValue(name, schema, existing);
  }

  return out;
}

function keepUsefulHeaders(endpoint, resolvedHeaders = {}) {
  const headerDefs = endpoint?.params?.header || [];
  const out = {};

  for (const param of headerDefs) {
    const name = paramName(param);
    if (!name) continue;
    if (isInternalOrDebugParam(name)) continue;

    if (
      !param?.required &&
      lc(name) !== "accept" &&
      lc(name) !== "content-type"
    ) {
      continue;
    }

    const schema = param?.schema || {};
    const existing =
      resolvedHeaders?.[name] ??
      resolvedHeaders?.[name?.toLowerCase?.()] ??
      resolvedHeaders?.[
        Object.keys(resolvedHeaders || {}).find((k) => lc(k) === lc(name))
      ];

    out[name] = normalizeParamValue(name, schema, existing);
  }

  if (!("Accept" in out) && !("accept" in out)) {
    out.Accept = "application/json";
  }

  return out;
}

function alignDeviceValues(request) {
  const next = {
    path_params: { ...(request?.path_params || {}) },
    query_params: { ...(request?.query_params || {}) },
    headers: { ...(request?.headers || {}) },
    cookies: { ...(request?.cookies || {}) },
    request_body: request?.request_body,
  };

  const q = next.query_params;
  const h = next.headers;

  const queryDeviceKey = Object.keys(q).find((k) =>
    ["device", "deviceid", "device_id"].includes(lc(k)),
  );
  const headerDeviceKey = Object.keys(h).find((k) => lc(k) === "x-device-id");

  const unifiedDevice =
    (queryDeviceKey && q[queryDeviceKey]) ||
    (headerDeviceKey && h[headerDeviceKey]);

  if (!unifiedDevice) return next;

  if (queryDeviceKey) q[queryDeviceKey] = unifiedDevice;
  if (headerDeviceKey) h[headerDeviceKey] = unifiedDevice;

  return next;
}

function buildMinimalPositiveRequest(endpoint, resolved) {
  const pathParams = buildPositiveParams(
    endpoint?.params?.path || [],
    resolved?.valid?.path || {},
    { includeOptional: true },
  );

  const queryParams = buildPositiveParams(
    endpoint?.params?.query || [],
    resolved?.valid?.query || {},
    { includeOptional: false },
  );

  const headers = keepUsefulHeaders(endpoint, resolved?.valid?.headers || {});

  return alignDeviceValues({
    path_params: pathParams,
    query_params: queryParams,
    headers,
    cookies: resolved?.valid?.cookies || {},
    request_body: resolved?.valid?.body,
  });
}

function sanitizePositiveQueryParams(endpoint, query = {}) {
  const defs = endpoint?.params?.query || [];
  const out = {};

  for (const [key, value] of Object.entries(query || {})) {
    if (isInternalOrDebugParam(key)) continue;

    const def = findParamByName(defs, key);
    out[key] = normalizeParamValue(key, def?.schema || {}, value);
  }

  return out;
}

function sanitizePositiveHeaders(endpoint, headers = {}) {
  const defs = endpoint?.params?.header || [];
  const out = {};

  for (const [key, value] of Object.entries(headers || {})) {
    if (isInternalOrDebugParam(key)) continue;

    const def = findParamByName(defs, key);
    out[key] = normalizeParamValue(key, def?.schema || {}, value);
  }

  if (!("Accept" in out) && !("accept" in out)) {
    out.Accept = "application/json";
  }

  const normalized = {};
  for (const [key, value] of Object.entries(out)) {
    if (lc(key) === "x-device-id") normalized["X-Device-Id"] = value;
    else if (lc(key) === "accept") normalized["Accept"] = "application/json";
    else normalized[key] = value;
  }

  return normalized;
}

function sanitizePositivePathParams(endpoint, pathParams = {}) {
  const defs = endpoint?.params?.path || [];
  const out = {};

  for (const [key, value] of Object.entries(pathParams || {})) {
    const def = findParamByName(defs, key);
    out[key] = normalizeParamValue(key, def?.schema || {}, value);
  }

  return out;
}

function sanitizePositiveTestData(endpoint, testData = {}) {
  const cleaned = {
    path_params: sanitizePositivePathParams(
      endpoint,
      testData?.path_params || {},
    ),
    query_params: sanitizePositiveQueryParams(
      endpoint,
      testData?.query_params || {},
    ),
    headers: sanitizePositiveHeaders(endpoint, testData?.headers || {}),
    cookies: testData?.cookies || {},
    request_body: testData?.request_body,
  };

  return alignDeviceValues(cleaned);
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function trimLeadingSlash(value) {
  return String(value || "").replace(/^\/+/, "");
}

function joinUrlParts(base, path) {
  const b = trimTrailingSlash(base);
  const p = trimLeadingSlash(path);
  if (!b) return path || "/";
  if (!p) return b || "/";
  return `${b}/${p}`;
}

function buildBaseUrl(endpoint) {
  const serverUrl =
    Array.isArray(endpoint?.servers) && endpoint.servers.length > 0
      ? endpoint.servers[0]?.url
      : "";

  if (serverUrl) {
    return trimTrailingSlash(serverUrl);
  }

  const scheme =
    Array.isArray(endpoint?.schemes) && endpoint.schemes.length > 0
      ? endpoint.schemes[0]
      : "https";

  const host = String(endpoint?.host || "").trim();
  const basePath = String(endpoint?.basePath || "").trim();

  if (host) {
    return trimTrailingSlash(`${scheme}://${host}${basePath}`);
  }

  return trimTrailingSlash(basePath);
}

function resolvePathTemplate(path, pathParams = {}) {
  let out = String(path || "/");

  for (const [key, value] of Object.entries(pathParams || {})) {
    out = out.replaceAll(`{${key}}`, encodeURIComponent(String(value)));
  }

  return out;
}

function buildQueryString(queryParams = {}) {
  const pairs = [];

  for (const [key, value] of Object.entries(queryParams || {})) {
    if (value === undefined || value === null || value === "") continue;

    if (Array.isArray(value)) {
      for (const item of value) {
        pairs.push(
          `${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`,
        );
      }
      continue;
    }

    if (typeof value === "object") {
      pairs.push(
        `${encodeURIComponent(key)}=${encodeURIComponent(JSON.stringify(value))}`,
      );
      continue;
    }

    pairs.push(
      `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    );
  }

  return pairs.length > 0 ? `?${pairs.join("&")}` : "";
}

function buildEndpointUrls(endpoint, testData = {}, apiPath = "/") {
  const baseUrl = buildBaseUrl(endpoint);
  const rawPath = String(apiPath || endpoint?.path || "/");
  const resolvedPath = resolvePathTemplate(
    rawPath,
    testData?.path_params || {},
  );
  const queryString = buildQueryString(testData?.query_params || {});

  return {
    base_url: baseUrl,
    full_url_template: joinUrlParts(baseUrl, rawPath),
    full_url_resolved: `${joinUrlParts(baseUrl, resolvedPath)}${queryString}`,
  };
}

/* ------------------ TEMPLATE HANDLING ------------------ */

function isPositiveTemplateKey(templateKey) {
  const key = String(templateKey || "")
    .trim()
    .toLowerCase();
  return (
    key.startsWith("contract.") ||
    key.startsWith("schema.") ||
    key === "auth.valid_credentials"
  );
}

function detectUniversalNegativeTemplateKeys(endpoint) {
  const out = new Set();

  const queryParams = endpoint?.params?.query || [];
  const pathParams = endpoint?.params?.path || [];
  const headerParams = endpoint?.params?.header || [];
  const preferredBodyType = endpoint?.requestBody?.preferredContentType;
  const bodySchema = preferredBodyType
    ? endpoint?.requestBody?.content?.[preferredBodyType]?.schema
    : null;

  if (queryParams.some((p) => p?.required)) {
    out.add("negative.missing_required_query");
  }

  if (pathParams.some((p) => p?.required)) {
    out.add("negative.missing_required_path");
  }

  if (
    queryParams.some((p) => {
      const s = p?.schema || {};
      return !!s.type || !!s.format;
    })
  ) {
    out.add("negative.invalid_query_type");
  }

  const hasEnum = (fields = []) =>
    fields.some(
      (p) => Array.isArray(p?.schema?.enum) && p.schema.enum.length > 0,
    );

  if (hasEnum(queryParams) || hasEnum(pathParams) || hasEnum(headerParams)) {
    out.add("negative.invalid_enum");
  }

  const hasFormat = (fields = []) =>
    fields.some((p) => {
      const s = p?.schema || {};
      return !!s.format || !!s.pattern;
    });

  if (
    hasFormat(queryParams) ||
    hasFormat(pathParams) ||
    hasFormat(headerParams)
  ) {
    out.add("negative.invalid_format");
  }

  const hasStringMaxLength = (fields = []) =>
    fields.some((p) => typeof p?.schema?.maxLength === "number");

  if (
    hasStringMaxLength(queryParams) ||
    hasStringMaxLength(pathParams) ||
    hasStringMaxLength(headerParams)
  ) {
    out.add("negative.string_too_long");
  }

  const hasNumericMaximum = (fields = []) =>
    fields.some((p) => typeof p?.schema?.maximum === "number");

  if (
    hasNumericMaximum(queryParams) ||
    hasNumericMaximum(pathParams) ||
    hasNumericMaximum(headerParams)
  ) {
    out.add("negative.numeric_above_maximum");
  }

  if (endpoint?.requestBody?.required) {
    out.add("negative.empty_body");
  }

  if (
    preferredBodyType &&
    String(preferredBodyType).includes("json") &&
    bodySchema
  ) {
    out.add("negative.invalid_content_type");
    out.add("negative.malformed_json");
  }

  if (bodySchema && (bodySchema.type === "object" || bodySchema.properties)) {
    out.add("negative.additional_property");
  }

  if (
    bodySchema &&
    Array.isArray(bodySchema.required) &&
    bodySchema.required.length > 0
  ) {
    out.add("negative.null_required_field");
  }

  const queryNames = queryParams.map((p) =>
    String(p?.name || "").toLowerCase(),
  );
  if (
    queryNames.some((n) =>
      [
        "page",
        "limit",
        "offset",
        "pagesize",
        "page_size",
        "per_page",
        "cursor",
        "size",
      ].includes(n),
    )
  ) {
    out.add("negative.invalid_pagination");
  }

  if (pathParams.length > 0) {
    out.add("negative.resource_not_found");
  }

  return Array.from(out);
}

function buildUniversalNegativeCases(endpoint) {
  const templateKeys = detectUniversalNegativeTemplateKeys(endpoint);
  const cases = [];

  for (const templateKey of templateKeys) {
    const fn = TEMPLATE_REGISTRY[templateKey];
    if (!fn) continue;

    const pseudoRule = {
      rule_id: `AUTO_${templateKey}`,
      category: "negative",
      scenario: `Auto-generated negative case for ${templateKey}`,
      template_key: templateKey,
      notes: "Generated automatically from endpoint schema",
    };

    try {
      const tc = annotateCase(fn(endpoint), pseudoRule, endpoint);
      if (tc) {
        tc.references = ensureArray(tc.references);
        tc.references.push("auto_generated:universal_negative");
        cases.push(tc);
      }
    } catch (err) {
      console.error(
        `Universal negative template build failed: ${templateKey}`,
        err,
      );
    }
  }

  return cases;
}

/* ------------------ DATA RESOLUTION ------------------ */

function inferResolvedTestData(templateKey, endpoint) {
  const resolved =
    endpoint?._resolvedTestData || resolveEndpointTestData(endpoint);

  const validRequest = isPositiveTemplateKey(templateKey)
    ? buildMinimalPositiveRequest(endpoint, resolved)
    : {
        path_params: resolved?.valid?.path || {},
        query_params: resolved?.valid?.query || {},
        headers: resolved?.valid?.headers || {},
        cookies: resolved?.valid?.cookies || {},
        request_body: resolved?.valid?.body,
      };

  switch (templateKey) {
    case "negative.missing_required_query":
      return (
        firstByLocation(resolved?.negative?.missingRequired, "query")
          ?.request || validRequest
      );

    case "negative.missing_required_path":
      return (
        firstByLocation(resolved?.negative?.missingRequired, "path")?.request ||
        validRequest
      );

    case "negative.empty_body":
      return (
        firstByLocation(resolved?.negative?.missingRequired, "body")
          ?.request || {
          ...validRequest,
          request_body: undefined,
        }
      );

    case "negative.invalid_query_type":
      return (
        firstItem(resolved?.negative?.invalidType)?.request || validRequest
      );

    case "negative.invalid_enum":
      return (
        firstItem(resolved?.negative?.invalidEnum)?.request || validRequest
      );

    case "negative.invalid_format":
      return (
        firstItem(resolved?.negative?.invalidFormat)?.request || validRequest
      );

    case "negative.string_too_long":
      return (
        firstItem(resolved?.negative?.stringTooLong)?.request || validRequest
      );

    case "negative.numeric_above_maximum":
      return (
        firstItem(resolved?.negative?.numericAboveMaximum)?.request ||
        validRequest
      );

    case "negative.null_required_field":
      return (
        firstItem(resolved?.negative?.nullRequiredField)?.request ||
        validRequest
      );

    case "negative.invalid_content_type":
      return {
        ...validRequest,
        headers: {
          ...(validRequest.headers || {}),
          "Content-Type": "text/plain",
        },
      };

    case "negative.malformed_json":
      return {
        ...validRequest,
        headers: {
          ...(validRequest.headers || {}),
          "Content-Type": "application/json",
        },
        request_body: "{invalid-json",
      };

    case "negative.additional_property": {
      const body = resolved?.valid?.body;
      if (body && typeof body === "object" && !Array.isArray(body)) {
        return {
          ...validRequest,
          request_body: {
            ...body,
            unexpectedProperty: "extra-value",
          },
        };
      }
      return validRequest;
    }

    case "negative.invalid_pagination": {
      const query = { ...(validRequest.query_params || {}) };

      if ("page" in query) query.page = -1;
      else if ("limit" in query) query.limit = -1;
      else if ("offset" in query) query.offset = -1;
      else if ("page_size" in query) query.page_size = -1;
      else if ("pagesize" in query) query.pagesize = -1;
      else if ("per_page" in query) query.per_page = -1;
      else if ("size" in query) query.size = -1;
      else if ("cursor" in query) query.cursor = "invalid-cursor";
      else query.page = -1;

      return {
        ...validRequest,
        query_params: query,
      };
    }

    case "negative.resource_not_found": {
      const pathParams = { ...(validRequest.path_params || {}) };
      const keys = Object.keys(pathParams);

      if (keys.length > 0) {
        pathParams[keys[0]] = "999999999";
      } else {
        pathParams.id = "999999999";
      }

      return {
        ...validRequest,
        path_params: pathParams,
      };
    }

    case "negative.conflict": {
      const body = resolved?.valid?.body;
      if (body && typeof body === "object" && !Array.isArray(body)) {
        return {
          ...validRequest,
          request_body: {
            ...body,
          },
        };
      }
      return validRequest;
    }

    case "negative.rate_limit":
      return validRequest;

    case "negative.unsupported_method":
      return validRequest;

    case "auth.missing_credentials": {
      const headers = { ...(validRequest.headers || {}) };

      delete headers.Authorization;
      delete headers.authorization;
      delete headers["X-API-Key"];
      delete headers["x-api-key"];
      delete headers.Cookie;
      delete headers.cookie;

      return {
        ...validRequest,
        headers,
      };
    }

    case "auth.invalid_credentials": {
      const headers = { ...(validRequest.headers || {}) };

      if ("Authorization" in headers || "authorization" in headers) {
        headers.Authorization = "Bearer invalid-token";
        delete headers.authorization;
      } else if ("X-API-Key" in headers || "x-api-key" in headers) {
        headers["X-API-Key"] = "invalid-api-key";
        delete headers["x-api-key"];
      } else if ("Cookie" in headers || "cookie" in headers) {
        headers.Cookie = "session=invalid-session";
        delete headers.cookie;
      } else {
        headers.Authorization = "Bearer invalid-token";
      }

      return {
        ...validRequest,
        headers,
      };
    }

    case "auth.expired_credentials": {
      const headers = { ...(validRequest.headers || {}) };

      if ("Authorization" in headers || "authorization" in headers) {
        headers.Authorization = "Bearer expired-token";
        delete headers.authorization;
      } else if ("Cookie" in headers || "cookie" in headers) {
        headers.Cookie = "session=expired-session";
        delete headers.cookie;
      } else {
        headers.Authorization = "Bearer expired-token";
      }

      return {
        ...validRequest,
        headers,
      };
    }

    case "auth.forbidden_role": {
      const headers = { ...(validRequest.headers || {}) };

      if ("Authorization" in headers || "authorization" in headers) {
        headers.Authorization = "Bearer valid-but-low-privilege-token";
        delete headers.authorization;
      } else {
        headers.Authorization = "Bearer valid-but-low-privilege-token";
      }

      return {
        ...validRequest,
        headers,
      };
    }

    default:
      return validRequest;
  }
}

/* ------------------ CASE ANNOTATION ------------------ */

function annotateCase(tc, rule, endpoint) {
  if (!tc) return null;

  tc.references = ensureArray(tc.references);
  tc.preconditions = ensureArray(tc.preconditions);
  tc.steps = ensureArray(tc.steps);
  tc.expected_results = ensureArray(tc.expected_results);
  tc.validation_focus = ensureArray(tc.validation_focus);
  tc.test_data = ensureObject(tc.test_data);

  tc.api_details = {
    method: String(
      tc?.api_details?.method || endpoint?.method || "GET",
    ).toUpperCase(),
    path: tc?.api_details?.path || endpoint?.path || "/",
  };

  if (rule?.rule_id) {
    tc.references.push(`rule_id:${rule.rule_id}`);
  }
  if (rule?.scenario) {
    tc.references.push(`scenario:${rule.scenario}`);
  }

  const templateKey = getTemplateKey(rule);
  if (templateKey) {
    tc.references.push(`template_key:${templateKey}`);
  }

  if (rule?.category && !tc.test_type) {
    tc.test_type = String(rule.category).toLowerCase();
  }

  if (!tc.module) {
    tc.module =
      (Array.isArray(endpoint?.tags) && endpoint.tags[0]) ||
      String(endpoint?.path || "")
        .split("/")
        .filter(Boolean)[0] ||
      "Default";
  }

  if (typeof tc.review_notes !== "string") {
    tc.review_notes = rule?.notes ? String(rule.notes) : "";
  } else if (!tc.review_notes && rule?.notes) {
    tc.review_notes = String(rule.notes);
  }

  if (typeof tc.needs_review !== "boolean") {
    tc.needs_review = false;
  }

  const resolvedData = inferResolvedTestData(templateKey, endpoint);

  const mergedTestData = {
    path_params: mergeObjects(
      resolvedData?.path_params,
      tc?.test_data?.path_params,
    ),
    query_params: mergeObjects(
      resolvedData?.query_params,
      tc?.test_data?.query_params,
    ),
    headers: mergeObjects(resolvedData?.headers, tc?.test_data?.headers),
    cookies: mergeObjects(resolvedData?.cookies, tc?.test_data?.cookies),
    request_body:
      tc?.test_data?.request_body !== undefined &&
      tc?.test_data?.request_body !== null
        ? tc.test_data.request_body
        : resolvedData?.request_body,
  };

  tc.test_data = isPositiveTemplateKey(templateKey)
    ? sanitizePositiveTestData(endpoint, mergedTestData)
    : mergedTestData;

  if (endpoint?.requires_auth) {
    tc.test_data.headers = {
      ...(tc.test_data.headers || {}),
      Authorization:
        tc.test_data.headers?.Authorization || "Bearer <valid_token>",
    };
  }

  if (tc.api_details.method === "GET") {
    delete tc.test_data.request_body;
  }

  if (
    ["POST", "PUT", "PATCH"].includes(tc.api_details.method) &&
    (tc.test_data.request_body === undefined ||
      tc.test_data.request_body === null ||
      (typeof tc.test_data.request_body === "object" &&
        !Array.isArray(tc.test_data.request_body) &&
        Object.keys(tc.test_data.request_body).length === 0))
  ) {
    tc.needs_review = true;

    if (!tc.review_notes) {
      tc.review_notes =
        "Request body could not be fully resolved from the API specification.";
    }
  }

  const urls = buildEndpointUrls(
    endpoint,
    tc.test_data,
    tc?.api_details?.path || endpoint?.path || "/",
  );

  tc.api_details = {
    ...tc.api_details,
    base_url: urls.base_url,
    full_url_template: urls.full_url_template,
    full_url_resolved: urls.full_url_resolved,
  };

  return tc;
}

/* ------------------ RULE HANDLING ------------------ */

function resolveLegacyTemplateKey(rule) {
  const category = String(rule?.category || "").toLowerCase();
  const appliesWhen = String(rule?.applies_when || "").trim();
  const ruleId = String(rule?.rule_id || "").trim();

  if (category === "contract") {
    if (
      ruleId === "CONTRACT_001" ||
      appliesWhen === "endpoint_exists" ||
      appliesWhen === "success_response_documented"
    ) {
      return "contract.success";
    }

    if (
      ruleId === "CONTRACT_005" ||
      appliesWhen === "response_has_required_fields"
    ) {
      return "contract.required_fields";
    }

    if (
      ruleId === "CONTRACT_004" ||
      appliesWhen === "endpoint_has_documented_success_status"
    ) {
      return "contract.status_code";
    }

    if (
      ruleId === "CONTRACT_002" ||
      appliesWhen === "response_content_type_documented"
    ) {
      return "contract.content_type";
    }

    if (
      ruleId === "CONTRACT_003" ||
      appliesWhen === "response_headers_documented"
    ) {
      return "contract.response_headers";
    }

    if (
      ruleId === "CONTRACT_008" ||
      appliesWhen === "endpoint_has_query_params" ||
      appliesWhen === "query_params_documented"
    ) {
      return "contract.query_params";
    }

    if (
      ruleId === "CONTRACT_009" ||
      appliesWhen === "endpoint_has_path_params" ||
      appliesWhen === "path_params_documented"
    ) {
      return "contract.path_params";
    }

    if (
      ruleId === "CONTRACT_010" ||
      appliesWhen === "request_body_schema_exists" ||
      appliesWhen === "request_body_documented"
    ) {
      return "contract.request_body";
    }

    if (
      ruleId === "CONTRACT_012" ||
      ruleId === "CONTRACT_013" ||
      appliesWhen === "error_responses_documented" ||
      appliesWhen === "operation_metadata_exists"
    ) {
      return "contract.error_response";
    }

    return "contract.success";
  }

  if (category === "schema") {
    if (
      appliesWhen === "request_body_schema_exists" ||
      appliesWhen === "request_body_has_required_fields" ||
      appliesWhen === "method_is_post_and_has_request_body" ||
      appliesWhen === "method_is_put_or_patch_and_has_request_body"
    ) {
      return "schema.request_body";
    }

    if (ruleId === "SCHEMA_001" || appliesWhen === "response_schema_exists") {
      return "schema.response";
    }

    if (
      ruleId === "SCHEMA_002" ||
      appliesWhen === "response_schema_has_required_fields"
    ) {
      return "schema.required_fields";
    }

    if (
      ruleId === "SCHEMA_003" ||
      appliesWhen === "response_schema_has_typed_fields"
    ) {
      return "schema.field_types";
    }

    if (
      ruleId === "SCHEMA_004" ||
      appliesWhen === "response_schema_has_enum_fields"
    ) {
      return "schema.enum";
    }

    if (
      ruleId === "SCHEMA_005" ||
      appliesWhen === "response_schema_has_nested_objects"
    ) {
      return "schema.nested_objects";
    }

    if (
      ruleId === "SCHEMA_006" ||
      appliesWhen === "response_schema_has_array_fields"
    ) {
      return "schema.array";
    }

    if (
      ruleId === "SCHEMA_007" ||
      appliesWhen === "response_schema_has_format_fields"
    ) {
      return "schema.format";
    }

    if (
      ruleId === "SCHEMA_008" ||
      appliesWhen === "response_schema_has_numeric_constraints"
    ) {
      return "schema.numeric_constraints";
    }

    if (
      ruleId === "SCHEMA_009" ||
      appliesWhen === "response_schema_has_string_constraints"
    ) {
      return "schema.string_constraints";
    }

    if (
      ruleId === "SCHEMA_010" ||
      appliesWhen === "response_schema_has_pattern_fields"
    ) {
      return "schema.pattern";
    }

    if (ruleId === "SCHEMA_011" || appliesWhen === "schema_has_composition") {
      return "schema.composition";
    }

    return "schema.response";
  }

  if (category === "negative") {
    if (
      ruleId === "NEGATIVE_001" ||
      appliesWhen === "endpoint_has_required_query"
    ) {
      return "negative.missing_required_query";
    }

    if (
      ruleId === "NEGATIVE_002" ||
      appliesWhen === "endpoint_has_path_params"
    ) {
      return "negative.missing_required_path";
    }

    if (
      ruleId === "NEGATIVE_003" ||
      appliesWhen === "query_params_have_typed_schema"
    ) {
      return "negative.invalid_query_type";
    }

    if (
      ruleId === "NEGATIVE_004" ||
      appliesWhen === "response_or_request_schema_has_enum" ||
      appliesWhen === "query_or_body_has_enum"
    ) {
      return "negative.invalid_enum";
    }

    if (
      ruleId === "NEGATIVE_005" ||
      appliesWhen === "schema_has_string_format" ||
      appliesWhen === "schema_has_date_or_datetime_fields" ||
      appliesWhen === "query_or_body_has_format"
    ) {
      return "negative.invalid_format";
    }

    if (
      ruleId === "NEGATIVE_006" ||
      appliesWhen === "schema_has_string_constraints" ||
      appliesWhen === "query_or_body_has_string_max_length"
    ) {
      return "negative.string_too_long";
    }

    if (
      ruleId === "NEGATIVE_007" ||
      appliesWhen === "schema_has_numeric_constraints" ||
      appliesWhen === "query_or_body_has_numeric_maximum"
    ) {
      return "negative.numeric_above_maximum";
    }

    if (
      ruleId === "NEGATIVE_008" ||
      appliesWhen === "request_body_schema_controls_additional_properties" ||
      appliesWhen === "request_body_is_object"
    ) {
      return "negative.additional_property";
    }

    if (ruleId === "NEGATIVE_009" || appliesWhen === "endpoint_can_conflict") {
      return "negative.conflict";
    }

    if (
      ruleId === "NEGATIVE_010" ||
      appliesWhen === "endpoint_has_rate_limit_contract"
    ) {
      return "negative.rate_limit";
    }

    if (
      ruleId === "NEGATIVE_011" ||
      appliesWhen === "endpoint_has_pagination_params" ||
      appliesWhen === "endpoint_has_pagination"
    ) {
      return "negative.invalid_pagination";
    }

    if (
      ruleId === "NEGATIVE_012" ||
      appliesWhen === "request_body_has_required_fields"
    ) {
      return "negative.null_required_field";
    }

    if (ruleId === "NEGATIVE_018" || appliesWhen === "endpoint_exists") {
      return "negative.unsupported_method";
    }

    if (
      ruleId === "NEGATIVE_019" ||
      ruleId === "NEGATIVE_107" ||
      appliesWhen === "request_body_schema_exists"
    ) {
      return "negative.invalid_content_type";
    }

    if (ruleId === "NEGATIVE_020" || ruleId === "NEGATIVE_113") {
      return "negative.malformed_json";
    }

    if (ruleId === "NEGATIVE_021" || appliesWhen === "request_body_required") {
      return "negative.empty_body";
    }

    if (
      ruleId === "NEGATIVE_024" ||
      appliesWhen === "endpoint_has_resource_identifier"
    ) {
      return "negative.resource_not_found";
    }

    if (ruleId === "NEGATIVE_014" || appliesWhen === "endpoint_requires_auth") {
      return "auth.missing_credentials";
    }

    if (ruleId === "NEGATIVE_015") {
      return "auth.invalid_credentials";
    }

    if (ruleId === "NEGATIVE_016") {
      return "auth.expired_credentials";
    }

    if (
      ruleId === "NEGATIVE_017" ||
      appliesWhen === "endpoint_requires_role_scope"
    ) {
      return "auth.forbidden_role";
    }

    return "negative.missing_required_query";
  }

  if (category === "auth") {
    if (ruleId === "AUTH_001" || appliesWhen === "endpoint_requires_auth") {
      return "auth.missing_credentials";
    }

    if (ruleId === "AUTH_002") {
      return "auth.invalid_credentials";
    }

    if (ruleId === "AUTH_003") {
      return "auth.expired_credentials";
    }

    if (
      ruleId === "AUTH_004" ||
      appliesWhen === "endpoint_requires_role_scope"
    ) {
      return "auth.forbidden_role";
    }

    return "auth.missing_credentials";
  }

  return "";
}

function getTemplateKey(rule) {
  const direct = String(rule?.template_key || "").trim();
  if (direct) return direct;
  return resolveLegacyTemplateKey(rule);
}

function buildCaseFromCsvRule(rule, endpoint) {
  const templateKey = getTemplateKey(rule);
  const fn = TEMPLATE_REGISTRY[templateKey];

  if (!fn) {
    console.warn(
      `No template found for rule ${rule?.rule_id || "UNKNOWN"} using template_key=${templateKey}`,
    );
    return null;
  }

  return annotateCase(fn(endpoint), rule, endpoint);
}

async function resolveCsvRules(endpoint, options = {}) {
  const { rules } = await evaluateRules(endpoint, options);
  return rules;
}

/* ------------------ MAIN GENERATION ------------------ */

function buildDedupKey(tc) {
  return JSON.stringify({
    title: String(tc?.title || "")
      .trim()
      .toLowerCase(),
    test_type: String(tc?.test_type || "")
      .trim()
      .toLowerCase(),
    objective: String(tc?.objective || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase(),
    method: String(tc?.api_details?.method || "")
      .trim()
      .toUpperCase(),
    path: String(tc?.api_details?.path || "").trim(),
    steps: ensureArray(tc?.steps).map((x) =>
      String(x || "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase(),
    ),
    expected_results: ensureArray(tc?.expected_results).map((x) =>
      String(x || "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase(),
    ),
  });
}

function dedupeCases(cases) {
  const out = [];
  const seen = new Set();

  for (const tc of ensureArray(cases)) {
    const key = buildDedupKey(tc);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tc);
  }

  return out;
}

export async function generateCasesForEndpoint(endpoint, options = {}) {
  const enrichedEndpoint = {
    ...endpoint,
    _resolvedTestData: resolveEndpointTestData(endpoint),
  };

  const matchedRules = await resolveCsvRules(enrichedEndpoint, options);
  const cases = [];

  for (const rule of matchedRules) {
    try {
      const tc = buildCaseFromCsvRule(rule, enrichedEndpoint);
      if (tc) cases.push(tc);
    } catch (err) {
      console.error(
        `Template build failed for CSV rule: ${rule?.rule_id}`,
        err,
      );
    }
  }

  const include = Array.isArray(options?.include)
    ? options.include.map((x) => String(x).toLowerCase())
    : ["contract", "schema"];

  if (include.includes("negative")) {
    const autoNegativeCases = buildUniversalNegativeCases(enrichedEndpoint);
    const schemaNegativeCases = generateNegativeCases(enrichedEndpoint);
    cases.push(...autoNegativeCases, ...schemaNegativeCases);
  }

  return dedupeCases(cases);
}

function formatGeneratedCase(tc, endpoint) {
  if (!tc) return tc;

  const method = tc.api_details?.method || "GET";
  const path = tc.api_details?.path || "/";
  const testType = String(tc.test_type || "").toLowerCase();

  /* ---------------- TITLE FIX ---------------- */

  if (tc.title?.startsWith("Verify")) {
    const cleanPath = String(path || "/").trim();

    const resourceName =
      cleanPath
        .split("/")
        .filter(Boolean)
        .filter((part) => !part.startsWith("{") && !part.endsWith("}"))
        .pop() || "resource";

    const readableResource = resourceName
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (ch) => ch.toUpperCase());

    if (testType === "contract") {
      if (method === "GET") {
        if (cleanPath.includes("opportunities")) {
          tc.title = "Retrieve trend opportunities successfully";
        } else if (cleanPath.includes("login")) {
          tc.title = "Login request returns success response";
        } else if (cleanPath.includes("auth/me")) {
          tc.title = "Retrieve authenticated user details successfully";
        } else {
          tc.title = `Retrieve ${readableResource.toLowerCase()} successfully`;
        }
      } else if (method === "POST") {
        if (cleanPath.includes("login")) {
          tc.title = "Login with valid credentials returns success response";
        } else {
          tc.title = `Create ${readableResource.toLowerCase()} successfully`;
        }
      } else if (method === "PUT" || method === "PATCH") {
        tc.title = `Update ${readableResource.toLowerCase()} successfully`;
      } else if (method === "DELETE") {
        tc.title = `Delete ${readableResource.toLowerCase()} successfully`;
      } else {
        tc.title = `Process ${readableResource.toLowerCase()} successfully`;
      }
    } else if (testType === "negative") {
      if (cleanPath.includes("login")) {
        tc.title = "Reject login request with invalid input";
      } else if (method === "GET") {
        tc.title = `Reject invalid request for ${readableResource.toLowerCase()} retrieval`;
      } else {
        tc.title = `Reject request for ${readableResource.toLowerCase()} when input is invalid`;
      }
    } else if (testType === "schema") {
      if (cleanPath.includes("auth/me")) {
        tc.title = "Validate authenticated user response schema";
      } else {
        tc.title = `Validate ${readableResource.toLowerCase()} response schema`;
      }
    }
  }
  /* ---------------- STEPS FIX ---------------- */

  const steps = [];
  const cleanPath = String(path || "/").trim();

  const hasHeaders =
    tc.test_data?.headers && Object.keys(tc.test_data.headers).length > 0;
  const hasQueryParams =
    tc.test_data?.query_params &&
    Object.keys(tc.test_data.query_params).length > 0;
  const hasPathParams =
    tc.test_data?.path_params &&
    Object.keys(tc.test_data.path_params).length > 0;
  const hasBody =
    method !== "GET" &&
    tc.test_data?.request_body !== undefined &&
    tc.test_data?.request_body !== null &&
    !(
      typeof tc.test_data.request_body === "object" &&
      !Array.isArray(tc.test_data.request_body) &&
      Object.keys(tc.test_data.request_body).length === 0
    );

  const sendVariants = [
    "Send the request.",
    "Execute the request.",
    "Submit the API call.",
  ];
  const sendStep = sendVariants[cleanPath.length % sendVariants.length];

  if (testType === "schema") {
    steps.push(`Set HTTP method to ${method}.`);
    steps.push(`Use endpoint path: ${cleanPath}.`);

    if (hasHeaders) {
      steps.push(`Add required headers.`);
    }

    if (hasPathParams) {
      steps.push(`Provide valid path parameter values.`);
    }

    if (hasQueryParams) {
      steps.push(`Provide required query parameter values.`);
    }

    steps.push(sendStep);
    steps.push(`Capture the response body.`);
    steps.push(
      `Validate the response structure against the documented schema.`,
    );
  } else if (testType === "negative") {
    steps.push(`Set HTTP method to ${method}.`);
    steps.push(`Use endpoint path: ${cleanPath}.`);

    if (hasHeaders) {
      steps.push(`Add required headers.`);
    }

    if (hasPathParams) {
      steps.push(`Provide valid path parameter values.`);
    }

    if (hasQueryParams) {
      steps.push(`Provide required query parameter values.`);
    }

    if (hasBody) {
      steps.push(`Provide a valid request body first.`);
    }

    steps.push(
      `Modify the request with invalid, unsupported, or missing input.`,
    );
    steps.push(sendStep);
  } else {
    steps.push(`Set HTTP method to ${method}.`);
    steps.push(`Use endpoint path: ${cleanPath}.`);

    if (hasHeaders) {
      steps.push(`Add required headers.`);
    }

    if (hasPathParams) {
      steps.push(`Provide valid path parameter values.`);
    }

    if (hasQueryParams) {
      steps.push(`Provide required query parameter values.`);
    }

    if (hasBody) {
      steps.push(`Provide request body with required fields.`);
    }

    steps.push(sendStep);
  }

  tc.steps = steps;

  /* ---------------- EXPECTED RESULTS FIX ---------------- */

  const expected = [];

  if (testType === "contract") {
    if (method === "GET") {
      if (cleanPath.includes("opportunities")) {
        expected.push(`API returns HTTP 200.`);
        expected.push(`Response contains a list of trend opportunities.`);
        expected.push(`Each item follows the documented response structure.`);
      } else if (cleanPath.includes("auth/me")) {
        expected.push(`API returns HTTP 200.`);
        expected.push(`Response contains authenticated user details.`);
        expected.push(`Response body is valid JSON.`);
      } else {
        expected.push(`API returns HTTP 200.`);
        expected.push(`Response contains the expected resource data.`);
        expected.push(`Response body is valid JSON.`);
      }
    } else if (method === "POST") {
      if (cleanPath.includes("login")) {
        expected.push(`API returns HTTP 200.`);
        expected.push(
          `Response contains authentication success details such as token or session information.`,
        );
        expected.push(`Response body is valid JSON.`);
      } else {
        expected.push(`API returns HTTP 200 or 201.`);
        expected.push(
          `Response confirms the request was processed successfully.`,
        );
        expected.push(`Response body is valid JSON.`);
      }
    } else if (method === "DELETE") {
      expected.push(`API returns a successful deletion response.`);
      expected.push(`Requested resource is deleted or marked as removed.`);
    } else {
      expected.push(`API returns a successful response.`);
      expected.push(`Response reflects the requested operation outcome.`);
    }
  }

  if (testType === "negative") {
    if (cleanPath.includes("login")) {
      expected.push(`API rejects the login request.`);
      expected.push(
        `Error response indicates invalid, missing, or unsupported input.`,
      );
      expected.push(`No authentication token or session is created.`);
    } else {
      expected.push(`API rejects the request.`);
      expected.push(`Appropriate client error status code is returned (4xx).`);
      expected.push(
        `Error response clearly indicates invalid, missing, or unsupported input.`,
      );
    }
  }

  if (testType === "schema") {
    if (cleanPath.includes("auth/me")) {
      expected.push(`API returns HTTP 200.`);
      expected.push(`Response contains authenticated user details.`);
      expected.push(`All required schema fields are present.`);
      expected.push(`Field data types match the documented schema.`);
    } else {
      expected.push(`Response matches the documented schema.`);
      expected.push(`All required fields are present.`);
      expected.push(`Field data types match the schema definition.`);
    }
  }

  tc.expected_results = expected;

  /* ---------------- CLEANUP ---------------- */

  if (method === "GET") {
    delete tc.test_data.request_body;
  }

  return tc;
}

export async function generateCasesForEndpoints(endpoints, options = {}) {
  const allCases = [];

  for (const endpoint of endpoints || []) {
    const cases = await generateCasesForEndpoint(endpoint, options);
    const formattedCases = cases.map((tc) => formatGeneratedCase(tc, endpoint));
    allCases.push(...formattedCases);
  }

  return dedupeCases(allCases);
}
