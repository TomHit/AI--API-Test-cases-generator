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

function getResponseSchema(endpoint) {
  for (const [, val] of getSuccessResponses(endpoint)) {
    const schema = getJsonSchemaFromContent(val?.content);
    if (schema) return schema;
  }

  return null;
}

function getRequestSchema(endpoint) {
  return getJsonSchemaFromContent(endpoint?.requestBody?.content);
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

/**
 * Legacy compatibility helper.
 * Prefer endpointProfiler.hasResponseSchema in new code.
 */
export function shouldGenerateSchemaResponse(endpoint) {
  if (endpoint?.responses && typeof endpoint.responses === "object") {
    return !!getResponseSchema(endpoint);
  }

  return !!endpoint?.response?.schemaSummary;
}

/**
 * Legacy compatibility helper.
 * Prefer endpointProfiler.hasRequestBody in new code.
 */
export function shouldGenerateSchemaRequestBody(endpoint) {
  return !!getRequestSchema(endpoint);
}

export function shouldGenerateSchemaRequiredFields(endpoint) {
  const schema = getResponseSchema(endpoint);
  return Array.isArray(schema?.required) && schema.required.length > 0;
}

export function shouldGenerateSchemaTypedFields(endpoint) {
  const schema = getResponseSchema(endpoint);
  return schemaSome(
    schema,
    (node) =>
      !!node?.type || !!node?.format || !!node?.items || !!node?.properties,
  );
}

export function shouldGenerateSchemaEnum(endpoint) {
  const schema = getResponseSchema(endpoint);
  return schemaSome(
    schema,
    (node) => Array.isArray(node?.enum) && node.enum.length > 0,
  );
}

export function shouldGenerateSchemaNestedObjects(endpoint) {
  const schema = getResponseSchema(endpoint);

  let objectCount = 0;
  walkSchema(schema, (node) => {
    if (node?.type === "object" || !!node?.properties) {
      objectCount += 1;
    }
  });

  return objectCount > 1;
}

export function shouldGenerateSchemaArray(endpoint) {
  const schema = getResponseSchema(endpoint);
  return schemaSome(schema, (node) => node?.type === "array" || !!node?.items);
}

export function shouldGenerateSchemaFormat(endpoint) {
  const schema = getResponseSchema(endpoint);
  return schemaSome(schema, (node) => typeof node?.format === "string");
}

export function shouldGenerateSchemaNumericConstraints(endpoint) {
  const schema = getResponseSchema(endpoint);
  return schemaSome(
    schema,
    (node) =>
      node?.minimum !== undefined ||
      node?.maximum !== undefined ||
      node?.exclusiveMinimum !== undefined ||
      node?.exclusiveMaximum !== undefined,
  );
}

export function shouldGenerateSchemaStringConstraints(endpoint) {
  const schema = getResponseSchema(endpoint);
  return schemaSome(
    schema,
    (node) => node?.minLength !== undefined || node?.maxLength !== undefined,
  );
}

export function shouldGenerateSchemaPattern(endpoint) {
  const schema = getResponseSchema(endpoint);
  return schemaSome(schema, (node) => typeof node?.pattern === "string");
}

export function shouldGenerateSchemaComposition(endpoint) {
  const responseSchema = getResponseSchema(endpoint);
  const requestSchema = getRequestSchema(endpoint);

  return (
    schemaSome(
      responseSchema,
      (node) => !!node?.oneOf || !!node?.anyOf || !!node?.allOf,
    ) ||
    schemaSome(
      requestSchema,
      (node) => !!node?.oneOf || !!node?.anyOf || !!node?.allOf,
    )
  );
}

export function shouldGenerateRequestBodyRequiredFields(endpoint) {
  const schema = getRequestSchema(endpoint);
  return Array.isArray(schema?.required) && schema.required.length > 0;
}
