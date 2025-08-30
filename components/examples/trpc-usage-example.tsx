'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/trpc-client';
import { Loader2, Play, Trash2 } from 'lucide-react';

export function TRPCUsageExample() {
  const [prompt, setPrompt] = useState('');
  const [framework, setFramework] = useState<'fastapi' | 'express'>('fastapi');

  // tRPC queries and mutations
  const { data: projects, isLoading: projectsLoading, refetch: refetchProjects } = api.api.listProjects.useQuery({
    limit: 10,
    offset: 0,
  });

  const generateApiMutation = api.api.generate.useMutation({
    onSuccess: () => {
      setPrompt('');
      refetchProjects();
    },
  });

  const deleteProjectMutation = api.api.deleteProject.useMutation({
    onSuccess: () => {
      refetchProjects();
    },
  });

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    
    generateApiMutation.mutate({
      prompt,
      framework,
      name: `API: ${prompt.slice(0, 30)}...`,
    });
  };

  const handleDelete = (projectId: string) => {
    deleteProjectMutation.mutate({ id: projectId });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'generating': return 'bg-yellow-500';
      case 'failed': return 'bg-red-500';
      case 'deployed': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* API Generation Form */}
      <Card>
        <CardHeader>
          <CardTitle>Generate New API</CardTitle>
          <CardDescription>
            Describe the API you want to build and we'll generate it for you
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Input
              placeholder="Describe the API you want to build..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={generateApiMutation.isPending}
            />
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              <Button
                variant={framework === 'fastapi' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFramework('fastapi')}
              >
                FastAPI
              </Button>
              <Button
                variant={framework === 'express' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFramework('express')}
              >
                Express
              </Button>
            </div>
            
            <Button
              onClick={handleGenerate}
              disabled={!prompt.trim() || generateApiMutation.isPending}
              className="ml-auto"
            >
              {generateApiMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Generate API
                </>
              )}
            </Button>
          </div>

          {generateApiMutation.error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {generateApiMutation.error.message}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Projects List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Projects</CardTitle>
          <CardDescription>
            Recent API projects you've generated
          </CardDescription>
        </CardHeader>
        <CardContent>
          {projectsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : projects && projects.length > 0 ? (
            <div className="space-y-3">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">{project.name}</h3>
                      <Badge className={getStatusColor(project.status)}>
                        {project.status}
                      </Badge>
                      <Badge variant="outline">{project.framework}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {project.prompt}
                    </p>
                    {project.deploy_url && (
                      <a
                        href={project.deploy_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline"
                      >
                        View Live API →
                      </a>
                    )}
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(project.id)}
                    disabled={deleteProjectMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No projects yet. Generate your first API above!
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
