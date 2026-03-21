import express from "express";
import fs from "fs/promises";
import path from "path";

import { generateTestPlan } from "./src/services/generator.js";
import { renderCsvFromTestPlan } from "./src/services/csvRenderer.js";

import { loadOpenApiDoc } from "./src/services/openapiLoader.js";
import {
  extractEndpointsLite,
  extractEndpointsFull,
} from "./src/services/openapiParser.js";

process.on("uncaughtException", (err) =>
  console.error("UNCAUGHT EXCEPTION:", err),
);
process.on("unhandledRejection", (err) =>
  console.error("UNHANDLED REJECTION:", err),
);

const app = express();
app.use(express.json({ limit: "2mb" }));

// increase timeouts a bit for local ollama
app.use((req, res, next) => {
  req.setTimeout(120000);
  res.setTimeout(120000);
  next();
});

const PROJECTS_DIR = path.join(process.cwd(), "projects");

async function ensureProjectsDir() {
  await fs.mkdir(PROJECTS_DIR, { recursive: true });
}

async function loadAllProjects() {
  await ensureProjectsDir();

  const entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
  const projects = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const projectFile = path.join(PROJECTS_DIR, entry.name, "project.json");

    try {
      const raw = await fs.readFile(projectFile, "utf-8");
      const parsed = JSON.parse(raw);

      projects.push({
        project_id: parsed.project_id,
        project_name: parsed.project_name,
        env_count: parsed.env_count ?? 1,
        docs_status: parsed.docs_status || "missing",
        description: parsed.description || "",
        spec_source_type: parsed.spec_source_type || "url",
        spec_source: parsed.spec_source || parsed?.openapi?.value || "",
        spec_format: parsed.spec_format || "auto",
        last_generated_at: parsed.last_generated_at || null,
      });
    } catch (err) {
      console.error("PROJECT READ ERROR:", projectFile, err);
    }
  }

  return projects.sort((a, b) =>
    String(a.project_name || "").localeCompare(String(b.project_name || "")),
  );
}

// Health
app.get("/api/health", (req, res) => res.json({ ok: true }));

// Projects list from disk
app.get("/api/projects", async (req, res) => {
  try {
    const projects = await loadAllProjects();
    res.json(projects);
  } catch (e) {
    console.error("PROJECTS ERROR:", e);
    res.status(500).json({ message: e?.message || String(e) });
  }
});

// Create new project
app.post("/api/projects", async (req, res) => {
  try {
    await ensureProjectsDir();

    const body = req.body || {};
    const projectName = String(body.project_name || "").trim();

    if (!projectName) {
      return res.status(400).json({ message: "project_name is required" });
    }

    const projectId = `proj_${Date.now()}`;
    const projectDir = path.join(PROJECTS_DIR, projectId);

    await fs.mkdir(projectDir, { recursive: true });

    const envCount = Number(body.env_count) || 1;
    const description = String(body.description || "").trim();
    const specSourceType = String(body.spec_source_type || "url").trim();
    const specSource = String(body.spec_source || "").trim();
    const specFormat = String(body.spec_format || "auto").trim();

    const projectConfig = {
      project_id: projectId,
      project_name: projectName,
      env_count: envCount,
      description,
      docs_status: specSource ? "ok" : "missing",
      spec_source_type: specSourceType,
      spec_source: specSource,
      spec_format: specFormat,
      last_generated_at: null,
      openapi: {
        mode: specSourceType === "file" ? "file" : "url",
        value: specSource,
        format: specFormat,
      },
    };

    await fs.writeFile(
      path.join(projectDir, "project.json"),
      JSON.stringify(projectConfig, null, 2),
      "utf-8",
    );

    res.status(201).json(projectConfig);
  } catch (e) {
    console.error("PROJECT CREATE ERROR:", e);
    res.status(500).json({ message: e?.message || String(e) });
  }
});

// Endpoints list from OpenAPI
app.get("/api/projects/:id/endpoints", async (req, res) => {
  try {
    const projectId = req.params.id;
    const specSource = String(req.query.spec_source || "").trim();

    const { doc } = await loadOpenApiDoc(projectId, {
      specSourceOverride: specSource || null,
    });

    const endpoints = extractEndpointsLite(doc);

    console.log("ENDPOINTS COUNT:", endpoints.length);

    res.json(
      endpoints.map((e) => ({
        id: e.id,
        method: e.method,
        path: e.path,
        tags: e.tags || [],
        summary: e.summary || "",
        response: e.response || null,
      })),
    );
  } catch (e) {
    console.error("ENDPOINTS ERROR:", e);
    res.status(400).json({ message: e?.message || String(e) });
  }
});

// Core: generate
app.post("/api/generate", async (req, res) => {
  try {
    const payload = req.body || {};

    console.log("POST /api/generate", {
      project_id: payload?.project_id,
      env: payload?.env,
      auth_profile: payload?.auth_profile,
      include: payload?.include,
      ai: payload?.ai,
      endpoints_n: Array.isArray(payload?.endpoints)
        ? payload.endpoints.length
        : null,
      guidance_len: payload?.guidance ? String(payload.guidance).length : 0,
    });

    const out = await generateTestPlan(payload);
    const csv = renderCsvFromTestPlan(out.testplan);

    res.json({
      run_id: out.run_id,
      generation_mode: out.generation_mode,
      spec_quality: out.spec_quality,
      blocked_endpoints: out.blocked_endpoints,
      eligible_endpoints: out.eligible_endpoints,
      testplan: out.testplan,
      report: out.report,
      csv,
    });
  } catch (e) {
    console.error("GENERATE ERROR:", e);

    const status =
      e?.name === "AjvValidationError" ||
      e?.code === "SCHEMA_INVALID" ||
      e?.details
        ? 400
        : 500;

    res.status(status).json({
      message: e?.message || String(e),
      details: e?.details || null,
      ...(status === 500 ? { stack: e?.stack || null } : {}),
    });
  }
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;
app.listen(PORT, () => {
  console.log(`Generator backend running on http://127.0.0.1:${PORT}`);
  console.log(`Health: http://127.0.0.1:${PORT}/api/health`);
});
