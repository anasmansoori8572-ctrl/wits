process.env.VERCEL = '1';

async function testVercelInvocation() {
  const handler = (await import('../api/index')).default;
  console.log('Testing Vercel Serverless Function Invocation...');

  // Mock Request for GET /api/webhooks/whatsapp
  const mockReqGet = {
    method: 'GET',
    url: '/api/webhooks/whatsapp',
    query: {
      'hub.mode': 'subscribe',
      'hub.verify_token': 'witslingo_meta_verify_token_2026',
      'hub.challenge': '1158201444'
    },
    headers: {
      host: 'www.witslingo.com'
    }
  };

  let getStatus = 0;
  let getBody = '';
  const mockResGet: any = {
    statusCode: 200,
    status(code: number) {
      this.statusCode = code;
      getStatus = code;
      return this;
    },
    sendStatus(code: number) {
      this.statusCode = code;
      getStatus = code;
      return this;
    },
    send(data: any) {
      getBody = String(data);
      return this;
    },
    setHeader(name: string, val: string) {
      return this;
    },
    json(data: any) {
      getBody = JSON.stringify(data);
      return this;
    }
  };

  await handler(mockReqGet, mockResGet);
  console.log('GET /api/webhooks/whatsapp Response Status:', getStatus);
  console.log('GET /api/webhooks/whatsapp Response Body:', getBody);

  if (getStatus === 200 && getBody === '1158201444') {
    console.log('✔ GET webhook handshake test PASSED on Vercel handler!');
  } else {
    throw new Error(`GET webhook handshake test FAILED! status: ${getStatus}, body: ${getBody}`);
  }
}

testVercelInvocation().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Vercel handler test error:', err);
  process.exit(1);
});
