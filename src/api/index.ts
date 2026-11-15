import app, { ensurePersistenceInitialized } from "../../server";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: any, res: any) {
  // If Vercel rewrote the URL to /api, restore the original incoming path for Express routing
  const rawMatched = req.headers["x-matched-path"] || req.headers["x-forwarded-uri"];
  if (rawMatched && typeof rawMatched === "string" && (req.url === "/api" || req.url.startsWith("/api?") || req.url.startsWith("/api/"))) {
    const [pathOnly, matchedQuery] = rawMatched.split("?");
    const reqQueryIdx = req.url.indexOf("?");
    const reqQuery = reqQueryIdx !== -1 ? req.url.substring(reqQueryIdx + 1) : "";
    const finalQuery = reqQuery || matchedQuery || "";
    const cleanPath = pathOnly.startsWith("/") ? pathOnly : "/" + pathOnly;
    req.url = finalQuery ? `${cleanPath}?${finalQuery}` : cleanPath;
  }

  // Synthesize authorization header if stripped by Vercel proxy
  if (!req.headers.authorization && !req.headers.Authorization) {
    const fallbackToken = 
      req.headers["x-authorization"] ||
      req.headers["x-admin-token"] ||
      req.headers["x-auth-token"] ||
      req.headers["x-access-token"] ||
      (req.query && req.query.token);
    if (fallbackToken) {
      const tok = String(fallbackToken).startsWith("Bearer ") ? String(fallbackToken) : `Bearer ${fallbackToken}`;
      req.headers.authorization = tok;
      req.headers.Authorization = tok;
    }
  }

  try {
    if (typeof ensurePersistenceInitialized === "function") {
      await ensurePersistenceInitialized();
    }
  } catch (e) {
    console.warn("[Vercel Handler] ensurePersistenceInitialized warning:", e);
  }
  return app(req, res);
}
