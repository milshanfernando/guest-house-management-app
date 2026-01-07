/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

/* ================= TYPES ================= */

interface Property {
  _id: string;
  name: string;
}

interface Room {
  _id: string;
  roomNo: string;
  status: string;
}

interface Booking {
  _id: string;
  guestName: string;
  roomId?: { _id: string };
  checkInDate: string;
  checkOutDate: string;
  status: string;
}

/* ================= API HELPERS ================= */

const fetchJSON = (url: string) => fetch(url).then((r) => r.json());

/* ================= PAGE ================= */

export default function RoomsPage() {
  const qc = useQueryClient();
  const [propertyId, setPropertyId] = useState("");
  const [roomNo, setRoomNo] = useState("");

  /* -------- Queries -------- */

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ["properties"],
    queryFn: () => fetchJSON("/api/properties"),
  });

  const { data: rooms = [] } = useQuery<Room[]>({
    queryKey: ["rooms", propertyId],
    queryFn: () => fetchJSON(`/api/rooms?propertyId=${propertyId}`),
    enabled: !!propertyId,
  });

  const { data: bookings = [] } = useQuery<Booking[]>({
    queryKey: ["bookings"],
    queryFn: () => fetchJSON("/api/bookings"),
  });

  /* -------- Mutations -------- */

  const addRoom = useMutation({
    mutationFn: () =>
      fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, roomNo }),
      }),
    onSuccess: () => {
      setRoomNo("");
      qc.invalidateQueries({ queryKey: ["rooms", propertyId] });
    },
  });

  const assignRoom = useMutation({
    mutationFn: (payload: { roomId: string; bookingId: string }) =>
      fetch("/api/rooms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign", ...payload }),
      }),
    onSuccess: () => qc.invalidateQueries(),
  });

  const checkout = useMutation({
    mutationFn: (bookingId: string) =>
      fetch("/api/rooms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "checkout", bookingId }),
      }),
    onSuccess: () => qc.invalidateQueries(),
  });

  /* -------- Helpers -------- */

  const today = new Date();
  const activeBooking = (roomId: string) =>
    bookings.find(
      (b) =>
        b.roomId?._id === roomId &&
        new Date(b.checkInDate) <= today &&
        today < new Date(b.checkOutDate)
    );

  const availableBookings = bookings.filter((b) => b.status === "booked");

  /* ================= UI ================= */

  return (
    <div className="p-8 bg-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold mb-6">🏨 Room Management</h1>

      {/* Property Select */}
      <select
        className="border rounded px-4 py-2 mb-6 shadow"
        value={propertyId}
        onChange={(e) => setPropertyId(e.target.value)}
      >
        <option value="">Select Property</option>
        {properties.map((p) => (
          <option key={p._id} value={p._id}>
            {p.name}
          </option>
        ))}
      </select>

      {/* Add Room */}
      {propertyId && (
        <div className="flex gap-2 mb-6">
          <input
            className="border rounded px-3 py-2 w-40"
            placeholder="Room No"
            value={roomNo}
            onChange={(e) => setRoomNo(e.target.value)}
          />
          <button
            onClick={() => addRoom.mutate()}
            className="bg-black text-white px-4 rounded"
          >
            Add Room
          </button>
        </div>
      )}

      {/* Rooms Grid */}
      <div className="grid md:grid-cols-3 gap-6">
        {rooms.map((room) => {
          const booking = activeBooking(room._id);

          return (
            <div
              key={room._id}
              className={`rounded-xl shadow p-5 ${
                booking ? "bg-red-50" : "bg-green-50"
              }`}
            >
              <div className="flex justify-between mb-2">
                <h2 className="text-xl font-semibold">Room {room.roomNo}</h2>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    booking
                      ? "bg-red-200 text-red-700"
                      : "bg-green-200 text-green-700"
                  }`}
                >
                  {booking ? "Occupied" : "Available"}
                </span>
              </div>

              {booking ? (
                <>
                  <p className="mt-2 font-medium">👤 {booking.guestName}</p>
                  <p className="text-sm text-gray-600">
                    📅 {booking.checkInDate.slice(0, 10)} →{" "}
                    {new Date(
                      new Date(booking.checkOutDate).setDate(
                        new Date(booking.checkOutDate).getDate() - 1
                      )
                    )
                      .toISOString()
                      .slice(0, 10)}
                  </p>

                  <button
                    onClick={() => checkout.mutate(booking._id)}
                    className="mt-4 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
                  >
                    Checkout
                  </button>
                </>
              ) : (
                <select
                  className="border rounded w-full mt-4 p-2"
                  onChange={(e) =>
                    assignRoom.mutate({
                      roomId: room._id,
                      bookingId: e.target.value,
                    })
                  }
                >
                  <option value="">Assign Booking</option>
                  {availableBookings.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.guestName}
                    </option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
