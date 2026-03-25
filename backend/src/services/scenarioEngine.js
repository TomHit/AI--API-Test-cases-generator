function ensureArray(v) {
  return Array.isArray(v) ? v : [];
}

function normalizeMethod(m) {
  return String(m || "GET").toUpperCase();
}

function lower(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function clone(value) {
  if (value === undefined) return undefined;

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function isObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function scenarioFamily(planOrId) {
  const id =
    typeof planOrId === "string"
      ? planOrId
      : String(planOrId?.scenario_id || "");
  return id.split(":")[0];
}

function scenarioSuffix(planOrId) {
  const id =
    typeof planOrId === "string"
      ? planOrId
      : String(planOrId?.scenario_id || "");
  const idx = id.indexOf(":");
  return idx >= 0 ? id.slice(idx + 1) : "";
}

function isScenario(planOrId, family) {
  return scenarioFamily(planOrId) === family;
}

function getResolved(endpoint) {
  return endpoint?._resolvedTestData || null;
}

function getSuccessResponses(endpoint) {
  const responses = endpoint?.responses || {};
  return Object.entries(responses)
    .filter(([code]) => /^2\d\d$/.test(String(code)))
    .sort(([a], [b]) => Number(a) - Number(b));
}

function getSuccessStatusCandidates(endpoint) {
  const codes = getSuccessResponses(endpoint).map(([code]) => String(code));
  return codes.length > 0 ? codes : ["200"];
}

function extractSchemaFromContent(content = {}) {
  if (!content || typeof content !== "object") return null;

  if (content["application/json"]?.schema) {
    return content["application/json"].schema;
  }

  for (const ct of Object.keys(content)) {
    if (ct.toLowerCase().includes("json") && content[ct]?.schema) {
      return content[ct].schema;
    }
  }

  for (const ct of Object.keys(content)) {
    if (content[ct]?.schema) {
      return content[ct].schema;
    }
  }

  return null;
}

function normalizeResponseSchema(schema) {
  if (!schema || typeof schema !== "object") return null;

  if (schema.$ref) return schema;
  if (schema.properties) return schema;
  if (Array.isArray(schema.required)) return schema;

  if (schema.type === "array" && schema.items) {
    return schema.items;
  }

  if (Array.isArray(schema.allOf) && schema.allOf.length > 0) {
    return schema.allOf[0];
  }

  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    return schema.oneOf[0];
  }

  if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    return schema.anyOf[0];
  }

  return schema;
}

function getResponseSchema(endpoint) {
  const content = endpoint?.response?.content || {};

  if (content["application/json"]?.schema) {
    return content["application/json"].schema;
  }

  for (const [ct, media] of Object.entries(content)) {
    if (String(ct).toLowerCase().includes("json") && media?.schema) {
      return media.schema;
    }
  }

  for (const media of Object.values(content)) {
    if (media?.schema) {
      return media.schema;
    }
  }

  return null;
}
function getTopLevelResponseFields(endpoint) {
  const schema = getResponseSchema(endpoint);
  const props =
    schema?.properties && typeof schema.properties === "object"
      ? Object.keys(schema.properties)
      : [];

  return props.slice(0, 10);
}

function getResponseRequiredFields(endpoint) {
  const schema = getResponseSchema(endpoint);
  return Array.isArray(schema?.required) ? schema.required.slice(0, 10) : [];
}

function getSchemaProperties(schema) {
  return schema?.properties && typeof schema.properties === "object"
    ? schema.properties
    : {};
}

function getRequestBodyContent(endpoint) {
  return endpoint?.requestBody?.content &&
    isObject(endpoint.requestBody.content)
    ? endpoint.requestBody.content
    : {};
}

function getSupportedContentTypes(endpoint) {
  return Object.keys(getRequestBodyContent(endpoint));
}

function getPrimaryRequestContentType(endpoint) {
  const content = getRequestBodyContent(endpoint);
  return (
    Object.keys(content).find((ct) => lower(ct).includes("json")) ||
    Object.keys(content)[0] ||
    ""
  );
}

function getRequestBodySchema(endpoint, profile = {}) {
  if (profile?.requestBodySchema) return profile.requestBodySchema;

  const content = getRequestBodyContent(endpoint);
  if (!isObject(content)) return null;

  const preferred =
    content["application/json"] ||
    content["application/*+json"] ||
    Object.values(content).find((v) => v?.schema);

  return preferred?.schema || null;
}

function getRequestBodyRequired(endpoint, profile = {}) {
  if (typeof profile?.requestBodyRequired === "boolean") {
    return profile.requestBodyRequired;
  }
  return !!endpoint?.requestBody?.required;
}

function hasRequestSchema(endpoint, profile) {
  return !!getRequestBodySchema(endpoint, profile);
}

function sampleValidValue(fieldName, fieldSchema = {}) {
  const name = lower(fieldName);

  if (fieldSchema?.example !== undefined) return clone(fieldSchema.example);
  if (fieldSchema?.default !== undefined) return clone(fieldSchema.default);

  if (Array.isArray(fieldSchema?.enum) && fieldSchema.enum.length > 0) {
    return clone(fieldSchema.enum[0]);
  }

  if (fieldSchema.type === "integer") return 1;
  if (fieldSchema.type === "number") return 1.23;
  if (fieldSchema.type === "boolean") return true;

  if (fieldSchema.type === "array") {
    if (fieldSchema.items) {
      return [sampleValidValue(`${fieldName}_item`, fieldSchema.items)];
    }
    return ["<item>"];
  }

  if (fieldSchema.type === "object") {
    return buildValidBodyFromSchema(fieldSchema, "full");
  }

  if (fieldSchema.type === "string") {
    if (fieldSchema.format === "date") return "<date_string>";
    if (fieldSchema.format === "date-time") return "<datetime_string>";
    if (fieldSchema.format === "uuid") return "<uuid_string>";
    if (fieldSchema.format === "email") return "<email_string>";
    if (fieldSchema.format === "uri" || fieldSchema.format === "url") {
      return "<url_string>";
    }
    return `<${name || "string"}>`;
  }

  return `<${name || "value"}>`;
}
function buildValidBodyFromSchema(schema, mode = "full") {
  if (!isObject(schema)) return {};

  const props = getSchemaProperties(schema);
  const required = ensureArray(schema?.required);
  const body = {};

  for (const [key, propSchema] of Object.entries(props)) {
    if (mode === "minimal" && !required.includes(key)) continue;
    body[key] = buildSchemaSampleValue(key, propSchema, mode);
  }

  return body;
}

function buildSchemaSampleValue(fieldName, fieldSchema = {}, mode = "full") {
  const name = lower(fieldName);

  if (!isObject(fieldSchema)) return "<value>";

  if (fieldSchema.example !== undefined) return clone(fieldSchema.example);
  if (fieldSchema.default !== undefined) return clone(fieldSchema.default);

  if (Array.isArray(fieldSchema.enum) && fieldSchema.enum.length > 0) {
    return clone(fieldSchema.enum[0]);
  }

  if (fieldSchema.$ref) {
    return `<${name || "value"}>`;
  }

  if (fieldSchema.type === "object" || isObject(fieldSchema.properties)) {
    return buildValidBodyFromSchema(fieldSchema, mode);
  }

  if (fieldSchema.type === "array") {
    const itemSchema = isObject(fieldSchema.items) ? fieldSchema.items : {};

    if (mode === "minimal") {
      return [buildSchemaSampleValue(`${fieldName}_item`, itemSchema, mode)];
    }

    return [
      buildSchemaSampleValue(`${fieldName}_item_1`, itemSchema, mode),
      buildSchemaSampleValue(`${fieldName}_item_2`, itemSchema, mode),
    ];
  }

  if (fieldSchema.type === "integer") {
    if (typeof fieldSchema.minimum === "number") return fieldSchema.minimum;
    if (typeof fieldSchema.maximum === "number" && fieldSchema.maximum >= 1) {
      return 1;
    }
    return 1;
  }

  if (fieldSchema.type === "number") {
    if (typeof fieldSchema.minimum === "number") return fieldSchema.minimum;
    if (typeof fieldSchema.maximum === "number" && fieldSchema.maximum >= 1) {
      return 1;
    }
    return 1.23;
  }

  if (fieldSchema.type === "boolean") return true;

  if (fieldSchema.type === "string") {
    if (fieldSchema.format === "date") return "<date_string>";
    if (fieldSchema.format === "date-time") return "<datetime_string>";
    if (fieldSchema.format === "uuid") return "<uuid_string>";
    if (fieldSchema.format === "email") return "<email_string>";
    if (fieldSchema.format === "uri" || fieldSchema.format === "url") {
      return "<url_string>";
    }
    if (fieldSchema.pattern) return `<pattern_${name || "string"}>`;
    if (
      typeof fieldSchema.minLength === "number" &&
      fieldSchema.minLength > 0
    ) {
      return "x".repeat(fieldSchema.minLength);
    }
    return `<${name || "string"}>`;
  }

  return `<${name || "value"}>`;
}

function buildBaseHeaders(profile, endpoint) {
  const headers = {
    Accept: "application/json",
  };

  const resolved = getResolved(endpoint);

  if (
    resolved?.valid?.headers &&
    Object.keys(resolved.valid.headers).length > 0
  ) {
    return clone(resolved.valid.headers);
  }

  if (profile?.requiresAuth || resolved?.auth === "required") {
    headers.Authorization = "Bearer <valid_token>";
  }

  const primaryContentType = getPrimaryRequestContentType(endpoint);
  if (endpoint?.requestBody && primaryContentType) {
    headers["Content-Type"] = primaryContentType;
  } else if (endpoint?.requestBody) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

function buildValidRequest(endpoint, profile, mode = "full") {
  const resolved = getResolved(endpoint);

  if (resolved?.valid) {
    const schema = getRequestBodySchema(endpoint, profile);

    const base = {
      path_params: clone(resolved.valid.path) || {},
      query_params: clone(resolved.valid.query) || {},
      headers: clone(resolved.valid.headers) || {},
      cookies: clone(resolved.valid.cookies) || {},
      request_body: clone(resolved.valid.body),
    };

    if (schema && isObject(schema)) {
      base.request_body = buildValidBodyFromSchema(
        schema,
        mode === "minimal" ? "minimal" : "full",
      );
    }

    return base;
  }

  const requestBodySchema = getRequestBodySchema(endpoint, profile);
  const requestBodyRequired = getRequestBodyRequired(endpoint, profile);

  const pathParams = {};
  const queryParams = {};
  const body = requestBodySchema
    ? buildValidBodyFromSchema(
        requestBodySchema,
        mode === "minimal" ? "minimal" : "full",
      )
    : requestBodyRequired
      ? {}
      : null;

  const queryDefs = ensureArray(endpoint?.params?.query);
  const pathDefs = ensureArray(endpoint?.params?.path);

  for (const p of queryDefs) {
    if (p?.required) {
      queryParams[p.name] = sampleValidValue(p.name, p?.schema || {});
    }
  }

  for (const p of pathDefs) {
    pathParams[p.name] = sampleValidValue(p.name, p?.schema || {});
  }

  return {
    path_params: pathParams,
    query_params: queryParams,
    headers: buildBaseHeaders(profile, endpoint),
    cookies: {},
    request_body: body,
  };
}

function buildInvalidFormatValue(fieldName, fieldSchema = {}) {
  const name = lower(fieldName);
  const format = lower(fieldSchema?.format);

  if (format === "email" || name.includes("email")) return "not-an-email";
  if (format === "uuid") return "not-a-uuid";
  if (format === "date") return "99-99-9999";
  if (format === "date-time") return "not-a-datetime";
  if (name === "totp" || name.includes("otp") || name.includes("code")) {
    return "12ab";
  }

  return "invalid-format";
}

function buildTooLongValue(fieldSchema = {}) {
  const maxLength =
    typeof fieldSchema?.maxLength === "number" ? fieldSchema.maxLength : 255;
  return "A".repeat(maxLength + 10);
}

function buildAboveMaximumValue(fieldSchema = {}) {
  const maximum =
    typeof fieldSchema?.maximum === "number" ? fieldSchema.maximum : 100;
  return maximum + 1;
}

function pickFirstRequiredQuery(endpoint) {
  return ensureArray(endpoint?.params?.query).find((p) => p?.required) || null;
}

function pickFirstRequiredPath(endpoint) {
  return ensureArray(endpoint?.params?.path).find((p) => p?.required) || null;
}

function getAllEnumFields(schema) {
  const props = getSchemaProperties(schema);
  return Object.entries(props)
    .filter(
      ([, fieldSchema]) =>
        Array.isArray(fieldSchema?.enum) && fieldSchema.enum.length > 0,
    )
    .map(([name, fieldSchema]) => ({ name, schema: fieldSchema }));
}

function getAllFormatFields(schema) {
  const props = getSchemaProperties(schema);
  return Object.entries(props)
    .filter(([key, fieldSchema]) => {
      const format = lower(fieldSchema?.format);
      const lowerKey = lower(key);

      return (
        !!format ||
        lowerKey.includes("email") ||
        lowerKey.includes("otp") ||
        lowerKey.includes("code")
      );
    })
    .map(([name, fieldSchema]) => ({ name, schema: fieldSchema }));
}

function getAllStringMaxLengthFields(schema) {
  const props = getSchemaProperties(schema);
  return Object.entries(props)
    .filter(
      ([, fieldSchema]) =>
        lower(fieldSchema?.type) === "string" &&
        typeof fieldSchema?.maxLength === "number",
    )
    .map(([name, fieldSchema]) => ({ name, schema: fieldSchema }));
}

function getAllNumericMaximumFields(schema) {
  const props = getSchemaProperties(schema);
  return Object.entries(props)
    .filter(
      ([, fieldSchema]) =>
        (lower(fieldSchema?.type) === "integer" ||
          lower(fieldSchema?.type) === "number") &&
        typeof fieldSchema?.maximum === "number",
    )
    .map(([name, fieldSchema]) => ({ name, schema: fieldSchema }));
}

function uniquePlans(plans = []) {
  const seen = new Set();
  const out = [];

  for (const plan of plans) {
    if (!plan?.scenario_id) continue;
    if (seen.has(plan.scenario_id)) continue;
    seen.add(plan.scenario_id);
    out.push(plan);
  }

  return out;
}

function makePlan({
  scenario_id,
  test_type,
  template_key,
  invalidate,
  keep_valid,
  expected_outcome_family,
  expected_status_candidates,
  field_target = null,
  spec_evidence = null,
}) {
  return {
    scenario_id,
    test_type,
    template_key,
    invalidate,
    keep_valid,
    expected_outcome_family,
    expected_status_candidates,
    field_target,
    spec_evidence,
    build(endpoint, profile) {
      return buildCaseFromScenarioPlan(endpoint, profile, this);
    },
  };
}

function buildContractPlans(endpoint, profile) {
  const plans = [];
  const successStatuses = getSuccessStatusCandidates(endpoint);

  plans.push(
    makePlan({
      scenario_id: "contract.success",
      test_type: "contract",
      template_key: null,
      invalidate: null,
      keep_valid: { all: true },
      expected_outcome_family: "success",
      expected_status_candidates: successStatuses,
      spec_evidence: { source: "responses.2xx" },
    }),
  );

  plans.push(
    makePlan({
      scenario_id: "contract.status_code",
      test_type: "contract",
      template_key: null,
      invalidate: null,
      keep_valid: { all: true },
      expected_outcome_family: "success",
      expected_status_candidates: successStatuses,
      spec_evidence: { source: "responses.status" },
    }),
  );

  plans.push(
    makePlan({
      scenario_id: "contract.content_type",
      test_type: "contract",
      template_key: null,
      invalidate: null,
      keep_valid: { all: true },
      expected_outcome_family: "success",
      expected_status_candidates: successStatuses,
      spec_evidence: { source: "responses.content" },
    }),
  );

  if (getResponseRequiredFields(endpoint).length > 0) {
    plans.push(
      makePlan({
        scenario_id: "contract.required_fields",
        test_type: "contract",
        template_key: null,
        invalidate: null,
        keep_valid: { all: true },
        expected_outcome_family: "success",
        expected_status_candidates: successStatuses,
        spec_evidence: { source: "response.required" },
      }),
    );
  }

  if (hasRequestSchema(endpoint, profile)) {
    plans.push(
      makePlan({
        scenario_id: "contract.request_body",
        test_type: "contract",
        template_key: null,
        invalidate: null,
        keep_valid: { all: true },
        expected_outcome_family: "success",
        expected_status_candidates: successStatuses,
        spec_evidence: { source: "requestBody" },
      }),
    );
  }

  return plans;
}

function buildSchemaPlans(endpoint, profile) {
  const plans = [];
  const responseSchema = getResponseSchema(endpoint);
  const requestSchema = getRequestBodySchema(endpoint, profile);
  const successStatuses = getSuccessStatusCandidates(endpoint);

  // Primary path: response schema exists
  if (responseSchema && typeof responseSchema === "object") {
    plans.push(
      makePlan({
        scenario_id: "schema.response",
        test_type: "schema",
        template_key: null,
        invalidate: null,
        keep_valid: { all: true },
        expected_outcome_family: "success",
        expected_status_candidates: successStatuses,
        spec_evidence: { source: "response.schema" },
      }),
    );

    if (getResponseRequiredFields(endpoint).length > 0) {
      plans.push(
        makePlan({
          scenario_id: "schema.required_fields",
          test_type: "schema",
          template_key: null,
          invalidate: null,
          keep_valid: { all: true },
          expected_outcome_family: "success",
          expected_status_candidates: successStatuses,
          spec_evidence: { source: "response.required" },
        }),
      );
    }

    if (getTopLevelResponseFields(endpoint).length > 0) {
      plans.push(
        makePlan({
          scenario_id: "schema.field_types",
          test_type: "schema",
          template_key: null,
          invalidate: null,
          keep_valid: { all: true },
          expected_outcome_family: "success",
          expected_status_candidates: successStatuses,
          spec_evidence: { source: "response.properties" },
        }),
      );
    }

    return plans;
  }

  // Fallback path: no response schema, but request body schema exists
  if (requestSchema && typeof requestSchema === "object") {
    plans.push(
      makePlan({
        scenario_id: "schema.request_body",
        test_type: "schema",
        template_key: null,
        invalidate: null,
        keep_valid: { all: true },
        expected_outcome_family: "success",
        expected_status_candidates: successStatuses,
        spec_evidence: { source: "request.schema" },
      }),
    );

    if (ensureArray(requestSchema?.required).length > 0) {
      plans.push(
        makePlan({
          scenario_id: "schema.request_required_fields",
          test_type: "schema",
          template_key: null,
          invalidate: null,
          keep_valid: { all: true },
          expected_outcome_family: "success",
          expected_status_candidates: successStatuses,
          spec_evidence: { source: "request.required" },
        }),
      );
    }

    if (Object.keys(getSchemaProperties(requestSchema)).length > 0) {
      plans.push(
        makePlan({
          scenario_id: "schema.request_field_types",
          test_type: "schema",
          template_key: null,
          invalidate: null,
          keep_valid: { all: true },
          expected_outcome_family: "success",
          expected_status_candidates: successStatuses,
          spec_evidence: { source: "request.properties" },
        }),
      );
    }
  }

  return plans;
}

function buildAutoPlansFromResolved(endpoint, profile) {
  const resolved = getResolved(endpoint);
  const autoPlans = [];
  const method = normalizeMethod(endpoint?.method);
  const requestBodySchema = getRequestBodySchema(endpoint, profile);
  const supportedContentTypes = getSupportedContentTypes(endpoint);

  if (profile?.requiresAuth || endpoint?.security?.length > 0) {
    autoPlans.push(
      makePlan({
        scenario_id: "auth.missing_credentials",
        test_type: "auth",
        template_key: null,
        invalidate: {
          location: "headers",
          field: "Authorization",
          mode: "missing",
        },
        keep_valid: {
          path: true,
          query: true,
          body: true,
          headers_other_than_target: true,
        },
        expected_outcome_family: "auth_failure",
        expected_status_candidates: ["401", "403"],
        spec_evidence: { source: "resolved.auth" },
      }),
    );

    autoPlans.push(
      makePlan({
        scenario_id: "auth.invalid_credentials",
        test_type: "auth",
        template_key: "auth.invalid_credentials",
        invalidate: {
          location: "headers",
          field: "Authorization",
          mode: "invalid",
        },
        keep_valid: {
          path: true,
          query: true,
          body: true,
          headers_other_than_target: true,
        },
        expected_outcome_family: "auth_failure",
        expected_status_candidates: ["401", "403"],
        spec_evidence: { source: "resolved.auth" },
      }),
    );
  }

  if (ensureArray(endpoint?.params?.query).some((p) => p?.required)) {
    const queryField = pickFirstRequiredQuery(endpoint)?.name || null;
    if (queryField) {
      autoPlans.push(
        makePlan({
          scenario_id: `negative.missing_required_query:${queryField}`,
          test_type: "negative",
          template_key: "negative.missing_required_query",
          invalidate: {
            location: "query",
            field: queryField,
            mode: "missing",
          },
          keep_valid: {
            auth: true,
            path: true,
            body: true,
            query_other_than_target: true,
          },
          expected_outcome_family: "validation_failure",
          expected_status_candidates: ["400", "422"],
          field_target: queryField,
          spec_evidence: { source: "endpoint.params.query.required" },
        }),
      );
    }
  }

  if (ensureArray(endpoint?.params?.path).some((p) => p?.required)) {
    const pathField = pickFirstRequiredPath(endpoint)?.name || null;
    if (pathField) {
      autoPlans.push(
        makePlan({
          scenario_id: `negative.missing_required_path:${pathField}`,
          test_type: "negative",
          template_key: "negative.missing_required_path",
          invalidate: {
            location: "path",
            field: pathField,
            mode: "missing_or_malformed",
          },
          keep_valid: {
            auth: true,
            query: true,
            body: true,
            path_other_than_target: true,
          },
          expected_outcome_family: "validation_failure",
          expected_status_candidates: ["400", "404"],
          field_target: pathField,
          spec_evidence: { source: "endpoint.params.path.required" },
        }),
      );
    }
  }

  if (method === "POST" && requestBodySchema) {
    autoPlans.push(
      makePlan({
        scenario_id: "success.min_payload",
        test_type: "contract",
        template_key: null,
        invalidate: null,
        keep_valid: { minimal_body: true },
        expected_outcome_family: "success",
        expected_status_candidates: getSuccessStatusCandidates(endpoint),
        spec_evidence: { source: "requestBody.minimal" },
      }),
    );

    autoPlans.push(
      makePlan({
        scenario_id: "success.full_payload",
        test_type: "contract",
        template_key: null,
        invalidate: null,
        keep_valid: { full_body: true },
        expected_outcome_family: "success",
        expected_status_candidates: getSuccessStatusCandidates(endpoint),
        spec_evidence: { source: "requestBody.full" },
      }),
    );
  }

  if (getRequestBodyRequired(endpoint, profile)) {
    autoPlans.push(
      makePlan({
        scenario_id: "negative.empty_body",
        test_type: "negative",
        template_key: "negative.empty_body",
        invalidate: {
          location: "body",
          field: null,
          mode: "empty_body",
        },
        keep_valid: {
          auth: true,
          path: true,
          query: true,
        },
        expected_outcome_family: "validation_failure",
        expected_status_candidates: ["400", "415", "422"],
        field_target: null,
        spec_evidence: { source: "requestBody.required" },
      }),
    );
  }

  if (supportedContentTypes.length > 0) {
    autoPlans.push(
      makePlan({
        scenario_id: "negative.unsupported_content_type",
        test_type: "negative",
        template_key: "negative.unsupported_content_type",
        invalidate: {
          location: "headers",
          field: "Content-Type",
          mode: "unsupported_content_type",
        },
        keep_valid: {
          auth: true,
          path: true,
          query: true,
          body: true,
        },
        expected_outcome_family: "validation_failure",
        expected_status_candidates: ["400", "415"],
        field_target: "Content-Type",
        spec_evidence: { source: "requestBody.content" },
      }),
    );
  }

  const enumFields = getAllEnumFields(requestBodySchema);
  for (const ef of enumFields) {
    autoPlans.push(
      makePlan({
        scenario_id: `negative.invalid_enum:${ef.name}`,
        test_type: "negative",
        template_key: "negative.invalid_enum",
        invalidate: {
          location: "body",
          field: ef.name,
          mode: "invalid_enum",
        },
        keep_valid: {
          auth: true,
          path: true,
          query: true,
          body_other_than_target: true,
        },
        expected_outcome_family: "validation_failure",
        expected_status_candidates: ["400", "422"],
        field_target: ef.name,
        spec_evidence: { source: "requestBody.enum" },
      }),
    );
  }

  const requiredFields = ensureArray(requestBodySchema?.required);
  for (const field of requiredFields) {
    autoPlans.push(
      makePlan({
        scenario_id: `negative.null_required_field:${field}`,
        test_type: "negative",
        template_key: "negative.null_required_field",
        invalidate: {
          location: "body",
          field,
          mode: "null",
        },
        keep_valid: {
          auth: true,
          path: true,
          query: true,
          body_other_than_target: true,
        },
        expected_outcome_family: "validation_failure",
        expected_status_candidates: ["400", "422"],
        field_target: field,
        spec_evidence: { source: "requestBody.required" },
      }),
    );
  }

  const formatFields = getAllFormatFields(requestBodySchema);
  for (const ff of formatFields) {
    autoPlans.push(
      makePlan({
        scenario_id: `negative.invalid_format:${ff.name}`,
        test_type: "negative",
        template_key: "negative.invalid_format",
        invalidate: {
          location: "body",
          field: ff.name,
          mode: "invalid_format",
        },
        keep_valid: {
          auth: true,
          path: true,
          query: true,
          body_other_than_target: true,
        },
        expected_outcome_family: "validation_failure",
        expected_status_candidates: ["400", "422"],
        field_target: ff.name,
        spec_evidence: { source: "requestBody.format" },
      }),
    );
  }

  const stringFields = getAllStringMaxLengthFields(requestBodySchema);
  for (const sf of stringFields) {
    autoPlans.push(
      makePlan({
        scenario_id: `negative.string_too_long:${sf.name}`,
        test_type: "negative",
        template_key: "negative.string_too_long",
        invalidate: {
          location: "body",
          field: sf.name,
          mode: "string_too_long",
        },
        keep_valid: {
          auth: true,
          path: true,
          query: true,
          body_other_than_target: true,
        },
        expected_outcome_family: "validation_failure",
        expected_status_candidates: ["400", "422"],
        field_target: sf.name,
        spec_evidence: { source: "requestBody.maxLength" },
      }),
    );
  }

  const numericFields = getAllNumericMaximumFields(requestBodySchema);
  for (const nf of numericFields) {
    autoPlans.push(
      makePlan({
        scenario_id: `negative.numeric_above_maximum:${nf.name}`,
        test_type: "negative",
        template_key: "negative.numeric_above_maximum",
        invalidate: {
          location: "body",
          field: nf.name,
          mode: "numeric_above_maximum",
        },
        keep_valid: {
          auth: true,
          path: true,
          query: true,
          body_other_than_target: true,
        },
        expected_outcome_family: "validation_failure",
        expected_status_candidates: ["400", "422"],
        field_target: nf.name,
        spec_evidence: { source: "requestBody.maximum" },
      }),
    );
  }

  return autoPlans;
}

export function buildScenarioPlans(endpoint, profile, rules = []) {
  const contractPlans = buildContractPlans(endpoint, profile);
  const schemaPlans = buildSchemaPlans(endpoint, profile);
  const negativeAuthPlans = buildAutoPlansFromResolved(endpoint, profile);

  return uniquePlans([...contractPlans, ...schemaPlans, ...negativeAuthPlans]);
}

function buildScenarioTitle(endpoint, plan) {
  const path = endpoint?.path || "";
  const method = normalizeMethod(endpoint?.method);
  const field = plan.field_target || scenarioSuffix(plan) || "field";
  const family = scenarioFamily(plan);

  switch (family) {
    case "auth.missing_credentials":
      return `Reject ${method} ${path} when authentication is missing`;
    case "auth.invalid_credentials":
      return `Reject ${method} ${path} when authentication is invalid`;
    case "negative.missing_required_query":
      return `Reject ${method} ${path} when query parameter '${field}' is missing`;
    case "negative.missing_required_path":
      return `Reject ${method} ${path} when path parameter '${field}' is invalid`;
    case "negative.invalid_enum":
      return `Reject ${method} ${path} when '${field}' has an invalid enum value`;
    case "negative.null_required_field":
      return `Reject ${method} ${path} when required field '${field}' is null`;
    case "negative.invalid_format":
      return `Reject ${method} ${path} when '${field}' has invalid format`;
    case "negative.string_too_long":
      return `Reject ${method} ${path} when '${field}' exceeds maximum length`;
    case "negative.numeric_above_maximum":
      return `Reject ${method} ${path} when '${field}' exceeds allowed value`;
    case "negative.empty_body":
      return `Reject ${method} ${path} when request body is missing`;
    case "negative.unsupported_content_type":
      return `Reject ${method} ${path} when Content-Type is unsupported`;
    case "success.min_payload":
      return `Verify ${method} ${path} accepts the minimal valid payload`;
    case "success.full_payload":
      return `Verify ${method} ${path} accepts the full valid payload`;
    case "contract.success":
      return `Verify successful response for ${method} ${path}`;
    case "contract.status_code":
      return `Verify documented success status for ${method} ${path}`;
    case "contract.content_type":
      return `Verify response content type for ${method} ${path}`;
    case "contract.required_fields":
      return `Verify mandatory response fields for ${method} ${path}`;
    case "contract.request_body":
      return `Verify valid request body is accepted for ${method} ${path}`;
    case "schema.response":
      return `Validate response schema for ${method} ${path}`;
    case "schema.required_fields":
      return `Validate required response fields for ${method} ${path}`;
    case "schema.field_types":
      return `Validate response field types for ${method} ${path}`;
    case "schema.request_body":
      return `Validate request schema for ${method} ${path}`;

    case "schema.request_required_fields":
      return `Validate required request fields for ${method} ${path}`;

    case "schema.request_field_types":
      return `Validate request field types for ${method} ${path}`;
    default:
      return `${method} ${path} - ${plan.test_type || "api"} scenario`;
  }
}

function buildScenarioObjective(endpoint, plan) {
  const method = normalizeMethod(endpoint?.method);
  const path = endpoint?.path || "/";
  const field = plan.field_target || scenarioSuffix(plan) || "field";
  const family = scenarioFamily(plan);

  switch (family) {
    case "auth.missing_credentials":
      return `Verify that ${method} ${path} rejects requests when authentication credentials are not provided.`;
    case "auth.invalid_credentials":
      return `Verify that ${method} ${path} rejects requests when authentication credentials are invalid.`;
    case "negative.empty_body":
      return `Verify that ${method} ${path} rejects requests when the required request body is not sent.`;
    case "negative.missing_required_query":
      return `Verify that ${method} ${path} rejects requests when required query parameter '${field}' is missing.`;
    case "negative.missing_required_path":
      return `Verify that ${method} ${path} rejects requests when required path parameter '${field}' is malformed or empty.`;
    case "negative.invalid_enum":
      return `Verify that ${method} ${path} rejects requests when '${field}' contains a value outside the allowed enum.`;
    case "negative.null_required_field":
      return `Verify that ${method} ${path} rejects requests when required field '${field}' is null.`;
    case "negative.invalid_format":
      return `Verify that ${method} ${path} rejects requests when '${field}' is not in the expected format.`;
    case "negative.string_too_long":
      return `Verify that ${method} ${path} rejects requests when '${field}' exceeds the documented max length.`;
    case "negative.numeric_above_maximum":
      return `Verify that ${method} ${path} rejects requests when '${field}' exceeds the documented maximum value.`;
    case "negative.unsupported_content_type":
      return `Verify that ${method} ${path} rejects requests sent with an unsupported Content-Type header.`;
    case "success.min_payload":
      return `Verify that ${method} ${path} accepts a minimal valid payload using only required fields.`;
    case "success.full_payload":
      return `Verify that ${method} ${path} accepts a complete valid payload including optional documented fields.`;
    case "contract.success":
      return `Verify that ${method} ${path} returns a successful response for a valid request.`;
    case "contract.status_code":
      return `Verify that ${method} ${path} returns the documented success status code for a valid request.`;
    case "contract.content_type":
      return `Verify that ${method} ${path} returns the documented response content type.`;
    case "contract.required_fields":
      return `Verify that ${method} ${path} returns all mandatory response fields defined in the API contract.`;
    case "contract.request_body":
      return `Verify that ${method} ${path} accepts a valid request body aligned with the documented contract.`;
    case "schema.response":
      return `Verify that ${method} ${path} returns a response body that matches the documented schema.`;
    case "schema.required_fields":
      return `Verify that ${method} ${path} returns all required response fields defined in the schema.`;
    case "schema.field_types":
      return `Verify that ${method} ${path} returns response fields using the documented data types.`;
    case "schema.request_body":
      return `Verify that the request body for ${method} ${path} conforms to the documented request schema.`;

    case "schema.request_required_fields":
      return `Verify that the request body for ${method} ${path} includes all required documented fields.`;

    case "schema.request_field_types":
      return `Verify that the request body for ${method} ${path} uses the documented field data types.`;
    default:
      return `Validate ${plan.test_type || "API"} behavior for ${method} ${path}.`;
  }
}

function buildRequestDetailsSteps(req) {
  const steps = [];

  for (const [k, v] of Object.entries(req?.headers || {})) {
    steps.push(`Set header '${k}' = ${JSON.stringify(v)}`);
  }

  for (const [k, v] of Object.entries(req?.query_params || {})) {
    steps.push(`Set query parameter '${k}' = ${JSON.stringify(v)}`);
  }

  for (const [k, v] of Object.entries(req?.path_params || {})) {
    steps.push(`Set path parameter '${k}' = ${JSON.stringify(v)}`);
  }

  if (req?.request_body !== undefined && req?.request_body !== null) {
    steps.push(`Set request body = ${JSON.stringify(req.request_body)}`);
  }

  return steps;
}

function buildScenarioSteps(endpoint, plan, req) {
  const steps = [];
  const method = normalizeMethod(endpoint?.method);
  const path = endpoint?.path || "/";
  const field = plan.field_target || scenarioSuffix(plan) || "field";
  const family = scenarioFamily(plan);

  steps.push(`Set HTTP method to ${method}`);
  steps.push(`Use endpoint path '${path}'`);
  steps.push(...buildRequestDetailsSteps(req));

  switch (family) {
    case "contract.success":
    case "contract.status_code":
    case "contract.content_type":
    case "contract.required_fields":
    case "contract.request_body":
    case "schema.response":
    case "schema.required_fields":
    case "schema.field_types":
      steps.push("Prepare a valid request using API specification");
      steps.push("Send the request to the endpoint");
      steps.push("Capture the response for validation");
      break;

    case "schema.request_body":
      steps.push(
        "Prepare a valid request body using the documented request schema",
      );
      steps.push("Send the request");
      steps.push("Capture the response for validation");
      break;

    case "schema.request_required_fields":
      steps.push(
        "Prepare a request body containing all documented required fields",
      );
      steps.push("Send the request");
      steps.push("Capture the response for validation");
      break;

    case "schema.request_field_types":
      steps.push("Prepare a request body using the documented field types");
      steps.push("Send the request");
      steps.push("Capture the response for validation");
      break;

    case "success.min_payload":
      steps.push(
        "Prepare a valid payload using only required documented fields",
      );
      steps.push("Send the request");
      steps.push("Capture the response for validation");
      break;

    case "success.full_payload":
      steps.push(
        "Prepare a complete valid payload including optional documented fields where applicable",
      );
      steps.push("Send the request");
      steps.push("Capture the response for validation");
      break;

    case "auth.missing_credentials":
      steps.push("Remove the Authorization header");
      steps.push("Send the request");
      break;

    case "auth.invalid_credentials":
      steps.push("Replace the Authorization header with an invalid token");
      steps.push("Send the request");
      break;

    case "negative.missing_required_query":
      steps.push(`Remove query parameter '${field}'`);
      steps.push("Send the request");
      break;

    case "negative.missing_required_path":
      steps.push(`Set path parameter '${field}' to an invalid or empty value`);
      steps.push("Send the request");
      break;

    case "negative.invalid_enum":
      steps.push(`Set '${field}' to a value outside the allowed enum`);
      steps.push("Send the request");
      break;

    case "negative.null_required_field":
      steps.push(`Set '${field}' to null`);
      steps.push("Send the request");
      break;

    case "negative.invalid_format":
      steps.push(`Set '${field}' to an invalid format`);
      steps.push("Send the request");
      break;

    case "negative.string_too_long":
      steps.push(
        `Set '${field}' to a value longer than the allowed maximum length`,
      );
      steps.push("Send the request");
      break;

    case "negative.numeric_above_maximum":
      steps.push(`Set '${field}' to a value above the allowed maximum`);
      steps.push("Send the request");
      break;

    case "negative.empty_body":
      steps.push(`Send ${method} ${path} without request body`);
      break;

    case "negative.unsupported_content_type":
      steps.push(
        "Replace the Content-Type header with an unsupported media type",
      );
      steps.push("Send the request");
      break;

    default:
      steps.push("Send the request");
      break;
  }

  return steps;
}

function buildScenarioExpectedResults(plan, endpoint) {
  const statuses = ensureArray(plan?.expected_status_candidates).join(" or ");
  const field = plan.field_target || scenarioSuffix(plan) || "field";
  const family = scenarioFamily(plan);

  switch (family) {
    case "auth.missing_credentials":
      return [
        `Response status should be ${statuses}`,
        "Response should indicate missing authentication credentials",
        "Response should not return protected or success data",
      ];

    case "auth.invalid_credentials":
      return [
        `Response status should be ${statuses}`,
        "Response should indicate invalid or expired authentication credentials",
        "Response should not return protected or success data",
      ];

    case "success.min_payload": {
      const requiredFields = ensureArray(
        getRequestBodySchema(endpoint)?.required,
      );
      return [
        `Response status should be ${statuses}`,
        "The API should accept the minimal valid payload",
        ...(requiredFields.length > 0
          ? [
              `The accepted payload should include required fields such as: ${requiredFields.join(", ")}`,
            ]
          : []),
        "No validation error should occur for the minimal valid payload",
      ];
    }
    case "schema.request_body":
      return [
        `Response status should be ${statuses}`,
        "Request body should conform to the documented request schema",
        "No request-schema validation error should occur for this valid payload",
      ];

    case "schema.request_required_fields": {
      const requestRequired = ensureArray(
        getRequestBodySchema(endpoint)?.required,
      );
      return [
        `Response status should be ${statuses}`,
        "All documented required request fields should be included",
        ...(requestRequired.length > 0
          ? [`Required request fields include: ${requestRequired.join(", ")}`]
          : []),
      ];
    }

    case "schema.request_field_types": {
      const requestFields = Object.keys(
        getSchemaProperties(getRequestBodySchema(endpoint)),
      );
      return [
        `Response status should be ${statuses}`,
        "Request body fields should use the documented data types",
        ...(requestFields.length > 0
          ? [`Validate request field types for: ${requestFields.join(", ")}`]
          : []),
      ];
    }

    case "success.full_payload": {
      const requestFields = Object.keys(
        buildValidRequest(endpoint, {}, "full").request_body || {},
      );
      return [
        `Response status should be ${statuses}`,
        "The API should accept the full valid payload",
        ...(requestFields.length > 0
          ? [
              `The accepted payload may include fields such as: ${requestFields.join(", ")}`,
            ]
          : []),
        "No validation error should occur for the full valid payload",
      ];
    }

    case "contract.success": {
      const fields = getTopLevelResponseFields(endpoint);
      return [
        `Response status should be ${statuses}`,
        "Response should follow the documented success contract",
        ...(fields.length > 0
          ? [
              `Response should include top-level fields such as: ${fields.join(", ")}`,
            ]
          : []),
      ];
    }

    case "contract.status_code":
      return [
        `Response status should be ${statuses}`,
        "Returned status code should match the documented success response",
        "No unexpected 4xx or 5xx response should be returned for valid input",
      ];

    case "contract.content_type":
      return [
        `Response status should be ${statuses}`,
        "Response should include the documented Content-Type header",
        "Returned media type should match the API contract",
      ];

    case "contract.required_fields": {
      const requiredFields = getResponseRequiredFields(endpoint);
      return [
        `Response status should be ${statuses}`,
        "All mandatory contract fields should be present in the response",
        ...(requiredFields.length > 0
          ? [`Mandatory response fields include: ${requiredFields.join(", ")}`]
          : []),
      ];
    }

    case "contract.request_body": {
      const requestFields = Object.keys(
        buildValidRequest(endpoint, {}, "full").request_body || {},
      );

      return [
        `Response status should be ${statuses}`,
        "Valid documented request body should be accepted by the API",
        ...(requestFields.length > 0
          ? [`Valid payload fields include: ${requestFields.join(", ")}`]
          : []),
        "No request-body validation error should occur for this valid payload",
      ];
    }

    case "schema.response":
      return [
        `Response status should be ${statuses}`,
        "Response body should conform to the documented response schema",
        "No undocumented top-level structure should violate schema validation",
      ];

    case "schema.required_fields": {
      const requiredFields = getResponseRequiredFields(endpoint);

      return [
        `Response status should be ${statuses}`,
        "All schema-required response fields should be present",
        ...(requiredFields.length > 0
          ? [`Schema-required fields include: ${requiredFields.join(", ")}`]
          : []),
      ];
    }

    case "schema.field_types": {
      const topFields = getTopLevelResponseFields(endpoint);

      return [
        `Response status should be ${statuses}`,
        "Response fields should use the documented data types",
        ...(topFields.length > 0
          ? [`Validate field types for: ${topFields.join(", ")}`]
          : []),
      ];
    }

    case "negative.empty_body":
      return [
        `Response status should be ${statuses}`,
        "Response should indicate missing required request body",
        "Error message should mention required body fields when available",
        "Request should not be processed successfully",
      ];

    case "negative.invalid_enum":
      return [
        `Response status should be ${statuses}`,
        `Response should indicate that '${field}' contains an unsupported enum value`,
        "Request should not be processed successfully",
      ];

    case "negative.null_required_field":
      return [
        `Response status should be ${statuses}`,
        `Response should indicate that required field '${field}' cannot be null`,
        "Request should not be processed successfully",
      ];

    case "negative.invalid_format":
      return [
        `Response status should be ${statuses}`,
        `Response should indicate invalid format for '${field}'`,
        "Request should not be processed successfully",
      ];

    case "negative.string_too_long":
      return [
        `Response status should be ${statuses}`,
        `Response should indicate that '${field}' exceeds maximum length`,
        "Request should not be processed successfully",
      ];

    case "negative.numeric_above_maximum":
      return [
        `Response status should be ${statuses}`,
        `Response should indicate that '${field}' exceeds maximum value`,
        "Request should not be processed successfully",
      ];

    case "negative.missing_required_query":
      return [
        `Response status should be ${statuses}`,
        `Response should indicate that query parameter '${field}' is required`,
        "Request should not be processed successfully",
      ];

    case "negative.missing_required_path":
      return [
        `Response status should be ${statuses}`,
        `Response should indicate that path parameter '${field}' is invalid`,
        "Request should not be processed successfully",
      ];

    case "negative.unsupported_content_type":
      return [
        `Response status should be ${statuses}`,
        "Response should indicate unsupported or invalid Content-Type",
        "Request should not be processed successfully",
      ];

    default:
      return [
        `Response should follow ${plan.test_type || "documented"} behavior`,
      ];
  }
}

function buildScenarioPreconditions(endpoint, plan) {
  const preconditions = [];
  const method = normalizeMethod(endpoint?.method);
  const family = scenarioFamily(plan);

  preconditions.push(
    `Target endpoint ${method} ${endpoint?.path || "/"} is available in the selected environment`,
  );

  if (plan.test_type === "auth") {
    preconditions.push(
      "Endpoint is protected and normally requires valid authentication",
    );
  }

  if (
    plan.test_type === "contract" ||
    family === "success.min_payload" ||
    family === "success.full_payload" ||
    family === "schema.request_body" ||
    family === "schema.request_required_fields" ||
    family === "schema.request_field_types"
  ) {
    preconditions.push(
      "A valid request can be constructed from the documented API contract",
    );
  }

  if (
    plan.test_type === "schema" &&
    family !== "schema.request_body" &&
    family !== "schema.request_required_fields" &&
    family !== "schema.request_field_types"
  ) {
    preconditions.push(
      "The endpoint exposes a documented response schema for validation",
    );
  }

  if (
    family === "negative.empty_body" ||
    family === "negative.invalid_enum" ||
    family === "negative.null_required_field" ||
    family === "negative.invalid_format" ||
    family === "negative.string_too_long" ||
    family === "negative.numeric_above_maximum" ||
    family === "negative.unsupported_content_type"
  ) {
    preconditions.push("Endpoint accepts request body content");
  }

  return preconditions;
}

function buildValidationFocus(plan, endpoint) {
  const family = scenarioFamily(plan);

  switch (family) {
    case "negative.empty_body":
      return [
        "request.body.required_fields",
        "error.response.structure",
        "status_code.validation",
      ];

    case "negative.invalid_enum":
      return [
        "request.body.enum_constraints",
        "error.response.structure",
        "status_code.validation",
      ];

    case "negative.null_required_field":
      return [
        "request.body.required_fields",
        "nullability.validation",
        "status_code.validation",
      ];

    case "negative.invalid_format":
      return [
        "request.body.format_constraints",
        "error.response.structure",
        "status_code.validation",
      ];

    case "negative.string_too_long":
      return [
        "request.body.string_constraints",
        "error.response.structure",
        "status_code.validation",
      ];

    case "negative.numeric_above_maximum":
      return [
        "request.body.numeric_constraints",
        "error.response.structure",
        "status_code.validation",
      ];

    case "negative.missing_required_query":
      return [
        "request.query.required_parameters",
        "error.response.structure",
        "status_code.validation",
      ];

    case "negative.missing_required_path":
      return [
        "request.path.parameter_validation",
        "routing_or_validation_failure",
        "status_code.validation",
      ];

    case "negative.unsupported_content_type":
      return [
        "request.content_type.validation",
        "unsupported_media_type_handling",
        "status_code.validation",
      ];

    case "auth.missing_credentials":
    case "auth.invalid_credentials":
      return [
        "authentication.enforcement",
        "error.response.structure",
        "status_code.authorization",
      ];

    case "success.min_payload":
      return [
        "request.body.required_fields",
        "minimal_valid_payload_acceptance",
        "http.success_status",
      ];

    case "success.full_payload":
      return [
        "request.body.contract",
        "full_valid_payload_acceptance",
        "http.success_status",
      ];

    case "contract.success":
      return [
        "http.success_status",
        "response.contract_structure",
        "response.content_type",
      ];

    case "contract.status_code":
      return ["http.success_status", "documented_status_code_compliance"];

    case "contract.content_type":
      return ["response.content_type", "documented_media_type_compliance"];

    case "contract.required_fields":
      return [
        "response.required_fields",
        "documented_contract_keys",
        "contract_completeness",
      ];

    case "contract.request_body":
      return [
        "request.body.contract",
        "valid_request_payload",
        "request_acceptance",
      ];

    case "schema.response":
      return [
        "response.schema_validation",
        "response.top_level_structure",
        "documented_schema_compliance",
      ];

    case "schema.required_fields":
      return [
        "schema.required_fields",
        "response.key_presence",
        "schema_completeness",
      ];

    case "schema.field_types":
      return [
        "schema.field_types",
        "response.property_types",
        "documented_type_compliance",
      ];

    case "schema.request_body":
      return [
        "request.schema_validation",
        "request.top_level_structure",
        "documented_request_schema_compliance",
      ];

    case "schema.request_required_fields":
      return [
        "request.required_fields",
        "request.key_presence",
        "request_schema_completeness",
      ];

    case "schema.request_field_types":
      return [
        "request.field_types",
        "request.property_types",
        "documented_request_type_compliance",
      ];

    default:
      return [`${plan.test_type || "general"}.validation`];
  }
}

function buildScenarioReferences(plan) {
  return [`scenario_id:${plan.scenario_id}`, "source:scenario_engine"];
}

function applyScenarioInvalidation(req, plan, profile, endpoint) {
  const next = clone(req) || {
    path_params: {},
    query_params: {},
    headers: {},
    cookies: {},
    request_body: null,
  };

  const invalidate = plan?.invalidate || {};
  const location = invalidate.location;
  const field = invalidate.field;
  const mode = invalidate.mode;
  const requestBodySchema = getRequestBodySchema(endpoint, profile);

  if (location === "headers") {
    next.headers = next.headers || {};

    if (mode === "missing") {
      delete next.headers[field];
      delete next.headers[String(field || "").toLowerCase()];
      delete next.headers.Authorization;
      delete next.headers.authorization;
      delete next.headers["X-API-Key"];
      delete next.headers["x-api-key"];
      delete next.headers.Cookie;
      delete next.headers.cookie;
    } else if (mode === "invalid") {
      next.headers[field || "Authorization"] = "Bearer invalid-token";
    } else if (mode === "unsupported_content_type") {
      next.headers["Content-Type"] = "application/unsupported";
    }

    return next;
  }

  if (location === "query") {
    next.query_params = next.query_params || {};

    if (mode === "missing" && field) {
      delete next.query_params[field];
    }

    return next;
  }

  if (location === "path") {
    next.path_params = next.path_params || {};

    if (mode === "missing_or_malformed" && field) {
      next.path_params[field] = "";
    }

    return next;
  }

  if (location === "body") {
    if (mode === "empty_body") {
      next.request_body = undefined;
      return next;
    }

    next.request_body = isObject(next.request_body) ? next.request_body : {};

    if (mode === "invalid_enum" && field) {
      next.request_body[field] = "__invalid_enum_value__";
    }

    if (mode === "null" && field) {
      next.request_body[field] = null;
    }

    if (mode === "invalid_format" && field) {
      const fieldSchema = requestBodySchema?.properties?.[field] || {};
      next.request_body[field] = buildInvalidFormatValue(field, fieldSchema);
    }

    if (mode === "string_too_long" && field) {
      const fieldSchema = requestBodySchema?.properties?.[field] || {};
      next.request_body[field] = buildTooLongValue(fieldSchema);
    }

    if (mode === "numeric_above_maximum" && field) {
      const fieldSchema = requestBodySchema?.properties?.[field] || {};
      next.request_body[field] = buildAboveMaximumValue(fieldSchema);
    }

    return next;
  }

  return next;
}

export function buildCaseFromScenarioPlan(endpoint, profile, plan) {
  const family = scenarioFamily(plan);

  let validReq;
  if (family === "success.min_payload") {
    validReq = buildValidRequest(endpoint, profile, "minimal");
  } else {
    validReq = buildValidRequest(endpoint, profile, "full");
  }

  const req = applyScenarioInvalidation(validReq, plan, profile, endpoint);
  const method = normalizeMethod(endpoint?.method);

  if (method === "GET") {
    delete req.request_body;
  }

  return {
    id: "",
    title: buildScenarioTitle(endpoint, plan),
    module:
      (Array.isArray(endpoint?.tags) && endpoint.tags[0]) ||
      String(endpoint?.path || "")
        .split("/")
        .filter(Boolean)[0] ||
      "Default API",
    test_type: plan.test_type,
    priority:
      plan.test_type === "auth" || plan.test_type === "negative"
        ? "P1"
        : family === "success.min_payload" ||
            family === "success.full_payload" ||
            family === "contract.success" ||
            family === "schema.response"
          ? "P1"
          : "P2",
    objective: buildScenarioObjective(endpoint, plan),
    preconditions: buildScenarioPreconditions(endpoint, plan),
    test_data: req,
    steps: buildScenarioSteps(endpoint, plan, req),
    expected_results: buildScenarioExpectedResults(plan, endpoint),
    api_details: {
      method,
      path: endpoint?.path || "/",
    },
    validation_focus: buildValidationFocus(plan, endpoint),
    references: buildScenarioReferences(plan),
    needs_review: false,
    review_notes: "",
    meta: {
      scenario_id: plan.scenario_id,
      template_key: plan.template_key,
      invalidate: plan.invalidate,
      keep_valid: plan.keep_valid,
      expected_outcome_family: plan.expected_outcome_family,
      expected_status_candidates: plan.expected_status_candidates,
      spec_evidence: plan.spec_evidence,
      required_fields: ensureArray(
        getRequestBodySchema(endpoint, profile)?.required,
      ),
    },
  };
}

export function validateScenarioCase(tc, profile, plan) {
  const errors = [];
  const family = scenarioFamily(plan);

  const expectedJoined = ensureArray(tc?.expected_results)
    .join(" ")
    .toLowerCase();

  const stepsJoined = ensureArray(tc?.steps).join(" ").toLowerCase();

  const hasExplicit2xxStatus = /\b2\d\d\b/.test(expectedJoined);

  const hasPositiveSuccessLanguage =
    /\b(success|successful|accepted|completed)\b/.test(expectedJoined) &&
    !/\b(not|no|without|reject|rejected|fail|failed|unauthorized|forbidden|invalid|unsupported)\b/.test(
      expectedJoined,
    );

  if (
    (plan?.expected_outcome_family === "auth_failure" ||
      tc?.test_type === "auth") &&
    (hasExplicit2xxStatus || hasPositiveSuccessLanguage)
  ) {
    errors.push("Auth scenario contains success expectation.");
  }

  if (
    (plan?.expected_outcome_family === "validation_failure" ||
      tc?.test_type === "negative") &&
    (hasExplicit2xxStatus || hasPositiveSuccessLanguage)
  ) {
    errors.push("Negative scenario contains success expectation.");
  }

  if (
    isScenario(plan, "negative.missing_required_query") &&
    plan?.field_target &&
    tc?.test_data?.query_params &&
    Object.prototype.hasOwnProperty.call(
      tc.test_data.query_params,
      plan.field_target,
    )
  ) {
    errors.push(
      "Query-missing scenario still contains the targeted query parameter.",
    );
  }

  if (
    isScenario(plan, "auth.missing_credentials") &&
    (tc?.test_data?.headers?.Authorization ||
      tc?.test_data?.headers?.authorization)
  ) {
    errors.push(
      "Missing-credentials scenario still contains Authorization header.",
    );
  }

  if (
    plan?.invalidate?.location === "body" &&
    plan?.field_target &&
    !stepsJoined.includes(String(plan?.field_target || "").toLowerCase())
  ) {
    errors.push(
      "Scenario steps do not mention the targeted invalid body field.",
    );
  }

  if (
    isScenario(plan, "negative.empty_body") &&
    tc?.test_data?.request_body !== undefined
  ) {
    errors.push("Empty-body scenario still contains a request body.");
  }

  if (
    isScenario(plan, "negative.unsupported_content_type") &&
    lower(tc?.test_data?.headers?.["Content-Type"]) !==
      "application/unsupported"
  ) {
    errors.push(
      "Unsupported-content-type scenario did not set the invalid Content-Type header.",
    );
  }

  if (
    isScenario(plan, "success.min_payload") &&
    isObject(tc?.test_data?.request_body)
  ) {
    const keys = Object.keys(tc.test_data.request_body || {});
    const expectedRequired = ensureArray(tc?.meta?.required_fields || []);

    if (
      expectedRequired.length > 0 &&
      keys.some((k) => !expectedRequired.includes(k))
    ) {
      errors.push(
        "Minimal-payload scenario contains non-required body fields.",
      );
    }
  }
  return {
    is_valid: errors.length === 0,
    errors,
  };
}
