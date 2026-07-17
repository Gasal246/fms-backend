import mongoose, { Schema, Document } from 'mongoose';

export interface IGuest extends Document {
  Camp_id: mongoose.Types.ObjectId | null;
  Client_id: mongoose.Types.ObjectId | null;
  Zone_id: mongoose.Types.ObjectId | null;
  Guest_name: string | null;
  Purpose: string | null;
  Hosted_by: mongoose.Types.ObjectId | null;
  Hosted_by_model: string | null;
  Created_by: mongoose.Types.ObjectId | null;
  Created_by_model: string | null;
  Entry_time: Date | null;
  Exit_time: Date | null;
  Expected_exit_time: Date | null;
  status: "Checked-In" | "Checked-Out";
  deleted_at?: Date | null;
  _id: mongoose.Types.ObjectId;
}

const GuestSchema: Schema = new Schema({
  Camp_id: { type: Schema.Types.ObjectId, ref: "camp" },
  Client_id: { type: Schema.Types.ObjectId, ref: "clients" },
  Zone_id: { type: Schema.Types.ObjectId, ref: "camp_zones" },
  Guest_name: { type: String },
  Purpose: { type: String },
  Hosted_by: {
    type: Schema.Types.ObjectId,
    required: false,
    refPath: 'Hosted_by_model'
  },
  Hosted_by_model: {
    type: String,
    enum: ['user_register', 'coordinator'],
    required: false
  },
  Created_by: {
    type: Schema.Types.ObjectId,
    required: false,
    refPath: 'Created_by_model'
  },
  Created_by_model: {
    type: String,
    enum: ['coordinator', 'clients'],
    required: false
  },
  status: {
    type: String,
    enum: ['Checked-In', 'Checked-Out'],
    default: 'Checked-In'
  },
  Entry_time: { type: Date },
  Exit_time: { type: Date },
  Expected_exit_time: { type: Date, default: null },
  deleted_at: { type: Date, default: null },
}, { timestamps: true });

// Custom toJSON mapping to return id instead of _id if needed
GuestSchema.method("toJSON", function () {
  const { __v, _id, ...object } = this.toObject() as any;
  object.id = _id;
  return object;
});

const Guest = mongoose.model<IGuest>('Guest', GuestSchema);

export default Guest;
