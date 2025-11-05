import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://iauvnrrufkkbclndonkp.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhdXZucnJ1ZmtrYmNsbmRvbmtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMzQyMzksImV4cCI6MjA3NzgxMDIzOX0.21OMGHRwxZd17DhP1hlxn_oEPyaK8kkvc79s5WgR07k';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type ToolCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  order_index: number;
  created_at: string;
};

export type Tool = {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  status: 'active' | 'coming_soon' | 'beta';
  integration_type: string | null;
  config_schema: any;
  is_featured: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
};
