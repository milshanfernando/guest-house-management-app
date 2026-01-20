/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";

/* ================= TYPES ================= */

interface Property {
  _id: string;
  name: string;
}

interface BookingForm {
  guestName: string;
  phone: string;
  email: string;
  reservationId: string;
  propertyId: string;
  platform: string;
  paymentMethod: string;
  amount: number | "";
  paymentDate: string | "";
  checkInDate: string | "";
  checkOutDate: string | "";
  status: string;
}

/* ================= API ================= */

const fetchJSON = (url: string) => fetch(url).then((r) => r.json());

export default function BookingPage() {
  const qc = useQueryClient();

  const today = new Date().toISOString().slice(0, 10);

  /* ================= FILTER STATES ================= */

  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("");

  /* ================= FORM STATE ================= */

  const [form, setForm] = useState<BookingForm>({
    guestName: "",
    phone: "",
    email: "",
    reservationId: "",
    propertyId: "",
    platform: "Direct",
    paymentMethod: "cash",
    amount: "",
    paymentDate: "",
    checkInDate: "",
    checkOutDate: "",
    status: "booked",
  });

  /* ================= QUERIES ================= */

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ["properties"],
    queryFn: () => fetchJSON("/api/properties"),
  });

  // Fetch bookings by date range
  const { data: bookings = [], isLoading } = useQuery<any[]>({
    queryKey: ["bookings", fromDate, toDate],
    queryFn: () => fetchJSON(`/api/bookings?start=${fromDate}&end=${toDate}`),
  });

  /* ================= MUTATIONS ================= */

  const saveBooking = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
        }),
      });

      if (!res.ok) throw new Error("Failed to save booking");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
      setForm({
        guestName: "",
        phone: "",
        email: "",
        reservationId: "",
        propertyId: "",
        platform: "Direct",
        paymentMethod: "cash",
        amount: "",
        paymentDate: "",
        checkInDate: "",
        checkOutDate: "",
        status: "booked",
      });
    },
  });

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
      qc.invalidateQueries({ queryKey: ["bookings"] });
    },
  });

  /* ================= HANDLERS ================= */

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  /* ================= FRONTEND FILTERING ================= */

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const matchesSearch =
        !search ||
        b.guestName?.toLowerCase().includes(search.toLowerCase()) ||
        b.phone?.toLowerCase().includes(search.toLowerCase()) ||
        b.email?.toLowerCase().includes(search.toLowerCase()) ||
        b.reservationId?.toLowerCase().includes(search.toLowerCase());

      const matchesPlatform = !platformFilter || b.platform === platformFilter;

      return matchesSearch && matchesPlatform;
    });
  }, [bookings, search, platformFilter]);

  /* ================= UI ================= */

  return (
    <div className="min-h-screen bg-gray-100 p-3 sm:p-6">
      <h1 className="text-3xl font-bold mb-6">🏨 Booking Management</h1>

      {/* ================= NEW BOOKING ================= */}
      <div className="bg-white rounded-xl shadow p-5 mb-10 max-w-4xl">
        <h2 className="text-xl font-semibold mb-4">📝 New Booking</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            name="guestName"
            placeholder="Guest Name"
            className="border p-2 rounded"
            value={form.guestName}
            onChange={handleChange}
          />
          <input
            name="reservationId"
            placeholder="Reservation ID"
            className="border p-2 rounded"
            value={form.reservationId}
            onChange={handleChange}
          />
          <input
            name="phone"
            placeholder="Phone"
            className="border p-2 rounded"
            value={form.phone}
            onChange={handleChange}
          />
          <input
            name="email"
            placeholder="Email"
            className="border p-2 rounded"
            value={form.email}
            onChange={handleChange}
          />

          <select
            name="propertyId"
            className="border p-2 rounded bg-white sm:col-span-2"
            value={form.propertyId}
            onChange={handleChange}
          >
            <option value="">Select Property</option>
            {properties.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </select>

          <select
            name="platform"
            className="border p-2 rounded bg-white"
            value={form.platform}
            onChange={handleChange}
          >
            <option>Booking.com</option>
            <option>Agoda</option>
            <option>Airbnb</option>
            <option>Expedia</option>
            <option>Direct</option>
          </select>

          <select
            name="paymentMethod"
            className="border p-2 rounded bg-white"
            value={form.paymentMethod}
            onChange={handleChange}
          >
            <option value="online">Online</option>
            <option value="bank">Bank</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
          </select>

          <input
            name="amount"
            type="number"
            placeholder="Amount"
            className="border p-2 rounded"
            value={form.amount}
            onChange={handleChange}
          />
          <input
            name="paymentDate"
            type="date"
            className="border p-2 rounded bg-white"
            value={form.paymentDate}
            onChange={handleChange}
          />
          <input
            name="checkInDate"
            type="date"
            className="border p-2 rounded bg-white"
            value={form.checkInDate}
            onChange={handleChange}
          />
          <input
            name="checkOutDate"
            type="date"
            className="border p-2 rounded bg-white sm:col-span-2"
            value={form.checkOutDate}
            onChange={handleChange}
          />
        </div>

        <button
          onClick={() => saveBooking.mutate()}
          className="mt-5 w-full bg-black text-white py-3 rounded hover:bg-gray-800"
        >
          Save Booking
        </button>
      </div>

      {/* ================= FILTERS ================= */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="border p-2 rounded bg-white"
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="border p-2 rounded bg-white"
        />
        <input
          placeholder="Search guest / phone / reservation"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border p-2 rounded w-64"
        />
        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
          className="border p-2 rounded bg-white"
        >
          <option value="">All Platforms</option>
          <option value="Direct">Direct</option>
          <option value="Booking.com">Booking.com</option>
          <option value="Expedia">Expedia</option>
          <option value="Airbnb">Airbnb</option>
          <option value="Agoda">Agoda</option>
        </select>
      </div>

      {/* ================= BOOKINGS ================= */}
      {isLoading && <p>Loading...</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredBookings.length === 0 && <p>No bookings found</p>}

        {filteredBookings.map((b) => (
          <div key={b._id} className="bg-white shadow rounded-lg p-4 space-y-1">
            <p className="font-semibold text-lg">{b.guestName}</p>
            <p className="text-sm">🏨 {b.propertyId?.name}</p>
            <p className="text-sm">📞 {b.phone}</p>
            <p className="text-sm">📧 {b.email}</p>
            <p className="text-sm">🆔 {b.reservationId}</p>
            <p className="text-sm">🌐 {b.platform}</p>
            <p className="text-sm">
              📅 {b.checkInDate?.slice(0, 10)} → {b.checkOutDate?.slice(0, 10)}
            </p>
            <p className="text-sm">
              💰 {b.amount} ({b.paymentMethod})
            </p>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => permanentDelete.mutate(b._id)}
                className="text-red-600 hover:text-red-800 text-sm"
              >
                ❌ Delete Forever
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
