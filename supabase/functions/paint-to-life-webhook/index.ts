import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const N8N_WEBHOOK_URL = "https://n8n-project-1-we63.onrender.com/webhook/ad5f0a18-085b-4a0d-acf2-a6376e675833";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { submissionId, title, imageUrl, imageData } = await req.json();

    console.log('Received Paint To Life request:', { submissionId, title });

    const base64Data = imageData.split(',')[1];
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const imageBlob = new Blob([bytes], { type: 'image/png' });

    const formData = new FormData();
    formData.append('file', imageBlob, 'drawing.png');
    formData.append('imageUrl', imageUrl);
    formData.append('filePath', `uploads/${submissionId}.png`);
    formData.append('submissionId', submissionId);

    console.log('Sending to n8n webhook...');

    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      body: formData,
    });

    if (!n8nResponse.ok) {
      throw new Error(`n8n webhook failed with status: ${n8nResponse.status}`);
    }

    const transformedImageBlob = await n8nResponse.blob();
    const transformedArrayBuffer = await transformedImageBlob.arrayBuffer();
    const transformedBase64 = btoa(String.fromCharCode(...new Uint8Array(transformedArrayBuffer)));
    const transformedImageUrl = `data:image/png;base64,${transformedBase64}`;

    console.log('Successfully received transformed image from n8n');

    const response = {
      success: true,
      submissionId,
      title,
      originalImageUrl: imageUrl,
      transformedImageUrl,
      message: 'Image transformed successfully',
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error in paint-to-life-webhook:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
