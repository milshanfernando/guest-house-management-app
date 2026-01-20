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
  paymentMethod: "online" | "bank" | "cash" | "card";

  amount: number;
  expectedPayment?: number; // ✅ NEW FIELD
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

    reservationId: { type: String, unique: true }, // ✅ reservationId added
    unitType: String, // ✅ unitType added

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
      enum: ["online", "bank", "cash", "card"],
      required: true,
    },

    amount: { type: Number, required: true },
    expectedPayment: {
      type: Number, // ✅ NEW FIELD
    },

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
