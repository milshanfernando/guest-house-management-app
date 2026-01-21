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

  // Guest
  guestName: string;
  reservationId?: string;
  phone?: string;

  // Property / Room
  propertyId?: Property;
  roomId?: {
    roomNo?: string | number;
    propertyId?: Property;
  };

  // Booking Info
  unitType?: string;
  platform: string;
  status?: "booked" | "checked_in" | "checked_out" | "cancelled";

  // Payment
  paymentMethod: "cash" | "bank" | "online" | "card";
  paymentDate?: string;
  amount: number;
  expectedPayment?: number;

  // Dates
  checkInDate?: string;
  checkOutDate?: string;

  // Meta
  createdAt?: string;
  updatedAt?: string;
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

const formatMoney = (v: number) =>
  v.toLocaleString(undefined, { minimumFractionDigits: 2 });

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
    },
  );

  /* ===============================
     MERGE + DEDUP (UNCHANGED)
  =============================== */
  const bookings = useMemo(() => {
    const map = new Map<string, Booking>();

    for (const b of directBookings) {
      if (b.platform === "Direct") map.set(b._id, b);
    }

    for (const b of otaBookings) {
      if (OTA_PLATFORMS.has(b.platform)) map.set(b._id, b);
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
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* HEADER */}
        <header>
          <h1 className="text-2xl font-semibold text-gray-900">
            Income by Platform
          </h1>
          <p className="text-sm text-gray-500">
            Accounting-safe revenue report
          </p>
        </header>

        {/* FILTERS */}
        <div className="bg-white rounded-xl shadow-sm p-4 flex flex-wrap gap-4">
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="input"
          />
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="input"
          />
          <select
            value={selectedProperty}
            onChange={(e) => setSelectedProperty(e.target.value)}
            className="input min-w-[180px]"
          >
            <option value="">All properties</option>
            {properties.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {isLoading && <p className="text-sm text-gray-500">Loading data…</p>}

        {/* PLATFORMS */}
        <div className="space-y-10">
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

  /* ===== DELETE (UNCHANGED) ===== */
  const permanentDelete = useMutation({
    mutationFn: async (bookingId: string) => {
      const ok = confirm("⚠️ Permanently delete this booking?");
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
      qc.invalidateQueries({ queryKey: ["direct-bookings"] });
      qc.invalidateQueries({ queryKey: ["ota-bookings"] });
    },
  });

  /* ===== TOTALS (UNCHANGED) ===== */
  const cashTotal = bookings.reduce(
    (s, b) => (b.paymentMethod === "cash" ? s + b.amount : s),
    0,
  );
  const bankTotal = bookings.reduce(
    (s, b) => (b.paymentMethod === "bank" ? s + b.amount : s),
    0,
  );
  const cardTotal = bookings.reduce(
    (s, b) => (b.paymentMethod === "card" ? s + b.amount : s),
    0,
  );
  const otaTotal = bookings.reduce((s, b) => s + (b.expectedPayment || 0), 0);

  return (
    <section className="space-y-4">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">{label}</h2>
        <span className="text-xs text-gray-400">{bookings.length} records</span>
      </div>

      {/* SUMMARY */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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

      <div className="grid gap-4 sm:hidden">
        {bookings.map((b) => {
          const amount = type === "direct" ? b.amount : b.expectedPayment || 0;

          return (
            <div
              key={b._id}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
            >
              {/* Header */}
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-semibold text-gray-900">{b.guestName}</p>
                  <p className="text-xs text-gray-500">{b.platform}</p>
                  {/* Phone */}
                  {b.phone && (
                    <p className="text-xs text-gray-500">📞 {b.phone}</p>
                  )}
                </div>

                <p className="text-lg font-bold text-gray-900">
                  {formatMoney(amount)}
                </p>
              </div>

              {/* Property & Unit & Room */}
              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div>
                  <p className="text-gray-400">Property</p>
                  <p className="font-medium text-gray-700">
                    {b.propertyId?.name || "—"}
                  </p>
                </div>

                <div>
                  <p className="text-gray-400">Unit Type</p>
                  <p className="font-medium text-gray-700">
                    {b.unitType || "—"}
                  </p>
                </div>

                <div className=" col-span-2">
                  <p className="text-gray-400">Room</p>
                  <p className="font-medium text-gray-700">
                    Room {b.roomId?.roomNo} - {b.roomId?.propertyId?.name}
                  </p>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div>
                  <p className="text-gray-400">Check-in</p>
                  <p className="font-medium text-gray-700">
                    {b.checkInDate
                      ? new Date(b.checkInDate).toLocaleDateString()
                      : "—"}
                  </p>
                </div>

                <div>
                  <p className="text-gray-400">Check-out</p>
                  <p className="font-medium text-gray-700">
                    {b.checkOutDate
                      ? new Date(b.checkOutDate).toLocaleDateString()
                      : "—"}
                  </p>
                </div>
              </div>

              {/* Payment Info */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-gray-400">Payment Method</p>
                  <p className="font-medium capitalize text-gray-700">
                    {b.paymentMethod || "—"}
                  </p>
                </div>

                <div>
                  <p className="text-gray-400">Payment Date</p>
                  <p className="font-medium text-gray-700">
                    {b.paymentDate
                      ? new Date(b.paymentDate).toLocaleDateString()
                      : "—"}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* DESKTOP TABLE */}
      <div className="hidden sm:block bg-white rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Guest</th>
              <th className="px-4 py-3 text-left">Property</th>
              <th className="px-4 py-3 text-left">Room</th>
              <th className="px-4 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b._id} className="border-t border-gray-100">
                <td className="px-4 py-3">{b.guestName}</td>
                <td className="px-4 py-3">{b.propertyId?.name}</td>
                <td className="px-4 py-3">
                  {b.roomId?.propertyId?.name} – {b.roomId?.roomNo}
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {formatMoney(
                    type === "direct" ? b.amount : b.expectedPayment || 0,
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ======================================================
   SUMMARY CARD
====================================================== */

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
      className={`rounded-xl p-4 shadow-sm ${
        highlight ? "bg-gray-900 text-white" : "bg-white"
      }`}
    >
      <p className="text-xs opacity-80">{label}</p>
      <p className="text-xl font-semibold">{formatMoney(value)}</p>
    </div>
  );
}
