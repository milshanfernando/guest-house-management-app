/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Booking from "@/models/Booking";
import "@/models/Room";
import "@/models/Property";

/**
 * GET /api/bookingsfordaterange?start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * Logic:
 * ✔ start <= checkOutDate <= end
 * ✔ No duplicates
 * ✔ Cancelled bookings excluded
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
      checkOutDate: {
        $gte: startDate,
        $lte: endDate,
      },
    })
      .populate("propertyId")
      .populate({
        path: "roomId",
        populate: { path: "propertyId" },
      })
      .sort({ checkOutDate: 1 });

    return NextResponse.json(bookings);
  } catch (error) {
    console.error("BOOKING CHECKOUT RANGE ERROR:", error);
    return NextResponse.json([], { status: 500 });
  }
}

// /* eslint-disable @typescript-eslint/no-explicit-any */
// import { NextResponse } from "next/server";
// import { connectDB } from "@/lib/mongodb";
// import Booking from "@/models/Booking";
// import "@/models/Room";
// import "@/models/Property";
// import mongoose from "mongoose";

// /**
//  * GET /api/bookingsfordaterange?start=YYYY-MM-DD&end=YYYY-MM-DD
//  *
//  * Logic:
//  * 1. Get bookings with checkInDate in range
//  * 2. Get bookings with checkOutDate in range
//  * 3. Merge + remove duplicates
//  */
// export async function GET(req: Request) {
//   try {
//     await connectDB();

//     const { searchParams } = new URL(req.url);
//     const start = searchParams.get("start");
//     const end = searchParams.get("end");

//     if (!start || !end) {
//       return NextResponse.json(
//         { error: "start and end are required" },
//         { status: 400 }
//       );
//     }

//     const startDate = new Date(start);
//     startDate.setHours(0, 0, 0, 0);

//     const endDate = new Date(end);
//     endDate.setHours(23, 59, 59, 999);

//     /* ===============================
//        DATASET A: check-in in range
//     =============================== */
//     const checkInBookings = await Booking.find({
//       status: { $ne: "cancel" },
//       checkInDate: { $gte: startDate, $lte: endDate },
//     });

//     /* ===============================
//        DATASET B: check-out in range
//     =============================== */
//     const checkOutBookings = await Booking.find({
//       status: { $ne: "cancel" },
//       checkOutDate: { $gte: startDate, $lte: endDate },
//     });

//     /* ===============================
//        MERGE + REMOVE DUPLICATES
//     =============================== */
//     const bookingMap = new Map<string, any>();

//     [...checkInBookings, ...checkOutBookings].forEach((b) => {
//       bookingMap.set(b._id.toString(), b);
//     });

//     const uniqueBookings = Array.from(bookingMap.values());

//     /* ===============================
//        POPULATE AFTER MERGE
//     =============================== */
//     const populatedBookings = await Booking.populate(uniqueBookings, [
//       { path: "propertyId" },
//       {
//         path: "roomId",
//         populate: { path: "propertyId" },
//       },
//     ]);

//     populatedBookings.sort(
//       (a: any, b: any) =>
//         new Date(a.checkInDate).getTime() - new Date(b.checkInDate).getTime()
//     );

//     return NextResponse.json(populatedBookings);
//   } catch (error) {
//     console.error("BOOKING RANGE ERROR:", error);
//     return NextResponse.json([], { status: 500 });
//   }
// }
