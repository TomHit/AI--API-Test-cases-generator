/**
 * Rule: endpoint has a documented 2xx success response
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
 * Rule: endpoint has a success response schema with properties or required fields
 */
export function shouldGenerateContractRequiredFields(endpoint) {
  if (endpoint?.responses && typeof endpoint.responses === "object") {
    for (const [code, val] of Object.entries(endpoint.responses)) {
      if (!/^2\d\d$/.test(String(code))) continue;

      const content = val?.content || {};
      const appJson =
        content["application/json"] || content["application/*+json"];

      const schema = appJson?.schema;
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
