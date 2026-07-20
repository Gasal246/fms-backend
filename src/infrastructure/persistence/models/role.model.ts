import mongoose, { Document } from "mongoose";

export interface IRole extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  deleted_at: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new mongoose.Schema(
  {
    name: String,
    slug: String,
    deleted_at: Date,
  },
  { timestamps: true }
);

schema.index({ slug: 1 }, { unique: true, partialFilterExpression: { deleted_at: null } });

schema.method("toJSON", function () {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { __v, _id, ...object } = this.toObject() as any;
  object.id = _id;

  return object;
});

const Role = mongoose.model<IRole>("Role", schema);
export default Role;
