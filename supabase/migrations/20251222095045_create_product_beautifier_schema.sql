/*
  Product Beautifier Schema

  1. New Tables
    - product_beautifier_submissions
      - id (uuid, primary key) - Unique identifier for each submission
      - original_image_url (text) - URL of the uploaded original image
      - beautified_image_url (text, nullable) - URL of the AI-enhanced image
      - status (text) - Current status: uploading, processing, completed, failed
      - webhook_sent_at (timestamptz, nullable) - When webhook request was sent
      - webhook_response_at (timestamptz, nullable) - When webhook response received
      - error_message (text, nullable) - Error details if processing failed
      - metadata (jsonb, nullable) - Additional data (file size, dimensions, etc.)
      - created_at (timestamptz) - Submission timestamp
      - updated_at (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on product_beautifier_submissions table
    - Add policy for anyone to create submissions (public tool)
    - Add policy for anyone to read submissions
*/

CREATE TABLE IF NOT EXISTS product_beautifier_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_image_url text NOT NULL,
  beautified_image_url text,
  status text NOT NULL DEFAULT 'uploading',
  webhook_sent_at timestamptz,
  webhook_response_at timestamptz,
  error_message text,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE product_beautifier_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create submissions"
  ON product_beautifier_submissions
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can read submissions"
  ON product_beautifier_submissions
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can update submissions"
  ON product_beautifier_submissions
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);