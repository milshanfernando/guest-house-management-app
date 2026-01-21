/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Booking from "@/models/Booking";
import mongoose from "mongoose";
import "@/models/Room";
import "@/models/Property";

/* ======================================================
   GET BOOKINGS BY PROPERTY (FROM roomId.propertyId)
   - ?propertyId=xxx
   - ?date=YYYY-MM-DD
   Logic (Hotel Occupancy):
   checkInDate < endOfDay
   AND
   checkOutDate > startOfDay
====================================================== */
export async function GET(req: Request) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get("propertyId");
    const dateParam = searchParams.get("date");

    if (!propertyId) {
      return NextResponse.json(
        { error: "propertyId is required" },
        { status: 400 },
      );
    }

    /* ============================
       DATE HANDLING
    ============================ */
    const selectedDate = dateParam ? new Date(dateParam) : new Date();

    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);

    /* ============================
       QUERY BOOKINGS
    ============================ */
    const bookings = await Booking.find({
      status: { $ne: "cancel" },

      // ✅ Correct hotel occupancy logic
      checkInDate: { $lte: endOfDay },
      checkOutDate: { $gte: startOfDay },

      roomId: { $exists: true },
    })
      .populate({
        path: "roomId",
        match: {
          propertyId: new mongoose.Types.ObjectId(propertyId),
        },
        populate: { path: "propertyId" },
      })
      .sort({ checkInDate: 1 });

    /* ============================
       FILTER NON-MATCHED ROOMS
    ============================ */
    const filteredBookings = bookings.filter((b: any) => b.roomId !== null);

    /* ============================
       ADD TYPE FOR FRONTEND
    ============================ */
    const bookingsWithType = filteredBookings.map((b: any) => {
      const checkIn = new Date(b.checkInDate);
      const checkOut = new Date(b.checkOutDate);

      checkIn.setHours(0, 0, 0, 0);
      checkOut.setHours(0, 0, 0, 0);

      let type: "checkin" | "stay" | "checkout" = "stay";

      if (checkIn.getTime() === startOfDay.getTime()) {
        type = "checkin";
      } else if (checkOut.getTime() === startOfDay.getTime()) {
        type = "checkout";
      }

      return {
        ...b.toObject(),
        type,
      };
    });

    return NextResponse.json(bookingsWithType);
  } catch (error) {
    console.error("BOOKING BY PROPERTY ERROR:", error);
    return NextResponse.json([], { status: 500 });
  }
}
