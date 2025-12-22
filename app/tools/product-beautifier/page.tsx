'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Sparkles, Download, ArrowLeft, Image as ImageIcon, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';

type ViewState = 'upload' | 'processing' | 'result';

export default function ProductBeautifier() {
  const [viewState, setViewState] = useState<ViewState>('upload');
  const [originalImage, setOriginalImage] = useState<string>('');
  const [beautifiedImage, setBeautifiedImage] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [submissionId, setSubmissionId] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Image size must be less than 10MB');
      return;
    }

    setError('');
    setUploading(true);

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        setOriginalImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      await processImage(file);
    } catch (err: any) {
      setError(err.message || 'Failed to process image');
      setUploading(false);
    }
  };

  const processImage = async (file: File) => {
    try {
      setViewState('processing');
      setProcessing(true);

      const fileName = `${Date.now()}-${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('paint-to-life')
        .upload(fileName, file, {
          contentType: file.type,
          cacheControl: '3600',
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('paint-to-life')
        .getPublicUrl(fileName);

      const { data: insertData, error: insertError } = await supabase
        .from('product_beautifier_submissions')
        .insert({
          original_image_url: publicUrlData.publicUrl,
          status: 'processing',
          webhook_sent_at: new Date().toISOString(),
          metadata: {
            originalFileName: file.name,
            fileSize: file.size,
            fileType: file.type,
          },
        })
        .select()
        .single();

      if (insertError) throw insertError;
      setSubmissionId(insertData.id);

      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      const imageData = await base64Promise;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('image_data', imageData);
      formData.append('callback_url', `${window.location.origin}/api/beautify-callback`);
      formData.append('submission_id', insertData.id);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch('https://n8n.busybiz.dk/webhook-test/ad5f0a18-085b-4a0d-acf2-a6376e675833', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Webhook request failed: ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      console.log('Response content-type:', contentType);

      let beautifiedBlob: Blob;

      if (contentType.includes('image')) {
        console.log('Receiving raw image blob');
        beautifiedBlob = await response.blob();
      } else {
        const jsonResponse = await response.json();
        console.log('Received JSON response:', jsonResponse);

        if (!jsonResponse.file) {
          throw new Error('No image file in webhook response');
        }

        const fileData = jsonResponse.file;
        console.log('File data type:', typeof fileData, 'starts with:', fileData.substring(0, 50));

        if (fileData.startsWith('http://') || fileData.startsWith('https://')) {
          const imageResponse = await fetch(fileData);
          if (!imageResponse.ok) {
            throw new Error('Failed to fetch image from URL');
          }
          beautifiedBlob = await imageResponse.blob();
        } else if (fileData.startsWith('data:image') || /^[A-Za-z0-9+/=]+$/.test(fileData.substring(0, 100))) {
          const base64Data = fileData.replace(/^data:image\/\w+;base64,/, '');
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          beautifiedBlob = new Blob([bytes], { type: 'image/png' });
        } else {
          const bytes = new Uint8Array(fileData.length);
          for (let i = 0; i < fileData.length; i++) {
            bytes[i] = fileData.charCodeAt(i);
          }
          beautifiedBlob = new Blob([bytes], { type: 'image/png' });
        }
      }

      if (!beautifiedBlob || beautifiedBlob.size === 0) {
        throw new Error('No beautified image returned from AI service');
      }

      console.log('✅ Beautified blob size:', beautifiedBlob.size, 'Original blob size:', file.size);

      const beautifiedFileName = `beautified-${Date.now()}.png`;
      const { data: beautifiedUploadData, error: beautifiedUploadError } = await supabase.storage
        .from('paint-to-life')
        .upload(beautifiedFileName, beautifiedBlob, {
          contentType: 'image/png',
          cacheControl: '3600',
        });

      if (beautifiedUploadError) {
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(beautifiedBlob);
        });

        setBeautifiedImage(dataUrl);
        setViewState('result');

        await supabase
          .from('product_beautifier_submissions')
          .update({
            status: 'completed',
            webhook_response_at: new Date().toISOString(),
            metadata: { usesFallback: true },
          })
          .eq('id', insertData.id);
      } else {
        const { data: beautifiedPublicUrlData } = supabase.storage
          .from('paint-to-life')
          .getPublicUrl(beautifiedFileName);

        setBeautifiedImage(beautifiedPublicUrlData.publicUrl);
        setViewState('result');

        await supabase
          .from('product_beautifier_submissions')
          .update({
            beautified_image_url: beautifiedPublicUrlData.publicUrl,
            status: 'completed',
            webhook_response_at: new Date().toISOString(),
          })
          .eq('id', insertData.id);
      }
    } catch (err: any) {
      console.error('Processing error:', err);
      setError(err.message || 'Failed to process image');
      setViewState('upload');

      if (submissionId) {
        await supabase
          .from('product_beautifier_submissions')
          .update({
            status: 'failed',
            error_message: err.message,
          })
          .eq('id', submissionId);
      }
    } finally {
      setUploading(false);
      setProcessing(false);
    }
  };

  const downloadImage = async (imageUrl: string, filename: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const downloadComparison = async () => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const loadImage = (src: string): Promise<HTMLImageElement> => {
        return new Promise(async (resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';

          if (src.startsWith('data:')) {
            img.src = src;
          } else {
            const response = await fetch(src);
            const blob = await response.blob();
            img.src = URL.createObjectURL(blob);
          }

          img.onload = () => resolve(img);
          img.onerror = reject;
        });
      };

      const [originalImg, beautifiedImg] = await Promise.all([
        loadImage(originalImage),
        loadImage(beautifiedImage),
      ]);

      const maxHeight = Math.max(originalImg.height, beautifiedImg.height);
      const padding = 40;
      const gap = 20;
      const titleHeight = 80;
      const labelHeight = 60;

      canvas.width = originalImg.width + beautifiedImg.width + gap + (padding * 2);
      canvas.height = maxHeight + (padding * 2) + titleHeight + labelHeight;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#000000';
      ctx.font = 'bold 36px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Product Image Enhancement', canvas.width / 2, padding + 50);

      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Original', padding + originalImg.width / 2, padding + titleHeight + labelHeight - 20);
      ctx.fillText('Beautified', padding + originalImg.width + gap + beautifiedImg.width / 2, padding + titleHeight + labelHeight - 20);

      const originalY = padding + titleHeight + labelHeight + (maxHeight - originalImg.height) / 2;
      const beautifiedY = padding + titleHeight + labelHeight + (maxHeight - beautifiedImg.height) / 2;

      ctx.drawImage(originalImg, padding, originalY);
      ctx.drawImage(beautifiedImg, padding + originalImg.width + gap, beautifiedY);

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `product-beautified-comparison-${Date.now()}.png`;
          document.body.appendChild(a);
          a.click();
          URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }
      });
    } catch (err) {
      console.error('Failed to create comparison:', err);
    }
  };

  const resetTool = () => {
    setViewState('upload');
    setOriginalImage('');
    setBeautifiedImage('');
    setError('');
    setSubmissionId('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 dark:from-slate-950 dark:via-blue-950 dark:to-cyan-950">
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-8"
        >
          <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 mb-6">
            <Sparkles className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-600 bg-clip-text text-transparent">
            Product Image Beautifier
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Transform your product images with AI-powered enhancement
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {viewState === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-2xl mx-auto"
            >
              <Card>
                <CardHeader>
                  <CardTitle>Upload Your Product Image</CardTitle>
                  <CardDescription>
                    Choose a product photo to enhance with professional lighting and background
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div
                    className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center hover:border-blue-500/50 transition-colors cursor-pointer bg-gradient-to-br from-white/50 to-blue-50/50 dark:from-slate-900/50 dark:to-blue-950/50"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Upload className="h-16 w-16 mx-auto mb-4 text-blue-500" />
                    <h3 className="text-xl font-semibold mb-2">Click to upload</h3>
                    <p className="text-muted-foreground mb-4">
                      Supports JPG, PNG, WebP (Max 10MB)
                    </p>
                    <Button disabled={uploading}>
                      {uploading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <ImageIcon className="h-4 w-4 mr-2" />
                          Select Image
                        </>
                      )}
                    </Button>
                  </div>
                  {error && (
                    <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
                      {error}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {viewState === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-2xl mx-auto"
            >
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-12">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 mb-6"
                    >
                      <Sparkles className="h-10 w-10 text-white" />
                    </motion.div>
                    <h3 className="text-2xl font-semibold mb-2">Enhancing Your Image</h3>
                    <p className="text-muted-foreground mb-8">
                      AI is applying professional lighting, clean background, and color enhancement...
                    </p>
                    <div className="flex justify-center gap-2">
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                        className="w-3 h-3 rounded-full bg-blue-500"
                      />
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                        className="w-3 h-3 rounded-full bg-cyan-500"
                      />
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                        className="w-3 h-3 rounded-full bg-blue-500"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {viewState === 'result' && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-6xl mx-auto"
            >
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-8 w-8 text-green-500" />
                      <div>
                        <CardTitle>Enhancement Complete!</CardTitle>
                        <CardDescription>Your product image has been beautified</CardDescription>
                      </div>
                    </div>
                    <Button onClick={downloadComparison}>
                      <Download className="h-5 w-5 mr-2" />
                      Download Comparison
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-lg flex items-center gap-2">
                            <ImageIcon className="h-5 w-5" />
                            Original
                          </h3>
                          <p className="text-sm text-muted-foreground">Your uploaded image</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadImage(originalImage, 'original.png')}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Save
                        </Button>
                      </div>
                      <div className="rounded-xl overflow-hidden border-2 border-border shadow-xl bg-white">
                        <img
                          src={originalImage}
                          alt="Original product"
                          className="w-full h-auto object-contain max-h-[600px]"
                        />
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-lg flex items-center gap-2">
                            <span className="bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                              Beautified
                            </span>
                            <Sparkles className="h-5 w-5 text-blue-500" />
                          </h3>
                          <p className="text-sm text-muted-foreground">AI-enhanced product photo</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadImage(beautifiedImage, 'beautified.png')}
                          className="border-blue-500/50"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Save
                        </Button>
                      </div>
                      <div className="rounded-xl overflow-hidden border-2 border-blue-500/50 shadow-xl shadow-blue-500/20 bg-gradient-to-br from-blue-50/30 to-cyan-50/30 dark:from-blue-950/20 dark:to-cyan-950/20">
                        <img
                          src={beautifiedImage}
                          alt="Beautified product"
                          className="w-full h-auto object-contain max-h-[600px]"
                        />
                      </div>
                    </motion.div>
                  </div>
                </CardContent>
              </Card>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex justify-center gap-4 mt-8"
              >
                <Button size="lg" onClick={resetTool}>
                  <Upload className="h-5 w-5 mr-2" />
                  Beautify Another Image
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
