export default async function handler(req: any, res: any) {
  if (typeof res.setHeader === 'function') {
    res.setHeader('Content-Type', 'application/json');
  }
  const diagnostics: Record<string, any> = {
    status: 'ok',
    environment: process.env.VERCEL ? 'vercel_serverless' : 'custom_server',
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    cwd: process.cwd(),
  };

  try {
    const cloudApi = await import('../src/services/whatsappCloudApiService');
    diagnostics.cloudApiImport = 'success';
  } catch (err: any) {
    diagnostics.cloudApiImport = { error: err.message, stack: err.stack, code: err.code };
  }

  try {
    const serverModule = await import('../server');
    diagnostics.serverImport = 'success';
  } catch (err: any) {
    diagnostics.serverImport = { error: err.message, stack: err.stack, code: err.code };
  }

  try {
    const webhookModule = await import('./webhooks/whatsapp');
    diagnostics.webhookImport = 'success';
  } catch (err: any) {
    diagnostics.webhookImport = { error: err.message, stack: err.stack, code: err.code };
  }

  if (typeof res.status === 'function') {
    return res.status(200).json(diagnostics);
  }
  res.statusCode = 200;
  return res.end(JSON.stringify(diagnostics));
}

