'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { api } from '@/lib/trpc-client';

export function ClientContent() {
  const [prompt, setPrompt] = useState('');

  // tRPC hook for automatic Inngest invocation
  const invokeInngest = api.apiGeneration.invoke.useMutation({
    onSuccess: () => {
      console.log("Inngest function invoked successfully from ClientContent!")
    },
    onError: (error: any) => {
      console.error("Failed to invoke Inngest function:", error)
    }
  });

  // tRPC hook for createApi
  const createApi = api.apiGeneration.createApi.useQuery(
    { text: prompt },
    { enabled: false } // Only run when manually triggered
  );

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    
    // Invoke Inngest function automatically
    invokeInngest.mutate({ text: prompt });
    
    // Clear the prompt after submission
    setPrompt('');
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
              disabled={invokeInngest.isLoading || !prompt.trim()}
            >
              {invokeInngest.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Generate API
            </Button>
          </div>

          {/* Success Message */}
          {invokeInngest.isSuccess && (
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="font-medium text-green-700">Inngest function invoked successfully!</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Your API generation request has been processed.
                </p>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Demo Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Start Templates</CardTitle>
          <CardDescription>
            Choose from pre-built API templates to get started faster
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { id: '1', name: 'Blog API', description: 'Create a REST API for a blog with posts, comments, and user authentication', framework: 'FastAPI' },
              { id: '2', name: 'E-commerce API', description: 'Build an e-commerce API with products, cart, orders, and payment processing', framework: 'Express' },
              { id: '3', name: 'Task Manager API', description: 'Design a task management API with projects, tasks, and team collaboration', framework: 'FastAPI' },
              { id: '4', name: 'Social Media API', description: 'Create a social media API with posts, likes, follows, and messaging', framework: 'Express' }
            ].map((template) => (
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
                      ~30s generation
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
    </div>
  );
}
