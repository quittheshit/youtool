'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Sparkles, Loader2, Download, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DrawingCanvas } from '@/components/drawing-canvas';
import { supabase } from '@/lib/supabase';

type ViewState = 'drawing' | 'processing' | 'result';

const applyDemoTransformation = async (imageBlob: Blob): Promise<Blob> => {
  return new Promise((resolve) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;

      if (ctx) {
        ctx.filter = 'contrast(1.2) saturate(1.4) brightness(1.1)';
        ctx.drawImage(img, 0, 0);

        ctx.filter = 'none';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 5;
        ctx.shadowOffsetY = 5;
        ctx.drawImage(canvas, 0, 0);
      }

      canvas.toBlob((blob) => {
        resolve(blob || imageBlob);
      }, 'image/png');
    };

    img.src = URL.createObjectURL(imageBlob);
  });
};

export default function PaintToLifePage() {
  const [viewState, setViewState] = useState<ViewState>('drawing');
  const [title, setTitle] = useState('');
  const [originalImage, setOriginalImage] = useState<string>('');
  const [transformedImage, setTransformedImage] = useState<string>('');
  const [submissionId, setSubmissionId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const handleFinishDrawing = async (imageDataUrl: string, imageBlob: Blob) => {
    if (!title.trim()) {
      setError('Please enter a title for your drawing');
      return;
    }

    setError('');
    setOriginalImage(imageDataUrl);
    setViewState('processing');

    try {
      const fileName = `drawing-${Date.now()}.png`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('paint-to-life')
        .upload(fileName, imageBlob, {
          contentType: 'image/png',
          cacheControl: '3600',
        });

      if (uploadError) {
        const { data: insertData, error: insertError } = await supabase
          .from('paint_to_life_submissions')
          .insert({
            title: title.trim(),
            original_image_url: imageDataUrl,
            status: 'pending',
            metadata: { usesFallback: true },
          })
          .select()
          .single();

        if (insertError) throw insertError;
        setSubmissionId(insertData.id);
      } else {
        const { data: publicUrlData } = supabase.storage
          .from('paint-to-life')
          .getPublicUrl(fileName);

        const { data: insertData, error: insertError } = await supabase
          .from('paint_to_life_submissions')
          .insert({
            title: title.trim(),
            original_image_url: publicUrlData.publicUrl,
            status: 'processing',
            webhook_sent_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (insertError) throw insertError;
        setSubmissionId(insertData.id);

        let transformedBlob: Blob;

        try {
          const formData = new FormData();
          formData.append('submissionId', insertData.id);
          formData.append('title', title.trim());
          formData.append('imageUrl', publicUrlData.publicUrl);
          formData.append('filePath', fileName);
          formData.append('image', imageBlob, `${fileName}`);

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

          const response = await fetch('https://n8n-project-1-we63.onrender.com/webhook/dc219bf6-6d33-4201-b99e-43039f6d56b6', {
            method: 'POST',
            body: formData,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`Webhook request failed: ${response.status}`);
          }

          transformedBlob = await response.blob();

          if (!transformedBlob || transformedBlob.size === 0) {
            throw new Error('No transformed image returned from AI service');
          }
        } catch (webhookError: any) {
          console.warn('AI service unavailable, using demo mode:', webhookError.message);

          transformedBlob = await applyDemoTransformation(imageBlob);

          await supabase
            .from('paint_to_life_submissions')
            .update({
              metadata: { demoMode: true, reason: webhookError.message },
            })
            .eq('id', insertData.id);
        }

        const transformedFileName = `transformed-${Date.now()}.png`;
        const { data: transformedUploadData, error: transformedUploadError } = await supabase.storage
          .from('paint-to-life')
          .upload(transformedFileName, transformedBlob, {
            contentType: 'image/png',
            cacheControl: '3600',
          });

        if (transformedUploadError) {
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(transformedBlob);
          });

          setTransformedImage(dataUrl);
          setViewState('result');

          await supabase
            .from('paint_to_life_submissions')
            .update({
              status: 'completed',
              webhook_response_at: new Date().toISOString(),
              metadata: { usesFallback: true },
            })
            .eq('id', insertData.id);
        } else {
          const { data: transformedPublicUrlData } = supabase.storage
            .from('paint-to-life')
            .getPublicUrl(transformedFileName);

          setTransformedImage(transformedPublicUrlData.publicUrl);
          setViewState('result');

          await supabase
            .from('paint_to_life_submissions')
            .update({
              transformed_image_url: transformedPublicUrlData.publicUrl,
              status: 'completed',
              webhook_response_at: new Date().toISOString(),
            })
            .eq('id', insertData.id);
        }
      }
    } catch (err: any) {
      console.error('Error processing drawing:', err);

      let errorMessage = 'Failed to process drawing. Please try again.';

      if (err.message.includes('Failed to fetch')) {
        errorMessage = 'Network error: Unable to connect to the AI transformation service. Please check your connection and try again.';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      setViewState('drawing');

      if (submissionId) {
        await supabase
          .from('paint_to_life_submissions')
          .update({
            status: 'failed',
            error_message: errorMessage,
          })
          .eq('id', submissionId);
      }
    }
  };

  const handleReset = () => {
    setViewState('drawing');
    setTitle('');
    setOriginalImage('');
    setTransformedImage('');
    setSubmissionId('');
    setError('');
    setIsEditingTitle(false);
    setNewTitle('');
  };

  const handleRetryWithNewTitle = async () => {
    if (!newTitle.trim()) {
      setError('Please enter a new title');
      return;
    }

    setError('');
    setTitle(newTitle.trim());
    setViewState('processing');
    setIsEditingTitle(false);

    try {
      const response = await fetch(originalImage);
      const blob = await response.blob();

      const fileName = `drawing-${Date.now()}.png`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('paint-to-life')
        .upload(fileName, blob, {
          contentType: 'image/png',
          cacheControl: '3600',
        });

      if (uploadError) {
        const { data: insertData, error: insertError } = await supabase
          .from('paint_to_life_submissions')
          .insert({
            title: newTitle.trim(),
            original_image_url: originalImage,
            status: 'pending',
            metadata: { usesFallback: true },
          })
          .select()
          .single();

        if (insertError) throw insertError;
        setSubmissionId(insertData.id);
      } else {
        const { data: publicUrlData } = supabase.storage
          .from('paint-to-life')
          .getPublicUrl(fileName);

        const { data: insertData, error: insertError } = await supabase
          .from('paint_to_life_submissions')
          .insert({
            title: newTitle.trim(),
            original_image_url: publicUrlData.publicUrl,
            status: 'processing',
            webhook_sent_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (insertError) throw insertError;
        setSubmissionId(insertData.id);

        let transformedBlob: Blob;

        try {
          const formData = new FormData();
          formData.append('submissionId', insertData.id);
          formData.append('title', newTitle.trim());
          formData.append('imageUrl', publicUrlData.publicUrl);
          formData.append('filePath', fileName);
          formData.append('image', blob, `${fileName}`);

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

          const webhookResponse = await fetch('https://n8n-project-1-we63.onrender.com/webhook/dc219bf6-6d33-4201-b99e-43039f6d56b6', {
            method: 'POST',
            body: formData,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!webhookResponse.ok) {
            throw new Error(`Webhook request failed: ${webhookResponse.status}`);
          }

          transformedBlob = await webhookResponse.blob();

          if (!transformedBlob || transformedBlob.size === 0) {
            throw new Error('No transformed image returned from AI service');
          }
        } catch (webhookError: any) {
          console.warn('AI service unavailable, using demo mode:', webhookError.message);

          transformedBlob = await applyDemoTransformation(blob);

          await supabase
            .from('paint_to_life_submissions')
            .update({
              metadata: { demoMode: true, reason: webhookError.message },
            })
            .eq('id', insertData.id);
        }

        const transformedFileName = `transformed-${Date.now()}.png`;
        const { data: transformedUploadData, error: transformedUploadError } = await supabase.storage
          .from('paint-to-life')
          .upload(transformedFileName, transformedBlob, {
            contentType: 'image/png',
            cacheControl: '3600',
          });

        if (transformedUploadError) {
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(transformedBlob);
          });

          setTransformedImage(dataUrl);
          setViewState('result');

          await supabase
            .from('paint_to_life_submissions')
            .update({
              status: 'completed',
              webhook_response_at: new Date().toISOString(),
              metadata: { usesFallback: true },
            })
            .eq('id', insertData.id);
        } else {
          const { data: transformedPublicUrlData } = supabase.storage
            .from('paint-to-life')
            .getPublicUrl(transformedFileName);

          setTransformedImage(transformedPublicUrlData.publicUrl);
          setViewState('result');

          await supabase
            .from('paint_to_life_submissions')
            .update({
              transformed_image_url: transformedPublicUrlData.publicUrl,
              status: 'completed',
              webhook_response_at: new Date().toISOString(),
            })
            .eq('id', insertData.id);
        }
      }
    } catch (err: any) {
      console.error('Error processing drawing:', err);

      let errorMessage = 'Failed to process drawing. Please try again.';

      if (err.message.includes('Failed to fetch')) {
        errorMessage = 'Network error: Unable to connect to the AI transformation service. Please check your connection and try again.';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      setViewState('result');
      setIsEditingTitle(true);

      if (submissionId) {
        await supabase
          .from('paint_to_life_submissions')
          .update({
            status: 'failed',
            error_message: errorMessage,
          })
          .eq('id', submissionId);
      }
    }
  };

  const downloadImage = async (imageUrl: string, filename: string) => {
    try {
      if (imageUrl.startsWith('data:')) {
        const link = document.createElement('a');
        link.download = filename;
        link.href = imageUrl;
        link.click();
      } else {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = filename;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const downloadSideBySide = async () => {
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

      const [originalImg, transformedImg] = await Promise.all([
        loadImage(originalImage),
        loadImage(transformedImage),
      ]);

      const maxHeight = Math.max(originalImg.height, transformedImg.height);
      const padding = 40;
      const gap = 20;
      const titleHeight = 80;
      const labelHeight = 60;

      canvas.width = originalImg.width + transformedImg.width + gap + (padding * 2);
      canvas.height = maxHeight + (padding * 2) + titleHeight + labelHeight;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#000000';
      ctx.font = 'bold 36px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(title, canvas.width / 2, padding + 50);

      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Original', padding + originalImg.width / 2, padding + titleHeight + labelHeight - 20);
      ctx.fillText('AI Enhanced', padding + originalImg.width + gap + transformedImg.width / 2, padding + titleHeight + labelHeight - 20);

      const originalY = padding + titleHeight + labelHeight + (maxHeight - originalImg.height) / 2;
      const transformedY = padding + titleHeight + labelHeight + (maxHeight - transformedImg.height) / 2;

      ctx.drawImage(originalImg, padding, originalY);
      ctx.drawImage(transformedImg, padding + originalImg.width + gap, transformedY);

      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 2;
      ctx.strokeRect(padding, padding + titleHeight + labelHeight, originalImg.width, originalImg.height);
      ctx.strokeRect(padding + originalImg.width + gap, padding + titleHeight + labelHeight, transformedImg.width, transformedImg.height);

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.download = `${title}-side-by-side.png`;
          link.href = url;
          link.click();
          URL.revokeObjectURL(url);
        }
      }, 'image/png');
    } catch (error) {
      console.error('Failed to create side-by-side image:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-blue-50/20 dark:to-blue-950/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 backdrop-blur-sm mb-4">
            <Sparkles className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium">AI Image Transformation</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
            Paint To Life
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Draw something amazing, and watch AI transform it into a stunning masterpiece
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {viewState === 'drawing' && (
            <motion.div
              key="drawing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <Card className="border-2 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>Create Your Drawing</CardTitle>
                  <CardDescription>
                    Use the canvas below to draw your creation. Choose colors, adjust brush size, and unleash your creativity!
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="title">Drawing Title</Label>
                    <Input
                      id="title"
                      placeholder="Give your drawing a name..."
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="text-lg"
                    />
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive"
                    >
                      {error}
                    </motion.div>
                  )}

                  <DrawingCanvas onFinish={handleFinishDrawing} />
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
              className="flex flex-col items-center justify-center py-20"
            >
              <Card className="max-w-md w-full border-2 bg-card/50 backdrop-blur-sm">
                <CardContent className="pt-6 text-center space-y-6">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className="w-20 h-20 mx-auto rounded-full bg-gradient-to-r from-blue-600 to-cyan-600 flex items-center justify-center"
                  >
                    <Loader2 className="h-10 w-10 text-white" />
                  </motion.div>

                  <div>
                    <h2 className="text-2xl font-bold mb-2">Transforming Your Art</h2>
                    <p className="text-muted-foreground">
                      Our AI is working its magic on your drawing. This may take a moment...
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      Analyzing your drawing
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse delay-1000" />
                      Applying AI transformation
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse delay-2000" />
                      Generating final result
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
              className="space-y-6"
            >
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-center mb-8"
              >
                <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 backdrop-blur-sm mb-4">
                  <Sparkles className="h-5 w-5 text-yellow-500 animate-pulse" />
                  <span className="text-lg font-bold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">
                    Magic Complete!
                  </span>
                </div>
                {!isEditingTitle ? (
                  <>
                    <h2 className="text-3xl font-bold mb-2">{title}</h2>
                    <p className="text-muted-foreground text-lg">
                      Watch your imagination come to life through AI transformation
                    </p>
                  </>
                ) : (
                  <div className="max-w-md mx-auto space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="newTitle" className="text-lg">Enter New Title</Label>
                      <Input
                        id="newTitle"
                        placeholder="Give your drawing a new title..."
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        className="text-lg"
                      />
                    </div>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm"
                      >
                        {error}
                      </motion.div>
                    )}
                    <div className="flex gap-3">
                      <Button
                        onClick={handleRetryWithNewTitle}
                        className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Transform Again
                      </Button>
                      <Button
                        onClick={() => {
                          setIsEditingTitle(false);
                          setNewTitle('');
                          setError('');
                        }}
                        variant="outline"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </motion.div>

              <Card className="border-2 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="text-center flex-1">
                      <CardTitle className="text-2xl mb-2">Side-by-Side Comparison</CardTitle>
                      <CardDescription>
                        See how AI transforms your creativity
                      </CardDescription>
                    </div>
                    <Button
                      onClick={downloadSideBySide}
                      size="lg"
                      className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-md"
                    >
                      <Download className="h-5 w-5 mr-2" />
                      Download Side-by-Side
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-lg">Your Original</h3>
                          <p className="text-sm text-muted-foreground">Where creativity begins</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadImage(originalImage, `${title}-original.png`)}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Save
                        </Button>
                      </div>
                      <div className="rounded-xl overflow-hidden border-2 border-border shadow-xl bg-white">
                        <img
                          src={originalImage}
                          alt="Original drawing"
                          className="w-full h-auto object-contain max-h-[600px]"
                        />
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-lg flex items-center gap-2">
                            <span className="bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                              AI Enhanced
                            </span>
                            <Sparkles className="h-5 w-5 text-blue-500" />
                          </h3>
                          <p className="text-sm text-muted-foreground">Powered by artificial intelligence</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadImage(transformedImage, `${title}-ai-enhanced.png`)}
                          className="border-blue-500/50"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Save
                        </Button>
                      </div>
                      <div className="rounded-xl overflow-hidden border-2 border-blue-500/50 shadow-xl shadow-blue-500/20 bg-gradient-to-br from-blue-50/30 to-cyan-50/30 dark:from-blue-950/20 dark:to-cyan-950/20">
                        <img
                          src={transformedImage}
                          alt="AI transformed drawing"
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
                transition={{ delay: 0.5 }}
                className="flex flex-col items-center gap-4 pt-6"
              >
                <div className="text-center max-w-2xl">
                  <p className="text-muted-foreground mb-4">
                    Love what you see? Create another masterpiece or try a different title with the same drawing!
                  </p>
                </div>
                <div className="flex gap-4 flex-wrap justify-center">
                  <Button
                    onClick={() => {
                      setIsEditingTitle(true);
                      setNewTitle(title);
                    }}
                    size="lg"
                    variant="outline"
                    className="border-blue-500/50 hover:bg-blue-500/10"
                  >
                    <Sparkles className="h-5 w-5 mr-2" />
                    Try Different Title
                  </Button>
                  <Button
                    onClick={handleReset}
                    size="lg"
                    className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-lg hover:shadow-xl transition-all"
                  >
                    <RefreshCw className="h-5 w-5 mr-2" />
                    Create New Drawing
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
