import handler from '../api/webhooks/whatsapp.js';

async function runTests() {
  const mockRes = () => {
    const res: any = {
      statusCode: 200,
      headers: {},
      setHeader(k: string, v: string) { this.headers[k] = v; },
      status(c: number) { this.statusCode = c; return this; },
      send(b: any) { this.body = String(b); return this; },
      json(j: any) { this.body = JSON.stringify(j); return this; },
      end(b: any) { this.body = String(b); return this; }
    };
    return res;
  };

  // 1. Direct browser visit without query parameters
  const res1 = mockRes();
  await handler({ method: 'GET', url: '/api/webhooks/whatsapp', query: {} }, res1);
  console.log('1. Direct Browser visit status:', res1.statusCode);
  console.log('   Is response valid JSON with ready status:', res1.body.includes('"ready"'));

  // 2. Matching token handshake
  const res2 = mockRes();
  await handler({
    method: 'GET',
    url: '/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=witslingo_meta_verify_token_2026&hub.challenge=test_challenge_123',
    query: {
      'hub.mode': 'subscribe',
      'hub.verify_token': 'witslingo_meta_verify_token_2026',
      'hub.challenge': 'test_challenge_123'
    }
  }, res2);
  console.log('2. Matching token status:', res2.statusCode);
  console.log('   Challenge returned accurately:', res2.body === 'test_challenge_123');

  // 3. Mismatched token
  const res3 = mockRes();
  await handler({
    method: 'GET',
    url: '/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=test_challenge_123',
    query: {
      'hub.mode': 'subscribe',
      'hub.verify_token': 'wrong_token',
      'hub.challenge': 'test_challenge_123'
    }
  }, res3);
  console.log('3. Mismatched token status:', res3.statusCode, 'body:', res3.body);

  // 4. Invalid mode
  const res4 = mockRes();
  await handler({
    method: 'GET',
    url: '/api/webhooks/whatsapp?hub.mode=bad_mode&hub.verify_token=witslingo_meta_verify_token_2026&hub.challenge=test_challenge_123',
    query: {
      'hub.mode': 'bad_mode',
      'hub.verify_token': 'witslingo_meta_verify_token_2026',
      'hub.challenge': 'test_challenge_123'
    }
  }, res4);
  console.log('4. Invalid mode status:', res4.statusCode, 'body:', res4.body);

  if (res1.statusCode === 200 && res2.statusCode === 200 && res3.statusCode === 403 && res4.statusCode === 400) {
    console.log('\n✔ All 4 GET scenarios passed perfectly!');
  } else {
    throw new Error('Some scenarios failed!');
  }
}

runTests().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
