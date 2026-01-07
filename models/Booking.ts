import mongoose, { Schema, model, models } from "mongoose";

export interface IBooking {
  guestName: string;
  email: string;
  phone: string;
  idNumber: string;
  reservationId?: string;
  unitType?: string;

  propertyId: mongoose.Types.ObjectId;
  roomId?: mongoose.Types.ObjectId;

  platform: "Booking.com" | "Agoda" | "Airbnb" | "Expedia" | "Direct";
  paymentMethod: "online" | "bank" | "cash";

  amount: number;
  paymentDate?: Date; // ✅ NEW FIELD

  checkInDate: Date;
  checkOutDate: Date;

  status: "booked" | "checkin" | "checkout" | "cancel";
}

const BookingSchema = new Schema<IBooking>(
  {
    guestName: { type: String, required: true },
    email: String,
    phone: String,
    idNumber: String,

    propertyId: {
      type: Schema.Types.ObjectId,
      ref: "Property",
      required: true,
    },

    roomId: {
      type: Schema.Types.ObjectId,
      ref: "Room",
    },

    platform: {
      type: String,
      enum: ["Booking.com", "Agoda", "Airbnb", "Expedia", "Direct"],
      required: true,
    },

    paymentMethod: {
      type: String,
      enum: ["online", "bank", "cash"],
      required: true,
    },

    amount: { type: Number, required: true },

    paymentDate: {
      type: Date, // ✅ NEW
    },

    checkInDate: { type: Date, required: true },
    checkOutDate: { type: Date, required: true },

    status: {
      type: String,
      enum: ["booked", "checkin", "checkout", "cancel"],
      default: "booked",
    },
  },
  { timestamps: true }
);

export default models.Booking || model<IBooking>("Booking", BookingSchema);
