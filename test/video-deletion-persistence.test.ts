import app from '../server';
import http from 'http';
import fs from 'fs';
import path from 'path';

async function runPersistenceTest() {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log(`Video Persistence Test Server running at ${baseUrl}`);

  let pass = 0;
  let fail = 0;

  function assert(cond: boolean, name: string, detail?: string) {
    if (cond) {
      console.log(`[PASS] ${name}`);
      pass++;
    } else {
      console.error(`[FAIL] ${name} - ${detail || ''}`);
      fail++;
    }
  }

  const materialsFile = path.join(process.cwd(), 'uploads', 'data', 'materials.json');

  try {
    // 1. Authenticate as admin
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin' })
    });
    const loginData = await loginRes.json();
    assert(loginRes.ok && !!loginData.token, 'Admin authenticated successfully');
    const token = loginData.token;

    // 2. Fetch all current materials
    const initialGet = await fetch(`${baseUrl}/api/admin/materials`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const initialData = await initialGet.json();
    assert(initialGet.ok && Array.isArray(initialData.materials), 'GET /api/admin/materials returns materials array');

    console.log(`Found ${initialData.materials.length} existing materials. Deleting all of them to test persistence...`);

    // 3. Delete every single material
    for (const mat of initialData.materials) {
      const delRes = await fetch(`${baseUrl}/api/admin/materials/${mat.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const delData = await delRes.json();
      assert(delRes.ok && delData.success === true, `DELETE /api/admin/materials/${mat.id} deleted successfully`);
    }

    // 4. Check GET /api/materials (public) and GET /api/admin/materials
    const publicGet = await fetch(`${baseUrl}/api/materials`);
    const publicData = await publicGet.json();
    assert(publicGet.ok && publicData.materials.length === 0, 'Public GET /api/materials has 0 items after full deletion');

    const adminGetAfterDelete = await fetch(`${baseUrl}/api/admin/materials`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const adminDataAfterDelete = await adminGetAfterDelete.json();
    assert(adminGetAfterDelete.ok && adminDataAfterDelete.materials.length === 0, 'Admin GET /api/admin/materials has 0 items after full deletion');

    // 5. Verify materials.json on disk contains empty array []
    assert(fs.existsSync(materialsFile), 'uploads/data/materials.json exists on disk');
    const fileContent = fs.readFileSync(materialsFile, 'utf-8');
    const parsedFile = JSON.parse(fileContent);
    assert(Array.isArray(parsedFile) && parsedFile.length === 0, 'uploads/data/materials.json on disk is an empty array []');

    // 6. Test that re-seeding DOES NOT happen when simulated reload or restart occurs
    // We test this by creating a new video, verifying it saves to disk, then deleting it, verifying it stays []
    const newVideoRes = await fetch(`${baseUrl}/api/admin/materials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        resourceType: 'youtube',
        title: 'Fresh Test Video Lesson',
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        description: 'Test persistent video creation',
        isVisibleOnWebsite: true,
        isPublished: true
      })
    });
    const newVideoData = await newVideoRes.json();
    assert(newVideoRes.ok && newVideoData.success === true && !!newVideoData.material?.id, 'POST /api/admin/materials created 1 new video lesson');

    const diskAfterCreate = JSON.parse(fs.readFileSync(materialsFile, 'utf-8'));
    assert(Array.isArray(diskAfterCreate) && diskAfterCreate.length === 1, 'materials.json on disk has exactly 1 video after creation');

    // 7. Delete the newly created video
    const delNewRes = await fetch(`${baseUrl}/api/admin/materials/${newVideoData.material.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const delNewData = await delNewRes.json();
    assert(delNewRes.ok && delNewData.success === true, 'DELETE newly created video returns success');

    const diskAfterSecondDelete = JSON.parse(fs.readFileSync(materialsFile, 'utf-8'));
    assert(Array.isArray(diskAfterSecondDelete) && diskAfterSecondDelete.length === 0, 'materials.json on disk remains empty [] after deletion (NO DEFAULT VIDEOS RE-SEEDED)');

  } catch (err: any) {
    console.error('Unhandled test error:', err);
    fail++;
  } finally {
    server.close();
  }

  console.log(`\n========================================`);
  console.log(`Persistence Test Summary: ${pass} PASSED, ${fail} FAILED`);
  console.log(`========================================`);

  if (fail > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPersistenceTest();
