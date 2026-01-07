/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Booking from "@/models/Booking";

/* ======================================================
   GET BOOKINGS
   - ?date=YYYY-MM-DD → occupancy for selected date
   - ?propertyId=xxx
   - Includes guests checking in and checking out that day
====================================================== */
export async function GET(req: Request) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");
    const propertyId = searchParams.get("propertyId");
    const unassigned = searchParams.get("unassigned");

    // IF fetching unassigned guests
    if (unassigned === "true") {
      const bookings = await Booking.find({
        roomId: { $exists: false },
        status: { $ne: "cancel" },
      })
        .populate("propertyId")
        .sort({
          checkInDate: 1,
        });
      return NextResponse.json(bookings);
    }

    // Otherwise, normal occupancy logic
    const query: any = {};
    if (propertyId) query.propertyId = propertyId;

    const selectedDate = dateParam ? new Date(dateParam) : new Date();
    selectedDate.setHours(0, 0, 0, 0);

    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);

    const bookings = await Booking.find({
      ...query,
      status: { $ne: "cancel" },
      $or: [
        { checkInDate: { $gte: startOfDay, $lte: endOfDay } },
        { checkOutDate: { $gte: startOfDay, $lte: endOfDay } },
        { checkInDate: { $lte: endOfDay }, checkOutDate: { $gte: startOfDay } },
      ],
    })
      .populate("propertyId")
      .sort({ checkInDate: 1 });

    // Add type field for frontend
    const bookingsWithType = bookings.map((b: any) => {
      const checkIn = new Date(b.checkInDate);
      const checkOut = new Date(b.checkOutDate);
      checkIn.setHours(0, 0, 0, 0);
      checkOut.setHours(0, 0, 0, 0);

      let type: "checkin" | "checkout" | "stay" = "stay";
      if (checkIn.getTime() === selectedDate.getTime()) type = "checkin";
      else if (checkOut.getTime() === selectedDate.getTime()) type = "checkout";

      return { ...b.toObject(), type };
    });

    return NextResponse.json(bookingsWithType);
  } catch (error) {
    console.error("BOOKING GET ERROR:", error);
    return NextResponse.json([], { status: 500 });
  }
}

/* ======================================================
   CREATE BOOKING
====================================================== */
export async function POST(req: Request) {
  try {
    await connectDB();
    const data = await req.json();
    const booking = await Booking.create({
      ...data,
      status: data.status || "booked",
    });
    return NextResponse.json(booking);
  } catch (error) {
    console.error("BOOKING POST ERROR:", error);
    return NextResponse.json(
      { error: "Failed to create booking" },
      { status: 500 }
    );
  }
}

/* ======================================================
   UPDATE BOOKING
   - assign, checkin, checkout
====================================================== */
export async function PATCH(req: Request) {
  try {
    await connectDB();
    const { bookingId, action, roomId } = await req.json();

    if (!bookingId)
      return NextResponse.json(
        { error: "bookingId required" },
        { status: 400 }
      );

    let booking;
    if (action === "assign") {
      booking = await Booking.findByIdAndUpdate(
        bookingId,
        { roomId },
        { new: true }
      );
    } else if (action === "checkin") {
      booking = await Booking.findByIdAndUpdate(
        bookingId,
        { status: "checked_in" },
        { new: true }
      );
    } else if (action === "checkout") {
      booking = await Booking.findByIdAndUpdate(
        bookingId,
        { status: "checked_out" },
        { new: true }
      );
    }

    return NextResponse.json(booking);
  } catch (error) {
    console.error("BOOKING PATCH ERROR:", error);
    return NextResponse.json(
      { error: "Failed to update booking" },
      { status: 500 }
    );
  }
}

/* ======================================================
   CANCEL BOOKING (soft delete)
====================================================== */
export async function DELETE(req: Request) {
  try {
    await connectDB();
    const { bookingId } = await req.json();
    if (!bookingId)
      return NextResponse.json(
        { error: "bookingId required" },
        { status: 400 }
      );

    const booking = await Booking.findByIdAndUpdate(
      bookingId,
      { status: "cancel" },
      { new: true }
    );
    return NextResponse.json(booking);
  } catch (error) {
    console.error("BOOKING DELETE ERROR:", error);
    return NextResponse.json(
      { error: "Failed to cancel booking" },
      { status: 500 }
    );
  }
}
