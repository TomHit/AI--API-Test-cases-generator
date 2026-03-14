import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";

function isHttpUrl(s) {
  return (
    typeof s === "string" &&
    (s.startsWith("http://") || s.startsWith("https://"))
  );
}

function normalizeSpecUrl(input) {
  const url = String(input || "").trim();
  if (!url) return url;

  if (url.startsWith("https://github.com/") && url.includes("/blob/")) {
    return url
      .replace("https://github.com/", "https://raw.githubusercontent.com/")
      .replace("/blob/", "/");
  }

  return url;
}

function buildCandidateSpecUrls(input) {
  const raw = String(input || "").trim();
  const normalized = normalizeSpecUrl(raw);
  const out = [];

  if (raw) out.push(raw);
  if (normalized && normalized !== raw) out.push(normalized);

  return [...new Set(out)];
}

function parseMaybeYaml(text, filename = "") {
  const trimmed = String(text || "").trim();
  if (!trimmed) throw new Error("OpenAPI is empty");

  const looksJson = trimmed.startsWith("{") || trimmed.startsWith("[");
  if (looksJson) return JSON.parse(trimmed);

  return yaml.load(trimmed);
}

async function fetchSpecFromCandidates(inputUrl) {
  const candidateUrls = buildCandidateSpecUrls(inputUrl);

  let lastStatus = null;
  let lastUrlTried = null;
  let text = null;
  let resolvedUrl = null;

  for (const candidateUrl of candidateUrls) {
    lastUrlTried = candidateUrl;

    const res = await fetch(candidateUrl, {
      headers: {
        Accept:
          "application/json, text/plain, application/yaml, text/yaml, application/x-yaml, */*",
      },
    });

    if (res.ok) {
      text = await res.text();
      resolvedUrl = candidateUrl;
      break;
    }

    lastStatus = res.status;
  }

  if (text == null) {
    throw new Error(
      `Failed to load OpenAPI URL: ${lastStatus || "unknown"}${lastUrlTried ? ` (${lastUrlTried})` : ""}`,
    );
  }

  return { text, resolvedUrl };
}

function normalizeProjectConfig(cfg = {}, projectId = "") {
  const project_id = cfg.project_id || projectId;
  const project_name = cfg.project_name || projectId;

  const legacyMode = cfg?.openapi?.mode;
  const legacyValue = cfg?.openapi?.value;

  const specSourceType = cfg.spec_source_type || legacyMode || "url";
  const specSource = cfg.spec_source || legacyValue || "";
  const specFormat = cfg.spec_format || "auto";

  return {
    ...cfg,
    project_id,
    project_name,
    spec_source_type: specSourceType,
    spec_source: specSource,
    spec_format: specFormat,
    openapi: {
      mode: specSourceType,
      value: specSource,
      format: specFormat,
    },
  };
}

export async function loadProjectConfig(projectId) {
  const p = path.join(process.cwd(), "projects", projectId, "project.json");
  const raw = await fs.readFile(p, "utf-8");
  const parsed = JSON.parse(raw);
  return normalizeProjectConfig(parsed, projectId);
}

export async function loadOpenApiDoc(projectId, opts = {}) {
  const override = String(opts?.specSourceOverride || "").trim();

  if (override) {
    if (!/^https?:\/\//i.test(override)) {
      throw new Error("Only http/https OpenAPI URL is supported right now");
    }

    const { text, resolvedUrl } = await fetchSpecFromCandidates(override);
    const doc = parseMaybeYaml(text, resolvedUrl || override);

    return {
      cfg: normalizeProjectConfig(
        {
          project_id: projectId,
          project_name: projectId,
          spec_source_type: "url",
          spec_source: resolvedUrl || override,
          spec_format: "auto",
        },
        projectId,
      ),
      doc,
    };
  }

  const cfg = await loadProjectConfig(projectId);
  const specSource = String(cfg.spec_source || "").trim();
  const specSourceType = String(cfg.spec_source_type || "url").trim();

  if (!specSource) {
    throw new Error("Project spec source is missing");
  }

  if (specSourceType === "raw") {
    return {
      cfg,
      doc: parseMaybeYaml(specSource, `${projectId}:inline-spec`),
    };
  }

  if (isHttpUrl(specSource)) {
    const { text, resolvedUrl } = await fetchSpecFromCandidates(specSource);
    return {
      cfg: normalizeProjectConfig(
        {
          ...cfg,
          spec_source: resolvedUrl || specSource,
        },
        projectId,
      ),
      doc: parseMaybeYaml(text, resolvedUrl || specSource),
    };
  }

  const full = path.join(process.cwd(), "projects", projectId, specSource);
  const text = await fs.readFile(full, "utf-8");

  return {
    cfg,
    doc: parseMaybeYaml(text, full),
  };
}
