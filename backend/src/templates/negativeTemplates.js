function isObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function buildNegativeTitle(endpoint, scenario) {
  const path = endpoint?.path || "/";

  const resource =
    path
      .split("/")
      .filter(Boolean)
      .filter((p) => !p.startsWith("{"))
      .pop() || "resource";

  const name = resource.replace(/[_-]+/g, " ");

  const map = {
    missing_query: "Reject request when required query parameter is missing",
    missing_path: "Reject request with invalid or missing path parameter",
    unsupported_method: `Reject unsupported HTTP method for ${name}`,
    invalid_content_type: "Reject request with unsupported content type",
    malformed_json: "Reject malformed JSON request",
    empty_body: "Reject empty request body when payload is required",
    not_found: `Return error for non-existent ${name}`,
    invalid_type: "Reject invalid query parameter type",
    invalid_enum: "Reject value outside allowed enum",
    invalid_format: "Reject invalid formatted field value",
    string_too_long: "Reject value exceeding maximum length",
    numeric_above_max: "Reject value above allowed maximum",
    additional_property: "Reject unexpected additional fields",
    conflict: "Return conflict response for duplicate or invalid state",
    rate_limit: "Return rate limit error when threshold is exceeded",
    invalid_pagination: "Reject invalid pagination parameters",
    null_required: "Reject null value for required field",
  };

  return map[scenario] || `Reject invalid request for ${name}`;
}

function buildModuleName(endpoint) {
  const tags = Array.isArray(endpoint?.tags) ? endpoint.tags : [];
  const firstTag = tags.find((tag) => String(tag || "").trim());

  if (firstTag) return `${String(firstTag).trim()} API`;
  return `${endpoint?.method || "API"} ${endpoint?.path || ""}`.trim();
}

function getJsonSchemaFromContent(content) {
  if (!content || typeof content !== "object") return null;

  if (content["application/json"]?.schema) {
    return content["application/json"].schema;
  }

  if (content["application/*+json"]?.schema) {
    return content["application/*+json"].schema;
  }

  for (const [mediaType, mediaDef] of Object.entries(content)) {
    if (mediaDef?.schema && mediaType.toLowerCase().includes("json")) {
      return mediaDef.schema;
    }
  }

  for (const mediaDef of Object.values(content)) {
    if (mediaDef?.schema) return mediaDef.schema;
  }

  return null;
}

function getSuccessResponses(endpoint) {
  const responses = endpoint?.responses || {};
  return Object.entries(responses)
    .filter(([code]) => /^2\d\d$/.test(String(code)))
    .sort(([a], [b]) => Number(a) - Number(b));
}

function walkSchema(schema, visit, seen = new Set(), path = []) {
  if (!schema || typeof schema !== "object") return;
  if (seen.has(schema)) return;

  seen.add(schema);
  visit(schema, path);

  if (isObject(schema.properties)) {
    for (const [key, child] of Object.entries(schema.properties)) {
      walkSchema(child, visit, seen, [...path, key]);
    }
  }

  if (schema.items && typeof schema.items === "object") {
    walkSchema(schema.items, visit, seen, [...path, "[]"]);
  }

  for (const key of ["oneOf", "anyOf", "allOf"]) {
    if (Array.isArray(schema[key])) {
      schema[key].forEach((child, idx) => {
        walkSchema(child, visit, seen, [...path, `${key}[${idx}]`]);
      });
    }
  }

  if (
    schema.additionalProperties &&
    typeof schema.additionalProperties === "object"
  ) {
    walkSchema(schema.additionalProperties, visit, seen, [
      ...path,
      "additionalProperties",
    ]);
  }
}

function getResolvedValidRequest(endpoint) {
  const resolved = endpoint?._resolvedTestData || {};

  return {
    path_params: resolved?.valid?.path || {},
    query_params: resolved?.valid?.query || {},
    headers: resolved?.valid?.headers || {},
    cookies: resolved?.valid?.cookies || {},
    request_body:
      resolved?.valid?.body !== undefined ? resolved.valid.body : null,
  };
}

function buildPathParams(endpoint) {
  const resolved = getResolvedValidRequest(endpoint);
  return resolved.path_params || {};
}

function buildQueryParams(endpoint) {
  const resolved = getResolvedValidRequest(endpoint);
  return resolved.query_params || {};
}

function buildHeaders(endpoint) {
  const resolved = getResolvedValidRequest(endpoint);
  return resolved.headers || {};
}

function buildCookies(endpoint) {
  const resolved = getResolvedValidRequest(endpoint);
  return resolved.cookies || {};
}

function buildRequestBody(endpoint) {
  const resolved = getResolvedValidRequest(endpoint);
  return resolved.request_body !== undefined ? resolved.request_body : null;
}

function hasRequestBody(endpoint) {
  return !!getRequestSchema(endpoint);
}

function getRequiredQueryParam(endpoint) {
  return (
    (Array.isArray(endpoint?.params?.query) ? endpoint.params.query : []).find(
      (p) => p?.required,
    ) || null
  );
}

function getRequiredPathParam(endpoint) {
  return (
    (Array.isArray(endpoint?.params?.path) ? endpoint.params.path : []).find(
      (p) => p?.required,
    ) || null
  );
}

function getRequestSchema(endpoint) {
  const oas3Schema = getJsonSchemaFromContent(endpoint?.requestBody?.content);
  if (oas3Schema) return oas3Schema;

  const bodyParams = Array.isArray(endpoint?.params?.body)
    ? endpoint.params.body
    : [];
  if (bodyParams[0]?.schema) return bodyParams[0].schema;

  return null;
}
function getResponseSchema(endpoint) {
  for (const [, response] of getSuccessResponses(endpoint)) {
    const oas3Schema = getJsonSchemaFromContent(response?.content);
    if (oas3Schema) return oas3Schema;

    if (response?.schema) return response.schema;
  }
  return null;
}

function getFirstQueryParamWithType(endpoint) {
  const query = Array.isArray(endpoint?.params?.query)
    ? endpoint.params.query
    : [];

  return (
    query.find((p) => {
      const s = p?.schema || {};
      return !!s.type || !!s.format;
    }) || null
  );
}

function getFirstEnumField(endpoint) {
  const schemas = [getRequestSchema(endpoint), getResponseSchema(endpoint)];

  for (const schema of schemas) {
    let found = null;

    walkSchema(schema, (node, path) => {
      if (found) return;
      if (Array.isArray(node?.enum) && node.enum.length > 0) {
        const fieldName = path[path.length - 1];
        if (typeof fieldName === "string" && fieldName !== "[]") {
          found = { name: fieldName, schema: node };
        }
      }
    });

    if (found) return found;
  }

  return null;
}

function getFirstFormatField(endpoint) {
  const schemas = [getRequestSchema(endpoint), getResponseSchema(endpoint)];

  for (const schema of schemas) {
    let found = null;

    walkSchema(schema, (node, path) => {
      if (found) return;
      if (typeof node?.format === "string") {
        const fieldName = path[path.length - 1];
        if (typeof fieldName === "string" && fieldName !== "[]") {
          found = { name: fieldName, schema: node };
        }
      }
    });

    if (found) return found;
  }

  return null;
}

function getFirstStringConstraintField(endpoint) {
  const schemas = [getRequestSchema(endpoint), getResponseSchema(endpoint)];

  for (const schema of schemas) {
    let found = null;

    walkSchema(schema, (node, path) => {
      if (found) return;
      if (node?.minLength !== undefined || node?.maxLength !== undefined) {
        const fieldName = path[path.length - 1];
        if (typeof fieldName === "string" && fieldName !== "[]") {
          found = { name: fieldName, schema: node };
        }
      }
    });

    if (found) return found;
  }

  return null;
}

function getFirstNumericConstraintField(endpoint) {
  const schemas = [getRequestSchema(endpoint), getResponseSchema(endpoint)];

  for (const schema of schemas) {
    let found = null;

    walkSchema(schema, (node, path) => {
      if (found) return;
      if (
        node?.minimum !== undefined ||
        node?.maximum !== undefined ||
        node?.exclusiveMinimum !== undefined ||
        node?.exclusiveMaximum !== undefined
      ) {
        const fieldName = path[path.length - 1];
        if (typeof fieldName === "string" && fieldName !== "[]") {
          found = { name: fieldName, schema: node };
        }
      }
    });

    if (found) return found;
  }

  return null;
}

function getFirstPatternField(endpoint) {
  const schemas = [getRequestSchema(endpoint), getResponseSchema(endpoint)];

  for (const schema of schemas) {
    let found = null;

    walkSchema(schema, (node, path) => {
      if (found) return;
      if (typeof node?.pattern === "string") {
        const fieldName = path[path.length - 1];
        if (typeof fieldName === "string" && fieldName !== "[]") {
          found = { name: fieldName, schema: node };
        }
      }
    });

    if (found) return found;
  }

  return null;
}

function getFirstResolvedNegative(endpoint, bucketName) {
  const list = endpoint?._resolvedTestData?.negative?.[bucketName];
  return Array.isArray(list) && list.length > 0 ? list[0] : null;
}

function applyResolvedNegativeRequest(tc, resolvedNegative) {
  if (!resolvedNegative?.request) return tc;

  tc.test_data = {
    path_params: resolvedNegative.request.path_params || {},
    query_params: resolvedNegative.request.query_params || {},
    headers: resolvedNegative.request.headers || {},
    cookies: resolvedNegative.request.cookies || {},
    request_body:
      resolvedNegative.request.request_body !== undefined
        ? resolvedNegative.request.request_body
        : null,
  };

  return tc;
}

function baseNegativeCase(endpoint, { title, objective, priority = "high" }) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const moduleName = buildModuleName(endpoint);
  const resolved = getResolvedValidRequest(endpoint);

  return {
    id: "",
    title,
    module: moduleName,
    test_type: "negative",
    priority,
    objective,
    preconditions: [
      "The API base URL is available for the selected environment.",
      "The endpoint is deployed and reachable.",
      "Any required authentication or access credentials are available if applicable.",
    ],
    test_data: {
      path_params: resolved.path_params || {},
      query_params: resolved.query_params || {},
      headers: resolved.headers || {},
      cookies: resolved.cookies || {},
      request_body: hasRequestBody(endpoint) ? resolved.request_body : null,
    },
    steps: [
      "Open an API client such as Postman or any approved API testing tool.",
      `Select the ${method} method.`,
      `Enter the endpoint URL using the configured base URL and path ${path}.`,
    ],
    expected_results: [],
    api_details: {
      method,
      path,
    },
    validation_focus: [],
    references: [],
    needs_review: true,
    review_notes: "",
  };
}

export function makeNegativeMissingRequiredQueryTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const requiredQuery = getRequiredQueryParam(endpoint);
  const missingParamName = requiredQuery?.name || "required_query_param";

  const tc = baseNegativeCase(endpoint, {
    title: buildNegativeTitle(endpoint, "missing_query"),
    objective:
      "Verify that the API rejects the request when a required query parameter is not provided.",
    priority: "high",
  });

  const resolvedNegative = getFirstResolvedNegative(
    endpoint,
    "missingRequired",
  );
  if (resolvedNegative?.location === "query") {
    applyResolvedNegativeRequest(tc, resolvedNegative);
  } else {
    const validQuery = { ...(buildQueryParams(endpoint) || {}) };
    delete validQuery[missingParamName];
    tc.test_data.query_params = validQuery;
    tc.test_data.request_body = null;
  }

  tc.steps.push(
    `Add all normally required query parameters except '${missingParamName}'.`,
    "Add required headers if applicable.",
    "Send the request.",
  );

  tc.expected_results = [
    "The API rejects the request.",
    "A client-side error response is returned, such as HTTP 400 or HTTP 422.",
    `The error response indicates that required query parameter '${missingParamName}' is missing or invalid.`,
  ];

  tc.validation_focus = [
    "Required query parameter validation",
    "Client error handling",
    "Negative request validation",
  ];

  tc.references = [
    "template_key:negative.missing_required_query",
    `field:${missingParamName}`,
  ];

  tc.review_notes = `Confirm the exact required query parameter and expected error response format for ${path}.`;

  return tc;
}

export function makeNegativeMissingRequiredPathTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const requiredPath = getRequiredPathParam(endpoint);
  const missingParamName = requiredPath?.name || "required_path_param";

  const tc = baseNegativeCase(endpoint, {
    title: buildNegativeTitle(endpoint, "missing_query"),
    objective:
      "Verify that the API rejects or fails safely when a required path parameter is omitted or malformed.",
    priority: "high",
  });

  const resolvedNegative = getFirstResolvedNegative(
    endpoint,
    "missingRequired",
  );
  if (resolvedNegative?.location === "path") {
    applyResolvedNegativeRequest(tc, resolvedNegative);
  } else {
    tc.test_data.path_params = {
      ...(buildPathParams(endpoint) || {}),
      [missingParamName]: "",
    };
  }

  tc.steps.push(
    `Prepare the endpoint request without a valid value for path parameter '${missingParamName}'.`,
    "Add any other required query parameters and headers.",
    "Send the request.",
  );

  tc.expected_results = [
    "The API does not process the request as a valid resource request.",
    "A client-side error response is returned, such as HTTP 400 or HTTP 404.",
    `The error response indicates that path parameter '${missingParamName}' or resource identifier is invalid or missing.`,
  ];

  tc.validation_focus = [
    "Path parameter validation",
    "Malformed resource identifier handling",
    "Negative request validation",
  ];

  tc.references = [
    "template_key:negative.missing_required_path",
    `field:${missingParamName}`,
  ];

  tc.review_notes = `Confirm how ${path} behaves when path parameter '${missingParamName}' is omitted or malformed.`;

  return tc;
}

export function makeNegativeUnsupportedMethodTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";

  const invalidMethod =
    method === "GET"
      ? "POST"
      : method === "POST"
        ? "DELETE"
        : method === "DELETE"
          ? "POST"
          : "GET";

  const tc = baseNegativeCase(endpoint, {
    title: `Verify ${path} rejects unsupported HTTP methods`,
    objective:
      "Verify that the API rejects requests made with an unsupported HTTP method.",
    priority: "medium",
  });

  tc.steps[1] = `Select an unsupported method such as ${invalidMethod}.`;
  tc.steps.push(
    "Add required parameters and headers if applicable.",
    "Send the request using the unsupported HTTP method.",
  );

  tc.expected_results = [
    "The API rejects the request made with the unsupported method.",
    "A suitable response such as HTTP 405 or another documented client error is returned.",
    "The response clearly indicates that the method is not allowed or unsupported.",
  ];

  tc.validation_focus = [
    "HTTP method enforcement",
    "Method-not-allowed handling",
    "Negative protocol validation",
  ];

  tc.references = [
    "template_key:negative.unsupported_method",
    `unsupported_method:${invalidMethod}`,
  ];

  tc.review_notes = `Confirm the expected unsupported-method response code for ${path}.`;

  return tc;
}

export function makeNegativeInvalidContentTypeTemplate(endpoint) {
  const method = String(endpoint?.method || "POST").toUpperCase();
  const path = endpoint?.path || "/";

  const tc = baseNegativeCase(endpoint, {
    title: `Verify ${method} ${path} rejects unsupported Content-Type header`,
    objective:
      "Verify that the API rejects requests sent with an invalid or unsupported Content-Type header.",
    priority: "high",
  });

  tc.test_data.headers = {
    ...(tc.test_data.headers || {}),
    "Content-Type": "text/plain",
  };
  tc.test_data.request_body = hasRequestBody(endpoint)
    ? buildRequestBody(endpoint)
    : {};

  tc.steps.push(
    "Set the Content-Type header to an unsupported media type such as text/plain.",
    "Add a request body if the endpoint expects one.",
    "Send the request.",
  );

  tc.expected_results = [
    "The API rejects the request.",
    "A client-side error response such as HTTP 400 or HTTP 415 is returned.",
    "The response indicates that the request media type is invalid or unsupported.",
  ];

  tc.validation_focus = [
    "Request media type validation",
    "Content-Type enforcement",
    "Negative request validation",
  ];

  tc.references = ["template_key:negative.invalid_content_type"];

  tc.review_notes = `Confirm the exact invalid Content-Type response code for ${path}.`;

  return tc;
}

export function makeNegativeMalformedJsonTemplate(endpoint) {
  const method = String(endpoint?.method || "POST").toUpperCase();
  const path = endpoint?.path || "/";

  const tc = baseNegativeCase(endpoint, {
    title: `Verify ${method} ${path} rejects malformed JSON request body`,
    objective:
      "Verify that the API rejects syntactically invalid JSON request payloads.",
    priority: "high",
  });

  tc.test_data.headers = {
    ...(tc.test_data.headers || {}),
    "Content-Type": "application/json",
  };
  tc.test_data.request_body = "{ invalid_json: true ";

  tc.steps.push(
    "Set the Content-Type header to application/json.",
    "Send a malformed JSON body that cannot be parsed correctly.",
    "Send the request.",
  );

  tc.expected_results = [
    "The API rejects the malformed JSON payload.",
    "A client-side error response such as HTTP 400 is returned.",
    "The response indicates that the request body is not valid JSON.",
  ];

  tc.validation_focus = [
    "Malformed JSON handling",
    "Request parsing validation",
    "Negative request validation",
  ];

  tc.references = ["template_key:negative.malformed_json"];

  tc.review_notes = `Confirm the exact malformed JSON error response for ${path}.`;

  return tc;
}

export function makeNegativeEmptyBodyTemplate(endpoint) {
  const method = String(endpoint?.method || "POST").toUpperCase();
  const path = endpoint?.path || "/";

  const tc = baseNegativeCase(endpoint, {
    title: `Verify ${method} ${path} rejects empty request body when body is required`,
    objective:
      "Verify that the API rejects an empty request body when the endpoint expects a required payload.",
    priority: "high",
  });

  const resolvedNegative = getFirstResolvedNegative(
    endpoint,
    "missingRequired",
  );
  if (resolvedNegative?.location === "body") {
    applyResolvedNegativeRequest(tc, resolvedNegative);
  } else {
    tc.test_data.headers = {
      ...(tc.test_data.headers || {}),
      "Content-Type": "application/json",
    };
    tc.test_data.request_body = null;
  }

  tc.steps.push(
    "Set the Content-Type header to application/json.",
    "Send the request with an empty or missing request body.",
    "Observe the API response.",
  );

  tc.expected_results = [
    "The API rejects the empty or missing request body.",
    "A client-side error response such as HTTP 400 or HTTP 422 is returned.",
    "The response indicates that the request body or required fields are missing.",
  ];

  tc.validation_focus = [
    "Required body validation",
    "Missing payload handling",
    "Negative request validation",
  ];

  tc.references = ["template_key:negative.empty_body"];

  tc.review_notes = `Confirm whether ${path} treats empty JSON and missing body differently.`;

  return tc;
}

export function makeNegativeResourceNotFoundTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";

  const fakePathParams = { ...(buildPathParams(endpoint) || {}) };
  for (const key of Object.keys(fakePathParams)) {
    fakePathParams[key] = "999999999";
  }

  const tc = baseNegativeCase(endpoint, {
    title: `Verify ${method} ${path} returns correct error for non-existent resource`,
    objective:
      "Verify that the API returns the correct error response when a non-existent resource identifier is used.",
    priority: "high",
  });

  tc.test_data.path_params = fakePathParams;

  tc.steps.push(
    "Use a non-existent or invalid resource identifier in the path parameters.",
    "Add required query parameters and headers if applicable.",
    "Send the request.",
  );

  tc.expected_results = [
    "The API does not return a successful resource response.",
    "A not-found style response such as HTTP 404 is returned.",
    "The response indicates that the requested resource does not exist.",
  ];

  tc.validation_focus = [
    "Resource existence validation",
    "Not-found handling",
    "Negative resource lookup validation",
  ];

  tc.references = ["template_key:negative.resource_not_found"];

  tc.review_notes = `Confirm the expected not-found response code and body for ${path}.`;

  return tc;
}

export function makeNegativeInvalidQueryTypeTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const qp = getFirstQueryParamWithType(endpoint);
  const fieldName = qp?.name || "typed_query_param";

  const tc = baseNegativeCase(endpoint, {
    title: `Verify ${method} ${path} rejects invalid query parameter type`,
    objective:
      "Verify that the API rejects query parameters whose values do not match the documented type.",
    priority: "medium",
  });

  const resolvedNegative = getFirstResolvedNegative(endpoint, "invalidType");
  if (resolvedNegative?.location === "query") {
    applyResolvedNegativeRequest(tc, resolvedNegative);
  } else {
    tc.test_data.query_params = {
      ...(buildQueryParams(endpoint) || {}),
      [fieldName]: "invalid-type-value",
    };
    tc.test_data.request_body = null;
  }

  tc.steps.push(
    `Set query parameter '${fieldName}' to a value that does not match its documented type.`,
    "Send the request.",
  );

  tc.expected_results = [
    "The API rejects the request.",
    "A client-side validation error such as HTTP 400 or HTTP 422 is returned.",
    "The response indicates that the query parameter type is invalid.",
  ];

  tc.validation_focus = [
    "Query parameter type validation",
    "Client-side validation",
    "Negative input handling",
  ];

  tc.references = [
    "template_key:negative.invalid_query_type",
    `field:${fieldName}`,
  ];

  tc.review_notes = `Confirm the typed query parameter name and exact validation response for ${path}.`;

  return tc;
}

export function makeNegativeInvalidEnumTemplate(endpoint) {
  const method = String(endpoint?.method || "POST").toUpperCase();
  const path = endpoint?.path || "/";
  const enumField = getFirstEnumField(endpoint);
  const fieldName = enumField?.name || "enum_field";
  const allowed = Array.isArray(enumField?.schema?.enum)
    ? enumField.schema.enum
    : [];

  const tc = baseNegativeCase(endpoint, {
    title: `Verify ${method} ${path} rejects values outside the allowed enum set`,
    objective:
      "Verify that the API rejects request values that are not part of the documented enum.",
    priority: "high",
  });

  const resolvedNegative = getFirstResolvedNegative(endpoint, "invalidEnum");
  if (resolvedNegative) {
    applyResolvedNegativeRequest(tc, resolvedNegative);
  } else {
    tc.test_data.request_body = {
      ...(tc.test_data.request_body || {}),
      [fieldName]: "__INVALID_ENUM__",
    };
  }

  tc.steps.push(
    allowed.length > 0
      ? `Set '${fieldName}' to a value outside the documented enum: [${allowed.join(", ")}].`
      : `Set '${fieldName}' to a value outside the documented enum set.`,
    "Send the request.",
  );

  tc.expected_results = [
    "The API rejects the request.",
    "A client-side validation error such as HTTP 400 or HTTP 422 is returned.",
    "The response indicates that the supplied value is not allowed.",
  ];

  tc.validation_focus = [
    "Enum validation",
    "Request validation",
    "Negative input handling",
  ];

  tc.references = ["template_key:negative.invalid_enum", `field:${fieldName}`];

  tc.review_notes = `Confirm the enum field name and exact validation error payload for ${path}.`;

  return tc;
}

export function makeNegativeInvalidFormatTemplate(endpoint) {
  const method = String(endpoint?.method || "POST").toUpperCase();
  const path = endpoint?.path || "/";
  const fmtField = getFirstFormatField(endpoint);
  const fieldName = fmtField?.name || "format_field";
  const formatName = fmtField?.schema?.format || "documented format";

  const tc = baseNegativeCase(endpoint, {
    title: `Verify ${method} ${path} rejects invalid formatted string values`,
    objective:
      "Verify that the API rejects values that do not follow documented string format rules.",
    priority: "high",
  });

  const resolvedNegative = getFirstResolvedNegative(endpoint, "invalidFormat");
  if (resolvedNegative) {
    applyResolvedNegativeRequest(tc, resolvedNegative);
  } else {
    tc.test_data.request_body = {
      ...(buildRequestBody(endpoint) || {}),
      [fieldName]:
        formatName === "email"
          ? "not-an-email"
          : formatName === "uuid"
            ? "not-a-uuid"
            : formatName === "date"
              ? "99-99-9999"
              : formatName === "date-time"
                ? "not-a-datetime"
                : "invalid-format",
    };
  }

  tc.steps.push(
    `Set '${fieldName}' to a value that does not match the documented ${formatName} format.`,
    "Send the request.",
  );

  tc.expected_results = [
    "The API rejects the request.",
    "A client-side validation error such as HTTP 400 or HTTP 422 is returned.",
    "The response indicates that the supplied value format is invalid.",
  ];

  tc.validation_focus = [
    "Format validation",
    "Schema format compliance",
    "Negative request validation",
  ];

  tc.references = [
    "template_key:negative.invalid_format",
    `field:${fieldName}`,
  ];

  tc.review_notes = `Confirm the formatted field name and exact invalid-format response for ${path}.`;

  return tc;
}

export function makeNegativeStringTooLongTemplate(endpoint) {
  const method = String(endpoint?.method || "POST").toUpperCase();
  const path = endpoint?.path || "/";
  const field = getFirstStringConstraintField(endpoint);
  const fieldName = field?.name || "string_field";
  const maxLen = field?.schema?.maxLength;

  const tc = baseNegativeCase(endpoint, {
    title: `Verify ${method} ${path} rejects string values exceeding maximum length`,
    objective:
      "Verify that the API rejects string values that exceed documented maximum length constraints.",
    priority: "high",
  });

  const resolvedNegative = getFirstResolvedNegative(endpoint, "stringTooLong");
  if (resolvedNegative) {
    applyResolvedNegativeRequest(tc, resolvedNegative);
  } else {
    tc.test_data.request_body = {
      ...(tc.test_data.request_body || {}),
      [fieldName]:
        typeof maxLen === "number" ? "X".repeat(maxLen + 1) : "X".repeat(300),
    };
  }

  tc.steps.push(
    typeof maxLen === "number"
      ? `Set '${fieldName}' to a string longer than the maximum allowed length (${maxLen} characters).`
      : `Set '${fieldName}' to a string longer than the documented maximum length.`,
    "Send the request.",
  );

  tc.expected_results = [
    "The API rejects the request.",
    typeof maxLen === "number"
      ? `A client-side validation error such as HTTP 400 or HTTP 422 is returned because '${fieldName}' exceeds the maximum length of ${maxLen}.`
      : "A client-side validation error such as HTTP 400 or HTTP 422 is returned.",
    "The response indicates that the supplied string value is too long.",
  ];

  tc.validation_focus = [
    "String length validation",
    "Maximum length enforcement",
    "Negative input handling",
  ];

  tc.references = [
    "template_key:negative.string_too_long",
    `field:${fieldName}`,
  ];

  tc.review_notes = `Confirm the constrained string field and max-length response behavior for ${path}.`;

  return tc;
}

export function makeNegativeNumericAboveMaximumTemplate(endpoint) {
  const method = String(endpoint?.method || "POST").toUpperCase();
  const path = endpoint?.path || "/";
  const field = getFirstNumericConstraintField(endpoint);
  const fieldName = field?.name || "numeric_field";
  const maxVal = field?.schema?.maximum;

  const tc = baseNegativeCase(endpoint, {
    title: `Verify ${method} ${path} rejects numeric values above the documented maximum`,
    objective:
      "Verify that the API rejects numeric values that exceed documented maximum constraints.",
    priority: "high",
  });

  const resolvedNegative = getFirstResolvedNegative(
    endpoint,
    "numericAboveMaximum",
  );
  if (resolvedNegative) {
    applyResolvedNegativeRequest(tc, resolvedNegative);
  } else {
    tc.test_data.request_body = {
      ...(tc.test_data.request_body || {}),
      [fieldName]: typeof maxVal === "number" ? maxVal + 1 : 999999999,
    };
  }

  tc.steps.push(
    typeof maxVal === "number"
      ? `Set '${fieldName}' to a numeric value above the documented maximum (${maxVal}).`
      : `Set '${fieldName}' to a numeric value above the documented maximum.`,
    "Send the request.",
  );

  tc.expected_results = [
    "The API rejects the request.",
    typeof maxVal === "number"
      ? `A client-side validation error such as HTTP 400 or HTTP 422 is returned because '${fieldName}' exceeds the maximum value of ${maxVal}.`
      : "A client-side validation error such as HTTP 400 or HTTP 422 is returned.",
    "The response indicates that the supplied numeric value is out of range.",
  ];

  tc.validation_focus = [
    "Numeric constraint validation",
    "Maximum value enforcement",
    "Negative input handling",
  ];

  tc.references = [
    "template_key:negative.numeric_above_maximum",
    `field:${fieldName}`,
  ];

  tc.review_notes = `Confirm the constrained numeric field and out-of-range response for ${path}.`;

  return tc;
}

export function makeNegativeAdditionalPropertyTemplate(endpoint) {
  const method = String(endpoint?.method || "POST").toUpperCase();
  const path = endpoint?.path || "/";

  const tc = baseNegativeCase(endpoint, {
    title: `Verify ${method} ${path} rejects unexpected additional request fields`,
    objective:
      "Verify that the API rejects request bodies containing undocumented additional properties when strict schema enforcement is expected.",
    priority: "high",
  });

  tc.test_data.request_body = {
    ...(buildRequestBody(endpoint) || {}),
    unexpected_field: "unexpected_value",
  };

  tc.steps.push(
    "Add an undocumented additional field to the request body.",
    "Send the request.",
  );

  tc.expected_results = [
    "The API rejects the request.",
    "A client-side validation error such as HTTP 400 or HTTP 422 is returned.",
    "The response indicates that additional or unknown properties are not allowed.",
  ];

  tc.validation_focus = [
    "Strict schema validation",
    "Additional property rejection",
    "Negative request validation",
  ];

  tc.references = ["template_key:negative.additional_property"];

  tc.review_notes = `Confirm whether ${path} enforces additionalProperties=false and how unknown fields are handled.`;

  return tc;
}

export function makeNegativeConflictTemplate(endpoint) {
  const method = String(endpoint?.method || "POST").toUpperCase();
  const path = endpoint?.path || "/";

  const tc = baseNegativeCase(endpoint, {
    title: `Verify ${method} ${path} returns the correct conflict response`,
    objective:
      "Verify that the API returns the correct conflict response when the request violates a conflict or duplicate-state rule.",
    priority: "high",
  });

  tc.steps.push(
    "Prepare a request that would create a conflict or duplicate state.",
    "Send the request.",
  );

  tc.expected_results = [
    "The API rejects the request.",
    "A conflict-style response such as HTTP 409 is returned.",
    "The response indicates that the requested operation conflicts with the current resource or system state.",
  ];

  tc.validation_focus = [
    "Conflict response handling",
    "Duplicate or invalid state transition handling",
    "Business rule enforcement",
  ];

  tc.references = ["template_key:negative.conflict"];

  tc.review_notes = `Confirm the exact conflict trigger and response code for ${path}.`;

  return tc;
}

export function makeNegativeRateLimitTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";

  const tc = baseNegativeCase(endpoint, {
    title: `Verify ${method} ${path} returns the correct rate limit response`,
    objective:
      "Verify that the API returns the correct response when the allowed request rate is exceeded.",
    priority: "high",
  });

  tc.steps.push(
    "Send repeated requests quickly enough to exceed the documented rate limit.",
    "Observe the throttling response.",
  );

  tc.expected_results = [
    "The API throttles or rejects the request sequence.",
    "A rate-limit response such as HTTP 429 is returned.",
    "The response indicates that the allowed request rate has been exceeded.",
  ];

  tc.validation_focus = [
    "Rate limit handling",
    "Throttling behavior",
    "Resilience and API protection",
  ];

  tc.references = ["template_key:negative.rate_limit"];

  tc.review_notes = `Confirm the exact rate-limit threshold, headers, and 429 response structure for ${path}.`;

  return tc;
}

export function makeNegativeInvalidPaginationTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";

  const tc = baseNegativeCase(endpoint, {
    title: `Verify ${method} ${path} rejects invalid pagination parameter values`,
    objective:
      "Verify that the API rejects invalid or out-of-range pagination values.",
    priority: "medium",
  });

  tc.test_data.query_params = {
    ...(buildQueryParams(endpoint) || {}),
    page: -1,
    limit: 999999,
  };
  tc.test_data.request_body = null;

  tc.steps.push(
    "Set pagination parameters to invalid or unsupported values.",
    "Send the request.",
  );

  tc.expected_results = [
    "The API rejects the request or returns a controlled validation error.",
    "A client-side validation response such as HTTP 400 is returned.",
    "The response indicates that pagination parameter values are invalid.",
  ];

  tc.validation_focus = [
    "Pagination parameter validation",
    "Boundary handling",
    "Negative query validation",
  ];

  tc.references = ["template_key:negative.invalid_pagination"];

  tc.review_notes = `Confirm the valid pagination range and exact validation behavior for ${path}.`;

  return tc;
}

export function makeNegativeNullRequiredFieldTemplate(endpoint) {
  const method = String(endpoint?.method || "POST").toUpperCase();
  const path = endpoint?.path || "/";

  const body =
    endpoint?._resolvedTestData?.valid?.body ||
    buildRequestBody(endpoint) ||
    {};
  const resolvedNullCase = getFirstResolvedNegative(
    endpoint,
    "nullRequiredField",
  );
  const firstKey =
    resolvedNullCase?.field || Object.keys(body)[0] || "required_field";

  const tc = baseNegativeCase(endpoint, {
    title: `Verify ${method} ${path} rejects null for required fields`,
    objective:
      "Verify that the API rejects null values for fields that are required and non-nullable.",
    priority: "high",
  });

  if (resolvedNullCase) {
    applyResolvedNegativeRequest(tc, resolvedNullCase);
  } else {
    tc.test_data.request_body = {
      ...body,
      [firstKey]: null,
    };
  }

  tc.steps.push(
    `Set required field '${firstKey}' to null.`,
    "Send the request.",
  );

  tc.expected_results = [
    "The API rejects the request.",
    "A client-side validation error such as HTTP 400 or HTTP 422 is returned.",
    "The response indicates that a required field cannot be null.",
  ];

  tc.validation_focus = [
    "Required field validation",
    "Null handling",
    "Negative request validation",
  ];

  tc.references = [
    "template_key:negative.null_required_field",
    `field:${firstKey}`,
  ];

  tc.review_notes = `Confirm the actual required field name and null-validation response for ${path}.`;

  return tc;
}
