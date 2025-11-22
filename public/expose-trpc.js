/**
 * Global tRPC Client Exposure Script
 * 
 * This script creates a global tRPC client that can be used in the browser console
 * for testing purposes. It mimics the same configuration as the React client.
 */

// Import required dependencies (these will be available from the bundled app)
const { createTRPCClient, httpBatchLink, loggerLink } = window.TRPCClient || {};
const superjson = window.SuperJSON || {};

// Create a standalone tRPC client for browser console testing
function createGlobalTRPCClient() {
  // Get the base URL for tRPC endpoints
  const getUrl = () => {
    const base = window.location.origin;
    return `${base}/api/trpc`;
  };

  // Create Supabase client for auth token (if available)
  const getAuthHeaders = async () => {
    try {
      // Try to get auth token from localStorage or cookies
      const accessToken = localStorage.getItem('sb-access-token') || 
                         document.cookie.split('; ')
                           .find(row => row.startsWith('sb-access-token='))
                           ?.split('=')[1];
      
      if (accessToken) {
        return {
          Authorization: `Bearer ${accessToken}`,
        };
      }
    } catch (error) {
      console.warn('Could not get auth token:', error);
    }
    return {};
  };

  // Create the tRPC client
  const trpcClient = createTRPCClient({
    links: [
      loggerLink({
        enabled: (opts) =>
          process.env.NODE_ENV === 'development' ||
          (opts.direction === 'down' && opts.result instanceof Error),
      }),
      httpBatchLink({
        url: getUrl(),
        headers: async () => {
          return await getAuthHeaders();
        },
      }),
    ],
    transformer: superjson,
  });

  return trpcClient;
}

// Expose tRPC client globally when the page loads
window.addEventListener('DOMContentLoaded', () => {
  try {
    // Check if required dependencies are available
    if (typeof window.TRPCClient === 'undefined') {
      console.warn('tRPC Client dependencies not found. Using fetch-based client instead.');
      
      // Fallback: Create a simple fetch-based client
      window.trpc = {
        messages: {
          getMany: {
            query: async (input) => {
              const response = await fetch('/api/trpc/messages.getMany', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(await getAuthHeaders()),
                },
                body: JSON.stringify(input),
              });
              
              if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
              }
              
              return await response.json();
            }
          }
        },
        projects: {
          getOne: {
            query: async (input) => {
              const response = await fetch('/api/trpc/projects.getOne', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(await getAuthHeaders()),
                },
                body: JSON.stringify(input),
              });
              
              if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
              }
              
              return await response.json();
            }
          },
          getMany: {
            query: async (input) => {
              const response = await fetch('/api/trpc/projects.getMany', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(await getAuthHeaders()),
                },
                body: JSON.stringify(input),
              });
              
              if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
              }
              
              return await response.json();
            }
          }
        }
      };
    } else {
      // Use the full tRPC client
      window.trpc = createGlobalTRPCClient();
    }
    
    console.log('✅ tRPC client is now available globally as window.trpc');
    console.log('📝 You can now test with:');
    console.log('  - trpc.messages.getMany.query({projectId: "your-project-id"})');
    console.log('  - trpc.projects.getOne.query({id: "your-project-id"})');
    console.log('  - trpc.projects.getMany.query({limit: 10, offset: 0})');
  } catch (error) {
    console.error('❌ Failed to expose tRPC client globally:', error);
  }
});

// Helper function to get auth headers
async function getAuthHeaders() {
  try {
    const accessToken = localStorage.getItem('sb-access-token') || 
                       document.cookie.split('; ')
                         .find(row => row.startsWith('sb-access-token='))
                         ?.split('=')[1];
    
    if (accessToken) {
      return {
        Authorization: `Bearer ${accessToken}`,
      };
    }
  } catch (error) {
    console.warn('Could not get auth token:', error);
  }
  return {};
}