// src/core/intelligence/domainClassifier.js

const DOMAIN_RULES = {
  retail_commerce: {
    label: "Retail / Commerce",
    baseWeight: 1.35,
    pathWeight: 2.8,
    strongKeywords: [
      "store",
      "order",
      "inventory",
      "product",
      "products",
      "cart",
      "checkout",
      "catalog",
      "price",
      "pricing",
      "purchase",
      "buyer",
      "seller",
      "item",
      "items",
      "sku",
      "stock",
      "shop",
      "merchant",
    ],
    weakKeywords: [
      "customer",
      "customers",
      "payment",
      "payments",
      "invoice",
      "billing",
    ],
    subdomains: {
      pet_store: ["pet", "pets", "animal", "animals"],
      marketplace: ["marketplace", "vendor", "merchant", "seller"],
      food_delivery: ["restaurant", "menu", "delivery", "food", "meal"],
    },
  },

  banking_finance: {
    label: "Banking / Finance",
    baseWeight: 1.3,
    pathWeight: 2.7,
    strongKeywords: [
      "account",
      "transaction",
      "transactions",
      "payment",
      "payments",
      "balance",
      "ledger",
      "loan",
      "wallet",
      "bank",
      "transfer",
      "deposit",
      "withdrawal",
      "credit",
      "debit",
      "settlement",
    ],
    weakKeywords: ["invoice", "billing", "card", "cards", "quote"],
    subdomains: {
      banking: ["bank", "account", "balance", "transfer", "deposit"],
      payments: ["payment", "checkout", "invoice", "settlement", "gateway"],
      lending: ["loan", "emi", "interest", "repayment"],
    },
  },

  healthcare: {
    label: "Healthcare",
    baseWeight: 1.35,
    pathWeight: 2.8,
    strongKeywords: [
      "patient",
      "doctor",
      "appointment",
      "medical",
      "clinic",
      "hospital",
      "diagnosis",
      "prescription",
      "medication",
      "ehr",
      "emr",
      "symptom",
      "treatment",
    ],
    weakKeywords: ["lab", "care", "test", "tests", "result", "results"],
    subdomains: {
      clinical: ["patient", "doctor", "diagnosis", "treatment"],
      hospital_ops: ["hospital", "ward", "bed", "admission", "discharge"],
      pharmacy: ["prescription", "drug", "medication", "pharmacy"],
    },
  },

  insurance: {
    label: "Insurance",
    baseWeight: 1.3,
    pathWeight: 2.7,
    strongKeywords: [
      "policy",
      "claim",
      "claims",
      "premium",
      "coverage",
      "insured",
      "insurer",
      "underwriting",
      "beneficiary",
      "renewal",
    ],
    weakKeywords: ["quote", "quotes", "risk"],
    subdomains: {
      claims: ["claim", "claims", "settlement"],
      policy_admin: ["policy", "premium", "renewal", "coverage"],
    },
  },

  travel_hospitality: {
    label: "Travel / Hospitality",
    baseWeight: 1.25,
    pathWeight: 2.6,
    strongKeywords: [
      "trip",
      "travel",
      "flight",
      "hotel",
      "booking",
      "reservation",
      "ticket",
      "itinerary",
      "passenger",
      "destination",
    ],
    weakKeywords: ["checkin", "checkout", "room", "ride", "driver"],
    subdomains: {
      airline: ["flight", "passenger", "boarding", "pnr"],
      hotel: ["hotel", "room", "reservation", "checkin", "checkout"],
      transport: ["cab", "ride", "driver", "vehicle", "trip"],
    },
  },

  logistics_supply_chain: {
    label: "Logistics / Supply Chain",
    baseWeight: 1.25,
    pathWeight: 2.7,
    strongKeywords: [
      "shipment",
      "shipping",
      "tracking",
      "warehouse",
      "fulfillment",
      "carrier",
      "dispatch",
      "delivery",
      "consignment",
      "route",
      "fleet",
    ],
    weakKeywords: ["inventory", "stock", "vehicle", "driver"],
    subdomains: {
      shipping: ["shipment", "tracking", "carrier", "consignment"],
      warehouse: ["warehouse", "bin", "stock", "fulfillment"],
      fleet: ["fleet", "vehicle", "route", "driver", "dispatch"],
    },
  },

  hr_payroll: {
    label: "HR / Payroll",
    baseWeight: 1.25,
    pathWeight: 2.6,
    strongKeywords: [
      "employee",
      "employees",
      "payroll",
      "salary",
      "leave",
      "attendance",
      "recruitment",
      "candidate",
      "onboarding",
      "benefits",
      "timesheet",
      "department",
    ],
    weakKeywords: ["manager", "staff", "team"],
    subdomains: {
      payroll: ["payroll", "salary", "benefits", "deduction"],
      hrms: ["employee", "attendance", "leave", "department"],
      hiring: ["candidate", "recruitment", "interview", "job posting"],
    },
  },

  education: {
    label: "Education",
    baseWeight: 1.25,
    pathWeight: 2.6,
    strongKeywords: [
      "student",
      "course",
      "lesson",
      "exam",
      "quiz",
      "grade",
      "teacher",
      "classroom",
      "learning",
      "assignment",
      "school",
      "university",
    ],
    weakKeywords: ["class", "classes", "subject"],
    subdomains: {
      lms: ["course", "lesson", "assignment", "quiz", "grade"],
      institution: ["student", "teacher", "school", "university"],
    },
  },

  legal_compliance: {
    label: "Legal / Compliance",
    baseWeight: 1.25,
    pathWeight: 2.6,
    strongKeywords: [
      "contract",
      "agreement",
      "clause",
      "compliance",
      "regulation",
      "audit",
      "legal",
      "gdpr",
      "kyc",
      "aml",
    ],
    weakKeywords: ["policy", "consent", "review"],
    subdomains: {
      legal_docs: ["contract", "agreement", "clause", "legal"],
      compliance_ops: ["compliance", "audit", "regulation", "policy"],
    },
  },

  media_content: {
    label: "Media / Content",
    baseWeight: 1.2,
    pathWeight: 2.5,
    strongKeywords: [
      "content",
      "article",
      "video",
      "audio",
      "stream",
      "playlist",
      "podcast",
      "image",
      "thumbnail",
      "caption",
      "publish",
      "channel",
    ],
    weakKeywords: ["editor", "media", "episode"],
    subdomains: {
      video: ["video", "stream", "playlist", "channel"],
      publishing: ["article", "publish", "editorial", "content"],
      audio: ["audio", "podcast", "episode"],
    },
  },

  social_communication: {
    label: "Social / Communication",
    baseWeight: 1.15,
    pathWeight: 2.4,
    strongKeywords: [
      "message",
      "messages",
      "chat",
      "conversation",
      "thread",
      "comment",
      "post",
      "feed",
      "notification",
      "friend",
      "follow",
      "group",
    ],
    weakKeywords: ["social", "profile"],
    subdomains: {
      messaging: ["chat", "message", "conversation", "thread"],
      social: ["post", "feed", "comment", "follow", "friend"],
    },
  },

  developer_tools: {
    label: "Developer Tools",
    baseWeight: 1.15,
    pathWeight: 2.4,
    strongKeywords: [
      "repository",
      "repo",
      "build",
      "deploy",
      "pipeline",
      "artifact",
      "commit",
      "branch",
      "ci",
      "cd",
      "environment",
      "webhook",
      "sdk",
      "api key",
    ],
    weakKeywords: ["release", "tooling", "developer"],
    subdomains: {
      cicd: ["build", "deploy", "pipeline", "artifact", "release"],
      code_hosting: ["repository", "repo", "commit", "branch", "pull request"],
    },
  },

  security_identity: {
    label: "Security / Identity",
    baseWeight: 0.78,
    pathWeight: 1.4,
    strongKeywords: [
      "auth",
      "authentication",
      "authorize",
      "authorization",
      "identity",
      "role",
      "permission",
      "token",
      "session",
      "sso",
      "mfa",
      "otp",
      "access",
    ],
    weakKeywords: ["user", "login", "logout"],
    subdomains: {
      iam: ["role", "permission", "identity", "access"],
      authentication: ["login", "logout", "token", "mfa", "otp", "sso"],
    },
  },

  crm_sales: {
    label: "CRM / Sales",
    baseWeight: 1.2,
    pathWeight: 2.4,
    strongKeywords: [
      "customer",
      "lead",
      "opportunity",
      "deal",
      "contact",
      "sales",
      "pipeline",
      "quote",
      "prospect",
    ],
    weakKeywords: ["account manager", "accounts"],
    subdomains: {
      crm: ["customer", "contact", "lead", "prospect"],
      sales_ops: ["deal", "opportunity", "quote", "pipeline", "sales"],
    },
  },

  generic_service: {
    label: "Generic Service",
    baseWeight: 0,
    pathWeight: 0,
    strongKeywords: [],
    weakKeywords: [],
    subdomains: {},
  },
};

function normalizeText(text) {
  return String(text || "").toLowerCase();
}

function normalizePathParts(path) {
  return String(path || "")
    .toLowerCase()
    .replace(/[{}]/g, "")
    .split(/[\/\-_]+/)
    .filter(Boolean);
}

function collectCorpus({ openapi, signals, projectNotes }) {
  const chunks = [];

  if (projectNotes) chunks.push(String(projectNotes));

  if (openapi?.info?.title) chunks.push(openapi.info.title);
  if (openapi?.info?.description) chunks.push(openapi.info.description);

  const tags = Array.isArray(openapi?.tags) ? openapi.tags : [];
  for (const tag of tags) {
    if (tag?.name) chunks.push(tag.name);
    if (tag?.description) chunks.push(tag.description);
  }

  const endpoints = Array.isArray(signals?.endpoints) ? signals.endpoints : [];
  for (const ep of endpoints) {
    if (ep?.path) chunks.push(ep.path);
    if (ep?.summary) chunks.push(ep.summary);
    if (ep?.method) chunks.push(ep.method);
  }

  const paths = openapi?.paths || {};
  for (const [path, methods] of Object.entries(paths)) {
    chunks.push(path);

    for (const [method, endpoint] of Object.entries(methods || {})) {
      chunks.push(method);
      if (endpoint?.summary) chunks.push(endpoint.summary);
      if (endpoint?.description) chunks.push(endpoint.description);
      if (endpoint?.operationId) chunks.push(endpoint.operationId);

      if (Array.isArray(endpoint?.tags)) {
        chunks.push(endpoint.tags.join(" "));
      }

      const parameters = Array.isArray(endpoint?.parameters)
        ? endpoint.parameters
        : [];
      for (const param of parameters) {
        if (param?.name) chunks.push(param.name);
        if (param?.description) chunks.push(param.description);
      }

      const requestBody = endpoint?.requestBody?.content || {};
      for (const content of Object.values(requestBody)) {
        if (content?.schema) {
          chunks.push(JSON.stringify(content.schema));
        }
      }

      const responses = endpoint?.responses || {};
      for (const response of Object.values(responses)) {
        const responseContent = response?.content || {};
        for (const content of Object.values(responseContent)) {
          if (content?.schema) {
            chunks.push(JSON.stringify(content.schema));
          }
        }
      }
    }
  }

  return chunks.filter(Boolean);
}

function countCorpusMatches(corpusText, keywords = [], weight = 1) {
  let score = 0;
  const matched = [];

  for (const keyword of keywords) {
    const lowered = normalizeText(keyword);
    if (!lowered) continue;

    if (corpusText.includes(lowered)) {
      score += weight;
      matched.push(lowered);
    }
  }

  return { score, matched };
}

function countPathMatches(endpoints = [], keywords = [], weight = 2) {
  let score = 0;
  const matched = [];

  for (const ep of endpoints) {
    const pathParts = normalizePathParts(ep?.path || "");
    for (const keyword of keywords) {
      const lowered = normalizeText(keyword);
      if (!lowered) continue;

      if (pathParts.includes(lowered)) {
        score += weight;
        matched.push(lowered);
      }
    }
  }

  return { score, matched };
}

function scoreDomainRule({ rule, corpusText, endpoints }) {
  const strongText = countCorpusMatches(
    corpusText,
    rule.strongKeywords || [],
    rule.baseWeight,
  );
  const weakText = countCorpusMatches(
    corpusText,
    rule.weakKeywords || [],
    rule.baseWeight * 0.45,
  );

  const strongPath = countPathMatches(
    endpoints,
    rule.strongKeywords || [],
    rule.pathWeight,
  );
  const weakPath = countPathMatches(
    endpoints,
    rule.weakKeywords || [],
    rule.pathWeight * 0.45,
  );

  const totalScore =
    strongText.score + weakText.score + strongPath.score + weakPath.score;

  const matchedSignals = [
    ...new Set([
      ...strongText.matched,
      ...weakText.matched,
      ...strongPath.matched,
      ...weakPath.matched,
    ]),
  ];

  return {
    score: totalScore,
    signals: matchedSignals,
  };
}

function pickTopDomain(domainScores) {
  const ranked = Object.entries(domainScores)
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0 || ranked[0].score <= 0) {
    return null;
  }

  const top = ranked[0];
  const second = ranked[1] || null;

  let confidence = Math.min(0.95, 0.3 + top.score * 0.045);

  if (second && top.score - second.score <= 2) {
    confidence -= 0.12;
  } else if (second && top.score - second.score <= 5) {
    confidence -= 0.06;
  }

  confidence = Math.max(0.2, Math.min(0.95, confidence));

  return {
    top,
    second,
    confidence,
  };
}

function detectSubdomain(domainRule, corpusText) {
  const subdomains = domainRule?.subdomains || {};
  let bestKey = null;
  let bestScore = 0;
  let bestSignals = [];

  for (const [subKey, keywords] of Object.entries(subdomains)) {
    const { score, matched } = countCorpusMatches(corpusText, keywords, 1);
    if (score > bestScore) {
      bestKey = subKey;
      bestScore = score;
      bestSignals = matched;
    }
  }

  if (!bestKey || bestScore === 0) {
    return null;
  }

  return {
    subdomain: bestKey,
    signals: [...new Set(bestSignals)],
  };
}

export function classifyBusinessDomain(input = {}) {
  const { openapi = {}, signals = {}, projectNotes = "" } = input;

  const corpusChunks = collectCorpus({ openapi, signals, projectNotes });
  const corpusText = corpusChunks.join(" ").toLowerCase();
  const endpoints = Array.isArray(signals?.endpoints) ? signals.endpoints : [];

  const domainScores = {};

  for (const [domainKey, rule] of Object.entries(DOMAIN_RULES)) {
    if (domainKey === "generic_service") continue;

    const scored = scoreDomainRule({
      rule,
      corpusText,
      endpoints,
    });

    domainScores[domainKey] = {
      score: scored.score,
      label: rule.label,
      signals: scored.signals,
    };
  }

  const picked = pickTopDomain(domainScores);

  if (!picked) {
    return {
      business_domain: "generic_service",
      business_domain_label: DOMAIN_RULES.generic_service.label,
      subdomain: null,
      domain_confidence: 0.2,
      domain_signals: [],
      secondary_domains: [],
    };
  }

  const topRule = DOMAIN_RULES[picked.top.key];
  const subdomainResult = detectSubdomain(topRule, corpusText);

  const secondaryDomains = Object.entries(domainScores)
    .filter(
      ([key, value]) =>
        key !== picked.top.key &&
        value.score >= Math.max(4, picked.top.score * 0.45),
    )
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 2)
    .map(([key, value]) => ({
      domain: key,
      label: value.label,
      score: Number(value.score.toFixed(2)),
    }));

  return {
    business_domain: picked.top.key,
    business_domain_label: picked.top.label,
    subdomain: subdomainResult?.subdomain || null,
    domain_confidence: Number(picked.confidence.toFixed(2)),
    domain_signals: picked.top.signals,
    secondary_domains: secondaryDomains,
  };
}
