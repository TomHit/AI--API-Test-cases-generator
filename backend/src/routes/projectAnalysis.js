import express from "express";
import { analyzeProject } from "../core/intelligence/analyzeProject.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const {
      api_spec_link,
      project_notes,

      // new enrichment inputs
      documents_text,
      prd_text,
      jira_text,
      story_text,
      acceptance_criteria_text,
      comments_text,
      extra_texts,
    } = req.body;

    let openapi = null;

    if (api_spec_link) {
      const specRes = await fetch(api_spec_link);
      openapi = await specRes.json();
    }

    const result = await analyzeProject({
      openapi,
      projectNotes: project_notes || "",

      // pass doc/jira/prd content into analyzer
      documentsText: documents_text || "",
      prdText: prd_text || "",
      jiraText: jira_text || "",
      storyText: story_text || "",
      acceptanceCriteriaText: acceptance_criteria_text || "",
      commentsText: comments_text || "",
      extraTexts: Array.isArray(extra_texts) ? extra_texts : [],
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({
      message: err.message || "Analysis failed",
    });
  }
});

export default router;
