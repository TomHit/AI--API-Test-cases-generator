import {
  makeContractSuccessTemplate,
  makeContractRequiredFieldsTemplate,
} from "../templates/contractTemplates.js";

import {
  makeSchemaResponseTemplate,
  makeSchemaRequestBodyTemplate,
} from "../templates/schemaTemplates.js";

import { makeNegativeMissingRequiredQueryTemplate } from "../templates/negativeTemplates.js";

import { makeAuthMissingCredentialsTemplate } from "../templates/authTemplates.js";

/**
 * Helper: check if endpoint has a success response
 */
function hasSuccessResponse(endpoint) {
  if (endpoint?.responses && typeof endpoint.responses === "object") {
    return Object.keys(endpoint.responses).some((k) =>
      /^2\d\d$/.test(String(k)),
    );
  }

  // fallback for summarized parser shape: { status, contentType, schemaSummary }
  const status = endpoint?.response?.status;
  return typeof status === "number" && status >= 200 && status < 300;
}

/**
 * Helper: check if response likely has schema
 */
function hasResponseSchema(endpoint) {
  if (endpoint?.responses && typeof endpoint.responses === "object") {
    for (const [code, val] of Object.entries(endpoint.responses)) {
      if (!/^2\d\d$/.test(String(code))) continue;

      const content = val?.content || {};
      const appJson =
        content["application/json"] || content["application/*+json"];
      if (appJson?.schema) return true;
    }
  }

  // fallback for summarized parser shape
  return !!endpoint?.response?.schemaSummary;
}

/**
 * Helper: check if request body schema exists
 */
function hasRequestBodySchema(endpoint) {
  const content = endpoint?.requestBody?.content || {};
  return !!(
    content["application/json"]?.schema || content["application/*+json"]?.schema
  );
}

/**
 * Helper: check required query params
 */
function hasRequiredQuery(endpoint) {
  return (
    Array.isArray(endpoint?.params?.query) &&
    endpoint.params.query.some((p) => p.required)
  );
}

/**
 * Helper: check auth/security
 */
function hasSecurity(endpoint) {
  if (Array.isArray(endpoint?.security)) {
    return endpoint.security.length > 0;
  }
  return !!endpoint?.security;
}

/**
 * Generate all applicable test cases for one endpoint
 * Max 1 per included type, max 3 total
 */
export function generateCasesForEndpoint(endpoint, options = {}) {
  const include = Array.isArray(options?.include)
    ? options.include
    : ["smoke", "contract", "negative"];

  const cases = [];

  // SMOKE
  if (include.includes("smoke") && hasSuccessResponse(endpoint)) {
    cases.push(makeContractSuccessTemplate(endpoint));
  }

  // CONTRACT
  if (include.includes("contract")) {
    if (hasResponseSchema(endpoint)) {
      cases.push(makeContractRequiredFieldsTemplate(endpoint));
    } else if (hasSuccessResponse(endpoint)) {
      cases.push(makeContractSuccessTemplate(endpoint));
    } else if (hasRequestBodySchema(endpoint)) {
      cases.push(makeSchemaRequestBodyTemplate(endpoint));
    }
  }

  // NEGATIVE
  if (include.includes("negative")) {
    if (hasRequiredQuery(endpoint)) {
      cases.push(makeNegativeMissingRequiredQueryTemplate(endpoint));
    } else if (hasSecurity(endpoint)) {
      cases.push(makeAuthMissingCredentialsTemplate(endpoint));
    }
  }

  return cases.slice(0, 3);
}

/**
 * Generate test cases for multiple endpoints
 */
export function generateCasesForEndpoints(endpoints, options = {}) {
  const eps = Array.isArray(endpoints) ? endpoints : [];
  let allCases = [];

  for (const endpoint of eps) {
    const cases = generateCasesForEndpoint(endpoint, options);
    allCases = allCases.concat(cases);
  }

  return allCases;
}
