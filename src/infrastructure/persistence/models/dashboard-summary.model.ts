import mongoose, { Document } from 'mongoose';
import type { SnapshotType } from '../../../domain/types/dashboard.types.js';

export interface IDashboardSummary extends Document {
  snapshot_type: SnapshotType;
  data: Record<string, any>;
  layout: Record<string, any>;
  metadata: {
    role?: string;
    orgId?: string;
    userId?: string;
  };
  computed_at: Date;
  expires_at: Date;
}

const metadataSchema = new mongoose.Schema(
  {
    role:   { type: String, index: true },
    orgId:  { type: String, index: true },
    userId: { type: String, index: true },
  },
  { _id: false }
);

const widgetSchema = new mongoose.Schema(
  {
    id:      { type: String, required: true },
    type:    { type: String, required: true },
    title:   { type: String, required: true },
    dataKey: { type: String, required: true },
    visible: { type: Boolean, default: true },
    order:   { type: Number, default: 0 },
  },
  { _id: false }
);

const layoutSchema = new mongoose.Schema(
  {
    columns: { type: Number, default: 2 },
    widgets: [widgetSchema],
  },
  { _id: false }
);

const dashboardSummarySchema = new mongoose.Schema(
  {
    snapshot_type: {
      type: String,
      enum: ['tenants_overview', 'camps_overview', 'rooms_overview', 'occupancy_overview', 'analytical_summary'],
      required: true,
    },
    data:        { type: mongoose.Schema.Types.Mixed, required: true },
    layout:      { type: layoutSchema, required: true },
    metadata:    { type: metadataSchema, required: true },
    computed_at: { type: Date, default: Date.now },
    expires_at:  { type: Date, required: true },
  },
  { timestamps: false }
);

// ── Compound indexes for covered queries (sub-200 ms at lakh scale) ──────────
dashboardSummarySchema.index(
  { 'metadata.orgId': 1, snapshot_type: 1 },
  { name: 'idx_orgId_snapshotType' }
);
dashboardSummarySchema.index(
  { 'metadata.role': 1, snapshot_type: 1 },
  { name: 'idx_role_snapshotType' }
);
dashboardSummarySchema.index(
  { 'metadata.orgId': 1, 'metadata.role': 1, snapshot_type: 1 },
  { name: 'idx_orgId_role_snapshotType' }
);
// TTL index – auto-clean documents after expires_at
dashboardSummarySchema.index(
  { expires_at: 1 },
  { expireAfterSeconds: 0, name: 'idx_ttl_expires' }
);

dashboardSummarySchema.method('toJSON', function () {
  const { __v, _id, ...object } = this.toObject() as any;
  object.id = _id;
  return object;
});

const DashboardSummary = mongoose.model<IDashboardSummary>(
  'dashboard_summaries',
  dashboardSummarySchema
);

export default DashboardSummary;
