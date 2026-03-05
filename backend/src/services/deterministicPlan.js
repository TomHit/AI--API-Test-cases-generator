function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix, i) {
  return `${prefix}.${String(i).padStart(3, "0")}`;
}

export function buildDeterministicTestPlan({ project, options, endpoints }) {
  const include = Array.isArray(options?.include)
    ? options.include
    : ["contract", "schema"];

  const suites = [];

  // CONTRACT suite
  if (include.includes("contract")) {
    const cases = [];
    let i = 1;

    for (const ep of endpoints) {
      const eid = ep.id || `${ep.method}_${ep.path}`.replace(/[^\w]+/g, "_");

      // TC: Status code (generic 200)
      cases.push({
        id: makeId(`TC.${eid}.contract.status`, i++),
        title: `Contract | ${ep.method} ${ep.path} returns 2xx`,
        type: "contract",
        priority: "P1",
        method: String(ep.method).toUpperCase(),
        path: ep.path,
        request: {
          query: {},
          headers: {},
        },
        steps: [
          {
            action: "send_request",
            method: String(ep.method).toUpperCase(),
            path: ep.path,
          },
        ],
        expected: [
          { kind: "status_2xx" },
          { kind: "content_type_json" },
          { kind: "body_is_json" },
        ],
        assertions: [
          { op: "status_in_range", min: 200, max: 299 },
          {
            op: "header_contains",
            key: "content-type",
            contains: "application/json",
          },
        ],
        needs_review: true,
        review_notes:
          "Default contract test. Add required query/path params and auth headers using rules.",
      });

      // TC: Error contract (optional baseline)
      cases.push({
        id: makeId(`TC.${eid}.contract.error`, i++),
        title: `Contract | ${ep.method} ${ep.path} error shape (if 4xx/5xx)`,
        type: "contract",
        priority: "P3",
        method: String(ep.method).toUpperCase(),
        path: ep.path,
        request: {
          query: {},
          headers: {},
        },
        steps: [
          {
            action: "send_request",
            method: String(ep.method).toUpperCase(),
            path: ep.path,
          },
        ],
        expected: [{ kind: "json_or_empty_on_error" }],
        assertions: [{ op: "no_html_error" }],
        needs_review: true,
        review_notes:
          "Baseline error contract. Tighten when spec defines error schema.",
      });
    }

    suites.push({
      suite_id: "contract",
      name: "Contract Tests (Deterministic)",
      endpoints: endpoints.map((e) => ({ method: e.method, path: e.path })),
      cases,
    });
  }

  // SCHEMA suite
  if (include.includes("schema")) {
    const cases = [];
    let i = 1;

    for (const ep of endpoints) {
      const eid = ep.id || `${ep.method}_${ep.path}`.replace(/[^\w]+/g, "_");

      cases.push({
        id: makeId(`TC.${eid}.schema.ajv`, i++),
        title: `Schema | ${ep.method} ${ep.path} matches OpenAPI schema (2xx)`,
        type: "schema",
        priority: "P1",
        method: String(ep.method).toUpperCase(),
        path: ep.path,
        request: {
          query: {},
          headers: {},
        },
        steps: [
          {
            action: "send_request",
            method: String(ep.method).toUpperCase(),
            path: ep.path,
          },
          { action: "validate_schema", source: "openapi", status: "2xx" },
        ],
        expected: [{ kind: "schema_valid" }],
        assertions: [{ op: "schema_validate_openapi", status: "2xx" }],
        needs_review: true,
        review_notes:
          "Requires OpenAPI response schema. If missing in spec, mark as baseline-only.",
      });
    }

    suites.push({
      suite_id: "schema",
      name: "Schema Tests (Deterministic)",
      endpoints: endpoints.map((e) => ({ method: e.method, path: e.path })),
      cases,
    });
  }

  return {
    project,
    generation: {
      generated_at: nowIso(),
      generator_version: "v1",
      model: "deterministic",
      prompt_version: "p1",
      rag_enabled: false,
    },
    suites,
  };
}
