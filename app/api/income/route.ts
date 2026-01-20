/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Booking from "@/models/Booking";

export async function GET(req: Request) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);

    const type = searchParams.get("type") || "daily"; // daily | monthly | range
    const date = searchParams.get("date");
    const month = searchParams.get("month");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const propertyId = searchParams.get("propertyId");
    const platform = searchParams.get("platform");

    const query: any = { status: { $ne: "cancel" } };

    // Optional property filter
    if (propertyId && propertyId.trim() !== "") {
      query.propertyId = propertyId;
    }

    // Optional platform filter
    if (platform && platform.trim() !== "") {
      if (platform === "directBank") {
        query.platform = "Direct";
        query.paymentMethod = "bank";
      } else if (platform === "directCash") {
        query.platform = "Direct";
        query.paymentMethod = "cash";
      } else {
        query.platform = platform;
      }
    }

    // Date filter
    let start: Date | null = null;
    let end: Date | null = null;

    if (type === "daily" && date) {
      start = new Date(date);
      start.setHours(0, 0, 0, 0);
      end = new Date(date);
      end.setHours(23, 59, 59, 999);
    }

    if (type === "range" && from && to) {
      start = new Date(from);
      start.setHours(0, 0, 0, 0);
      end = new Date(to);
      end.setHours(23, 59, 59, 999);
    }

    if (type === "monthly" && month) {
      const [year, monthIndex] = month.split("-").map(Number);
      start = new Date(year, monthIndex - 1, 1, 0, 0, 0);
      end = new Date(year, monthIndex, 0, 23, 59, 59, 999);
    }

    if (start && end) {
      query.paymentDate = { $gte: start, $lte: end };
    }

    // Fetch bookings
    const records = await Booking.find(query).sort({
      paymentDate: -1,
      createdAt: -1,
    });

    // Calculate totals
    const totals = {
      booking: 0,
      agoda: 0,
      airbnb: 0,
      expedia: 0,
      directBank: 0,
      directCash: 0,
      netTotal: 0,
    };

    const modifiedRecords = records.map((b: any) => {
      const amount = b.amount || 0;
      totals.netTotal += amount;

      switch (b.platform) {
        case "Booking.com":
          totals.booking += amount;
          break;
        case "Agoda":
          totals.agoda += amount;
          break;
        case "Airbnb":
          totals.airbnb += amount;
          break;
        case "Expedia":
          totals.expedia += amount;
          break;
        case "Direct":
          if (b.paymentMethod === "bank") totals.directBank += amount;
          if (b.paymentMethod === "cash") totals.directCash += amount;
          break;
      }

      return {
        _id: b._id,
        guestName: b.guestName,
        propertyId: b.propertyId, // raw ObjectId
        roomId: b.roomId, // raw ObjectId
        platform: b.platform,
        paymentMethod: b.paymentMethod,
        paymentDate: b.paymentDate ? b.paymentDate.toISOString() : undefined,
        amount,
        expectedPayment: b.expectedPayment,
      };
    });

    return NextResponse.json({ totals, records: modifiedRecords });
  } catch (error) {
    console.error("INCOME API ERROR:", error);
    return NextResponse.json(
      {
        totals: {
          booking: 0,
          agoda: 0,
          airbnb: 0,
          expedia: 0,
          directBank: 0,
          directCash: 0,
          netTotal: 0,
        },
        records: [],
      },
      { status: 500 }
    );
  }
}
