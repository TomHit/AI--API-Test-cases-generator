import "dotenv/config";

function normBaseUrl(v) {
  v = (v || "").trim();
  if (!v) return "";
  if (!/^https?:\/\//i.test(v)) v = "https://" + v; // add scheme if missing
  return v.replace(/\/+$/, ""); // remove trailing slash
}

export const baseUrl = normBaseUrl(process.env.BASE_URL);
export const sessionCookie = (process.env.SESSION_COOKIE || "").trim();
export const deviceId = (process.env.DEVICE_ID || "").trim();
export const timeoutMs = Number(process.env.TIMEOUT_MS || 30000);

if (!baseUrl) {
  throw new Error(
    "BASE_URL is missing. Set BASE_URL in .env (example: https://app.xautrendlab.com)",
  );
}
