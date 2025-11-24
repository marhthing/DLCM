import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const res = await fetch(queryKey[0] as string);
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return await res.json();
      },
    },
  },
});

export async function apiRequest(
  method: string,
  url: string,
  body?: any
): Promise<any> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || `HTTP error! status: ${res.status}`);
  }

  return await res.json();
}
