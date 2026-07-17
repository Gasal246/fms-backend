import mongoose, { Document, Schema } from 'mongoose';

export interface IUserActivityLog extends Document {
  user_id?: mongoose.Types.ObjectId | null;
  performed_by: string;
  tenant_id?: mongoose.Types.ObjectId | null;
  document_id?: mongoose.Types.ObjectId | null;
  action: string;
  module: 'Compliance' | 'Allocation' | 'Tenant' | 'Camp' | 'Contract';
  timestamp: Date;
  previous_state?: any;
  new_state?: any;
  ip_address?: string;
}

const userActivityLogSchema = new Schema<IUserActivityLog>(
  {
    user_id: { type: Schema.Types.ObjectId, default: null },
    performed_by: { type: String, required: true },
    tenant_id: { type: Schema.Types.ObjectId, ref: 'user_register', default: null },
    document_id: { type: Schema.Types.ObjectId, ref: 'Document', default: null },
    action: { type: String, required: true },
    module: { type: String, enum: ['Compliance', 'Allocation', 'Tenant', 'Camp', 'Contract'], required: true },
    timestamp: { type: Date, default: Date.now },
    previous_state: { type: Schema.Types.Mixed, default: null },
    new_state: { type: Schema.Types.Mixed, default: null },
    ip_address: { type: String, default: '' }
  },
  { timestamps: true }
);

// Indexes
userActivityLogSchema.index({ user_id: 1 });
userActivityLogSchema.index({ tenant_id: 1 });
userActivityLogSchema.index({ timestamp: -1 });

export const UserActivityLogModel = mongoose.model<IUserActivityLog>('UserActivityLog', userActivityLogSchema);
export default UserActivityLogModel;
