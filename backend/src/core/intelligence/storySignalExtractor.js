function cleanText(value = "") {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function lower(value = "") {
  return cleanText(value).toLowerCase();
}

function unique(items = []) {
  return [...new Set((items || []).filter(Boolean))];
}

function detectActors(text = "") {
  const t = lower(text);
  const actors = [];

  if (/\bmerchant\b/.test(t)) actors.push("merchant");
  if (/\bcustomer\b/.test(t)) actors.push("customer");
  if (/\buser\b/.test(t)) actors.push("user");
  if (/\badmin\b/.test(t)) actors.push("admin");
  if (/\boperator\b/.test(t)) actors.push("operator");
  if (/\bagent\b/.test(t)) actors.push("agent");
  if (/\bbuyer\b/.test(t)) actors.push("buyer");
  if (/\bseller\b/.test(t)) actors.push("seller");
  if (/\bpatient\b/.test(t)) actors.push("patient");
  if (/\bdoctor\b/.test(t)) actors.push("doctor");
  if (/\bmanager\b/.test(t)) actors.push("manager");
  if (/\bemployee\b/.test(t)) actors.push("employee");

  return unique(actors);
}

function detectIntent(text = "") {
  const t = cleanText(text);

  const asMatch = t.match(
    /as\s+a?n?\s+(.+?)(?:,|\s+i\s+want|\s+i\s+should|\s+i\s+can|$)/i,
  );
  const wantMatch = t.match(
    /i\s+(?:want\s+to|should\s+be\s+able\s+to|can)\s+(.+?)(?:\s+so\s+that|\.$|$)/i,
  );
  const soThatMatch = t.match(/so\s+that\s+(.+?)(?:\.$|$)/i);

  return {
    actor_phrase: asMatch?.[1]?.trim() || "",
    action_phrase: wantMatch?.[1]?.trim() || "",
    benefit_phrase: soThatMatch?.[1]?.trim() || "",
  };
}

function detectDomainHints(text = "") {
  const t = lower(text);
  const out = [];

  if (
    /\bpayment\b|\bupi\b|\brefund\b|\bsettlement\b|\btransaction\b|\bnet banking\b|\bwallet\b|\bchargeback\b|\bdispute\b/.test(
      t,
    )
  ) {
    out.push("banking_finance");
  }

  if (
    /\bpatient\b|\bclaim\b|\bdiagnosis\b|\bhospital\b|\bmedical\b|\bhealth\b/.test(
      t,
    )
  ) {
    out.push("healthcare");
  }

  if (
    /\bchat\b|\bprompt\b|\bmodel\b|\brag\b|\bknowledge base\b|\bembedding\b/.test(
      t,
    )
  ) {
    out.push("ai_system");
  }

  if (/\border\b|\bcart\b|\bcheckout\b|\bshipment\b|\binventory\b/.test(t)) {
    out.push("ecommerce");
  }

  return unique(out);
}

function detectActionHints(text = "") {
  const t = lower(text);
  const out = [];

  if (/\bpay\b|\bpayment\b|\bcollect\b/.test(t)) out.push("payment");
  if (/\brefund\b/.test(t)) out.push("refund");
  if (/\bsettlement\b/.test(t)) out.push("settlement");
  if (/\bdispute\b|\bchargeback\b/.test(t)) out.push("dispute");
  if (/\bnotify\b|\bemail\b|\bsms\b|\balert\b/.test(t)) {
    out.push("notification");
  }
  if (/\blogin\b|\bauth\b|\bsign in\b/.test(t)) out.push("authentication");
  if (/\bupload\b|\battachment\b|\bfile\b/.test(t)) out.push("upload");
  if (/\bsearch\b|\bretrieve\b|\bquery\b/.test(t)) out.push("search");

  return unique(out);
}

function detectSystems(text = "") {
  const t = lower(text);
  const out = [];

  if (/\bui\b|\bfrontend\b|\bcheckout\b|\bportal\b|\bapp\b/.test(t)) {
    out.push("ui");
  }
  if (/\bapi\b|\bbackend\b|\bservice\b|\bserver\b/.test(t)) {
    out.push("backend_api");
  }
  if (
    /\bgateway\b|\bprovider\b|\bthird[- ]party\b|\bexternal service\b|\bwebhook\b/.test(
      t,
    )
  ) {
    out.push("external_dependency");
  }
  if (/\bdb\b|\bdatabase\b|\bpersist\b|\bstore\b|\brecord\b/.test(t)) {
    out.push("database");
  }
  if (
    /\bqueue\b|\basync\b|\bevent\b|\bsettlement\b|\breconciliation\b/.test(t)
  ) {
    out.push("async_processor");
  }

  return unique(out);
}

function detectDataEntities(text = "") {
  const t = lower(text);
  const out = [];

  if (/\border\b/.test(t)) out.push("order");
  if (/\bpayment\b/.test(t)) out.push("payment");
  if (/\btransaction\b/.test(t)) out.push("transaction");
  if (/\brefund\b/.test(t)) out.push("refund");
  if (/\bsettlement\b/.test(t)) out.push("settlement");
  if (/\bwallet\b/.test(t)) out.push("wallet");
  if (/\baccount\b/.test(t)) out.push("account");
  if (/\btoken\b/.test(t)) out.push("token");
  if (/\bsession\b/.test(t)) out.push("session");

  return unique(out);
}

function detectFunctionalSignals(text = "") {
  const t = lower(text);
  const out = [];

  if (/\bcheckout\b|\binitiate\b|\bstart\b/.test(t)) {
    out.push("initiate flow");
  }
  if (/\bselect\b.*\bpayment\b|\bpayment method\b/.test(t)) {
    out.push("select payment method");
  }
  if (/\bsubmit\b|\benter\b|\bprovide\b/.test(t)) {
    out.push("submit request details");
  }
  if (/\bvalidate\b|\bverification\b/.test(t)) {
    out.push("validate request");
  }
  if (/\bsuccess\b|\bfailure\b|\bresponse\b/.test(t)) {
    out.push("return outcome to user");
  }

  return unique(out);
}

function detectIntegrationSignals(text = "") {
  const t = lower(text);
  const out = [];

  if (/\bui\b.*\bapi\b|\bfrontend\b.*\bbackend\b/.test(t)) {
    out.push("ui_to_api");
  }
  if (/\bapi\b.*\bgateway\b|\bbackend\b.*\bprovider\b/.test(t)) {
    out.push("api_to_external_provider");
  }
  if (/\bwebhook\b|\bcallback\b/.test(t)) {
    out.push("external_callback");
  }
  if (/\bapi\b.*\bdatabase\b|\bpersist\b|\bstore\b/.test(t)) {
    out.push("api_to_database");
  }

  return unique(out);
}

function detectDatabaseSignals(text = "") {
  const t = lower(text);
  const out = [];

  if (/\bpersist\b|\bstore\b|\bsave\b|\brecord\b|\bwrite\b/.test(t)) {
    out.push("persistence_required");
  }
  if (/\bupdate status\b|\bstatus update\b|\bstate change\b/.test(t)) {
    out.push("status_updates");
  }
  if (/\bconsistent\b|\bconsistency\b|\breconcile\b/.test(t)) {
    out.push("data_consistency");
  }
  if (/\bduplicate\b/.test(t)) {
    out.push("duplicate_prevention");
  }

  return unique(out);
}

function detectReliabilitySignals(text = "") {
  const t = lower(text);
  const out = [];

  if (/\bretry\b/.test(t)) out.push("retry_handling");
  if (/\btimeout\b|\bdelayed\b/.test(t)) out.push("timeout_handling");
  if (/\bpartial failure\b|\bpartial success\b/.test(t)) {
    out.push("partial_failure_handling");
  }
  if (/\basync\b|\beventual consistency\b|\bsettlement\b/.test(t)) {
    out.push("async_completion");
  }
  if (/\bduplicate\b|\bidempot/i.test(t)) {
    out.push("duplicate_execution_protection");
  }

  return unique(out);
}

function detectSecuritySignals(text = "") {
  const t = lower(text);
  const out = [];

  if (/\bauth\b|\bauthoriz\b|\blogin\b|\btoken\b|\bsession\b/.test(t)) {
    out.push("authentication_authorization");
  }
  if (/\bsecure\b|\bencrypt\b|\bsensitive\b|\bpii\b|\bcard data\b/.test(t)) {
    out.push("sensitive_data_protection");
  }
  if (/\breplay\b|\bfraud\b|\babuse\b/.test(t)) {
    out.push("abuse_prevention");
  }
  if (/\bidempot/i.test(t)) {
    out.push("replay_duplicate_protection");
  }

  return unique(out);
}

function detectUnknowns(text = "") {
  const t = lower(text);
  const out = [];

  if (!/\bretry\b/.test(t)) out.push("retry behavior not described");
  if (!/\bsettlement\b|\breconciliation\b|\basync\b/.test(t)) {
    out.push("post-processing behavior not described");
  }
  if (!/\bdatabase\b|\bpersist\b|\brecord\b|\bstore\b/.test(t)) {
    out.push("persistence behavior not described");
  }
  if (!/\bauth\b|\btoken\b|\bauthoriz\b|\bsecure\b/.test(t)) {
    out.push("security controls not clearly described");
  }

  return unique(out);
}

function detectConstraints(text = "") {
  const t = lower(text);
  const out = [];

  if (/\bretry\b/.test(t)) out.push("retry handling");
  if (/\bidempot/i.test(t)) out.push("idempotency");
  if (/\breal[- ]?time\b/.test(t)) out.push("real-time behavior");
  if (/\blatency\b|\bperformance\b/.test(t)) {
    out.push("performance expectations");
  }
  if (/\bsecure\b|\bencrypt\b|\btoken\b|\b2fa\b/.test(t)) {
    out.push("security controls");
  }

  return unique(out);
}

export function extractStorySignals({
  story = "",
  acceptanceCriteria = "",
  comments = "",
  prd = "",
} = {}) {
  const storyText = cleanText(story);
  const acText = cleanText(acceptanceCriteria);
  const commentsText = cleanText(comments);
  const prdText = cleanText(prd);

  const combined = [storyText, acText, commentsText, prdText]
    .filter(Boolean)
    .join("\n\n");

  const actors = detectActors(combined);
  const intent = detectIntent(storyText || combined);
  const domain_hints = detectDomainHints(combined);
  const action_hints = detectActionHints(combined);
  const constraints = detectConstraints(combined);

  const systems = detectSystems(combined);
  const data_entities = detectDataEntities(combined);

  const functional_signals = detectFunctionalSignals(combined);
  const integration_signals = detectIntegrationSignals(combined);
  const database_signals = detectDatabaseSignals(combined);
  const reliability_signals = detectReliabilitySignals(combined);
  const security_signals = detectSecuritySignals(combined);

  const unknowns = detectUnknowns(combined);

  return {
    source_type: "user_story",
    has_content: Boolean(cleanText(combined)),
    raw_text: combined,
    source_parts: {
      story: storyText,
      acceptance_criteria: acText,
      comments: commentsText,
      prd: prdText,
    },
    actors,
    intent,
    domain_hints,
    action_hints,
    constraints,
    systems,
    data_entities,
    qa_signals: {
      functional: functional_signals,
      integration: integration_signals,
      database: database_signals,
      reliability: reliability_signals,
      security: security_signals,
    },
    unknowns,
  };
}
