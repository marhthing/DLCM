
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const url = queryKey[0] as string
        const res = await fetch(url, {
          credentials: 'same-origin',
        })
        
        if (!res.ok) {
          const error = await res.text()
          throw new Error(error || 'An error occurred')
        }
        
        return res.json()
      },
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
    },
  },
})

export async function apiRequest(method: string, url: string, data?: any) {
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'same-origin',
  }

  if (data) {
    options.body = JSON.stringify(data)
  }

  const res = await fetch(url, options)

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(errorText || 'An error occurred')
  }

  return res.json()
}
