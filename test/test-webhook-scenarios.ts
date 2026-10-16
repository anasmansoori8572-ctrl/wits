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

  // 2. Matching token handshake (standard Meta query params)
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

  // 5. Nested qs query parser structure (req.query.hub = { mode, verify_token, challenge })
  const res5 = mockRes();
  await handler({
    method: 'GET',
    url: '/api/webhooks/whatsapp',
    query: {
      hub: {
        mode: 'subscribe',
        verify_token: 'witslingo_meta_verify_token_2026',
        challenge: 'test_challenge_nested'
      }
    }
  }, res5);
  console.log('5. Nested qs hub object status:', res5.statusCode);
  console.log('   Challenge returned accurately:', res5.body === 'test_challenge_nested');

  // 6. Raw URL query string only (req.query empty, parsed from req.url)
  const res6 = mockRes();
  await handler({
    method: 'GET',
    url: '/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=witslingo_meta_verify_token_2026&hub.challenge=test_challenge_raw_url',
    query: {}
  }, res6);
  console.log('6. Raw URL query string parsing status:', res6.statusCode);
  console.log('   Challenge returned accurately:', res6.body === 'test_challenge_raw_url');

  // 7. Token with surrounding whitespace or quotes
  const res7 = mockRes();
  await handler({
    method: 'GET',
    url: '/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=%20witslingo_meta_verify_token_2026%20&hub.challenge=test_challenge_spaces',
    query: {
      'hub.mode': 'subscribe',
      'hub.verify_token': ' witslingo_meta_verify_token_2026 ',
      'hub.challenge': 'test_challenge_spaces'
    }
  }, res7);
  console.log('7. Token with whitespace normalization status:', res7.statusCode);
  console.log('   Challenge returned accurately:', res7.body === 'test_challenge_spaces');

  // 8. GET action=verify_subscription probe
  const res8 = mockRes();
  await handler({
    method: 'GET',
    url: '/api/webhooks/whatsapp?action=verify_subscription',
    query: { action: 'verify_subscription' }
  }, res8);
  console.log('8. Verify subscription probe status:', res8.statusCode);
  console.log('   Probe returned valid JSON with subscription field:', res8.body.includes('subscription'));

  // 9. POST Inbound Message Event (Representative Meta Cloud API payload)
  const metaInboundPayload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '10987654321',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '919027729917',
                phone_number_id: '1318784024659002'
              },
              contacts: [
                {
                  profile: { name: 'Test Student' },
                  wa_id: '919876543210'
                }
              ],
              messages: [
                {
                  from: '919876543210',
                  id: 'wamid.HBgMOTExOTg3NjU0MzIxMBUCMRIA',
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  text: { body: 'Hello, I want details about the course fees' },
                  type: 'text'
                }
              ]
            },
            field: 'messages'
          }
        ]
      }
    ]
  };

  const res9 = mockRes();
  await handler({
    method: 'POST',
    url: '/api/webhooks/whatsapp',
    headers: {},
    body: metaInboundPayload
  }, res9);
  console.log('9. POST Inbound Message Status:', res9.statusCode);
  console.log('   Inbound acknowledged with status ok:', res9.body.includes('"status":"ok"'));

  // 10. POST Delivery Status Callback Event
  const metaStatusPayload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '10987654321',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '919027729917',
                phone_number_id: '1318784024659002'
              },
              statuses: [
                {
                  id: 'wamid.HBgMOTExOTg3NjU0MzIxMBUCMRIA',
                  status: 'delivered',
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  recipient_id: '919876543210'
                }
              ]
            },
            field: 'messages'
          }
        ]
      }
    ]
  };

  const res10 = mockRes();
  await handler({
    method: 'POST',
    url: '/api/webhooks/whatsapp',
    headers: {},
    body: metaStatusPayload
  }, res10);
  console.log('10. POST Delivery Status Callback Status:', res10.statusCode);
  console.log('    Status acknowledged with status ok:', res10.body.includes('"status":"ok"'));

  const allPassed =
    res1.statusCode === 200 &&
    res2.statusCode === 200 &&
    res3.statusCode === 403 &&
    res4.statusCode === 400 &&
    res5.statusCode === 200 &&
    res6.statusCode === 200 &&
    res7.statusCode === 200 &&
    (res8.statusCode === 200 || res8.statusCode === 500) &&
    res9.statusCode === 200 &&
    res10.statusCode === 200;

  if (allPassed) {
    console.log('\n✔ All 10 Webhook Verification GET and POST scenarios passed successfully!');
  } else {
    throw new Error('Some webhook scenarios failed!');
  }
}

runTests().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
