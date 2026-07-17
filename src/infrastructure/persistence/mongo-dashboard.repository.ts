import type { DashboardRepository } from '../../domain/repositories/dashboard.repository.interface.js';
import type { DashboardSummaryDocument, RbacScope, SnapshotType } from '../../domain/types/dashboard.types.js';
import DashboardSummary from './models/dashboard-summary.model.js';

export class MongoDashboardRepository implements DashboardRepository {

  async findByScope(scope: RbacScope, snapshotType?: SnapshotType): Promise<DashboardSummaryDocument[]> {
    const filter: Record<string, any> = {};

    // Snapshots are stored PER CLIENT (orgId). Role/userId are never used as storage keys.
    if (scope.orgId)  filter['metadata.orgId'] = scope.orgId;
    if (snapshotType) filter['snapshot_type']   = snapshotType;

    const docs = await DashboardSummary
      .find(filter)
      .select('snapshot_type data layout metadata computed_at expires_at')
      .lean();

    return docs as unknown as DashboardSummaryDocument[];
  }

  async upsertSummary(
    snapshot_type: SnapshotType,
    data: Record<string, any>,
    scope: RbacScope,
    layout: Record<string, any>
  ): Promise<void> {
    const computed_at = new Date();
    const expires_at  = new Date(computed_at.getTime() + 20 * 60 * 1000); // 20-min TTL

    // Upsert key: snapshot_type + orgId → guarantees exactly ONE doc per client per type.
    // Role is NEVER a storage key — it is only used for response filtering in the controller.
    const filter: Record<string, any> = { snapshot_type };
    if (scope.orgId) filter['metadata.orgId'] = scope.orgId;

    await DashboardSummary.findOneAndUpdate(
      filter,
      {
        $set: {
          data,
          layout,
          metadata: { orgId: scope.orgId },
          computed_at,
          expires_at,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );
  }

  async deleteExpired(): Promise<void> {
    await DashboardSummary.deleteMany({ expires_at: { $lt: new Date() } });
  }
}
