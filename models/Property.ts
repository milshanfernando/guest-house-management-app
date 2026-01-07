import mongoose, { Schema, model, models } from "mongoose";

export interface IProperty {
  name: string;
}

const PropertySchema = new Schema<IProperty>(
  { name: { type: String, required: true } },
  { timestamps: true }
);

export default models.Property || model<IProperty>("Property", PropertySchema);
