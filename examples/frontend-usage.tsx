import React, { useState } from "react";
import { api } from "../lib/trpc-client"; // Adjust path based on your TRPC client setup
import type {
  MessageWithFragments,
  Fragment,
} from "../src/modules/messages/types";

// Type the messages properly
type MessagesWithFragments = MessageWithFragments[];

/**
 * Example of how to use the messages.getMany tRPC procedure
 * from the frontend using TRPC React Query hooks
 */
export function MessagesExample() {
  const projectId = "550e8400-e29b-41d4-a716-446655440000"; // Example project ID

  // Basic usage with default limit (50)
  const {
    data: messages,
    isLoading,
    error,
    refetch,
  } = api.messages.getMany.useQuery({ projectId, includeFragment: true });

  // Usage with custom limit
  const { data: limitedMessages, isLoading: isLoadingLimited } =
    api.messages.getMany.useQuery({
      projectId,
      limit: 10,
      includeFragment: true,
    });

  // Type the messages data properly
  const typedMessages = messages as MessageWithFragments[] | undefined;

  // Usage with enabled/disabled based on condition
  const [shouldFetch, setShouldFetch] = useState(true);
  const { data: conditionalMessages } = api.messages.getMany.useQuery(
    { projectId, limit: 25, includeFragment: true },
    {
      enabled: shouldFetch,
      refetchInterval: 30000, // Refetch every 30 seconds
      staleTime: 10000, // Consider data stale after 10 seconds
    },
  );

  if (isLoading) {
    return <div>Loading messages...</div>;
  }

  if (error) {
    return (
      <div className="error">
        <h3>Error loading messages:</h3>
        <p>{error.message}</p>
        <button onClick={() => refetch()}>Retry</button>
      </div>
    );
  }

  return (
    <div className="messages-container">
      <h2>Messages with Fragments</h2>

      {/* Button to toggle conditional fetching */}
      <button onClick={() => setShouldFetch(!shouldFetch)}>
        {shouldFetch ? "Stop" : "Start"} Conditional Fetching
      </button>

      {/* Display messages count */}
      <p>Total messages loaded: {typedMessages?.length || 0}</p>

      {/* Raw JSON display for debugging */}
      <details>
        <summary>Raw JSON Data (Click to expand)</summary>
        <pre
          style={{
            background: "#f5f5f5",
            padding: "1rem",
            borderRadius: "4px",
            overflow: "auto",
            maxHeight: "400px",
          }}
        >
          {JSON.stringify(typedMessages, null, 2)}
        </pre>
      </details>

      {/* Formatted display of messages */}
      <div className="messages-list">
        {typedMessages?.map((message) => (
          <div
            key={message.id}
            className="message-card"
            style={{
              border: "1px solid #ddd",
              borderRadius: "8px",
              padding: "1rem",
              margin: "1rem 0",
              backgroundColor: message.role === "user" ? "#e3f2fd" : "#f3e5f5",
            }}
          >
            <div className="message-header">
              <strong>Role:</strong> {message.role} |<strong> Type:</strong>{" "}
              {message.type} |<strong> Updated:</strong>{" "}
              {new Date(message.updated_at).toLocaleString()}
            </div>

            <div className="message-content">
              <h4>Content:</h4>
              <p>{message.content}</p>
            </div>

            {/* Display associated fragments with proper typing */}
            {message.fragments && message.fragments.length > 0 && (
              <div className="fragments-section">
                <h4>Fragments ({message.fragments.length}):</h4>
                {message.fragments.map((fragment: Fragment, index: number) => (
                  <div
                    key={fragment.id || index}
                    style={{
                      backgroundColor: "#fff",
                      padding: "0.5rem",
                      margin: "0.5rem 0",
                      borderLeft: "3px solid #2196f3",
                      borderRadius: "4px",
                    }}
                  >
                    <div>
                      <strong>Fragment {index + 1}:</strong>
                    </div>
                    <div>
                      <strong>Title:</strong> {fragment.title}
                    </div>
                    <div>
                      <strong>Sandbox URL:</strong> {fragment.sandbox_url}
                    </div>
                    {fragment.files &&
                      Object.keys(fragment.files).length > 0 && (
                        <div
                          style={{
                            fontSize: "0.8em",
                            color: "#666",
                            marginTop: "0.25rem",
                          }}
                        >
                          Files: {Object.keys(fragment.files).join(", ")}
                        </div>
                      )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Limited messages example */}
      <div className="limited-messages-section">
        <h3>Limited Messages (10 items)</h3>
        {isLoadingLimited ? (
          <p>Loading limited messages...</p>
        ) : (
          <pre
            style={{
              background: "#f0f0f0",
              padding: "0.5rem",
              borderRadius: "4px",
              fontSize: "0.8em",
            }}
          >
            {JSON.stringify(limitedMessages, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

/**
 * Alternative simpler example for just displaying messages as JSON
 */
export function SimpleMessagesDisplay() {
  const projectId = "550e8400-e29b-41d4-a716-446655440000"; // Example project ID

  const {
    data: messages,
    isLoading,
    error,
  } = api.messages.getMany.useQuery({
    projectId,
    limit: 20,
    includeFragment: true,
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h2>Messages JSON Display</h2>
      <pre
        style={{
          backgroundColor: "#f8f9fa",
          border: "1px solid #e9ecef",
          borderRadius: "0.375rem",
          padding: "1rem",
          overflow: "auto",
          maxHeight: "600px",
          fontSize: "0.875rem",
          lineHeight: "1.25rem",
        }}
      >
        {JSON.stringify(messages, null, 2)}
      </pre>
    </div>
  );
}

/**
 * Example with error handling and loading states
 */
export function MessagesWithErrorHandling() {
  const [limit, setLimit] = React.useState(10);
  const [projectId, setProjectId] = React.useState(
    "550e8400-e29b-41d4-a716-446655440000",
  ); // Example project ID

  const {
    data: messages,
    isLoading,
    error,
    refetch,
    isFetching,
  } = api.messages.getMany.useQuery(
    { projectId, limit, includeFragment: true },
    {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  );

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <label>
          Limit:
          <input
            type="number"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            min="1"
            max="100"
            style={{ marginLeft: "0.5rem", padding: "0.25rem" }}
          />
        </label>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          style={{ marginLeft: "1rem", padding: "0.25rem 0.5rem" }}
        >
          {isFetching ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {isLoading && <div>Loading messages...</div>}

      {error && (
        <div style={{ color: "red", marginBottom: "1rem" }}>
          <strong>Error:</strong> {error.message}
        </div>
      )}

      {messages && (
        <div>
          <p>
            <strong>Loaded {messages.length} messages</strong>
          </p>
          <pre
            style={{
              backgroundColor: "#f8f9fa",
              padding: "1rem",
              borderRadius: "4px",
              overflow: "auto",
              maxHeight: "500px",
            }}
          >
            {JSON.stringify(messages, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
