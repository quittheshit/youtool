/*
  # Simplify RLS Policies for Paint to Life

  1. Changes
    - Drop all existing policies
    - Create simple, permissive policies that definitely work
    - Allow all operations for anonymous users without complex checks
*/

DROP POLICY IF EXISTS "Anonymous users can insert" ON paint_to_life_submissions;
DROP POLICY IF EXISTS "Authenticated users can insert" ON paint_to_life_submissions;
DROP POLICY IF EXISTS "Users can view their own submissions" ON paint_to_life_submissions;
DROP POLICY IF EXISTS "Anyone can view completed submissions" ON paint_to_life_submissions;
DROP POLICY IF EXISTS "System can update all submissions" ON paint_to_life_submissions;

CREATE POLICY "Enable insert for everyone"
  ON paint_to_life_submissions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Enable read for everyone"
  ON paint_to_life_submissions
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Enable update for everyone"
  ON paint_to_life_submissions
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);