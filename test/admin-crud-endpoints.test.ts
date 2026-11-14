import app from '../server';
import http from 'http';

async function runTests() {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log(`Test server running at ${baseUrl}`);

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

  try {
    // 1. Test Login to get JWT Token
    console.log('\n--- 1. Testing Admin Authentication ---');
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin' })
    });
    const loginData = await loginRes.json();
    assert(loginRes.ok && !!loginData.token, 'Admin login with default credentials returns token', JSON.stringify(loginData));
    const token = loginData.token;

    // 2. Test /api/auth/me with Bearer token
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const meData = await meRes.json();
    assert(meRes.ok && meData.user?.role === 'admin' && !!meData.token, '/api/auth/me returns admin user and fresh token', JSON.stringify(meData));

    // 3. Test /api/auth/me with admin-session fallback token
    const meFallbackRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { 'Authorization': 'Bearer admin-session' }
    });
    const meFallbackData = await meFallbackRes.json();
    assert(meFallbackRes.ok && meFallbackData.user?.role === 'admin', '/api/auth/me accepts admin-session fallback', JSON.stringify(meFallbackData));

    // 4. Test Course CRUD
    console.log('\n--- 2. Testing Course CRUD Endpoints ---');
    const testCourseId = `test-course-${Date.now()}`;
    const createCourseRes = await fetch(`${baseUrl}/api/courses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        id: testCourseId,
        name: 'Automated Test Course',
        level: 'Intermediate',
        fee: 1999,
        badge: 'Live',
        isPublished: true
      })
    });
    const createCourseData = await createCourseRes.json();
    assert(createCourseRes.ok && createCourseData.success, 'POST /api/courses creates course', JSON.stringify(createCourseData));

    const editCourseRes = await fetch(`${baseUrl}/api/courses/${testCourseId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        name: 'Automated Test Course (Updated)',
        fee: 2499
      })
    });
    const editCourseData = await editCourseRes.json();
    assert(editCourseRes.ok && editCourseData.success, 'PUT /api/courses/:id updates course', JSON.stringify(editCourseData));

    const togglePublishRes = await fetch(`${baseUrl}/api/courses/${testCourseId}/publish`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ isPublished: false })
    });
    const togglePublishData = await togglePublishRes.json();
    assert(togglePublishRes.ok && togglePublishData.success && togglePublishData.isPublished === false, 'PATCH /api/courses/:id/publish toggles course draft status', JSON.stringify(togglePublishData));

    const deleteCourseRes = await fetch(`${baseUrl}/api/courses/${testCourseId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const deleteCourseData = await deleteCourseRes.json();
    assert(deleteCourseRes.ok && deleteCourseData.success, 'DELETE /api/courses/:id deletes course', JSON.stringify(deleteCourseData));

    // 5. Test Batch CRUD
    console.log('\n--- 3. Testing Batch CRUD Endpoints ---');
    const testBatchCode = `TBC-${Date.now().toString().slice(-4)}`;
    const createBatchRes = await fetch(`${baseUrl}/api/admin/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        name: 'Automated Test Batch',
        batchCode: testBatchCode,
        courseId: 'course-spoken-english',
        courseName: 'Spoken English',
        scheduleTime: '07:30 PM - 08:30 PM IST',
        maxCapacity: 30
      })
    });
    const createBatchData = await createBatchRes.json();
    assert(createBatchRes.ok && createBatchData.success && !!createBatchData.batch, 'POST /api/admin/batches creates batch', JSON.stringify(createBatchData));
    const createdBatchId = createBatchData.batch?.id;

    if (createdBatchId) {
      const editBatchRes = await fetch(`${baseUrl}/api/admin/batches/${createdBatchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          name: 'Automated Test Batch (Updated)',
          maxCapacity: 35
        })
      });
      const editBatchData = await editBatchRes.json();
      assert(editBatchRes.ok && editBatchData.success, 'PUT /api/admin/batches/:id updates batch', JSON.stringify(editBatchData));

      const deleteBatchRes = await fetch(`${baseUrl}/api/admin/batches/${createdBatchId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const deleteBatchData = await deleteBatchRes.json();
      assert(deleteBatchRes.ok && deleteBatchData.success, 'DELETE /api/admin/batches/:id deletes batch', JSON.stringify(deleteBatchData));
    }

    // 6. Test Announcements CRUD
    console.log('\n--- 4. Testing Announcements CRUD Endpoints ---');
    const createAnnRes = await fetch(`${baseUrl}/api/admin/announcements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        title: 'Audit Test Notice',
        message: 'This is an automated test notice.',
        category: 'General',
        batchId: 'all',
        priority: 'Normal'
      })
    });
    const createAnnData = await createAnnRes.json();
    assert(createAnnRes.ok && createAnnData.success && !!createAnnData.announcement, 'POST /api/admin/announcements creates announcement', JSON.stringify(createAnnData));
    const createdAnnId = createAnnData.announcement?.id;

    if (createdAnnId) {
      const editAnnRes = await fetch(`${baseUrl}/api/admin/announcements/${createdAnnId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          title: 'Audit Test Notice (Edited)',
          message: 'Updated message.'
        })
      });
      const editAnnData = await editAnnRes.json();
      assert(editAnnRes.ok && editAnnData.success, 'PUT /api/admin/announcements/:id updates announcement', JSON.stringify(editAnnData));

      const deleteAnnRes = await fetch(`${baseUrl}/api/admin/announcements/${createdAnnId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const deleteAnnData = await deleteAnnRes.json();
      assert(deleteAnnRes.ok && deleteAnnData.success, 'DELETE /api/admin/announcements/:id deletes announcement', JSON.stringify(deleteAnnData));
    }

    // 7. Test Study Materials CRUD (PDF + YouTube)
    console.log('\n--- 5. Testing Study Materials CRUD Endpoints ---');
    const createMatRes = await fetch(`${baseUrl}/api/admin/materials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        title: 'Audit Test Worksheet.pdf',
        resourceType: 'pdf',
        batchId: 'all',
        category: 'Worksheets',
        pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
      })
    });
    const createMatData = await createMatRes.json();
    assert(createMatRes.ok && createMatData.success && !!createMatData.material, 'POST /api/admin/materials creates PDF material', JSON.stringify(createMatData));
    const createdMatId = createMatData.material?.id;

    if (createdMatId) {
      const editMatRes = await fetch(`${baseUrl}/api/admin/materials/${createdMatId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          title: 'Audit Test Worksheet (Updated).pdf',
          category: 'Grammar'
        })
      });
      const editMatData = await editMatRes.json();
      assert(editMatRes.ok && editMatData.success, 'PUT /api/admin/materials/:id updates material', JSON.stringify(editMatData));

      const deleteMatRes = await fetch(`${baseUrl}/api/admin/materials/${createdMatId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const deleteMatData = await deleteMatRes.json();
      assert(deleteMatRes.ok && deleteMatData.success, 'DELETE /api/admin/materials/:id deletes material', JSON.stringify(deleteMatData));
    }

    // YouTube Lesson Create & Delete
    const createYtRes = await fetch(`${baseUrl}/api/admin/materials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        title: 'Daily Spoken English Drill Lesson',
        resourceType: 'youtube',
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        category: 'Daily English'
      })
    });
    const createYtData = await createYtRes.json();
    assert(createYtRes.ok && createYtData.success && createYtData.material?.resourceType === 'youtube', 'POST /api/admin/materials creates YouTube lesson', JSON.stringify(createYtData));
    if (createYtData.material?.id) {
      await fetch(`${baseUrl}/api/admin/materials/${createYtData.material.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    }

    // 8. Test Gallery Upload, Update, Delete
    console.log('\n--- 6. Testing Gallery CRUD Endpoints ---');
    const dummyBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const uploadGalleryRes = await fetch(`${baseUrl}/api/admin/gallery/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        dataBase64: dummyBase64,
        filename: 'test-audit.png',
        mimeType: 'image/png',
        title: 'Audit Classroom Moment',
        category: 'Classrooms'
      })
    });
    const uploadGalleryData = await uploadGalleryRes.json();
    assert(uploadGalleryRes.ok && uploadGalleryData.success && Array.isArray(uploadGalleryData.items) && uploadGalleryData.items.length > 0, 'POST /api/admin/gallery/upload uploads gallery photo', JSON.stringify(uploadGalleryData));
    const createdGalId = uploadGalleryData.items?.[0]?.id;

    if (createdGalId) {
      const editGalRes = await fetch(`${baseUrl}/api/admin/gallery/${createdGalId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          title: 'Audit Classroom Moment (Updated)',
          caption: 'Great energy in class today'
        })
      });
      const editGalData = await editGalRes.json();
      assert(editGalRes.ok && editGalData.success, 'PUT /api/admin/gallery/:id updates gallery item', JSON.stringify(editGalData));

      const deleteGalRes = await fetch(`${baseUrl}/api/admin/gallery/${createdGalId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const deleteGalData = await deleteGalRes.json();
      assert(deleteGalRes.ok && deleteGalData.success, 'DELETE /api/admin/gallery/:id deletes gallery item', JSON.stringify(deleteGalData));
    }

    // 9. Test CMS Content Bulk Update
    console.log('\n--- 7. Testing CMS Settings Update ---');
    const cmsUpdateRes = await fetch(`${baseUrl}/api/cms/content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        settings: {
          announcementBannerText: 'Admissions Open for New Interactive Batches!'
        }
      })
    });
    const cmsUpdateData = await cmsUpdateRes.json();
    assert(cmsUpdateRes.ok && cmsUpdateData.success, 'POST /api/cms/content updates site settings', JSON.stringify(cmsUpdateData));

    // 10. Test Fallback with 'admin-session' on admin endpoints
    console.log('\n--- 8. Testing CRUD with admin-session Token ---');
    const testCourseFallbackId = `test-course-fallback-${Date.now()}`;
    const fallbackCourseRes = await fetch(`${baseUrl}/api/courses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer admin-session' },
      body: JSON.stringify({
        id: testCourseFallbackId,
        name: 'Fallback Admin Session Course',
        fee: 999
      })
    });
    const fallbackCourseData = await fallbackCourseRes.json();
    assert(fallbackCourseRes.ok && fallbackCourseData.success, 'POST /api/courses works with Bearer admin-session', JSON.stringify(fallbackCourseData));

    // Cleanup fallback course
    await fetch(`${baseUrl}/api/courses/${testCourseFallbackId}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer admin-session' }
    });

  } finally {
    server.close();
  }

  console.log(`\n================================================================`);
  console.log(` ENDPOINT AUDIT: ${pass} PASSED, ${fail} FAILED`);
  console.log(`================================================================`);

  if (fail > 0) process.exit(1);
  else process.exit(0);
}

runTests().catch((e) => {
  console.error('Test execution error:', e);
  process.exit(1);
});
