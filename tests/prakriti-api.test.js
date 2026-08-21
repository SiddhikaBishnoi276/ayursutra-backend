const http = require('http');
const assert = require('assert');
const app = require('../src/app');

async function testPrakritiAPI() {
  console.log('🧪 Starting Prakriti API tests...');
  const server = http.createServer(app);
  
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/prakriti-questions`;
  console.log(`📡 Server running on ${baseUrl}`);

  try {
    // 1. GET ALL
    console.log('\nTesting GET all questions...');
    let res = await fetch(baseUrl);
    let data = await res.json();
    assert.strictEqual(res.status, 200);
    console.log(`✅ GET /prakriti-questions returned ${data.count} items.`);

    // 2. CREATE A QUESTION
    console.log('\nTesting POST create question...');
    const postBody = {
      question_text: "Test API Question?",
      is_active: true,
      options: [
        { option_text: "Option A", dosha_weight: { vata: 1 } },
        { option_text: "Option B", dosha_weight: { pitta: 2 } }
      ]
    };
    res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postBody)
    });
    data = await res.json();
    assert.strictEqual(res.status, 201);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.question_text, "Test API Question?");
    assert.strictEqual(data.data.options.length, 2);
    const newQuestionId = data.data.id;
    console.log(`✅ POST /prakriti-questions created question ID ${newQuestionId}.`);

    // 3. GET QUESTION BY ID
    console.log('\nTesting GET question by ID...');
    res = await fetch(`${baseUrl}/${newQuestionId}`);
    data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.data.id, newQuestionId);
    console.log(`✅ GET /prakriti-questions/${newQuestionId} successful.`);

    // 4. UPDATE QUESTION
    console.log('\nTesting PUT update question...');
    const putBody = {
      question_text: "Updated API Question?",
      is_active: true,
      options: [
        { option_text: "Option A Updated", dosha_weight: { vata: 3 } }
      ]
    };
    res = await fetch(`${baseUrl}/${newQuestionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(putBody)
    });
    data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.data.question_text, "Updated API Question?");
    assert.strictEqual(data.data.options.length, 1);
    console.log(`✅ PUT /prakriti-questions/${newQuestionId} updated successfully.`);

    // 5. DELETE QUESTION (Soft delete)
    console.log('\nTesting DELETE question...');
    res = await fetch(`${baseUrl}/${newQuestionId}`, {
      method: 'DELETE'
    });
    data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.data.is_active, false);
    console.log(`✅ DELETE /prakriti-questions/${newQuestionId} soft deleted successfully.`);

    console.log('\n🎉 All Prakriti API tests passed!');
  } catch (err) {
    console.error('\n❌ Test failed:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
}

testPrakritiAPI();
