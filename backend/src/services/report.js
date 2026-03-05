export function buildReport(testplan) {
  let total = 0;
  let needsReview = 0;

  for (const s of testplan?.suites || []) {
    for (const tc of s?.cases || []) {
      total += 1;
      if (tc?.needs_review) needsReview += 1;
    }
  }

  return {
    total_cases: total,
    needs_review: needsReview,
    invalid_cases: 0,
    warnings: [],
  };
}
