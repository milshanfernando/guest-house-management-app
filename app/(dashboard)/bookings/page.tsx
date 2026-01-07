/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

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
  const [selectedDate, setSelectedDate] = useState(today);

  const [form, setForm] = useState<BookingForm>({
    guestName: "",
    phone: "",
    email: "",
    reservationId: "",
    propertyId: "",
    platform: "Booking.com",
    paymentMethod: "online",
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

  const { data: occupancies = [] } = useQuery<any[]>({
    queryKey: ["occupancies", selectedDate],
    queryFn: () => fetchJSON(`/api/bookings?date=${selectedDate}`),
  });

  /* ================= MUTATION ================= */

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

      if (!res.ok) {
        throw new Error("Failed to save booking");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["occupancies"] });
      setForm({
        guestName: "",
        phone: "",
        email: "",
        reservationId: "",
        propertyId: "",
        platform: "Booking.com",
        paymentMethod: "online",
        amount: "",
        paymentDate: "",
        checkInDate: "",
        checkOutDate: "",
        status: "booked",
      });
    },
  });

  /* ================= HANDLERS ================= */

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  /* ================= UI ================= */

  return (
    <div className="min-h-screen bg-gray-100 p-1 sm:p-6 lg:p-8">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6">
        🏨 Booking Management
      </h1>

      {/* ================= NEW BOOKING ================= */}
      <div className="bg-white rounded-xl shadow p-2 sm:p-6 mb-10 max-w-3xl">
        <h2 className="text-lg sm:text-xl font-semibold mb-4">
          📝 New Booking
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            name="guestName"
            placeholder="Guest Name"
            className="border p-2 rounded w-full"
            value={form.guestName}
            onChange={handleChange}
          />

          <input
            name="reservationId"
            placeholder="Reservation ID"
            className="border p-2 rounded w-full"
            value={form.reservationId}
            onChange={handleChange}
          />

          <input
            name="phone"
            placeholder="Phone"
            className="border p-2 rounded w-full"
            value={form.phone}
            onChange={handleChange}
          />

          <input
            name="email"
            placeholder="Email"
            className="border p-2 rounded w-full"
            value={form.email}
            onChange={handleChange}
          />

          <select
            name="propertyId"
            className="border p-2 rounded w-full sm:col-span-2 bg-white"
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
            className="border p-2 rounded w-full bg-white"
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
            className="border p-2 rounded w-full bg-white"
            value={form.paymentMethod}
            onChange={handleChange}
          >
            <option value="online">Online</option>
            <option value="bank">Bank</option>
            <option value="cash">Cash</option>
          </select>

          <input
            name="amount"
            type="number"
            placeholder="Amount"
            className="border p-2 rounded w-full"
            value={form.amount}
            onChange={handleChange}
          />

          <input
            name="paymentDate"
            type="date"
            className="border p-2 rounded w-full bg-white"
            value={form.paymentDate}
            onChange={handleChange}
          />

          <input
            name="checkInDate"
            type="date"
            className="border p-2 rounded w-full bg-white"
            value={form.checkInDate}
            onChange={handleChange}
          />

          <input
            name="checkOutDate"
            type="date"
            className="border p-2 rounded w-full sm:col-span-2 bg-white"
            value={form.checkOutDate}
            onChange={handleChange}
          />
        </div>

        <button
          onClick={() => saveBooking.mutate()}
          className="mt-5 bg-black hover:bg-gray-800 text-white px-6 py-3 rounded w-full disabled:opacity-50"
          disabled={saveBooking.isPending}
        >
          {saveBooking.isPending ? "Saving..." : "Save Booking"}
        </button>
      </div>

      {/* ================= OCCUPANCY ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <label className="font-medium">📅 Select Date</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="border p-2 rounded w-full sm:w-auto bg-white"
        />
      </div>

      <h2 className="text-xl sm:text-2xl font-semibold mb-4">
        🏠 Occupancy for {selectedDate}
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {occupancies.length === 0 && (
          <p className="text-gray-500">No occupied rooms</p>
        )}

        {occupancies.map((b) => (
          <div key={b._id} className="bg-white shadow rounded-lg p-4 space-y-1">
            <p className="font-semibold">{b.guestName}</p>
            <p className="text-sm">🏨 {b.propertyId?.name}</p>
            <p className="text-sm">
              📅 {b.checkInDate?.slice(0, 10)} → {b.checkOutDate?.slice(0, 10)}
            </p>
            <p className="text-xs text-gray-500">
              💰 {b.amount} ({b.paymentMethod})
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
