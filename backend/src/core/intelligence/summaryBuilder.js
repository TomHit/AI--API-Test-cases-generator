export function buildProjectSummary(card = {}) {
  const domain = card.business_domain_label || "unknown domain";
  const subdomain = card.subdomain;
  const workflow = card.workflow || [];
  const risks = card.risk_tags || [];
  const missing = card.missing || [];

  let systemDescription = "";

  if (domain === "Retail / Commerce") {
    if (subdomain === "pet_store") {
      systemDescription =
        "This API represents a pet store system managing animals, inventory, and customer orders.";
    } else {
      systemDescription =
        "This API represents a commerce platform handling products, inventory, and orders.";
    }
  } else {
    systemDescription = `This API represents a system in the ${domain}.`;
  }

  let workflowText = "";
  if (workflow.includes("crud")) {
    workflowText = "It supports CRUD operations for managing core resources.";
  }

  let riskText = "";
  if (risks.length) {
    riskText = `Key risks include ${risks.join(", ")}.`;
  }

  let missingText = "";
  if (missing.length) {
    missingText = `Missing controls include ${missing.join(", ")}.`;
  }

  return [systemDescription, workflowText, riskText, missingText]
    .filter(Boolean)
    .join(" ");
}
