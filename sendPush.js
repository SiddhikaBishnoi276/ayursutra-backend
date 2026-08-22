const http = require('http');

const data = JSON.stringify({
  title: "Dr. Riddhima - New Alert",
  body: "Aapke patient ki file ready hai! (Test Notification from AyurSutra)"
});

// Assuming Riddhima's user ID is this one based on our DB checks
const userId = "91f00a20-1015-4049-b511-87e8924db7f6";

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/notifications/test-send',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-user-id': userId,
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let responseData = '';
  res.on('data', (chunk) => { responseData += chunk; });
  res.on('end', () => {
    console.log(`Status Code: ${res.statusCode}`);
    console.log(`Response: ${responseData}`);
    if (res.statusCode === 200) {
      console.log('✅ Push notification sent successfully! Check your browser.');
    } else {
      console.log('❌ Failed to send notification.');
    }
  });
});

req.on('error', (error) => {
  console.error('Error hitting backend API:', error.message);
});

req.write(data);
req.end();
