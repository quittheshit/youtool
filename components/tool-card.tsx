'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import * as Icons from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tool } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface ToolCardProps {
  tool: Tool;
  index: number;
}

export function ToolCard({ tool, index }: ToolCardProps) {
  const router = useRouter();

  const getIcon = (iconName: string | null) => {
    if (!iconName) return Icons.Box;
    const Icon = (Icons as any)[iconName];
    return Icon || Icons.Box;
  };

  const Icon = getIcon(tool.icon);

  const statusConfig = {
    active: { label: 'Active', className: 'bg-green-500/10 text-green-600 border-green-500/20' },
    beta: { label: 'Beta', className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
    coming_soon: { label: 'Coming Soon', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  };

  const status = statusConfig[tool.status];

  const handleLaunch = () => {
    if (tool.status === 'active') {
      router.push(`/tools/${tool.slug}`);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      whileHover={{ y: -8, scale: 1.02 }}
      className="h-full"
    >
      <Card className="h-full relative overflow-hidden group border-2 hover:border-primary/50 transition-all duration-300 bg-card/50 backdrop-blur-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {tool.is_featured && (
          <div className="absolute top-3 right-3 z-10">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              <Icons.Star className="h-5 w-5 fill-yellow-500 text-yellow-500" />
            </motion.div>
          </div>
        )}

        <CardHeader className="relative">
          <div className="flex items-start gap-4">
            <motion.div
              whileHover={{ rotate: 360, scale: 1.1 }}
              transition={{ duration: 0.6 }}
              className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg flex-shrink-0"
            >
              <Icon className="h-7 w-7 text-white" />
            </motion.div>

            <div className="flex-1 min-w-0">
              <CardTitle className="text-xl mb-2">{tool.name}</CardTitle>
              <Badge variant="outline" className={cn('text-xs', status.className)}>
                {status.label}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative">
          <CardDescription className="mb-4 line-clamp-2 min-h-[2.5rem]">
            {tool.description || 'No description available'}
          </CardDescription>

          <div className="flex gap-2">
            <Button
              variant="default"
              className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
              disabled={tool.status !== 'active'}
              onClick={handleLaunch}
            >
              {tool.status === 'active' ? 'Launch' : 'Notify Me'}
            </Button>
            <Button variant="outline" size="icon">
              <Icons.Info className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
