import {
  baseUrl,
  sessionCookie,
  deviceId,
  timeoutMs,
} from "../../config/env.js";

export async function apiGet(path, params = {}) {
  const u = new URL(path, baseUrl);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
  }

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(u.toString(), {
      method: "GET",
      headers: {
        ...(deviceId ? { "X-Device-Id": deviceId } : {}),
        ...(sessionCookie ? { Cookie: sessionCookie } : {}),
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    return { status: res.status, ok: res.ok, data, raw: text };
  } finally {
    clearTimeout(t);
  }
}
