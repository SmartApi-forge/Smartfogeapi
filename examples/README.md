# Frontend Usage Examples for Messages.getMany

This directory contains examples showing how to use the `trpc.messages.getMany.useQuery()` procedure in your React frontend.

## Quick Start

### Basic Usage

```tsx
import { trpc } from '../src/trpc/client'

function MyComponent() {
  const { data: messages, isLoading, error } = trpc.messages.getMany.useQuery()
  
  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>
  
  return (
    <pre>{JSON.stringify(messages, null, 2)}</pre>
  )
}
```

### With Custom Limit

```tsx
const { data: messages } = trpc.messages.getMany.useQuery({ 
  limit: 25 
})
```

### With React Query Options

```tsx
const { data: messages } = trpc.messages.getMany.useQuery(
  { limit: 10 },
  { 
    enabled: shouldFetch,
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000 // Consider data stale after 10 seconds
  }
)
```

## Data Structure

The `getMany` procedure returns an array of messages with their associated fragments:

```typescript
type MessageWithFragments = {
  id: string
  content: string
  role: 'user' | 'assistant'
  type: 'result' | 'error'
  created_at: string
  updated_at: string
  fragments: Array<{
    id: string
    content: string
    metadata?: any
    created_at: string
    updated_at: string
  }>
}
```

## Example Components

### 1. `MessagesExample`
A comprehensive example showing:
- Basic usage with default limit
- Custom limit usage
- Conditional fetching
- Error handling
- Formatted display of messages and fragments

### 2. `SimpleMessagesDisplay`
A minimal example that just displays messages as JSON with basic loading and error states.

### 3. `MessagesWithErrorHandling`
An advanced example showing:
- Dynamic limit adjustment
- Manual refetch functionality
- Retry configuration
- Loading states

## Features

- **Automatic Caching**: TRPC uses React Query under the hood for automatic caching
- **Real-time Updates**: Configure `refetchInterval` for periodic updates
- **Error Handling**: Built-in error states and retry mechanisms
- **Loading States**: `isLoading`, `isFetching`, and other loading indicators
- **Type Safety**: Full TypeScript support with inferred types

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | `number` | `50` | Maximum number of messages to fetch (1-100) |

## Error Handling

The procedure will throw a TRPC error if:
- Database query fails
- Invalid parameters are provided
- Server-side errors occur

Errors are automatically handled by React Query and exposed through the `error` property.

## Performance Tips

1. **Use appropriate limits**: Don't fetch more data than you need
2. **Configure staleTime**: Reduce unnecessary refetches
3. **Use enabled option**: Only fetch when needed
4. **Implement pagination**: For large datasets, consider implementing pagination

## Integration

Make sure your TRPC client is properly configured and the messages router is included in your app router:

```typescript
// In your app router
export const appRouter = createTRPCRouter({
  messages: messagesRouter,
  // ... other routers
})
```