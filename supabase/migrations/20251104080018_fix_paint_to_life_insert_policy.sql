/*
  # Fix Paint to Life Insert Policy

  1. Changes
    - Drop the existing insert policy that's blocking anonymous inserts
    - Create a new insert policy that properly allows anonymous submissions
    - The policy allows anyone (authenticated or not) to insert records
*/

DROP POLICY IF EXISTS "Anyone can insert submissions" ON paint_to_life_submissions;

CREATE POLICY "Allow anonymous and authenticated inserts"
  ON paint_to_life_submissions
  FOR INSERT
  TO public
  WITH CHECK (true);