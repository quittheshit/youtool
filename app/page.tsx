'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Navbar } from '@/components/navbar';
import { ToolboxDrawer } from '@/components/toolbox-drawer';
import { HeroSection } from '@/components/hero-section';
import { ToolCard } from '@/components/tool-card';
import { supabase, Tool, ToolCategory } from '@/lib/supabase';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Home() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [categories, setCategories] = useState<ToolCategory[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [filteredTools, setFilteredTools] = useState<Tool[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'featured'>('all');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterTools();
  }, [tools, selectedCategory, searchQuery, activeTab]);

  const loadData = async () => {
    const { data: categoriesData } = await supabase
      .from('tool_categories')
      .select('*')
      .order('order_index');

    const { data: toolsData } = await supabase
      .from('tools')
      .select('*')
      .order('order_index');

    if (categoriesData) setCategories(categoriesData);
    if (toolsData) setTools(toolsData);
  };

  const filterTools = () => {
    let filtered = tools;

    if (activeTab === 'featured') {
      filtered = filtered.filter((tool) => tool.is_featured);
    }

    if (selectedCategory) {
      filtered = filtered.filter((tool) => tool.category_id === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (tool) =>
          tool.name.toLowerCase().includes(query) ||
          tool.description?.toLowerCase().includes(query)
      );
    }

    setFilteredTools(filtered);
  };

  const handleCategorySelect = (categoryId: string | null) => {
    setSelectedCategory(categoryId);
    setActiveTab('all');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-blue-50/20 dark:to-blue-950/20">
      <Navbar
        onMenuClick={() => setIsDrawerOpen(true)}
        onSearch={setSearchQuery}
      />

      <ToolboxDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={handleCategorySelect}
      />

      <HeroSection />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="mb-8">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'all' | 'featured')}>
            <TabsList className="bg-card/50 backdrop-blur-sm">
              <TabsTrigger value="all" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-cyan-600 data-[state=active]:text-white">
                All Tools
              </TabsTrigger>
              <TabsTrigger value="featured" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-cyan-600 data-[state=active]:text-white">
                Featured
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-8">
              {selectedCategory && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6"
                >
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-card/50 backdrop-blur-sm border">
                    <span className="text-sm text-muted-foreground">Filtered by:</span>
                    <span className="font-medium">
                      {categories.find((c) => c.id === selectedCategory)?.name}
                    </span>
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className="ml-2 text-muted-foreground hover:text-foreground"
                    >
                      ✕
                    </button>
                  </div>
                </motion.div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTools.length > 0 ? (
                  filteredTools.map((tool, index) => (
                    <ToolCard key={tool.id} tool={tool} index={index} />
                  ))
                ) : (
                  <div className="col-span-full text-center py-20">
                    <p className="text-muted-foreground">No tools found matching your criteria.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="featured" className="mt-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTools.length > 0 ? (
                  filteredTools.map((tool, index) => (
                    <ToolCard key={tool.id} tool={tool} index={index} />
                  ))
                ) : (
                  <div className="col-span-full text-center py-20">
                    <p className="text-muted-foreground">No featured tools available yet.</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <footer className="border-t bg-card/30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center text-sm text-muted-foreground">
            <p>&copy; 2025 YouTool. Built for automation, AI, and creative possibilities.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
