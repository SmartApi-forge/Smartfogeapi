import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from "@tanstack/react-query";
import superjson from "superjson";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
      },
    },
  });
}

// Export dehydration options for use with dehydrate() function
export const dehydrateOptions = {
  shouldDehydrateQuery: (query: any) =>
    defaultShouldDehydrateQuery(query) || query.state.status === "pending",
  // serializeData: superjson.serialize,
};

// Export hydration options for use with hydrate() function
export const hydrateOptions = {
  // deserializeData: superjson.deserialize,
};
