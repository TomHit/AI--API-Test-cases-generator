function normalizeMethod(method) {
  return String(method || "").toUpperCase();
}

function getJsonSchemaFromContent(content) {
  return (
    content?.["application/json"]?.schema ||
    content?.["application/*+json"]?.schema ||
    null
  );
}

function getSuccessResponses(endpoint) {
  const responses = endpoint?.responses || {};
  return Object.entries(responses).filter(([code]) =>
    /^2\d\d$/.test(String(code)),
  );
}

function getFirstSuccessResponse(endpoint) {
  const matches = getSuccessResponses(endpoint);
  return matches.length > 0 ? matches[0][1] : null;
}

function getResponseSchema(endpoint) {
  const responses = endpoint?.responses || {};

  for (const [code, val] of Object.entries(responses)) {
    if (!/^2\d\d$/.test(String(code))) continue;
    const schema = getJsonSchemaFromContent(val?.content);
    if (schema) return schema;
  }

  return null;
}

function getRequestBodySchema(endpoint) {
  return getJsonSchemaFromContent(endpoint?.requestBody?.content);
}

function getQueryParamNames(endpoint) {
  return (endpoint?.params?.query || []).map((p) =>
    String(p?.name || "").toLowerCase(),
  );
}

function getSchemaProperties(schema) {
  return schema?.properties && typeof schema.properties === "object"
    ? schema.properties
    : {};
}

function schemaHasRequiredFields(schema) {
  return Array.isArray(schema?.required) && schema.required.length > 0;
}

function schemaHasTypedFields(schema) {
  const props = Object.values(getSchemaProperties(schema));
  return props.some((p) => !!p?.type || !!p?.format);
}

function schemaHasEnum(schema) {
  const props = Object.values(getSchemaProperties(schema));
  return props.some((p) => Array.isArray(p?.enum) && p.enum.length > 0);
}

function schemaHasNestedObjects(schema) {
  const props = Object.values(getSchemaProperties(schema));
  return props.some((p) => p?.type === "object" || !!p?.properties);
}

function schemaHasArrayFields(schema) {
  const props = Object.values(getSchemaProperties(schema));
  return props.some((p) => p?.type === "array" || !!p?.items);
}

function schemaHasFormat(schema) {
  const props = Object.values(getSchemaProperties(schema));
  return props.some((p) => !!p?.format);
}

function schemaHasNumericConstraints(schema) {
  const props = Object.values(getSchemaProperties(schema));
  return props.some(
    (p) =>
      typeof p?.minimum === "number" ||
      typeof p?.maximum === "number" ||
      typeof p?.exclusiveMinimum === "number" ||
      typeof p?.exclusiveMaximum === "number",
  );
}

function schemaHasStringConstraints(schema) {
  const props = Object.values(getSchemaProperties(schema));
  return props.some(
    (p) => typeof p?.minLength === "number" || typeof p?.maxLength === "number",
  );
}

function schemaHasPattern(schema) {
  const props = Object.values(getSchemaProperties(schema));
  return props.some((p) => typeof p?.pattern === "string" && p.pattern.trim());
}

function schemaHasComposition(schema) {
  return !!(
    (Array.isArray(schema?.oneOf) && schema.oneOf.length > 0) ||
    (Array.isArray(schema?.anyOf) && schema.anyOf.length > 0) ||
    (Array.isArray(schema?.allOf) && schema.allOf.length > 0)
  );
}

function schemaHasDateOrDatetimeFields(schema) {
  const props = Object.values(getSchemaProperties(schema));
  return props.some((p) => p?.format === "date" || p?.format === "date-time");
}

function responseHasContentType(endpoint) {
  const res = getFirstSuccessResponse(endpoint);
  const content = res?.content || {};
  return Object.keys(content).length > 0 || !!endpoint?.response?.contentType;
}

function responseHasHeaders(endpoint) {
  const res = getFirstSuccessResponse(endpoint);
  return !!(res?.headers && Object.keys(res.headers).length > 0);
}

function endpointHasPathParams(endpoint) {
  return (
    Array.isArray(endpoint?.params?.path) && endpoint.params.path.length > 0
  );
}

function endpointHasQueryParams(endpoint) {
  return (
    Array.isArray(endpoint?.params?.query) && endpoint.params.query.length > 0
  );
}

function endpointHasRequiredQuery(endpoint) {
  const query = Array.isArray(endpoint?.params?.query)
    ? endpoint.params.query
    : [];
  return query.some((p) => !!p?.required);
}

function queryParamsHaveTypedSchema(endpoint) {
  const query = Array.isArray(endpoint?.params?.query)
    ? endpoint.params.query
    : [];
  return query.some(
    (p) => !!p?.schema?.type || !!p?.type || !!p?.schema?.format,
  );
}

function endpointHasDocumentedError(endpoint) {
  const responses = endpoint?.responses || {};
  return Object.keys(responses).some((code) => /^[45]\d\d$/.test(String(code)));
}

function endpointRequiresAuth(endpoint) {
  return Array.isArray(endpoint?.security) && endpoint.security.length > 0;
}

function endpointRequiresRoleScope(endpoint) {
  const security = Array.isArray(endpoint?.security) ? endpoint.security : [];

  for (const req of security) {
    if (!req || typeof req !== "object") continue;

    for (const scopes of Object.values(req)) {
      if (Array.isArray(scopes) && scopes.length > 0) {
        return true;
      }
    }
  }

  return false;
}

function endpointHasRateLimitContract(endpoint) {
  const responses = endpoint?.responses || {};
  return !!responses["429"];
}

function endpointHasPaginationParams(endpoint) {
  const names = getQueryParamNames(endpoint);
  return names.some((n) =>
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
  );
}

function endpointHasSortingParams(endpoint) {
  const names = getQueryParamNames(endpoint);
  return names.some((n) =>
    ["sort", "sortby", "order", "orderby", "order_by"].includes(n),
  );
}

function endpointHasFilterParams(endpoint) {
  const names = getQueryParamNames(endpoint);
  return names.some(
    (n) =>
      n.includes("filter") ||
      n === "status_filter" ||
      n === "type_filter" ||
      n === "filter_by",
  );
}

function requestBodyHasOptionalFields(schema) {
  const props = getSchemaProperties(schema);
  const propKeys = Object.keys(props);
  const required = Array.isArray(schema?.required) ? schema.required : [];
  return propKeys.length > required.length;
}

function requestContainsLikelyUniqueField(schema) {
  const props = getSchemaProperties(schema);
  const names = Object.keys(props).map((x) => String(x).toLowerCase());

  return names.some((n) =>
    ["email", "username", "user_name", "external_id", "slug"].includes(n),
  );
}

export function profileEndpoint(endpoint) {
  const method = normalizeMethod(endpoint?.method);
  const successResponses = getSuccessResponses(endpoint);
  const firstSuccessResponse = getFirstSuccessResponse(endpoint);
  const responseSchema = getResponseSchema(endpoint);
  const requestBodySchema = getRequestBodySchema(endpoint);

  return {
    exists: !!endpoint,
    method,
    path: String(endpoint?.path || "/"),

    has2xxResponse: successResponses.length > 0,
    successStatusCodes: successResponses.map(([code]) => String(code)),
    successResponseIs204: !!endpoint?.responses?.["204"],
    hasResponseContentType: responseHasContentType(endpoint),
    hasResponseHeaders: responseHasHeaders(endpoint),
    hasDocumentedErrorResponses: endpointHasDocumentedError(endpoint),
    hasSummaryOrOperationId: !!endpoint?.summary || !!endpoint?.operationId,

    hasPathParams: endpointHasPathParams(endpoint),
    hasQueryParams: endpointHasQueryParams(endpoint),
    hasRequiredQuery: endpointHasRequiredQuery(endpoint),
    hasResourceIdentifier: endpointHasPathParams(endpoint),
    queryParamsHaveTypedSchema: queryParamsHaveTypedSchema(endpoint),

    hasRequestBody: !!requestBodySchema,
    requestBodyRequired: !!endpoint?.requestBody?.required,
    requestBodyIsObject: !!(
      requestBodySchema &&
      (requestBodySchema.type === "object" || requestBodySchema.properties)
    ),
    requestBodyHasRequiredFields: schemaHasRequiredFields(requestBodySchema),
    requestBodyHasOptionalFields:
      requestBodyHasOptionalFields(requestBodySchema),
    requestBodyControlsAdditionalProperties:
      requestBodySchema?.additionalProperties === false,

    hasResponseSchema: !!responseSchema,
    responseHasRequiredFields: schemaHasRequiredFields(responseSchema),

    hasEnum: schemaHasEnum(responseSchema) || schemaHasEnum(requestBodySchema),
    hasFormat:
      schemaHasFormat(responseSchema) || schemaHasFormat(requestBodySchema),
    hasNumericConstraints:
      schemaHasNumericConstraints(responseSchema) ||
      schemaHasNumericConstraints(requestBodySchema),
    hasStringConstraints:
      schemaHasStringConstraints(responseSchema) ||
      schemaHasStringConstraints(requestBodySchema),
    hasPattern:
      schemaHasPattern(responseSchema) || schemaHasPattern(requestBodySchema),
    hasDateOrDatetimeFields:
      schemaHasDateOrDatetimeFields(responseSchema) ||
      schemaHasDateOrDatetimeFields(requestBodySchema),

    responseSchemaHasTypedFields: schemaHasTypedFields(responseSchema),
    responseSchemaHasEnumFields: schemaHasEnum(responseSchema),
    responseSchemaHasNestedObjects: schemaHasNestedObjects(responseSchema),
    responseSchemaHasArrayFields: schemaHasArrayFields(responseSchema),
    responseSchemaHasFormatFields: schemaHasFormat(responseSchema),
    responseSchemaHasNumericConstraints:
      schemaHasNumericConstraints(responseSchema),
    responseSchemaHasStringConstraints:
      schemaHasStringConstraints(responseSchema),
    responseSchemaHasPatternFields: schemaHasPattern(responseSchema),
    schemaHasComposition:
      schemaHasComposition(responseSchema) ||
      schemaHasComposition(requestBodySchema),

    requiresAuth: endpointRequiresAuth(endpoint),
    requiresRoleScope: endpointRequiresRoleScope(endpoint),
    hasRateLimitContract: endpointHasRateLimitContract(endpoint),

    hasPaginationParams: endpointHasPaginationParams(endpoint),
    hasSortingParams: endpointHasSortingParams(endpoint),
    hasFilterParams: endpointHasFilterParams(endpoint),

    canConflict:
      method === "POST" && requestContainsLikelyUniqueField(requestBodySchema),

    firstSuccessResponse,
    responseSchema,
    requestBodySchema,
  };
}
