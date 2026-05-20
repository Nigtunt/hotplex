import { adminFetch } from './admin-client';
import type { GatewayStatsResponse } from '@/lib/types/admin';

export function getAdminStats(): Promise<GatewayStatsResponse> {
  return adminFetch<GatewayStatsResponse>('/admin/stats');
}
