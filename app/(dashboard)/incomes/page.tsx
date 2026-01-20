/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

/* ======================================================
   TYPES
====================================================== */

interface Property {
  _id: string;
  name: string;
}

interface Booking {
  _id: string;
  guestName: string;
  propertyId?: Property;
  roomId?: any;
  platform: string;
  paymentMethod: "cash" | "bank" | "online" | "card";
  paymentDate?: string;
  amount: number;
  expectedPayment?: number;
}

/* ======================================================
   CONSTANTS
====================================================== */

const fetchJSON = (url: string) => fetch(url).then((r) => r.json());

const PLATFORMS = [
  { label: "Direct", key: "Direct", type: "direct" },
  { label: "Booking.com", key: "Booking.com", type: "ota" },
  { label: "Expedia", key: "Expedia", type: "ota" },
  { label: "Agoda", key: "Agoda", type: "ota" },
  { label: "Airbnb", key: "Airbnb", type: "ota" },
] as const;

const OTA_PLATFORMS = new Set(["Booking.com", "Expedia", "Agoda", "Airbnb"]);

const formatMoney = (v: number) => v.toLocaleString();

/* ======================================================
   PAGE
====================================================== */

export default function IncomeByPlatformPage() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [selectedProperty, setSelectedProperty] = useState("");

  /* ===============================
     DIRECT → PAYMENT DATE
  =============================== */
  const { data: directBookings = [], isLoading: loadingDirect } = useQuery<
    Booking[]
  >({
    queryKey: ["direct-bookings", start, end],
    queryFn: () => fetchJSON(`/api/by-payment-range?start=${start}&end=${end}`),
    enabled: !!start && !!end,
  });

  /* ===============================
     OTA → CHECKOUT DATE
  =============================== */
  const { data: otaBookings = [], isLoading: loadingOta } = useQuery<Booking[]>(
    {
      queryKey: ["ota-bookings", start, end],
      queryFn: () =>
        fetchJSON(`/api/by-checkout-range?start=${start}&end=${end}`),
      enabled: !!start && !!end,
    }
  );

  /* ===============================
     MERGE + DEDUP (IMPORTANT)
  =============================== */
  const bookings = useMemo(() => {
    const map = new Map<string, Booking>();

    // Direct bookings ONLY from payment endpoint
    for (const b of directBookings) {
      if (b.platform === "Direct") {
        map.set(b._id, b);
      }
    }

    // OTA bookings ONLY from checkout endpoint
    for (const b of otaBookings) {
      if (OTA_PLATFORMS.has(b.platform)) {
        map.set(b._id, b);
      }
    }

    return Array.from(map.values());
  }, [directBookings, otaBookings]);

  const isLoading = loadingDirect || loadingOta;

  /* ===============================
     PROPERTIES
  =============================== */
  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ["properties"],
    queryFn: () => fetchJSON("/api/properties"),
  });

  /* ===============================
     FILTER BY PROPERTY
  =============================== */
  const filteredBookings = useMemo(() => {
    if (!selectedProperty) return bookings;
    return bookings.filter((b) => b.propertyId?._id === selectedProperty);
  }, [bookings, selectedProperty]);

  /* ===============================
     GROUP BY PLATFORM
  =============================== */
  const bookingsByPlatform = useMemo(() => {
    const map: Record<string, Booking[]> = {};
    for (const b of filteredBookings) {
      if (!map[b.platform]) map[b.platform] = [];
      map[b.platform].push(b);
    }
    return map;
  }, [filteredBookings]);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-10">
        <header>
          <h1 className="text-3xl font-bold">Income by Platform</h1>
          <p className="text-gray-500">Accounting-safe revenue dashboard</p>
        </header>

        {/* FILTERS */}
        <div className="bg-white rounded-2xl border p-6 flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-sm text-gray-500">Start date</label>
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="block border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="text-sm text-gray-500">End date</label>
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="block border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="text-sm text-gray-500">Property</label>
            <select
              value={selectedProperty}
              onChange={(e) => setSelectedProperty(e.target.value)}
              className="block border rounded-lg px-3 py-2"
            >
              <option value="">All properties</option>
              {properties.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              setStart("");
              setEnd("");
              setSelectedProperty("");
            }}
            className="ml-auto border rounded-lg px-4 py-2 text-sm hover:bg-gray-100"
          >
            Reset
          </button>
        </div>

        {isLoading && <p className="text-gray-500">Loading data…</p>}

        <div className="space-y-8">
          {PLATFORMS.map((p) => (
            <PlatformSection
              key={p.key}
              label={p.label}
              type={p.type}
              bookings={bookingsByPlatform[p.key] || []}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ======================================================
   PLATFORM SECTION
====================================================== */

function PlatformSection({
  label,
  type,
  bookings,
}: {
  label: string;
  type: "direct" | "ota";
  bookings: Booking[];
}) {
  const qc = useQueryClient();

  const permanentDelete = useMutation({
    mutationFn: async (bookingId: string) => {
      const ok = confirm(
        "⚠️ This will permanently delete the booking. This cannot be undone."
      );
      if (!ok) return;

      const res = await fetch("/api/bookings?permanent=true", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });

      if (!res.ok) throw new Error("Delete failed");
      return res.json();
    },
    onSuccess: () => {
      // ✅ CORRECT INVALIDATIONS
      qc.invalidateQueries({ queryKey: ["direct-bookings"] });
      qc.invalidateQueries({ queryKey: ["ota-bookings"] });
    },
  });
  const cashTotal = bookings.reduce(
    (s, b) => (b.paymentMethod === "cash" ? s + b.amount : s),
    0
  );

  const bankTotal = bookings.reduce(
    (s, b) => (b.paymentMethod === "bank" ? s + b.amount : s),
    0
  );

  const cardTotal = bookings.reduce(
    (s, b) => (b.paymentMethod === "card" ? s + b.amount : s),
    0
  );

  const otaTotal = bookings.reduce((s, b) => s + (b.expectedPayment || 0), 0);

  return (
    <div className="bg-white rounded-2xl border p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">{label}</h2>
        <span className="text-sm text-gray-500">
          {bookings.length} bookings
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {type === "direct" ? (
          <>
            <SummaryCard label="Cash" value={cashTotal} />
            <SummaryCard label="Bank" value={bankTotal} />
            <SummaryCard label="Card" value={cardTotal} />
            <SummaryCard
              label="Total"
              value={cashTotal + bankTotal + cardTotal}
              highlight
            />
          </>
        ) : (
          <SummaryCard label="Expected Revenue" value={otaTotal} highlight />
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border rounded-lg overflow-hidden">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-3 py-2 text-left">Guest</th>
              <th className="border px-3 py-2 text-left">Property</th>
              <th className="border px-3 py-2 text-left">Room</th>
              <th className="border px-3 py-2 text-right">Amount</th>
              {/* <th className="border px-3 py-2 text-right">#</th> */}
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b._id} className="hover:bg-gray-50">
                <td className="border px-3 py-2">{b.guestName}</td>
                <td className="border px-3 py-2 text-xs">
                  {b.propertyId?.name || "—"}
                </td>
                <td className="border px-3 py-2 text-xs">
                  {b?.roomId?.propertyId?.name || "—"} -{" "}
                  {b?.roomId?.roomNo || "—"}
                </td>
                <td className="border px-3 py-2 text-right">
                  {formatMoney(
                    type === "direct" ? b.amount : b.expectedPayment || 0
                  )}
                </td>
                {/* <td className="border px-3 py-2 text-right">
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => permanentDelete.mutate(b._id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      ❌ Delete Forever
                    </button>
                  </div>
                </td> */}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight ? "bg-black text-white" : "bg-white"
      }`}
    >
      <p className="text-sm opacity-80">{label}</p>
      <p className="text-2xl font-bold">{formatMoney(value)}</p>
    </div>
  );
}
