/**
 * Frontend Integration Test Component for Messages Project Filtering
 * 
 * This component demonstrates and tests the messages.getMany functionality
 * in a real React environment with proper error handling and loading states.
 */

import React, { useState } from 'react';
import { api } from './lib/trpc-client';
import type { MessageWithFragments } from './src/modules/messages/types';

// Test project IDs - replace with actual project IDs from your database
const TEST_PROJECT_IDS = {
  ALPHA: '550e8400-e29b-41d4-a716-446655440000',
  BETA: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
  NONEXISTENT: '123e4567-e89b-12d3-a456-426614174000'
};

/**
 * Main test component for messages functionality
 */
export function MessagesTestComponent() {
  const [selectedProjectId, setSelectedProjectId] = useState(TEST_PROJECT_IDS.ALPHA);
  const [limit, setLimit] = useState(10);
  const [includeFragment, setIncludeFragment] = useState(true);
  const [testResults, setTestResults] = useState<string[]>([]);

  // Main query for messages
  const { 
    data: messages, 
    isLoading, 
    error, 
    refetch,
    isFetching 
  } = api.messages.getMany.useQuery(
    { 
      projectId: selectedProjectId, 
      limit, 
      includeFragment 
    },
    {
      retry: 1,
      onSuccess: (data) => {
        addTestResult(`✅ Successfully fetched ${data.length} messages for project ${selectedProjectId}`);
        
        // Validate that all messages belong to the correct project
        const allCorrectProject = data.every(msg => msg.project_id === selectedProjectId);
        if (allCorrectProject) {
          addTestResult(`✅ All messages belong to project ${selectedProjectId}`);
        } else {
          addTestResult(`❌ Some messages belong to different projects!`);
        }
        
        // Check fragments if includeFragment is true
        if (includeFragment) {
          const messagesWithFragments = data.filter(msg => msg.fragments && msg.fragments.length > 0);
          addTestResult(`📎 ${messagesWithFragments.length} messages have fragments`);
        }
      },
      onError: (error) => {
        addTestResult(`❌ Error: ${error.message}`);
      }
    }
  );

  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
  };

  const clearTestResults = () => {
    setTestResults([]);
  };

  const runAutomatedTests = async () => {
    clearTestResults();
    addTestResult('🚀 Starting automated tests...');

    // Test 1: Project Alpha
    setSelectedProjectId(TEST_PROJECT_IDS.ALPHA);
    addTestResult('🧪 Testing Project Alpha...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 2: Project Beta
    setSelectedProjectId(TEST_PROJECT_IDS.BETA);
    addTestResult('🧪 Testing Project Beta...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 3: Non-existent project
    setSelectedProjectId(TEST_PROJECT_IDS.NONEXISTENT);
    addTestResult('🧪 Testing non-existent project...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Reset to Alpha
    setSelectedProjectId(TEST_PROJECT_IDS.ALPHA);
    addTestResult('🏁 Automated tests completed!');
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Messages Project Filtering Test</h1>
      
      {/* Test Controls */}
      <div className="bg-gray-100 p-4 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-4">Test Controls</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-2">Project ID:</label>
            <select 
              value={selectedProjectId} 
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value={TEST_PROJECT_IDS.ALPHA}>Project Alpha</option>
              <option value={TEST_PROJECT_IDS.BETA}>Project Beta</option>
              <option value={TEST_PROJECT_IDS.NONEXISTENT}>Non-existent Project</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Limit:</label>
            <input 
              type="number" 
              value={limit} 
              onChange={(e) => setLimit(Number(e.target.value))}
              min="1" 
              max="100"
              className="w-full p-2 border rounded"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Include Fragments:</label>
            <input 
              type="checkbox" 
              checked={includeFragment} 
              onChange={(e) => setIncludeFragment(e.target.checked)}
              className="mt-3"
            />
          </div>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={() => refetch()} 
            disabled={isFetching}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {isFetching ? 'Fetching...' : 'Refetch Messages'}
          </button>
          
          <button 
            onClick={runAutomatedTests}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Run Automated Tests
          </button>
          
          <button 
            onClick={clearTestResults}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Clear Results
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="bg-blue-100 p-4 rounded-lg mb-6">
          <p className="text-blue-800">🔄 Loading messages...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-100 p-4 rounded-lg mb-6">
          <p className="text-red-800">❌ Error: {error.message}</p>
        </div>
      )}

      {/* Test Results */}
      {testResults.length > 0 && (
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <h3 className="text-lg font-semibold mb-2">Test Results</h3>
          <div className="max-h-40 overflow-y-auto">
            {testResults.map((result, index) => (
              <div key={index} className="text-sm font-mono mb-1">
                {result}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages Display */}
      {messages && (
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">
            Messages for Project: {selectedProjectId}
          </h3>
          
          <div className="mb-4 text-sm text-gray-600">
            Found {messages.length} messages
            {includeFragment && (
              <span> (with fragments: {messages.filter(m => m.fragments && m.fragments.length > 0).length})</span>
            )}
          </div>

          {messages.length === 0 ? (
            <p className="text-gray-500 italic">No messages found for this project.</p>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <MessageCard 
                  key={message.id} 
                  message={message} 
                  showFragments={includeFragment}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Individual message card component
 */
function MessageCard({ 
  message, 
  showFragments 
}: { 
  message: MessageWithFragments; 
  showFragments: boolean;
}) {
  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <div className="flex justify-between items-start mb-2">
        <div className="flex gap-2">
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            message.role === 'user' ? 'bg-blue-100 text-blue-800' :
            message.role === 'assistant' ? 'bg-green-100 text-green-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {message.role}
          </span>
          <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
            {message.type}
          </span>
        </div>
        <div className="text-xs text-gray-500">
          {new Date(message.created_at).toLocaleString()}
        </div>
      </div>
      
      <p className="text-gray-800 mb-2">{message.content}</p>
      
      <div className="text-xs text-gray-500 mb-2">
        ID: {message.id} | Project: {message.project_id}
      </div>
      
      {showFragments && message.fragments && message.fragments.length > 0 && (
        <div className="mt-3 pl-4 border-l-2 border-gray-300">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Fragments ({message.fragments.length}):
          </h4>
          {message.fragments.map((fragment) => (
            <div key={fragment.id} className="text-sm text-gray-600 mb-1 p-2 bg-white rounded">
              {fragment.content}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MessagesTestComponent;