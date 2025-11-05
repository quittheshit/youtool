'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function TestDB() {
  const [status, setStatus] = useState('Testing connection...');
  const [envVars, setEnvVars] = useState({ url: '', key: '' });
  const [tools, setTools] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const testConnection = async () => {
      setEnvVars({
        url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'MISSING',
        key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET (hidden)' : 'MISSING'
      });

      try {
        const { data: categoriesData, error: catError } = await supabase
          .from('tool_categories')
          .select('*');

        if (catError) throw catError;

        const { data: toolsData, error: toolError } = await supabase
          .from('tools')
          .select('*');

        if (toolError) throw toolError;

        setCategories(categoriesData || []);
        setTools(toolsData || []);
        setStatus('✅ Connection successful!');
      } catch (err: any) {
        setError(err.message);
        setStatus('❌ Connection failed');
      }
    };

    testConnection();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Database Connection Test</h1>

        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Status: {status}</h2>

          <div className="mb-4">
            <h3 className="font-semibold">Environment Variables:</h3>
            <p>URL: {envVars.url}</p>
            <p>Anon Key: {envVars.key}</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 p-4 rounded mb-4">
              <h3 className="font-semibold text-red-800">Error:</h3>
              <p className="text-red-600">{error}</p>
            </div>
          )}

          <div className="mb-4">
            <h3 className="font-semibold">Categories Found: {categories.length}</h3>
            <pre className="bg-gray-100 p-2 rounded mt-2 text-xs overflow-auto">
              {JSON.stringify(categories, null, 2)}
            </pre>
          </div>

          <div>
            <h3 className="font-semibold">Tools Found: {tools.length}</h3>
            <pre className="bg-gray-100 p-2 rounded mt-2 text-xs overflow-auto">
              {JSON.stringify(tools, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
