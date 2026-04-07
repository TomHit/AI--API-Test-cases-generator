function safeJsonParse(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export async function apiRequest(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await res.text();
  const payload = safeJsonParse(text);

  // 🔥 Fallback for non-unified APIs (important during migration)
  const normalized =
    payload?.ok !== undefined
      ? payload
      : {
          ok: res.ok,
          message: payload?.message || "",
          data: payload?.data || payload?.result || payload,
          meta: {},
          error: null,
        };

  // ❌ HTTP error
  if (!res.ok) {
    const err = new Error(
      normalized?.message || `Request failed with status ${res.status}`,
    );
    err.details = normalized?.error?.details || normalized?.error || payload;
    err.code = normalized?.error?.code || null;
    throw err;
  }

  // ❌ API-level error
  if (!normalized?.ok) {
    const err = new Error(normalized?.message || "Request failed");
    err.details = normalized?.error?.details || normalized?.error || payload;
    err.code = normalized?.error?.code || null;
    throw err;
  }

  return normalized;
}
