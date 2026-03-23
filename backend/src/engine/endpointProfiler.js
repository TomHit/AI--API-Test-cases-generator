function normalizeMethod(method) {
  return String(method || "").toUpperCase();
}
function getAuthType(endpoint) {
  const security = Array.isArray(endpoint?.security) ? endpoint.security : [];

  for (const sec of security) {
    for (const key of Object.keys(sec)) {
      const k = key.toLowerCase();

      if (k.includes("oauth")) return "oauth2";
      if (k.includes("api_key")) return "apiKey";
      if (k.includes("bearer")) return "bearer";
      if (k.includes("basic")) return "basic";
    }
  }

  return null;
}

function getJsonSchemaFromContent(content) {
  if (!content || typeof content !== "object") return null;

  if (content["application/json"]?.schema)
    return content["application/json"].schema;
  if (content["application/*+json"]?.schema)
    return content["application/*+json"].schema;

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

function getFirstSuccessResponse(endpoint) {
  const matches = getSuccessResponses(endpoint).sort(
    ([a], [b]) => Number(a) - Number(b),
  );
  return matches.length > 0 ? matches[0][1] : null;
}

function requestBodyHasOptionalFields(schema) {
  if (!schema || !(schema.type === "object" || schema.properties)) return false;

  const props = getSchemaProperties(schema);
  const propKeys = Object.keys(props);
  const required = Array.isArray(schema?.required) ? schema.required : [];
  return propKeys.length > required.length;
}
function getSuccessResponses(endpoint) {
  const responses = endpoint?.responses || {};
  return Object.entries(responses).filter(([code]) =>
    /^2\d\d$/.test(String(code)),
  );
}

function getResponseSchema(endpoint) {
  const matches = getSuccessResponses(endpoint).sort(
    ([a], [b]) => Number(a) - Number(b),
  );

  for (const [, val] of matches) {
    const schema = getJsonSchemaFromContent(val?.content);
    if (schema) return schema;
  }

  return null;
}

function getRequestBodySchema(endpoint) {
  return getJsonSchemaFromContent(endpoint?.requestBody?.content);
}

function getQueryParamNames(endpoint) {
  const query = Array.isArray(endpoint?.params?.query)
    ? endpoint.params.query
    : [];

  return query.map((p) => String(p?.name || "").toLowerCase());
}

function getSchemaProperties(schema) {
  return schema?.properties && typeof schema.properties === "object"
    ? schema.properties
    : {};
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

function schemaSome(schema, predicate) {
  let found = false;

  walkSchema(schema, (node) => {
    if (!found && predicate(node)) {
      found = true;
    }
  });

  return found;
}

function schemaHasRequiredFields(schema) {
  return Array.isArray(schema?.required) && schema.required.length > 0;
}

function schemaHasTypedFields(schema) {
  return schemaSome(
    schema,
    (node) => !!node?.type || typeof node?.format === "string",
  );
}

function schemaHasEnum(schema) {
  return schemaSome(
    schema,
    (node) => Array.isArray(node?.enum) && node.enum.length > 0,
  );
}

function schemaHasNestedObjects(schema) {
  let objectCount = 0;

  walkSchema(schema, (node) => {
    if (node?.type === "object" || !!node?.properties) {
      objectCount += 1;
    }
  });

  return objectCount > 1;
}

function schemaHasArrayFields(schema) {
  return schemaSome(schema, (node) => node?.type === "array" || !!node?.items);
}

function schemaHasFormat(schema) {
  return schemaSome(
    schema,
    (node) => typeof node?.format === "string" && node.format.trim(),
  );
}

function schemaHasNumericConstraints(schema) {
  return schemaSome(
    schema,
    (node) =>
      typeof node?.minimum === "number" ||
      typeof node?.maximum === "number" ||
      node?.exclusiveMinimum !== undefined ||
      node?.exclusiveMaximum !== undefined,
  );
}

function schemaHasStringConstraints(schema) {
  return schemaSome(
    schema,
    (node) =>
      typeof node?.minLength === "number" ||
      typeof node?.maxLength === "number",
  );
}

function schemaHasPattern(schema) {
  return schemaSome(
    schema,
    (node) => typeof node?.pattern === "string" && node.pattern.trim(),
  );
}

function schemaHasComposition(schema) {
  return schemaSome(
    schema,
    (node) =>
      (Array.isArray(node?.oneOf) && node.oneOf.length > 0) ||
      (Array.isArray(node?.anyOf) && node.anyOf.length > 0) ||
      (Array.isArray(node?.allOf) && node.allOf.length > 0),
  );
}

function schemaHasDateOrDatetimeFields(schema) {
  return schemaSome(
    schema,
    (node) => node?.format === "date" || node?.format === "date-time",
  );
}

function responseHasContentType(endpoint) {
  const res = getFirstSuccessResponse(endpoint);
  const content = res?.content || {};
  return Object.keys(content).length > 0;
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
  const firstSuccessStatusCode =
    successResponses.length > 0
      ? successResponses
          .map(([code]) => String(code))
          .sort((a, b) => Number(a) - Number(b))[0]
      : null;

  return {
    exists: !!endpoint,
    method,
    path: String(endpoint?.path || "/"),

    has2xxResponse: successResponses.length > 0,
    successStatusCodes: successResponses.map(([code]) => String(code)),
    expectedSuccessCode: firstSuccessStatusCode,
    successResponseIs204: firstSuccessStatusCode === "204",
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
    authType: getAuthType(endpoint),
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
