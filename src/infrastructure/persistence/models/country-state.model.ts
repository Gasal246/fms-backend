import mongoose, { Schema, Document } from "mongoose";

export interface ICountryState extends Document {
  nationality_name: string;
  country_state_name: string;
  deleted_at: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const CountryStateSchema: Schema = new Schema(
  {
    nationality_name: {
      type: String,
      required: true,
      trim: true,
    },
    country_state_name: {
      type: String,
      required: true,
      trim: true,
    },
    deleted_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

CountryStateSchema.method("toJSON", function () {
  const { __v, _id, ...object } = this.toObject() as any;
  object.id = _id;
  return object;
});

const CountryState = mongoose.model<ICountryState>("CountryState", CountryStateSchema, "country_states");
export default CountryState;
