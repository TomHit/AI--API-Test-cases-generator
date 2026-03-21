function normalizeMethod(method) {
  return String(method || "").toUpperCase();
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

function getSuccessResponses(endpoint) {
  const responses = endpoint?.responses || {};
  return Object.entries(responses)
    .filter(([code]) => /^2\d\d$/.test(String(code)))
    .sort(([a], [b]) => Number(a) - Number(b));
}

function getResponseSchema(endpoint) {
  const matches = getSuccessResponses(endpoint);

  for (const [, val] of matches) {
    const schema = getJsonSchemaFromContent(val?.content);
    if (schema) return schema;
  }

  return null;
}

function getRequestBodySchema(endpoint) {
  return getJsonSchemaFromContent(endpoint?.requestBody?.content);
}

function getQueryParams(endpoint) {
  return Array.isArray(endpoint?.params?.query) ? endpoint.params.query : [];
}

function getPathParams(endpoint) {
  return Array.isArray(endpoint?.params?.path) ? endpoint.params.path : [];
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

function endpointExists(endpoint, profile) {
  if (typeof profile?.exists === "boolean") {
    return profile.exists;
  }
  return !!endpoint && typeof endpoint === "object";
}

function methodIsGet(endpoint, profile) {
  return normalizeMethod(profile?.method || endpoint?.method) === "GET";
}

function methodIsPost(endpoint, profile) {
  return normalizeMethod(profile?.method || endpoint?.method) === "POST";
}

function methodIsPut(endpoint, profile) {
  return normalizeMethod(profile?.method || endpoint?.method) === "PUT";
}

function methodIsPatch(endpoint, profile) {
  return normalizeMethod(profile?.method || endpoint?.method) === "PATCH";
}

function methodIsDelete(endpoint, profile) {
  return normalizeMethod(profile?.method || endpoint?.method) === "DELETE";
}

function methodIsWrite(endpoint, profile) {
  return ["POST", "PUT", "PATCH"].includes(
    normalizeMethod(profile?.method || endpoint?.method),
  );
}

function endpointHas2xxResponse(endpoint, profile) {
  if (typeof profile?.has2xxResponse === "boolean") {
    return profile.has2xxResponse;
  }
  return getSuccessResponses(endpoint).length > 0;
}

function responseHasContentType(endpoint, profile) {
  if (typeof profile?.hasResponseContentType === "boolean") {
    return profile.hasResponseContentType;
  }

  const first = getSuccessResponses(endpoint)[0]?.[1];
  const content = first?.content || {};
  return Object.keys(content).length > 0;
}

function responseHasHeaders(endpoint, profile) {
  if (typeof profile?.hasResponseHeaders === "boolean") {
    return profile.hasResponseHeaders;
  }

  const first = getSuccessResponses(endpoint)[0]?.[1];
  return !!(first?.headers && Object.keys(first.headers).length > 0);
}

function endpointHasPathParams(endpoint, profile) {
  if (typeof profile?.hasPathParams === "boolean") {
    return profile.hasPathParams;
  }
  return getPathParams(endpoint).length > 0;
}

function endpointHasQueryParams(endpoint, profile) {
  if (typeof profile?.hasQueryParams === "boolean") {
    return profile.hasQueryParams;
  }
  return getQueryParams(endpoint).length > 0;
}

function endpointHasRequiredQuery(endpoint, profile) {
  if (typeof profile?.hasRequiredQuery === "boolean") {
    return profile.hasRequiredQuery;
  }
  return getQueryParams(endpoint).some((p) => !!p?.required);
}

function requestBodyHasOptionalFields(endpoint, profile) {
  if (typeof profile?.requestBodyHasOptionalFields === "boolean") {
    return profile.requestBodyHasOptionalFields;
  }

  const schema = getRequestBodySchema(endpoint);
  if (!schema || !(schema.type === "object" || schema.properties)) return false;

  const props = getSchemaProperties(schema);
  const propKeys = Object.keys(props);
  const required = Array.isArray(schema?.required) ? schema.required : [];
  return propKeys.length > required.length;
}

function successResponseIs204(endpoint, profile) {
  if (typeof profile?.successResponseIs204 === "boolean") {
    return profile.successResponseIs204;
  }

  const successCodes = getSuccessResponses(endpoint).map(([code]) =>
    String(code),
  );
  return successCodes[0] === "204";
}

function endpointHasDocumentedError(endpoint, profile) {
  if (typeof profile?.hasDocumentedErrorResponses === "boolean") {
    return profile.hasDocumentedErrorResponses;
  }

  const responses = endpoint?.responses || {};
  return Object.keys(responses).some((code) => /^[45]\d\d$/.test(String(code)));
}

function endpointHasSummaryOrOperationId(endpoint, profile) {
  if (typeof profile?.hasSummaryOrOperationId === "boolean") {
    return profile.hasSummaryOrOperationId;
  }
  return !!endpoint?.summary || !!endpoint?.operationId;
}

function responseSchemaExists(endpoint, profile) {
  if (typeof profile?.hasResponseSchema === "boolean") {
    return profile.hasResponseSchema;
  }
  return !!getResponseSchema(endpoint);
}

function responseHasRequiredFields(endpoint, profile) {
  if (typeof profile?.responseHasRequiredFields === "boolean") {
    return profile.responseHasRequiredFields;
  }

  const schema = getResponseSchema(endpoint);
  return Array.isArray(schema?.required) && schema.required.length > 0;
}

function requestBodySchemaExists(endpoint, profile) {
  if (typeof profile?.hasRequestBody === "boolean") {
    return profile.hasRequestBody;
  }
  return !!getRequestBodySchema(endpoint);
}

function requestBodyHasRequiredFields(endpoint, profile) {
  if (typeof profile?.requestBodyHasRequiredFields === "boolean") {
    return profile.requestBodyHasRequiredFields;
  }

  const schema = getRequestBodySchema(endpoint);
  return Array.isArray(schema?.required) && schema.required.length > 0;
}

function responseSchemaHasRequiredFields(endpoint, profile) {
  if (typeof profile?.responseHasRequiredFields === "boolean") {
    return profile.responseHasRequiredFields;
  }

  const schema = getResponseSchema(endpoint);
  return Array.isArray(schema?.required) && schema.required.length > 0;
}

function responseSchemaHasTypedFields(endpoint, profile) {
  if (typeof profile?.responseSchemaHasTypedFields === "boolean") {
    return profile.responseSchemaHasTypedFields;
  }

  const schema = getResponseSchema(endpoint);
  return schemaSome(
    schema,
    (node) => !!node?.type || typeof node?.format === "string",
  );
}

function responseSchemaHasEnumFields(endpoint, profile) {
  if (typeof profile?.responseSchemaHasEnumFields === "boolean") {
    return profile.responseSchemaHasEnumFields;
  }

  const schema = getResponseSchema(endpoint);
  return schemaSome(
    schema,
    (node) => Array.isArray(node?.enum) && node.enum.length > 0,
  );
}

function responseSchemaHasNestedObjects(endpoint, profile) {
  if (typeof profile?.responseSchemaHasNestedObjects === "boolean") {
    return profile.responseSchemaHasNestedObjects;
  }

  const schema = getResponseSchema(endpoint);
  let objectCount = 0;

  walkSchema(schema, (node) => {
    if (node?.type === "object" || !!node?.properties) {
      objectCount += 1;
    }
  });

  return objectCount > 1;
}

function responseSchemaHasArrayFields(endpoint, profile) {
  if (typeof profile?.responseSchemaHasArrayFields === "boolean") {
    return profile.responseSchemaHasArrayFields;
  }

  const schema = getResponseSchema(endpoint);
  return schemaSome(schema, (node) => node?.type === "array" || !!node?.items);
}

function responseSchemaHasFormatFields(endpoint, profile) {
  if (typeof profile?.responseSchemaHasFormatFields === "boolean") {
    return profile.responseSchemaHasFormatFields;
  }

  const schema = getResponseSchema(endpoint);
  return schemaSome(
    schema,
    (node) => typeof node?.format === "string" && node.format.trim(),
  );
}

function responseSchemaHasNumericConstraints(endpoint, profile) {
  if (typeof profile?.responseSchemaHasNumericConstraints === "boolean") {
    return profile.responseSchemaHasNumericConstraints;
  }

  const schema = getResponseSchema(endpoint);
  return schemaSome(
    schema,
    (node) =>
      typeof node?.minimum === "number" ||
      typeof node?.maximum === "number" ||
      node?.exclusiveMinimum !== undefined ||
      node?.exclusiveMaximum !== undefined,
  );
}

function responseSchemaHasStringConstraints(endpoint, profile) {
  if (typeof profile?.responseSchemaHasStringConstraints === "boolean") {
    return profile.responseSchemaHasStringConstraints;
  }

  const schema = getResponseSchema(endpoint);
  return schemaSome(
    schema,
    (node) =>
      typeof node?.minLength === "number" ||
      typeof node?.maxLength === "number",
  );
}

function responseSchemaHasPatternFields(endpoint, profile) {
  if (typeof profile?.responseSchemaHasPatternFields === "boolean") {
    return profile.responseSchemaHasPatternFields;
  }

  const schema = getResponseSchema(endpoint);
  return schemaSome(
    schema,
    (node) => typeof node?.pattern === "string" && node.pattern.trim(),
  );
}

function schemaHasComposition(endpoint, profile) {
  if (typeof profile?.schemaHasComposition === "boolean") {
    return profile.schemaHasComposition;
  }

  const responseSchema = getResponseSchema(endpoint);
  const requestSchema = getRequestBodySchema(endpoint);

  return (
    schemaSome(
      responseSchema,
      (node) =>
        (Array.isArray(node?.oneOf) && node.oneOf.length > 0) ||
        (Array.isArray(node?.anyOf) && node.anyOf.length > 0) ||
        (Array.isArray(node?.allOf) && node.allOf.length > 0),
    ) ||
    schemaSome(
      requestSchema,
      (node) =>
        (Array.isArray(node?.oneOf) && node.oneOf.length > 0) ||
        (Array.isArray(node?.anyOf) && node.anyOf.length > 0) ||
        (Array.isArray(node?.allOf) && node.allOf.length > 0),
    )
  );
}

function endpointRequiresAuth(endpoint, profile) {
  if (typeof profile?.requiresAuth === "boolean") {
    return profile.requiresAuth;
  }
  return Array.isArray(endpoint?.security) && endpoint.security.length > 0;
}

function endpointRequiresRoleScope(endpoint, profile) {
  if (typeof profile?.requiresRoleScope === "boolean") {
    return profile.requiresRoleScope;
  }

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

function endpointHasResourceIdentifier(endpoint, profile) {
  if (typeof profile?.hasResourceIdentifier === "boolean") {
    return profile.hasResourceIdentifier;
  }
  return endpointHasPathParams(endpoint, profile);
}

function queryParamsHaveTypedSchema(endpoint, profile) {
  if (typeof profile?.queryParamsHaveTypedSchema === "boolean") {
    return profile.queryParamsHaveTypedSchema;
  }

  const query = getQueryParams(endpoint);
  return query.some(
    (p) => !!p?.schema?.type || !!p?.type || !!p?.schema?.format,
  );
}

function responseOrRequestSchemaHasEnum(endpoint, profile) {
  if (typeof profile?.hasEnum === "boolean") {
    return profile.hasEnum;
  }

  const responseSchema = getResponseSchema(endpoint);
  const requestSchema = getRequestBodySchema(endpoint);

  return (
    schemaSome(
      responseSchema,
      (node) => Array.isArray(node?.enum) && node.enum.length > 0,
    ) ||
    schemaSome(
      requestSchema,
      (node) => Array.isArray(node?.enum) && node.enum.length > 0,
    )
  );
}

function schemaHasStringFormat(endpoint, profile) {
  if (typeof profile?.hasFormat === "boolean") {
    return profile.hasFormat;
  }

  const responseSchema = getResponseSchema(endpoint);
  const requestSchema = getRequestBodySchema(endpoint);

  return (
    schemaSome(
      responseSchema,
      (node) => typeof node?.format === "string" && node.format.trim(),
    ) ||
    schemaSome(
      requestSchema,
      (node) => typeof node?.format === "string" && node.format.trim(),
    )
  );
}

function schemaHasStringConstraints(endpoint, profile) {
  if (typeof profile?.hasStringConstraints === "boolean") {
    return profile.hasStringConstraints;
  }

  const responseSchema = getResponseSchema(endpoint);
  const requestSchema = getRequestBodySchema(endpoint);

  return (
    schemaSome(
      responseSchema,
      (node) =>
        typeof node?.minLength === "number" ||
        typeof node?.maxLength === "number",
    ) ||
    schemaSome(
      requestSchema,
      (node) =>
        typeof node?.minLength === "number" ||
        typeof node?.maxLength === "number",
    )
  );
}

function schemaHasNumericConstraints(endpoint, profile) {
  if (typeof profile?.hasNumericConstraints === "boolean") {
    return profile.hasNumericConstraints;
  }

  const responseSchema = getResponseSchema(endpoint);
  const requestSchema = getRequestBodySchema(endpoint);

  return (
    schemaSome(
      responseSchema,
      (node) =>
        typeof node?.minimum === "number" ||
        typeof node?.maximum === "number" ||
        node?.exclusiveMinimum !== undefined ||
        node?.exclusiveMaximum !== undefined,
    ) ||
    schemaSome(
      requestSchema,
      (node) =>
        typeof node?.minimum === "number" ||
        typeof node?.maximum === "number" ||
        node?.exclusiveMinimum !== undefined ||
        node?.exclusiveMaximum !== undefined,
    )
  );
}

function schemaHasPattern(endpoint, profile) {
  if (typeof profile?.hasPattern === "boolean") {
    return profile.hasPattern;
  }

  const responseSchema = getResponseSchema(endpoint);
  const requestSchema = getRequestBodySchema(endpoint);

  return (
    schemaSome(
      responseSchema,
      (node) => typeof node?.pattern === "string" && node.pattern.trim(),
    ) ||
    schemaSome(
      requestSchema,
      (node) => typeof node?.pattern === "string" && node.pattern.trim(),
    )
  );
}

function schemaHasDateOrDatetimeFields(endpoint, profile) {
  if (typeof profile?.hasDateOrDatetimeFields === "boolean") {
    return profile.hasDateOrDatetimeFields;
  }

  const responseSchema = getResponseSchema(endpoint);
  const requestSchema = getRequestBodySchema(endpoint);

  return (
    schemaSome(
      responseSchema,
      (node) => node?.format === "date" || node?.format === "date-time",
    ) ||
    schemaSome(
      requestSchema,
      (node) => node?.format === "date" || node?.format === "date-time",
    )
  );
}

function requestBodySchemaControlsAdditionalProperties(endpoint, profile) {
  if (typeof profile?.requestBodyControlsAdditionalProperties === "boolean") {
    return profile.requestBodyControlsAdditionalProperties;
  }

  const schema = getRequestBodySchema(endpoint);
  return schema?.additionalProperties === false;
}

function requestBodyIsObject(endpoint, profile) {
  if (typeof profile?.requestBodyIsObject === "boolean") {
    return profile.requestBodyIsObject;
  }

  const schema = getRequestBodySchema(endpoint);
  return !!(schema && (schema.type === "object" || schema.properties));
}

function endpointCanConflict(endpoint, profile) {
  if (typeof profile?.canConflict === "boolean") {
    return profile.canConflict;
  }

  const schema = getRequestBodySchema(endpoint);
  const props = getSchemaProperties(schema);
  const names = Object.keys(props).map((x) => String(x).toLowerCase());

  return (
    normalizeMethod(profile?.method || endpoint?.method) === "POST" &&
    names.some((n) =>
      [
        "email",
        "username",
        "user_name",
        "external_id",
        "slug",
        "phone",
        "mobile",
        "uuid",
        "reference",
        "code",
      ].includes(n),
    )
  );
}

function endpointHasRateLimitContract(endpoint, profile) {
  if (typeof profile?.hasRateLimitContract === "boolean") {
    return profile.hasRateLimitContract;
  }

  const responses = endpoint?.responses || {};
  return !!responses["429"];
}

function endpointHasPaginationParams(endpoint, profile) {
  if (typeof profile?.hasPaginationParams === "boolean") {
    return profile.hasPaginationParams;
  }

  const names = getQueryParams(endpoint).map((p) =>
    String(p?.name || "").toLowerCase(),
  );

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

function endpointHasSortingParams(endpoint, profile) {
  if (typeof profile?.hasSortingParams === "boolean") {
    return profile.hasSortingParams;
  }

  const names = getQueryParams(endpoint).map((p) =>
    String(p?.name || "").toLowerCase(),
  );

  return names.some((n) =>
    ["sort", "sortby", "order", "orderby", "order_by"].includes(n),
  );
}

function endpointHasFilterParams(endpoint, profile) {
  if (typeof profile?.hasFilterParams === "boolean") {
    return profile.hasFilterParams;
  }

  const names = getQueryParams(endpoint).map((p) =>
    String(p?.name || "").toLowerCase(),
  );

  return names.some(
    (n) =>
      n.includes("filter") ||
      n === "status_filter" ||
      n === "type_filter" ||
      n === "filter_by",
  );
}

export const RULE_CONDITION_MAP = {
  endpoint_exists: endpointExists,

  method_is_delete: methodIsDelete,
  method_is_post_and_has_request_body: (endpoint, profile) =>
    methodIsPost(endpoint, profile) &&
    requestBodySchemaExists(endpoint, profile),
  method_is_put_or_patch_and_has_request_body: (endpoint, profile) =>
    (methodIsPut(endpoint, profile) || methodIsPatch(endpoint, profile)) &&
    requestBodySchemaExists(endpoint, profile),
  method_is_get_and_has_2xx_response: (endpoint, profile) =>
    methodIsGet(endpoint, profile) && endpointHas2xxResponse(endpoint, profile),
  method_is_write_and_has_2xx_response: (endpoint, profile) =>
    methodIsWrite(endpoint, profile) &&
    endpointHas2xxResponse(endpoint, profile),

  endpoint_has_2xx_response: endpointHas2xxResponse,
  endpoint_has_documented_success_status: endpointHas2xxResponse,
  success_response_documented: endpointHas2xxResponse,

  response_has_content_type: responseHasContentType,
  response_content_type_documented: responseHasContentType,

  response_has_headers: responseHasHeaders,
  response_headers_documented: responseHasHeaders,

  endpoint_has_path_params: endpointHasPathParams,
  path_params_documented: endpointHasPathParams,

  endpoint_has_query_params: endpointHasQueryParams,
  query_params_documented: endpointHasQueryParams,

  response_has_required_fields: responseHasRequiredFields,

  request_body_has_optional_fields: requestBodyHasOptionalFields,
  success_response_is_204: successResponseIs204,

  endpoint_has_documented_4xx_or_5xx: endpointHasDocumentedError,
  error_responses_documented: endpointHasDocumentedError,

  endpoint_has_summary_or_operationid: endpointHasSummaryOrOperationId,
  operation_metadata_exists: endpointHasSummaryOrOperationId,

  response_schema_exists: responseSchemaExists,
  request_body_schema_exists: requestBodySchemaExists,
  request_body_documented: requestBodySchemaExists,
  request_body_has_required_fields: requestBodyHasRequiredFields,

  response_schema_has_required_fields: responseSchemaHasRequiredFields,
  response_schema_has_typed_fields: responseSchemaHasTypedFields,
  response_schema_has_enum_fields: responseSchemaHasEnumFields,
  response_schema_has_nested_objects: responseSchemaHasNestedObjects,
  response_schema_has_array_fields: responseSchemaHasArrayFields,
  response_schema_has_format_fields: responseSchemaHasFormatFields,
  response_schema_has_numeric_constraints: responseSchemaHasNumericConstraints,
  response_schema_has_string_constraints: responseSchemaHasStringConstraints,
  response_schema_has_pattern_fields: responseSchemaHasPatternFields,
  schema_has_composition: schemaHasComposition,

  query_or_body_has_enum: responseOrRequestSchemaHasEnum,
  response_or_request_schema_has_enum: responseOrRequestSchemaHasEnum,
  query_or_body_has_format: schemaHasStringFormat,
  schema_has_string_format: schemaHasStringFormat,
  query_or_body_has_string_max_length: schemaHasStringConstraints,
  schema_has_string_constraints: schemaHasStringConstraints,
  query_or_body_has_numeric_maximum: schemaHasNumericConstraints,
  schema_has_numeric_constraints: schemaHasNumericConstraints,
  schema_has_pattern: schemaHasPattern,
  schema_has_date_or_datetime_fields: schemaHasDateOrDatetimeFields,
  request_body_schema_controls_additional_properties:
    requestBodySchemaControlsAdditionalProperties,
  request_body_is_object: requestBodyIsObject,

  endpoint_has_required_query: endpointHasRequiredQuery,
  endpoint_requires_auth: endpointRequiresAuth,
  endpoint_requires_role_scope: endpointRequiresRoleScope,
  endpoint_has_resource_identifier: endpointHasResourceIdentifier,
  query_params_have_typed_schema: queryParamsHaveTypedSchema,
  endpoint_can_conflict: endpointCanConflict,
  endpoint_has_rate_limit_contract: endpointHasRateLimitContract,

  endpoint_has_pagination: endpointHasPaginationParams,
  endpoint_has_pagination_params: endpointHasPaginationParams,
  endpoint_has_sorting_params: endpointHasSortingParams,
  endpoint_has_filter_params: endpointHasFilterParams,
  endpoint_has_sorting_or_filtering_params: (endpoint, profile) =>
    endpointHasSortingParams(endpoint, profile) ||
    endpointHasFilterParams(endpoint, profile),
};
