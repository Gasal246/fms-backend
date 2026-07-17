import type { DashboardSummaryDocument, RbacScope, SnapshotType } from '../types/dashboard.types.js';

export interface DashboardRepository {
  findByScope(scope: RbacScope, snapshotType?: SnapshotType): Promise<DashboardSummaryDocument[]>;
  upsertSummary(snapshot_type: SnapshotType, data: Record<string, any>, scope: RbacScope, layout: Record<string, any>): Promise<void>;
  deleteExpired(): Promise<void>;
}

export interface DashboardService {
  getDashboard(scope: RbacScope, snapshotType?: SnapshotType): Promise<DashboardSummaryDocument[]>;
}
