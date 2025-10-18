/**
 * Simple tRPC Console Helper
 *
 * This script provides a simple way to test tRPC endpoints from the browser console
 * without requiring complex client setup.
 */

(function () {
  "use strict";

  // Helper function to make tRPC calls
  async function makeTRPCCall(procedure, input = {}, isQuery = true) {
    try {
      // Get auth headers if available
      const headers = {
        "Content-Type": "application/json",
      };

      // Try to get auth token from various sources
      const accessToken =
        localStorage.getItem("sb-access-token") ||
        sessionStorage.getItem("sb-access-token") ||
        document.cookie
          .split("; ")
          .find((row) => row.startsWith("sb-access-token="))
          ?.split("=")[1];

      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      }

      let url = `/api/trpc/${procedure}`;
      let fetchOptions = { headers };

      if (isQuery) {
        // For queries, use GET with URL parameters
        const params = new URLSearchParams();
        if (Object.keys(input).length > 0) {
          params.append("input", JSON.stringify(input));
        }
        if (params.toString()) {
          url += `?${params.toString()}`;
        }
        fetchOptions.method = "GET";
      } else {
        // For mutations, use POST with body
        fetchOptions.method = "POST";
        fetchOptions.body = JSON.stringify(input);
      }

      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error(`tRPC call failed for ${procedure}:`, error);
      throw error;
    }
  }

  // Create the global tRPC object
  window.trpc = {
    messages: {
      getMany: {
        query: async (input) => {
          console.log("🔍 Calling messages.getMany with:", input);
          const result = await makeTRPCCall("messages.getMany", input, true); // true for query
          console.log("✅ Result:", result);
          return result;
        },
      },
      getById: {
        query: async (input) => {
          console.log("🔍 Calling messages.getById with:", input);
          const result = await makeTRPCCall("messages.getById", input, true); // true for query
          console.log("✅ Result:", result);
          return result;
        },
      },
      create: {
        mutate: async (input) => {
          console.log("🔍 Calling messages.create with:", input);
          const result = await makeTRPCCall("messages.create", input, false); // false for mutation
          console.log("✅ Result:", result);
          return result;
        },
      },
    },
  };

  // Helper functions for common test cases
  window.testTRPC = {
    // Test Project Alpha messages
    testProjectAlpha: async () => {
      console.log("🧪 Testing Project Alpha messages...");
      return await window.trpc.messages.getMany.query({
        projectId: "550e8400-e29b-41d4-a716-446655440000",
      });
    },

    // Test Project Beta messages
    testProjectBeta: async () => {
      console.log("🧪 Testing Project Beta messages...");
      return await window.trpc.messages.getMany.query({
        projectId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      });
    },

    // Test Project Alpha with fragments
    testProjectAlphaWithFragments: async () => {
      console.log("🧪 Testing Project Alpha with fragments...");
      return await window.trpc.messages.getMany.query({
        projectId: "550e8400-e29b-41d4-a716-446655440000",
        includeFragments: true,
      });
    },

    // Test non-existent project
    testNonExistentProject: async () => {
      console.log("🧪 Testing non-existent project...");
      return await window.trpc.messages.getMany.query({
        projectId: "non-existent-project-id",
      });
    },

    // Run all tests
    runAllTests: async () => {
      console.log("🚀 Running all tRPC tests...");

      try {
        console.log("\n--- Test 1: Project Alpha ---");
        const alpha = await window.testTRPC.testProjectAlpha();

        console.log("\n--- Test 2: Project Beta ---");
        const beta = await window.testTRPC.testProjectBeta();

        console.log("\n--- Test 3: Project Alpha with Fragments ---");
        const alphaFragments =
          await window.testTRPC.testProjectAlphaWithFragments();

        console.log("\n--- Test 4: Non-existent Project ---");
        const nonExistent = await window.testTRPC.testNonExistentProject();

        console.log("\n🎉 All tests completed!");
        return {
          projectAlpha: alpha,
          projectBeta: beta,
          projectAlphaWithFragments: alphaFragments,
          nonExistentProject: nonExistent,
        };
      } catch (error) {
        console.error("❌ Test suite failed:", error);
        throw error;
      }
    },
  };

  console.log("✅ tRPC Console Helper loaded!");
  console.log("📝 Available commands:");
  console.log('  - trpc.messages.getMany.query({projectId: "your-id"})');
  console.log("  - testTRPC.testProjectAlpha()");
  console.log("  - testTRPC.testProjectBeta()");
  console.log("  - testTRPC.testProjectAlphaWithFragments()");
  console.log("  - testTRPC.testNonExistentProject()");
  console.log("  - testTRPC.runAllTests()");
})();
