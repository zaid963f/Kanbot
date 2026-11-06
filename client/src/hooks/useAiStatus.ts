import { useQuery } from '@tanstack/react-query';
import { getAiStatus } from '../api/ai';

// Asked once per session: the mode only changes when the server restarts.
export function useAiStatus() {
  return useQuery({ queryKey: ['ai-status'], queryFn: getAiStatus, staleTime: Infinity });
}
