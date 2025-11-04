/*
  # YouTool Schema - Tool Categories and Integrations

  ## Overview
  Sets up the foundational schema for YouTool, a modern automation and AI tool showcase platform.
  This migration creates the database structure for tool categories, tools, and user favorites.

  ## New Tables
  
  ### `tool_categories`
  - `id` (uuid, primary key) - Unique identifier for each category
  - `name` (text, not null) - Category name (e.g., "AI Tools", "Automation")
  - `slug` (text, unique, not null) - URL-friendly identifier
  - `description` (text) - Category description
  - `icon` (text) - Lucide icon name for the category
  - `color` (text) - Hex color for category theming
  - `order_index` (integer, default 0) - Display order
  - `created_at` (timestamptz, default now()) - Record creation timestamp
  
  ### `tools`
  - `id` (uuid, primary key) - Unique identifier for each tool
  - `category_id` (uuid, foreign key) - References tool_categories
  - `name` (text, not null) - Tool name
  - `slug` (text, unique, not null) - URL-friendly identifier
  - `description` (text) - Tool description
  - `icon` (text) - Lucide icon name
  - `status` (text, default 'coming_soon') - Status: 'active', 'coming_soon', 'beta'
  - `integration_type` (text) - Type of integration (e.g., 'api', 'webhook', 'oauth')
  - `config_schema` (jsonb) - JSON schema for tool configuration
  - `is_featured` (boolean, default false) - Featured tool flag
  - `order_index` (integer, default 0) - Display order within category
  - `created_at` (timestamptz, default now()) - Record creation timestamp
  - `updated_at` (timestamptz, default now()) - Record update timestamp

  ### `user_favorites`
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid, not null) - References auth.users
  - `tool_id` (uuid, foreign key) - References tools
  - `created_at` (timestamptz, default now()) - Record creation timestamp
  - Unique constraint on (user_id, tool_id)

  ## Security
  - Enable RLS on all tables
  - Public read access for categories and tools (unauthenticated browsing)
  - Authenticated users can manage their own favorites
  
  ## Notes
  - Uses UUID for all primary keys with auto-generation
  - Includes indexes for performance on foreign keys and lookups
  - JSONB field for flexible tool configuration storage
  - Prepared for future integration expansions
*/

CREATE TABLE IF NOT EXISTS tool_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  icon text,
  color text,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES tool_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  icon text,
  status text DEFAULT 'coming_soon' CHECK (status IN ('active', 'coming_soon', 'beta')),
  integration_type text,
  config_schema jsonb,
  is_featured boolean DEFAULT false,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tool_id uuid REFERENCES tools(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, tool_id)
);

CREATE INDEX IF NOT EXISTS idx_tools_category_id ON tools(category_id);
CREATE INDEX IF NOT EXISTS idx_tools_status ON tools(status);
CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_tool_id ON user_favorites(tool_id);

ALTER TABLE tool_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tool categories"
  ON tool_categories FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view tools"
  ON tools FOR SELECT
  USING (true);

CREATE POLICY "Users can view their own favorites"
  ON user_favorites FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own favorites"
  ON user_favorites FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorites"
  ON user_favorites FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

INSERT INTO tool_categories (name, slug, description, icon, color, order_index) VALUES
  ('AI Tools', 'ai-tools', 'Powerful AI models and automation', 'Brain', '#3b82f6', 1),
  ('Automation', 'automation', 'Workflow automation and task scheduling', 'Zap', '#10b981', 2),
  ('Content Creation', 'content-creation', 'Tools for creating and editing content', 'Sparkles', '#f59e0b', 3),
  ('Analytics', 'analytics', 'Data analysis and visualization tools', 'BarChart3', '#8b5cf6', 4),
  ('Communication', 'communication', 'Messaging and collaboration tools', 'MessageSquare', '#ec4899', 5),
  ('Developer Tools', 'developer-tools', 'APIs and development utilities', 'Code2', '#06b6d4', 6)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO tools (category_id, name, slug, description, icon, status, is_featured, order_index) VALUES
  ((SELECT id FROM tool_categories WHERE slug = 'ai-tools'), 'GPT Assistant', 'gpt-assistant', 'AI-powered chat and content generation', 'MessageCircle', 'coming_soon', true, 1),
  ((SELECT id FROM tool_categories WHERE slug = 'ai-tools'), 'Image Generator', 'image-generator', 'Create images from text descriptions', 'Image', 'coming_soon', true, 2),
  ((SELECT id FROM tool_categories WHERE slug = 'automation'), 'Task Scheduler', 'task-scheduler', 'Automate recurring tasks and workflows', 'Calendar', 'coming_soon', false, 1),
  ((SELECT id FROM tool_categories WHERE slug = 'automation'), 'Webhook Manager', 'webhook-manager', 'Manage and monitor webhooks', 'Webhook', 'coming_soon', false, 2),
  ((SELECT id FROM tool_categories WHERE slug = 'content-creation'), 'Video Editor', 'video-editor', 'Edit and enhance videos', 'Film', 'coming_soon', true, 1),
  ((SELECT id FROM tool_categories WHERE slug = 'analytics'), 'Dashboard Builder', 'dashboard-builder', 'Create custom analytics dashboards', 'LayoutDashboard', 'coming_soon', false, 1),
  ((SELECT id FROM tool_categories WHERE slug = 'communication'), 'Email Automation', 'email-automation', 'Automated email campaigns', 'Mail', 'coming_soon', false, 1),
  ((SELECT id FROM tool_categories WHERE slug = 'developer-tools'), 'API Playground', 'api-playground', 'Test and debug APIs', 'Terminal', 'coming_soon', false, 1)
ON CONFLICT (slug) DO NOTHING;