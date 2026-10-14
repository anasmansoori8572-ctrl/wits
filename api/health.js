// src/api/health.ts
function handler(req, res) {
  if (typeof res.setHeader === "function") {
    res.setHeader("Content-Type", "application/json");
  }
  const payload = {
    status: "ok",
    app: "Wits Lingo Academy",
    environment: process.env.VERCEL ? "vercel_serverless" : "custom_server",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (typeof res.status === "function") {
    return res.status(200).json(payload);
  }
  res.statusCode = 200;
  return res.end(JSON.stringify(payload));
}
export {
  handler as default
};
