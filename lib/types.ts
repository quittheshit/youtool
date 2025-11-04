export interface IntegrationConfig {
  id: string;
  name: string;
  type: 'api' | 'oauth' | 'webhook';
  credentials?: Record<string, string>;
  settings?: Record<string, any>;
}

export interface ToolExecution {
  toolId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  result?: any;
  error?: string;
}

export interface WorkflowStep {
  id: string;
  toolId: string;
  config: Record<string, any>;
  order: number;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
