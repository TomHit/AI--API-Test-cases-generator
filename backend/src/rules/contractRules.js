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

/**
 * Legacy compatibility helper.
 * Prefer endpointProfiler.has2xxResponse / ruleConditionMap fallbacks in new code.
 */
export function shouldGenerateContractSuccess(endpoint) {
  if (endpoint?.responses && typeof endpoint.responses === "object") {
    return Object.keys(endpoint.responses).some((code) =>
      /^2\d\d$/.test(String(code)),
    );
  }

  const status = endpoint?.response?.status;
  return typeof status === "number" && status >= 200 && status < 300;
}

/**
 * Legacy compatibility helper.
 * Prefer endpointProfiler.responseHasRequiredFields in new code.
 */
export function shouldGenerateContractRequiredFields(endpoint) {
  if (endpoint?.responses && typeof endpoint.responses === "object") {
    const successResponses = Object.entries(endpoint.responses)
      .filter(([code]) => /^2\d\d$/.test(String(code)))
      .sort(([a], [b]) => Number(a) - Number(b));

    for (const [, val] of successResponses) {
      const schema = getJsonSchemaFromContent(val?.content);
      if (!schema) continue;

      const hasRequired =
        Array.isArray(schema.required) && schema.required.length > 0;

      const hasProperties =
        schema?.properties && typeof schema.properties === "object"
          ? Object.keys(schema.properties).length > 0
          : false;

      if (hasRequired || hasProperties) return true;
    }
  }

  const summaryProps = endpoint?.response?.schemaSummary?.properties;
  return Array.isArray(summaryProps) && summaryProps.length > 0;
}
