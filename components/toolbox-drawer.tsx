'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import * as Icons from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToolCategory } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface ToolboxDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  categories: ToolCategory[];
  selectedCategory: string | null;
  onSelectCategory: (categoryId: string | null) => void;
}

export function ToolboxDrawer({
  isOpen,
  onClose,
  categories,
  selectedCategory,
  onSelectCategory,
}: ToolboxDrawerProps) {
  const getIcon = (iconName: string | null) => {
    if (!iconName) return Icons.Box;
    const Icon = (Icons as any)[iconName];
    return Icon || Icons.Box;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          />

          <motion.div
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed left-0 top-0 bottom-0 w-80 bg-background/95 backdrop-blur-xl border-r shadow-2xl z-50"
          >
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-lg font-semibold">Tool Categories</h2>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <ScrollArea className="flex-1 p-4">
                <div className="space-y-2">
                  <motion.button
                    onClick={() => {
                      onSelectCategory(null);
                      onClose();
                    }}
                    whileHover={{ scale: 1.02, x: 4 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      'w-full flex items-center gap-3 p-4 rounded-lg transition-all',
                      selectedCategory === null
                        ? 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30'
                        : 'hover:bg-accent'
                    )}
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                      <Icons.Grid3x3 className="h-5 w-5 text-white" />
                    </div>
                    <span className="font-medium">All Tools</span>
                  </motion.button>

                  {categories.map((category) => {
                    const Icon = getIcon(category.icon);
                    const isSelected = selectedCategory === category.id;

                    return (
                      <motion.button
                        key={category.id}
                        onClick={() => {
                          onSelectCategory(category.id);
                          onClose();
                        }}
                        whileHover={{ scale: 1.02, x: 4 }}
                        whileTap={{ scale: 0.98 }}
                        className={cn(
                          'w-full flex items-center gap-3 p-4 rounded-lg transition-all',
                          isSelected
                            ? 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30'
                            : 'hover:bg-accent'
                        )}
                      >
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{
                            background: category.color
                              ? `linear-gradient(135deg, ${category.color}, ${category.color}dd)`
                              : 'linear-gradient(135deg, #3b82f6, #3b82f6dd)',
                          }}
                        >
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1 text-left">
                          <div className="font-medium">{category.name}</div>
                          {category.description && (
                            <div className="text-xs text-muted-foreground line-clamp-1">
                              {category.description}
                            </div>
                          )}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
