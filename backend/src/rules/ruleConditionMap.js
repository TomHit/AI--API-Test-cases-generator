import {
  shouldGenerateContractSuccess,
  shouldGenerateContractRequiredFields,
} from "./contractRules.js";

import {
  shouldGenerateSchemaResponse,
  shouldGenerateSchemaRequestBody,
  shouldGenerateSchemaRequiredFields,
  shouldGenerateSchemaTypedFields,
  shouldGenerateSchemaEnum,
  shouldGenerateSchemaNestedObjects,
  shouldGenerateSchemaArray,
  shouldGenerateSchemaFormat,
  shouldGenerateSchemaNumericConstraints,
  shouldGenerateSchemaStringConstraints,
  shouldGenerateSchemaPattern,
  shouldGenerateSchemaComposition,
  shouldGenerateRequestBodyRequiredFields,
} from "./schemaRules.js";

import {
  shouldGenerateNegativeMissingRequiredQuery,
  shouldGenerateAuthMissingCredentials,
} from "./negativeRules.js";

function normalizeMethod(method) {
  return String(method || "").toUpperCase();
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

function endpointExists(endpoint, profile) {
  return !!(profile?.exists ?? endpoint);
}

function endpointHas2xxResponse(endpoint, profile) {
  if (typeof profile?.has2xxResponse === "boolean")
    return profile.has2xxResponse;
  return shouldGenerateContractSuccess(endpoint);
}

function responseHasContentType(endpoint, profile) {
  if (typeof profile?.hasResponseContentType === "boolean") {
    return profile.hasResponseContentType;
  }
  return false;
}

function responseHasHeaders(endpoint, profile) {
  if (typeof profile?.hasResponseHeaders === "boolean") {
    return profile.hasResponseHeaders;
  }
  return false;
}

function endpointHasPathParams(endpoint, profile) {
  if (typeof profile?.hasPathParams === "boolean") return profile.hasPathParams;
  return (
    Array.isArray(endpoint?.params?.path) && endpoint.params.path.length > 0
  );
}

function endpointHasQueryParams(endpoint, profile) {
  if (typeof profile?.hasQueryParams === "boolean")
    return profile.hasQueryParams;
  return (
    Array.isArray(endpoint?.params?.query) && endpoint.params.query.length > 0
  );
}

function endpointHasRequiredQuery(endpoint, profile) {
  if (typeof profile?.hasRequiredQuery === "boolean")
    return profile.hasRequiredQuery;
  return shouldGenerateNegativeMissingRequiredQuery(endpoint);
}

function requestBodyHasOptionalFields(endpoint, profile) {
  if (typeof profile?.requestBodyHasOptionalFields === "boolean") {
    return profile.requestBodyHasOptionalFields;
  }
  return false;
}

function successResponseIs204(endpoint, profile) {
  if (typeof profile?.successResponseIs204 === "boolean") {
    return profile.successResponseIs204;
  }
  return !!endpoint?.responses?.["204"];
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
  return shouldGenerateSchemaResponse(endpoint);
}

function responseHasRequiredFields(endpoint, profile) {
  if (typeof profile?.responseHasRequiredFields === "boolean") {
    return profile.responseHasRequiredFields;
  }
  return shouldGenerateContractRequiredFields(endpoint);
}

function requestBodySchemaExists(endpoint, profile) {
  if (typeof profile?.hasRequestBody === "boolean") {
    return profile.hasRequestBody;
  }
  return shouldGenerateSchemaRequestBody(endpoint);
}

function requestBodyHasRequiredFields(endpoint, profile) {
  if (typeof profile?.requestBodyHasRequiredFields === "boolean") {
    return profile.requestBodyHasRequiredFields;
  }
  return shouldGenerateRequestBodyRequiredFields(endpoint);
}

function responseSchemaHasRequiredFields(endpoint, profile) {
  if (typeof profile?.responseHasRequiredFields === "boolean") {
    return profile.responseHasRequiredFields;
  }
  return shouldGenerateSchemaRequiredFields(endpoint);
}

function responseSchemaHasTypedFields(endpoint, profile) {
  if (typeof profile?.responseSchemaHasTypedFields === "boolean") {
    return profile.responseSchemaHasTypedFields;
  }
  return shouldGenerateSchemaTypedFields(endpoint);
}

function responseSchemaHasEnumFields(endpoint, profile) {
  if (typeof profile?.responseSchemaHasEnumFields === "boolean") {
    return profile.responseSchemaHasEnumFields;
  }
  return shouldGenerateSchemaEnum(endpoint);
}

function responseSchemaHasNestedObjects(endpoint, profile) {
  if (typeof profile?.responseSchemaHasNestedObjects === "boolean") {
    return profile.responseSchemaHasNestedObjects;
  }
  return shouldGenerateSchemaNestedObjects(endpoint);
}

function responseSchemaHasArrayFields(endpoint, profile) {
  if (typeof profile?.responseSchemaHasArrayFields === "boolean") {
    return profile.responseSchemaHasArrayFields;
  }
  return shouldGenerateSchemaArray(endpoint);
}

function responseSchemaHasFormatFields(endpoint, profile) {
  if (typeof profile?.responseSchemaHasFormatFields === "boolean") {
    return profile.responseSchemaHasFormatFields;
  }
  return shouldGenerateSchemaFormat(endpoint);
}

function responseSchemaHasNumericConstraints(endpoint, profile) {
  if (typeof profile?.responseSchemaHasNumericConstraints === "boolean") {
    return profile.responseSchemaHasNumericConstraints;
  }
  return shouldGenerateSchemaNumericConstraints(endpoint);
}

function responseSchemaHasStringConstraints(endpoint, profile) {
  if (typeof profile?.responseSchemaHasStringConstraints === "boolean") {
    return profile.responseSchemaHasStringConstraints;
  }
  return shouldGenerateSchemaStringConstraints(endpoint);
}

function responseSchemaHasPatternFields(endpoint, profile) {
  if (typeof profile?.responseSchemaHasPatternFields === "boolean") {
    return profile.responseSchemaHasPatternFields;
  }
  return shouldGenerateSchemaPattern(endpoint);
}

function schemaHasComposition(endpoint, profile) {
  if (typeof profile?.schemaHasComposition === "boolean") {
    return profile.schemaHasComposition;
  }
  return shouldGenerateSchemaComposition(endpoint);
}

function endpointRequiresAuth(endpoint, profile) {
  if (typeof profile?.requiresAuth === "boolean") {
    return profile.requiresAuth;
  }
  return shouldGenerateAuthMissingCredentials(endpoint);
}

function endpointRequiresRoleScope(_endpoint, profile) {
  if (typeof profile?.requiresRoleScope === "boolean") {
    return profile.requiresRoleScope;
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
  const query = Array.isArray(endpoint?.params?.query)
    ? endpoint.params.query
    : [];
  return query.some(
    (p) => !!p?.schema?.type || !!p?.type || !!p?.schema?.format,
  );
}

function responseOrRequestSchemaHasEnum(endpoint, profile) {
  if (typeof profile?.hasEnum === "boolean") {
    return profile.hasEnum;
  }
  return shouldGenerateSchemaEnum(endpoint);
}

function schemaHasStringFormat(endpoint, profile) {
  if (typeof profile?.hasFormat === "boolean") {
    return profile.hasFormat;
  }
  return shouldGenerateSchemaFormat(endpoint);
}

function schemaHasStringConstraints(endpoint, profile) {
  if (typeof profile?.hasStringConstraints === "boolean") {
    return profile.hasStringConstraints;
  }
  return shouldGenerateSchemaStringConstraints(endpoint);
}

function schemaHasNumericConstraints(endpoint, profile) {
  if (typeof profile?.hasNumericConstraints === "boolean") {
    return profile.hasNumericConstraints;
  }
  return shouldGenerateSchemaNumericConstraints(endpoint);
}

function schemaHasPattern(endpoint, profile) {
  if (typeof profile?.hasPattern === "boolean") {
    return profile.hasPattern;
  }
  return shouldGenerateSchemaPattern(endpoint);
}

function schemaHasDateOrDatetimeFields(_endpoint, profile) {
  if (typeof profile?.hasDateOrDatetimeFields === "boolean") {
    return profile.hasDateOrDatetimeFields;
  }
  return false;
}

function requestBodySchemaControlsAdditionalProperties(_endpoint, profile) {
  if (typeof profile?.requestBodyControlsAdditionalProperties === "boolean") {
    return profile.requestBodyControlsAdditionalProperties;
  }
  return false;
}

function requestBodyIsObject(_endpoint, profile) {
  if (typeof profile?.requestBodyIsObject === "boolean") {
    return profile.requestBodyIsObject;
  }
  return false;
}

function endpointCanConflict(_endpoint, profile) {
  if (typeof profile?.canConflict === "boolean") {
    return profile.canConflict;
  }
  return false;
}

function endpointHasRateLimitContract(_endpoint, profile) {
  if (typeof profile?.hasRateLimitContract === "boolean") {
    return profile.hasRateLimitContract;
  }
  return false;
}

function endpointHasPaginationParams(_endpoint, profile) {
  if (typeof profile?.hasPaginationParams === "boolean") {
    return profile.hasPaginationParams;
  }
  return false;
}

function endpointHasSortingParams(_endpoint, profile) {
  if (typeof profile?.hasSortingParams === "boolean") {
    return profile.hasSortingParams;
  }
  return false;
}

function endpointHasFilterParams(_endpoint, profile) {
  if (typeof profile?.hasFilterParams === "boolean") {
    return profile.hasFilterParams;
  }
  return false;
}

export const RULE_CONDITION_MAP = {
  // Basic existence / method
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

  // Contract
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

  // Schema
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

  // Negative / Auth
  endpoint_has_required_query: endpointHasRequiredQuery,
  endpoint_requires_auth: endpointRequiresAuth,
  endpoint_requires_role_scope: endpointRequiresRoleScope,
  endpoint_has_resource_identifier: endpointHasResourceIdentifier,
  query_params_have_typed_schema: queryParamsHaveTypedSchema,
  endpoint_can_conflict: endpointCanConflict,
  endpoint_has_rate_limit_contract: endpointHasRateLimitContract,

  // Query behavior
  endpoint_has_pagination: endpointHasPaginationParams,
  endpoint_has_pagination_params: endpointHasPaginationParams,
  endpoint_has_sorting_params: endpointHasSortingParams,
  endpoint_has_filter_params: endpointHasFilterParams,
  endpoint_has_sorting_or_filtering_params: (endpoint, profile) =>
    endpointHasSortingParams(endpoint, profile) ||
    endpointHasFilterParams(endpoint, profile),
};
