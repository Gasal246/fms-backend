import mongoose, { Document } from "mongoose";

export interface IPermission extends Document {
    _id: mongoose.Types.ObjectId;
    name: string;
    slug: string;
    module: string;
    client_id?: mongoose.Types.ObjectId | null;
    deleted_at: Date;
    createdAt: Date;
    updatedAt: Date;
}

const schema = new mongoose.Schema(
    {
        name: String,
        slug: String,
        module: String,
        client_id: { type: mongoose.Schema.Types.ObjectId, ref: 'client' },
        deleted_at: Date,
    },
    { timestamps: true }
);

schema.method("toJSON", function () {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { __v, _id, ...object } = this.toObject() as any;
    object.id = _id;

    return object;
});

const Permission = mongoose.model<IPermission>("Permission", schema);
export default Permission;