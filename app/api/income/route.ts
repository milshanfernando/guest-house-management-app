/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Booking from "@/models/Booking";

export async function GET(req: Request) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);

    const date = searchParams.get("date");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const month = searchParams.get("month"); // ✅ NEW
    const propertyId = searchParams.get("propertyId");
    const platform = searchParams.get("platform");

    const query: any = {
      status: { $ne: "cancel" },
    };

    /* ================= PROPERTY ================= */
    if (propertyId) {
      query.propertyId = propertyId;
    }

    /* ================= PLATFORM ================= */
    if (platform) {
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

    /* ================= DATE LOGIC ================= */
    let start: Date | null = null;
    let end: Date | null = null;

    // 📅 Single day
    if (date) {
      start = new Date(date);
      start.setUTCHours(0, 0, 0, 0);

      end = new Date(date);
      end.setUTCHours(23, 59, 59, 999);
    }

    // 📆 Date range
    if (from && to) {
      start = new Date(from);
      start.setUTCHours(0, 0, 0, 0);

      end = new Date(to);
      end.setUTCHours(23, 59, 59, 999);
    }

    // 🗓️ Monthly
    if (month) {
      const [year, monthIndex] = month.split("-").map(Number);

      start = new Date(Date.UTC(year, monthIndex - 1, 1, 0, 0, 0));
      end = new Date(Date.UTC(year, monthIndex, 0, 23, 59, 59, 999));
    }

    /** Apply date filter safely */
    if (start && end) {
      query.$or = [
        { paymentDate: { $gte: start, $lte: end } },
        {
          paymentDate: { $exists: false },
          createdAt: { $gte: start, $lte: end },
        },
      ];
    }

    /* ================= QUERY ================= */
    const records = await Booking.find(query)
      .populate("propertyId")
      .sort({ paymentDate: -1, createdAt: -1 });

    /* ================= TOTALS ================= */
    const totals = {
      booking: 0,
      agoda: 0,
      airbnb: 0,
      expedia: 0,
      directBank: 0,
      directCash: 0,
      netTotal: 0,
    };

    for (const b of records) {
      const amount = b.amount || 0;
      totals.netTotal += amount;

      if (b.platform === "Booking.com") totals.booking += amount;
      if (b.platform === "Agoda") totals.agoda += amount;
      if (b.platform === "Airbnb") totals.airbnb += amount;
      if (b.platform === "Expedia") totals.expedia += amount;

      if (b.platform === "Direct" && b.paymentMethod === "bank") {
        totals.directBank += amount;
      }

      if (b.platform === "Direct" && b.paymentMethod === "cash") {
        totals.directCash += amount;
      }
    }

    return NextResponse.json({ totals, records });
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
