'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { useTRPC } from '@/src/trpc/client';

export function ClientContent() {
  const [prompt, setPrompt] = useState('');
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  // tRPC hooks for API generation
  const generateAPI = useTRPC().apiGeneration.generateAPI.useMutation({
    onSuccess: (data: { jobId: string; status: string; message: string; estimatedTime: number }) => {
      setCurrentJobId(data.jobId);
    },
  });

  const { data: jobStatus } = useTRPC().jobs.getJob.useQuery(
    { jobId: currentJobId! },
    { 
      enabled: !!currentJobId,
      refetchInterval: 2000,
    }
  );

  const { data: projects } = useTRPC().apiGeneration.getProjects.useQuery();
  const { data: templates } = useTRPC().apiGeneration.getTemplates.useQuery();

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    
    generateAPI.mutate({
      prompt,
      framework: 'fastapi',
      advanced: false,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'deployed': return 'bg-green-500';
      case 'generating': return 'bg-blue-500';
      case 'testing': return 'bg-yellow-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'deployed': return <CheckCircle className="h-4 w-4" />;
      case 'generating': return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'testing': return <Clock className="h-4 w-4" />;
      case 'failed': return <AlertCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* API Generation Input */}
      <Card>
        <CardHeader>
          <CardTitle>Generate Your API</CardTitle>
          <CardDescription>
            Describe your API requirements in plain English
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="e.g., Create a REST API for a blog with posts, comments, and user authentication"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="flex-1"
            />
            <Button 
              onClick={handleGenerate}
              disabled={generateAPI.isLoading || !prompt.trim()}
            >
              {generateAPI.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Generate API
            </Button>
          </div>

          {/* Job Status */}
          {currentJobId && jobStatus && (
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(jobStatus.status)}
                    <span className="font-medium">API Generation in Progress</span>
                  </div>
                  <Badge variant="secondary">{jobStatus.progress}%</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  {jobStatus.currentStep}
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${jobStatus.progress}%` }}
                  />
                </div>
                {jobStatus.estimatedTimeRemaining && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Estimated time remaining: {jobStatus.estimatedTimeRemaining}s
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Start Templates</CardTitle>
          <CardDescription>
            Choose from pre-built API templates to get started faster
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates?.map((template: { id: string; name: string; description: string; framework: string; estimatedTime: number }) => (
              <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="pt-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium">{template.name}</h3>
                    <Badge variant="outline">{template.framework}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    {template.description}
                  </p>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">
                      ~{template.estimatedTime}s generation
                    </span>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setPrompt(template.description)}
                    >
                      Use Template
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Projects */}
      <Card>
        <CardHeader>
          <CardTitle>Your Recent APIs</CardTitle>
          <CardDescription>
            Manage and deploy your generated APIs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {projects?.map((project: { id: string; name: string; description: string; framework: string; status: string; deploy_url?: string }) => (
              <div key={project.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(project.status)}`} />
                  <div>
                    <h3 className="font-medium">{project.name}</h3>
                    <p className="text-sm text-muted-foreground">{project.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{project.framework}</Badge>
                  <Badge variant={project.status === 'deployed' ? 'default' : 'secondary'}>
                    {project.status}
                  </Badge>
                  {project.deploy_url && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={project.deploy_url} target="_blank" rel="noopener noreferrer">
                        View API
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
