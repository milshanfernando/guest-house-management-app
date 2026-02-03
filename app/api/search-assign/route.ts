/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Booking from "@/models/Booking";
import "@/models/Property";

export async function GET(req: Request) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query");

    if (!query) {
      return NextResponse.json([], { status: 200 });
    }

    const bookings = await Booking.find({
      roomId: null, // 🔥 only unassigned
      status: { $ne: "cancel" }, // exclude cancelled
      guestName: { $regex: query, $options: "i" }, // name search
    })
      .populate("propertyId")
      .sort({ createdAt: -1 })
      .limit(20);

    return NextResponse.json(bookings);
  } catch (error) {
    console.error("BOOKING SEARCH ERROR:", error);
    return NextResponse.json([], { status: 500 });
  }
}
