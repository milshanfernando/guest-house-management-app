import mongoose, { Schema, model, models } from "mongoose";

export interface IRoom {
  propertyId: mongoose.Types.ObjectId;
  roomNo: string;
  status: "available" | "occupied";
}

const RoomSchema = new Schema<IRoom>({
  propertyId: { type: Schema.Types.ObjectId, ref: "Property", required: true },
  roomNo: { type: String, required: true },
  status: { type: String, default: "available" },
});

export default models.Room || model<IRoom>("Room", RoomSchema);
