function buildModuleName(endpoint) {
  const tags = Array.isArray(endpoint?.tags) ? endpoint.tags : [];
  const firstTag = tags.find((tag) => String(tag || "").trim());

  if (firstTag) return `${String(firstTag).trim()} API`;
  return `${endpoint?.method || "API"} ${endpoint?.path || ""}`.trim();
}
function buildSchemaTitle(endpoint, scenario) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";

  const resource =
    path
      .split("/")
      .filter(Boolean)
      .filter((p) => !p.startsWith("{"))
      .pop() || "resource";

  const name = resource.replace(/[_-]+/g, " ");

  const map = {
    response: `Validate ${name} response schema`,
    required_fields: `Ensure required fields are present in ${name} response`,
    field_types: `Validate data types in ${name} response`,
    enum: `Validate enum values in ${name} response`,
    nested: `Validate nested objects in ${name} response`,
    array: `Validate array structure in ${name} response`,
    format: `Validate field formats in ${name} response`,
    numeric: `Validate numeric constraints in ${name} response`,
    string: `Validate string length constraints in ${name} response`,
    pattern: `Validate pattern constraints in ${name} response`,
    composition: `Validate composed schema rules for ${name}`,
    request_body: `Validate request payload schema for ${name}`,
  };

  return map[scenario] || `Validate schema for ${name}`;
}

function isObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
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

function walkSchema(schema, visit, seen = new Set()) {
  if (!schema || typeof schema !== "object") return;
  if (seen.has(schema)) return;

  seen.add(schema);
  visit(schema);

  if (schema.properties && typeof schema.properties === "object") {
    for (const child of Object.values(schema.properties)) {
      walkSchema(child, visit, seen);
    }
  }

  if (schema.items && typeof schema.items === "object") {
    walkSchema(schema.items, visit, seen);
  }

  for (const key of ["oneOf", "anyOf", "allOf"]) {
    if (Array.isArray(schema[key])) {
      for (const child of schema[key]) {
        walkSchema(child, visit, seen);
      }
    }
  }

  if (
    schema.additionalProperties &&
    typeof schema.additionalProperties === "object"
  ) {
    walkSchema(schema.additionalProperties, visit, seen);
  }
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

function buildPathParams(endpoint) {
  const out = {};
  const pathParams = Array.isArray(endpoint?.params?.path)
    ? endpoint.params.path
    : [];

  for (const p of pathParams) {
    const name = String(p?.name || "").trim();
    if (!name) continue;
    out[name] = `<valid_${name}>`;
  }

  return out;
}

function buildQueryParams(endpoint) {
  const out = {};
  const query = Array.isArray(endpoint?.params?.query)
    ? endpoint.params.query
    : [];

  for (const p of query) {
    const name = String(p?.name || "").trim();
    if (!name) continue;

    out[name] = p?.required ? `<provide_valid_${name}>` : `<optional_${name}>`;
  }

  return out;
}

function buildValueFromSchema(schema, fieldName = "value") {
  const name = String(fieldName || "value").toLowerCase();

  if (!schema || typeof schema !== "object") {
    return `<valid_${fieldName}>`;
  }

  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;

  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return schema.enum[0];
  }

  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    return buildValueFromSchema(schema.oneOf[0], fieldName);
  }

  if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    return buildValueFromSchema(schema.anyOf[0], fieldName);
  }

  if (Array.isArray(schema.allOf) && schema.allOf.length > 0) {
    const merged = {};

    for (const item of schema.allOf) {
      const value = buildValueFromSchema(item, fieldName);
      if (value && typeof value === "object" && !Array.isArray(value)) {
        Object.assign(merged, value);
      }
    }

    if (Object.keys(merged).length > 0) return merged;
  }

  if (schema.type === "object" || schema.properties) {
    const out = {};
    const props =
      schema.properties && typeof schema.properties === "object"
        ? schema.properties
        : {};

    const required = Array.isArray(schema.required) ? schema.required : [];
    const propEntries = Object.entries(props);

    // Prefer required fields first
    const orderedEntries = [
      ...propEntries.filter(([key]) => required.includes(key)),
      ...propEntries.filter(([key]) => !required.includes(key)),
    ];

    for (const [key, value] of orderedEntries) {
      out[key] = buildValueFromSchema(value, key);
    }

    return out;
  }

  if (schema.type === "array" || schema.items) {
    return [buildValueFromSchema(schema.items || {}, `${fieldName}_item`)];
  }

  // ---- semantic value generation ----

  if (name.includes("email")) return "qa.user@example.com";
  if (name.includes("password")) return "ValidPassword123!";
  if (name.includes("username")) return "qa_user";
  if (name === "name" || name.endsWith("_name")) return "QA Test User";
  if (name.includes("first_name")) return "QA";
  if (name.includes("last_name")) return "User";
  if (name.includes("phone") || name.includes("mobile")) return "9876543210";
  if (name.includes("token")) return "sample_token_123";
  if (name.includes("session")) return "sample_session_123";
  if (name === "id" || name.endsWith("_id")) return "12345";
  if (name.includes("url") || name.includes("uri"))
    return "https://example.com";
  if (name.includes("city")) return "Mumbai";
  if (name.includes("country")) return "India";
  if (name.includes("address")) return "123 Test Street";
  if (name.includes("zip") || name.includes("postal")) return "400001";

  if (schema.format === "email") return "qa.user@example.com";
  if (schema.format === "uuid") return "123e4567-e89b-12d3-a456-426614174000";
  if (schema.format === "date-time") return "2026-01-01T00:00:00Z";
  if (schema.format === "date") return "2026-01-01";
  if (schema.format === "uri" || schema.format === "url")
    return "https://example.com";

  if (schema.type === "boolean") return true;
  if (schema.type === "integer") return 1;
  if (schema.type === "number") return 1.5;
  if (schema.type === "string") return `<valid_${fieldName}>`;

  return `<valid_${fieldName}>`;
}
function buildRequestBody(endpoint) {
  const schema = getRequestSchema(endpoint);
  if (!schema) return null;
  return buildValueFromSchema(schema, "request_body");
}

function getResponseSchema(endpoint) {
  for (const [, response] of getSuccessResponses(endpoint)) {
    const schema = getJsonSchemaFromContent(response?.content);
    if (schema) return schema;
  }

  return null;
}

function getRequestSchema(endpoint) {
  return getJsonSchemaFromContent(endpoint?.requestBody?.content);
}

function getSchemaRequiredFields(schema) {
  return Array.isArray(schema?.required) ? schema.required.slice(0, 20) : [];
}

function getSchemaProperties(schema) {
  return isObject(schema?.properties)
    ? Object.keys(schema.properties).slice(0, 20)
    : [];
}

function getSchemaEnumFields(schema) {
  const out = [];

  walkSchema(schema, (node) => {
    if (!isObject(node?.properties)) return;

    for (const [key, val] of Object.entries(node.properties)) {
      if (Array.isArray(val?.enum) && val.enum.length > 0) {
        out.push(key);
      }
    }
  });

  return Array.from(new Set(out)).slice(0, 10);
}

function getSchemaNestedObjectFields(schema) {
  const out = [];

  walkSchema(schema, (node) => {
    if (!isObject(node?.properties)) return;

    for (const [key, val] of Object.entries(node.properties)) {
      if (val?.type === "object" || !!val?.properties) {
        out.push(key);
      }
    }
  });

  return Array.from(new Set(out)).slice(0, 10);
}

function getSchemaArrayFields(schema) {
  const out = [];

  walkSchema(schema, (node) => {
    if (!isObject(node?.properties)) return;

    for (const [key, val] of Object.entries(node.properties)) {
      if (val?.type === "array" || !!val?.items) {
        out.push(key);
      }
    }
  });

  return Array.from(new Set(out)).slice(0, 10);
}

function getSchemaFormatFields(schema) {
  const out = [];

  walkSchema(schema, (node) => {
    if (!isObject(node?.properties)) return;

    for (const [key, val] of Object.entries(node.properties)) {
      if (typeof val?.format === "string") {
        out.push(`${key}(${val.format})`);
      }
    }
  });

  return Array.from(new Set(out)).slice(0, 10);
}

function getSchemaNumericConstraintFields(schema) {
  const out = [];

  walkSchema(schema, (node) => {
    if (!isObject(node?.properties)) return;

    for (const [key, val] of Object.entries(node.properties)) {
      if (
        val?.minimum !== undefined ||
        val?.maximum !== undefined ||
        val?.exclusiveMinimum !== undefined ||
        val?.exclusiveMaximum !== undefined
      ) {
        out.push(key);
      }
    }
  });

  return Array.from(new Set(out)).slice(0, 10);
}

function getSchemaStringConstraintFields(schema) {
  const out = [];

  walkSchema(schema, (node) => {
    if (!isObject(node?.properties)) return;

    for (const [key, val] of Object.entries(node.properties)) {
      if (val?.minLength !== undefined || val?.maxLength !== undefined) {
        out.push(key);
      }
    }
  });

  return Array.from(new Set(out)).slice(0, 10);
}

function getSchemaPatternFields(schema) {
  const out = [];

  walkSchema(schema, (node) => {
    if (!isObject(node?.properties)) return;

    for (const [key, val] of Object.entries(node.properties)) {
      if (typeof val?.pattern === "string") {
        out.push(key);
      }
    }
  });

  return Array.from(new Set(out)).slice(0, 10);
}

function hasSchemaComposition(schema) {
  let found = false;

  walkSchema(schema, (node) => {
    if (
      found ||
      (Array.isArray(node?.oneOf) && node.oneOf.length > 0) ||
      (Array.isArray(node?.anyOf) && node.anyOf.length > 0) ||
      (Array.isArray(node?.allOf) && node.allOf.length > 0)
    ) {
      found = true;
    }
  });

  return found;
}

function getSuccessStatus(endpoint) {
  const successCodes = getSuccessResponses(endpoint).map(([code]) =>
    Number(code),
  );
  if (successCodes.length > 0) return successCodes[0];

  const status = endpoint?.response?.status;
  if (typeof status === "number") return status;

  return 200;
}

function hasRequestBody(endpoint) {
  return !!getRequestSchema(endpoint);
}

function describeSchemaType(schema = {}) {
  if (schema?.type) return schema.type;
  if (schema?.properties) return "object";
  if (schema?.items) return "array";
  return "value";
}

function getActualRequestBody(endpoint) {
  const body =
    endpoint?._resolvedTestData?.valid?.body ?? buildRequestBody(endpoint);

  return body && typeof body === "object" && !Array.isArray(body) ? body : {};
}

function getActualRequestBodyFields(endpoint) {
  return Object.keys(getActualRequestBody(endpoint));
}

function getRequestSchemaPropertyMap(endpoint) {
  const schema = getRequestSchema(endpoint);
  const props = isObject(schema?.properties) ? schema.properties : {};
  return props;
}

function buildFormatAssertion(fieldName, format, prefix = "Response field") {
  const fmt = String(format || "").toLowerCase();

  if (fmt === "email") return `${prefix} '${fieldName}' follows email format.`;
  if (fmt === "date-time") {
    return `${prefix} '${fieldName}' follows date-time format.`;
  }
  if (fmt === "date") return `${prefix} '${fieldName}' follows date format.`;
  if (fmt === "uuid") return `${prefix} '${fieldName}' follows UUID format.`;
  if (fmt === "uri" || fmt === "url") {
    return `${prefix} '${fieldName}' follows URI format.`;
  }

  return `${prefix} '${fieldName}' follows documented format '${format}'.`;
}

function buildResponseAssertions(endpoint, maxFields = 5) {
  const schema = getResponseSchema(endpoint);
  const props = isObject(schema?.properties) ? schema.properties : {};
  const entries = Object.entries(props).slice(0, maxFields);
  const assertions = [];

  for (const [fieldName, fieldSchema] of entries) {
    const fieldType = describeSchemaType(fieldSchema);

    if (fieldType === "object") {
      assertions.push(
        `Response field '${fieldName}' is returned as an object.`,
      );
    } else if (fieldType === "array") {
      assertions.push(`Response field '${fieldName}' is returned as an array.`);
    } else {
      assertions.push(
        `Response field '${fieldName}' matches type '${fieldType}'.`,
      );
    }

    if (typeof fieldSchema?.format === "string") {
      assertions.push(
        buildFormatAssertion(fieldName, fieldSchema.format, "Response field"),
      );
    }

    if (Array.isArray(fieldSchema?.enum) && fieldSchema.enum.length > 0) {
      assertions.push(
        `Response field '${fieldName}' uses one of the documented enum values: ${fieldSchema.enum.join(", ")}.`,
      );
    }
  }

  return assertions;
}

function buildRequestAssertions(endpoint, maxFields = 5) {
  const actualFields = getActualRequestBodyFields(endpoint).slice(0, maxFields);
  const props = getRequestSchemaPropertyMap(endpoint);
  const assertions = [];

  for (const fieldName of actualFields) {
    const fieldSchema = props[fieldName] || {};
    const fieldType = describeSchemaType(fieldSchema);

    if (fieldType === "object") {
      assertions.push(`Request field '${fieldName}' is sent as an object.`);
    } else if (fieldType === "array") {
      assertions.push(`Request field '${fieldName}' is sent as an array.`);
    } else {
      assertions.push(
        `Request field '${fieldName}' matches type '${fieldType}'.`,
      );
    }

    if (typeof fieldSchema?.format === "string") {
      assertions.push(
        buildFormatAssertion(fieldName, fieldSchema.format, "Request field"),
      );
    }

    if (Array.isArray(fieldSchema?.enum) && fieldSchema.enum.length > 0) {
      assertions.push(
        `Request field '${fieldName}' uses one of the documented enum values: ${fieldSchema.enum.join(", ")}.`,
      );
    }
  }

  return assertions;
}

function baseCase(endpoint, { title, objective, priority = "P1" }) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const moduleName = buildModuleName(endpoint);

  return {
    id: "",
    title,
    module: moduleName,
    test_type: "schema",
    priority,
    objective,
    preconditions: [
      "The API base URL is available for the selected environment.",
      "The endpoint is deployed and reachable.",
      "Required authentication or access credentials are available if applicable.",
    ],
    test_data: {
      path_params: buildPathParams(endpoint),
      query_params: buildQueryParams(endpoint),
      headers: buildHeaders(endpoint),
      cookies: {},
      request_body: hasRequestBody(endpoint)
        ? buildRequestBody(endpoint)
        : null,
    },
    steps: [
      `Select the ${method} method.`,
      `Enter the endpoint URL using the configured base URL and path ${path}.`,
      "Add all required path parameters, query parameters, and headers.",
      ...(hasRequestBody(endpoint)
        ? ["Add a valid request body if the endpoint requires one."]
        : []),
      "Send the request.",
    ],
    expected_results: [],
    api_details: {
      method,
      path,
    },
    validation_focus: [],
    references: [],
    needs_review: false,
    review_notes: "",
  };
}

export function makeSchemaResponseTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const successStatus = getSuccessStatus(endpoint);
  const schema = getResponseSchema(endpoint);
  const requiredFields = getSchemaRequiredFields(schema);
  const allProps = getSchemaProperties(schema);

  const tc = baseCase(endpoint, {
    title: buildSchemaTitle(endpoint, "response"),
    objective:
      "Verify that the response body complies with the documented response schema, including mandatory fields and structure.",
    priority: "P1",
  });

  tc.steps.push(
    "Review the response body and compare it with the documented response schema.",
  );

  tc.expected_results = [
    `The API responds with HTTP ${successStatus}.`,
    "Response structure matches the API schema.",
    ...requiredFields
      .slice(0, 5)
      .map((field) => `Required response field '${field}' is present.`),
    ...buildResponseAssertions(endpoint, 5),
    ...(requiredFields.length === 0 && allProps.length > 0
      ? [
          `The documented response properties are structured as expected: ${allProps.join(", ")}.`,
        ]
      : []),
    "Field values follow the documented data types and structure.",
  ];

  tc.validation_focus = [
    "Response schema compliance",
    "Mandatory fields",
    "Field data types",
    "Object and array structure",
    ...allProps.slice(0, 3).map((field) => `Field:${field}`),
  ];

  return tc;
}

export function makeSchemaRequiredFieldsTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const successStatus = getSuccessStatus(endpoint);
  const schema = getResponseSchema(endpoint);
  const requiredFields = getSchemaRequiredFields(schema);

  const tc = baseCase(endpoint, {
    title: `Verify ${method} ${path} includes all required schema fields`,
    objective:
      "Verify that all required fields defined in the response schema are present in the API response.",
    priority: "P1",
  });

  tc.steps.push(
    "Review the response body and verify that all required schema fields are present.",
  );

  tc.expected_results = [
    `The API responds with HTTP ${successStatus}.`,
    "All required schema fields are present in the response.",
    ...requiredFields
      .slice(0, 8)
      .map((field) => `Required field '${field}' is present in the response.`),
    ...(requiredFields.length === 0
      ? ["Required fields are present according to the documented schema."]
      : []),
    "No mandatory field is missing from the response body.",
  ];

  tc.validation_focus = [
    "Required schema fields",
    "Response completeness",
    ...requiredFields.slice(0, 3).map((field) => `Field:${field}`),
  ];

  return tc;
}

export function makeSchemaFieldTypesTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const successStatus = getSuccessStatus(endpoint);
  const schema = getResponseSchema(endpoint);
  const props = getSchemaProperties(schema);
  const responseAssertions = buildResponseAssertions(endpoint, 5);

  const tc = baseCase(endpoint, {
    title: `Verify ${method} ${path} response field types match the schema`,
    objective:
      "Verify that response fields follow the data types documented in the response schema.",
    priority: "P1",
  });

  tc.steps.push(
    "Inspect the response body and compare field data types with the documented schema.",
  );

  tc.expected_results = [
    `The API responds with HTTP ${successStatus}.`,
    "Response fields match the documented primitive and structured data types.",
    ...responseAssertions,
    ...(props.length > 0 && responseAssertions.length === 0
      ? [
          `The tester should validate field types for documented properties such as: ${props.join(", ")}.`,
        ]
      : []),
  ];

  tc.validation_focus = [
    "Field data types",
    "Response type consistency",
    ...props.slice(0, 3).map((field) => `Field:${field}`),
  ];

  return tc;
}

export function makeSchemaEnumTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const schema = getResponseSchema(endpoint);
  const enumFields = getSchemaEnumFields(schema);
  const enumAssertions = buildResponseAssertions(endpoint, 5).filter(
    (x) => x.includes("documented enum values") || x.includes("allowed values"),
  );

  const tc = baseCase(endpoint, {
    title: `Verify ${method} ${path} returns only documented enum values`,
    objective:
      "Verify that enum fields in the response contain only documented allowed values.",
    priority: "P1",
  });

  tc.steps.push(
    "Review response fields that are defined as enums and compare them with the documented allowed values.",
  );

  tc.expected_results = [
    "All enum-based response fields contain only documented values.",
    ...enumAssertions,
    ...(enumFields.length > 0 && enumAssertions.length === 0
      ? [`Enum-constrained fields include: ${enumFields.join(", ")}.`]
      : []),
    "No undocumented enum value is returned by the API.",
  ];

  tc.validation_focus = [
    "Enum validation",
    "Allowed value enforcement",
    ...enumFields.slice(0, 3).map((field) => `Field:${field}`),
  ];

  return tc;
}

export function makeSchemaNestedObjectsTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const schema = getResponseSchema(endpoint);
  const nestedFields = getSchemaNestedObjectFields(schema);
  const objectAssertions = buildResponseAssertions(endpoint, 5).filter((x) =>
    x.includes("as an object."),
  );

  const tc = baseCase(endpoint, {
    title: `Verify ${method} ${path} nested objects follow the documented schema`,
    objective:
      "Verify that nested objects in the response body follow the documented schema structure.",
    priority: "P1",
  });

  tc.steps.push(
    "Inspect nested response objects and compare their structure with the documented schema.",
  );

  tc.expected_results = [
    "Nested objects follow the documented structure.",
    ...objectAssertions,
    ...(nestedFields.length > 0 && objectAssertions.length === 0
      ? [`Nested object fields include: ${nestedFields.join(", ")}.`]
      : []),
    "No nested object contains an unexpected schema structure.",
  ];

  tc.validation_focus = [
    "Nested object structure",
    "Response schema depth validation",
    ...nestedFields.slice(0, 3).map((field) => `Field:${field}`),
  ];

  return tc;
}

export function makeSchemaArrayTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const schema = getResponseSchema(endpoint);
  const arrayFields = getSchemaArrayFields(schema);
  const arrayAssertions = buildResponseAssertions(endpoint, 5).filter((x) =>
    x.includes("as an array."),
  );

  const tc = baseCase(endpoint, {
    title: `Verify ${method} ${path} array items follow the documented schema`,
    objective:
      "Verify that array fields in the response follow the documented item structure.",
    priority: "P1",
  });

  tc.steps.push(
    "Inspect response array fields and validate item structure against the documented schema.",
  );

  tc.expected_results = [
    "Array fields are returned in the documented structure.",
    ...arrayAssertions,
    "Array elements follow the documented item schema.",
    ...(arrayFields.length > 0 && arrayAssertions.length === 0
      ? [`Array-based fields include: ${arrayFields.join(", ")}.`]
      : []),
  ];

  tc.validation_focus = [
    "Array structure",
    "Array item schema validation",
    ...arrayFields.slice(0, 3).map((field) => `Field:${field}`),
  ];

  return tc;
}

export function makeSchemaFormatTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const schema = getResponseSchema(endpoint);
  const formatFields = getSchemaFormatFields(schema);
  const formatAssertions = buildResponseAssertions(endpoint, 5).filter((x) =>
    x.includes("follows"),
  );

  const tc = baseCase(endpoint, {
    title: `Verify ${method} ${path} formatted fields follow the documented schema format`,
    objective:
      "Verify that formatted string fields such as date-time, email, UUID, or URI follow the documented schema format.",
    priority: "P1",
  });

  tc.steps.push(
    "Inspect formatted string fields in the response and compare them with the documented schema format.",
  );

  tc.expected_results = [
    "Formatted string fields follow the documented format constraints.",
    ...formatAssertions,
    ...(formatFields.length > 0 && formatAssertions.length === 0
      ? [`Fields with documented formats include: ${formatFields.join(", ")}.`]
      : ["Formatted fields match the documented schema format."]),
    "No field violates the documented formatting rules.",
  ];

  tc.validation_focus = [
    "String format validation",
    "Format-specific field compliance",
    ...formatFields.slice(0, 3).map((field) => `Field:${field}`),
  ];

  return tc;
}

export function makeSchemaNumericConstraintsTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const schema = getResponseSchema(endpoint);
  const fields = getSchemaNumericConstraintFields(schema);

  const tc = baseCase(endpoint, {
    title: `Verify ${method} ${path} numeric fields respect schema constraints`,
    objective:
      "Verify that numeric response fields respect documented minimum and maximum constraints.",
    priority: "P1",
  });

  tc.steps.push(
    "Inspect numeric fields in the response and compare them with the documented numeric constraints.",
  );

  tc.expected_results = [
    "Numeric response fields are within documented schema bounds.",
    ...(fields.length > 0
      ? [`Numeric constrained fields include: ${fields.join(", ")}.`]
      : ["Numeric fields follow documented minimum and maximum constraints."]),
    "No numeric field violates the documented range rules.",
  ];

  tc.validation_focus = [
    "Numeric constraint validation",
    "Range compliance",
    ...fields.slice(0, 3).map((field) => `Field:${field}`),
  ];

  return tc;
}

export function makeSchemaStringConstraintsTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const schema = getResponseSchema(endpoint);
  const fields = getSchemaStringConstraintFields(schema);

  const tc = baseCase(endpoint, {
    title: `Verify ${method} ${path} string fields respect schema length constraints`,
    objective:
      "Verify that string response fields respect documented minimum and maximum length constraints.",
    priority: "P1",
  });

  tc.steps.push(
    "Inspect string fields in the response and compare them with the documented string length constraints.",
  );

  tc.expected_results = [
    "String fields respect documented length constraints.",
    ...(fields.length > 0
      ? [`String constrained fields include: ${fields.join(", ")}.`]
      : ["String fields follow documented minimum and maximum length rules."]),
    "No string field violates the documented length constraints.",
  ];

  tc.validation_focus = [
    "String length validation",
    "Length constraint compliance",
    ...fields.slice(0, 3).map((field) => `Field:${field}`),
  ];

  return tc;
}

export function makeSchemaPatternTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const schema = getResponseSchema(endpoint);
  const fields = getSchemaPatternFields(schema);

  const tc = baseCase(endpoint, {
    title: `Verify ${method} ${path} pattern-constrained fields follow the schema`,
    objective:
      "Verify that pattern-constrained response fields follow the documented regex or pattern rules.",
    priority: "P2",
  });

  tc.steps.push(
    "Inspect pattern-constrained response fields and compare them with the documented pattern requirements.",
  );

  tc.expected_results = [
    "Pattern-constrained fields follow the documented pattern rules.",
    ...(fields.length > 0
      ? [`Pattern-constrained fields include: ${fields.join(", ")}.`]
      : ["Pattern-constrained fields follow the documented schema behavior."]),
    "No field violates the documented pattern constraints.",
  ];

  tc.validation_focus = [
    "Pattern validation",
    "Regex constraint compliance",
    ...fields.slice(0, 3).map((field) => `Field:${field}`),
  ];

  return tc;
}

export function makeSchemaCompositionTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const responseSchema = getResponseSchema(endpoint);
  const requestSchema = getRequestSchema(endpoint);

  const tc = baseCase(endpoint, {
    title: `Verify ${method} ${path} composed schema rules are respected`,
    objective:
      "Verify that composed schema definitions such as oneOf, anyOf, or allOf are respected by the API structure.",
    priority: "P1",
  });

  tc.steps.push(
    "Review composed schema definitions and validate the API structure against them.",
  );

  tc.expected_results = [
    "The API response or request structure follows documented composed schema rules.",
    ...(hasSchemaComposition(responseSchema) ||
    hasSchemaComposition(requestSchema)
      ? [
          "Composed schema definitions such as oneOf, anyOf, or allOf are applied correctly.",
        ]
      : ["Schema composition behavior follows the documented contract."]),
    "No schema composition rule is violated.",
  ];

  tc.validation_focus = [
    "Schema composition validation",
    "oneOf/anyOf/allOf compliance",
  ];

  tc.needs_review = true;
  tc.review_notes =
    "Review the exact branch selection and composition logic for this endpoint.";

  return tc;
}

export function makeSchemaRequestBodyTemplate(endpoint) {
  const method = String(endpoint?.method || "POST").toUpperCase();
  const path = endpoint?.path || "/";
  const requestSchema = getRequestSchema(endpoint);
  const requiredFields = getSchemaRequiredFields(requestSchema);
  const props = getSchemaProperties(requestSchema);
  const actualBodyFields = getActualRequestBodyFields(endpoint);

  const tc = baseCase(endpoint, {
    title:
      actualBodyFields.length > 0
        ? `Verify ${method} ${path} accepts a valid schema-compliant request payload`
        : `Verify ${method} ${path} accepts a request body that matches the documented schema`,
    objective:
      "Verify that the request body used for the endpoint follows the documented request schema and is accepted by the API.",
    priority: "P1",
  });

  tc.steps.push(
    "Prepare the request body according to the documented schema.",
    "Review the response to confirm the API accepts the schema-compliant payload.",
  );

  tc.expected_results = [
    "The provided request body follows the documented request schema for the fields included in this payload.",
    ...requiredFields
      .slice(0, 5)
      .map(
        (field) =>
          `Documented required request field '${field}' is supported when provided.`,
      ),
    ...buildRequestAssertions(endpoint, 5),
    ...(actualBodyFields.length > 0
      ? [
          `This test payload includes these request fields: ${actualBodyFields.join(", ")}.`,
        ]
      : []),
    ...(requiredFields.length === 0 &&
    props.length > 0 &&
    actualBodyFields.length === 0
      ? [`Documented request fields include: ${props.join(", ")}.`]
      : []),
    "API accepts the request with valid schema-compliant payload.",
    "No schema-related validation failure occurs for the provided valid payload.",
  ];

  tc.validation_focus = [
    "Request body schema compliance",
    "Provided request payload fields",
    "Request field types",
    "Acceptance of valid payload",
    ...actualBodyFields.slice(0, 3).map((field) => `Field:${field}`),
  ];

  if (actualBodyFields.length > 0) {
    tc.review_notes =
      "This case validates the actual fields included in the generated payload, not every documented schema property.";
  }

  return tc;
}
