import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Room from "@/models/Room";
import Booking from "@/models/Booking";

export async function GET(req: Request) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get("propertyId");

    const rooms = propertyId
      ? await Room.find({ propertyId })
      : await Room.find();

    return NextResponse.json(rooms);
  } catch (error) {
    console.error("ROOM GET ERROR:", error);
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await connectDB();
    const { propertyId, roomNo } = await req.json();

    const room = await Room.create({
      propertyId,
      roomNo,
      status: "available",
    });

    return NextResponse.json(room);
  } catch (error) {
    console.error("ROOM POST ERROR:", error);
    return NextResponse.json(
      { error: "Failed to create room" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    await connectDB();
    const { roomId, bookingId, action } = await req.json();

    if (action === "assign") {
      await Room.findByIdAndUpdate(roomId, { status: "occupied" });
      await Booking.findByIdAndUpdate(bookingId, {
        roomId,
        status: "checkin",
      });
    }

    if (action === "checkout") {
      const booking = await Booking.findById(bookingId);
      if (booking?.roomId) {
        await Room.findByIdAndUpdate(booking.roomId, {
          status: "available",
        });
      }

      await Booking.findByIdAndUpdate(bookingId, {
        roomId: null,
        status: "checkout",
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("ROOM PATCH ERROR:", error);
    return NextResponse.json(
      { error: "Failed to update room" },
      { status: 500 }
    );
  }
}
