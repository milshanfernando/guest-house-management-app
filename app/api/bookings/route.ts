/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Booking from "@/models/Booking";
import mongoose from "mongoose";
import "@/models/Room";
import "@/models/Property";

/* ======================================================
   GET BOOKINGS
   - ?date=YYYY-MM-DD → occupancy for selected date
   - ?start=YYYY-MM-DD&end=YYYY-MM-DD → bookings with checkInDate in range
   - ?propertyId=xxx
   - ?unassigned=true → guests without room assigned
====================================================== */
export async function GET(req: Request) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");
    const dateParam = searchParams.get("date");
    const propertyId = searchParams.get("propertyId");
    const unassigned = searchParams.get("unassigned");

    /** ================= UNASSIGNED GUESTS ================= */
    if (unassigned === "true") {
      if (!dateParam) {
        return NextResponse.json(
          { error: "date is required for unassigned guests" },
          { status: 400 }
        );
      }

      const selectedDate = new Date(dateParam);
      selectedDate.setHours(0, 0, 0, 0);
      const startOfDay = new Date(selectedDate);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      const bookings = await Booking.find({
        roomId: { $exists: false },
        status: { $ne: "cancel" },
        checkInDate: { $gte: startOfDay, $lte: endOfDay },
      })
        .populate("propertyId")
        .sort({ checkInDate: 1 });

      return NextResponse.json(bookings);
    }

    /** ================= DATE OR RANGE FILTER ================= */
    if (startParam && endParam) {
      // FILTER: check-in date within range
      const startDate = new Date(startParam);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(endParam);
      endDate.setHours(23, 59, 59, 999);

      const query: any = {
        status: { $ne: "cancel" },
        checkInDate: { $gte: startDate, $lte: endDate },
      };

      if (propertyId) {
        query.propertyId = new mongoose.Types.ObjectId(propertyId);
      }

      const bookings = await Booking.find(query)
        .populate("propertyId")
        .populate({
          path: "roomId",
          populate: { path: "propertyId" },
        })
        .sort({ checkInDate: 1 });

      return NextResponse.json(bookings);
    }

    /** ================= SINGLE DATE LOGIC ================= */
    const selectedDate = dateParam ? new Date(dateParam) : new Date();
    selectedDate.setHours(0, 0, 0, 0);
    const startOfDay = new Date(selectedDate);
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);

    const query: any = {
      status: { $ne: "cancel" },
      $or: [
        { checkInDate: { $gte: startOfDay, $lte: endOfDay } },
        { checkOutDate: { $gte: startOfDay, $lte: endOfDay } },
        { checkInDate: { $lte: endOfDay }, checkOutDate: { $gte: startOfDay } },
      ],
    };

    if (propertyId) {
      query.propertyId = new mongoose.Types.ObjectId(propertyId);
    }

    const bookings = await Booking.find(query)
      .populate("propertyId")
      .populate({
        path: "roomId",
        populate: { path: "propertyId" },
      })
      .sort({ checkInDate: 1 });

    // Add type for frontend
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

    let reservationId = data.reservationId;
    if (!reservationId) {
      reservationId = `AUTO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }

    const existing = await Booking.findOne({
      reservationId,
      status: { $ne: "cancel" },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Reservation ID already exists" },
        { status: 409 }
      );
    }

    const booking = await Booking.create({
      ...data,
      reservationId,
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
   DELETE BOOKING
   - soft delete or permanent
====================================================== */
export async function DELETE(req: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const permanent = searchParams.get("permanent") === "true";
    const { bookingId } = await req.json();

    if (!bookingId) {
      return NextResponse.json(
        { error: "bookingId required" },
        { status: 400 }
      );
    }

    if (permanent) {
      const deleted = await Booking.findByIdAndDelete(bookingId);
      if (!deleted) {
        return NextResponse.json(
          { error: "Booking not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        message: "Booking permanently deleted",
      });
    }

    // Soft delete
    const booking = await Booking.findByIdAndUpdate(
      bookingId,
      { status: "cancel" },
      { new: true }
    );
    return NextResponse.json(booking);
  } catch (error) {
    console.error("BOOKING DELETE ERROR:", error);
    return NextResponse.json(
      { error: "Failed to delete booking" },
      { status: 500 }
    );
  }
}
