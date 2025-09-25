import { useQuery } from '@tanstack/react-query'
import { getDashboardData } from '@/lib/supabase/dashboard-data'

export function useDashboardData() {
  return useQuery({
    queryKey: ['dashboard-data'],
    queryFn: getDashboardData,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  })
}
