/*
  # Paint To Life - Image Transformation Schema

  ## Overview
  Creates database tables for storing Paint To Life submissions, tracking the transformation
  process, and storing both original drawings and AI-transformed results.

  ## New Tables
  
  ### `paint_to_life_submissions`
  - `id` (uuid, primary key) - Unique identifier for each submission
  - `user_id` (uuid, nullable) - References auth.users (nullable for anonymous users)
  - `title` (text, not null) - User-provided title for the drawing
  - `original_image_url` (text, not null) - URL/path to the original drawing
  - `transformed_image_url` (text, nullable) - URL/path to the AI-transformed image
  - `status` (text, default 'pending') - Status: 'pending', 'processing', 'completed', 'failed'
  - `webhook_sent_at` (timestamptz, nullable) - When webhook request was sent
  - `webhook_response_at` (timestamptz, nullable) - When webhook response was received
  - `error_message` (text, nullable) - Error message if transformation failed
  - `metadata` (jsonb, default '{}') - Additional metadata (canvas size, colors used, etc.)
  - `created_at` (timestamptz, default now()) - Record creation timestamp
  - `updated_at` (timestamptz, default now()) - Record update timestamp

  ## Security
  - Enable RLS on paint_to_life_submissions table
  - Allow anyone to insert submissions (for anonymous users)
  - Users can view their own submissions
  - Public can view completed submissions

  ## Indexes
  - Index on user_id for fast user-specific queries
  - Index on status for filtering by processing status
  - Index on created_at for chronological ordering

  ## Notes
  - Supports both authenticated and anonymous users
  - Tracks full transformation lifecycle
  - Stores metadata for future analytics
*/

CREATE TABLE IF NOT EXISTS paint_to_life_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  title text NOT NULL,
  original_image_url text NOT NULL,
  transformed_image_url text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  webhook_sent_at timestamptz,
  webhook_response_at timestamptz,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paint_to_life_user_id ON paint_to_life_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_paint_to_life_status ON paint_to_life_submissions(status);
CREATE INDEX IF NOT EXISTS idx_paint_to_life_created_at ON paint_to_life_submissions(created_at DESC);

ALTER TABLE paint_to_life_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert submissions"
  ON paint_to_life_submissions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view their own submissions"
  ON paint_to_life_submissions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view completed submissions"
  ON paint_to_life_submissions FOR SELECT
  USING (status = 'completed');

CREATE POLICY "System can update all submissions"
  ON paint_to_life_submissions FOR UPDATE
  USING (true)
  WITH CHECK (true);