/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Booking from "@/models/Booking";
import "@/models/Room";
import "@/models/Property";

/**
 * GET /api/bookings/by-checkout-range?start=YYYY-MM-DD&end=YYYY-MM-DD
 * start <= checkOutDate <= end
 */
export async function GET(req: Request) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (!start || !end) {
      return NextResponse.json(
        { error: "start and end are required" },
        { status: 400 }
      );
    }

    const startDate = new Date(start);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    const bookings = await Booking.find({
      status: { $ne: "cancel" },
      checkOutDate: { $gte: startDate, $lte: endDate },
    })
      .populate("propertyId")
      .populate({
        path: "roomId",
        populate: { path: "propertyId" },
      })
      .sort({ checkOutDate: 1 });

    return NextResponse.json(bookings);
  } catch (error) {
    console.error("CHECKOUT RANGE ERROR:", error);
    return NextResponse.json([], { status: 500 });
  }
}
