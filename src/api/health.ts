export default function handler(req: any, res: any) {
  if (typeof res.setHeader === 'function') {
    res.setHeader('Content-Type', 'application/json');
  }
  const payload = {
    status: 'ok',
    app: 'Wits Lingo Academy',
    environment: process.env.VERCEL ? 'vercel_serverless' : 'custom_server',
    timestamp: new Date().toISOString()
  };
  if (typeof res.status === 'function') {
    return res.status(200).json(payload);
  }
  res.statusCode = 200;
  return res.end(JSON.stringify(payload));
}
