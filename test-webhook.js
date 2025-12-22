const fs = require('fs');
const path = require('path');

async function testWebhook() {
  try {
    const imagePath = '/tmp/test-product.jpg';
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

    const FormData = require('form-data');
    const formData = new FormData();

    formData.append('file', imageBuffer, {
      filename: 'test-product.jpg',
      contentType: 'image/jpeg',
    });
    formData.append('image_data', base64Image);
    formData.append('callback_url', 'https://example.com/callback');
    formData.append('submission_id', 'test-' + Date.now());

    console.log('Sending test image to webhook...');
    console.log('Image size:', imageBuffer.length, 'bytes');
    console.log('Base64 length:', base64Image.length, 'characters');

    const fetch = (await import('node-fetch')).default;
    const response = await fetch('https://n8n.busybiz.dk/webhook-test/ad5f0a18-085b-4a0d-acf2-a6376e675833', {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders(),
    });

    console.log('\nWebhook Response:');
    console.log('Status:', response.status, response.statusText);
    console.log('Content-Type:', response.headers.get('content-type'));

    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const jsonData = await response.json();
      console.log('JSON Response:', JSON.stringify(jsonData, null, 2));
    } else if (contentType.includes('image')) {
      const buffer = await response.arrayBuffer();
      const outputPath = '/tmp/beautified-result.jpg';
      fs.writeFileSync(outputPath, Buffer.from(buffer));
      console.log('Image saved to:', outputPath);
      console.log('Beautified image size:', buffer.byteLength, 'bytes');
    } else {
      const text = await response.text();
      console.log('Response:', text.substring(0, 500));
    }

    console.log('\n✅ Webhook test completed successfully!');
  } catch (error) {
    console.error('\n❌ Webhook test failed:', error.message);
    console.error(error);
  }
}

testWebhook();
