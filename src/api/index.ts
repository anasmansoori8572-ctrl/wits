import app, { ensurePersistenceInitialized } from "../../server";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: any, res: any) {
  // If Vercel rewrote the URL to /api, restore the original incoming path for Express routing
  const matchedPath = req.headers["x-matched-path"] || req.headers["x-forwarded-uri"];
  if (matchedPath && typeof matchedPath === "string" && (req.url === "/api" || req.url.startsWith("/api?") || req.url.startsWith("/api/"))) {
    const queryIdx = req.url.indexOf("?");
    const queryString = queryIdx !== -1 ? req.url.substring(queryIdx) : "";
    req.url = (matchedPath.startsWith("/") ? matchedPath : "/" + matchedPath) + queryString;
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
