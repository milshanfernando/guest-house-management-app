/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

/* ================= TYPES ================= */

interface Property {
  _id: string;
  name: string;
}

interface Room {
  _id: string;
  roomNo: string;
}

interface Booking {
  _id: string;
  guestName: string;
  roomId?: string;
  propertyId?: { _id: string; name: string };
  checkInDate: string;
  checkOutDate: string;
  status: string;
  type?: "checkin" | "checkout" | "stay";
}

/* ================= PAGE ================= */

export default function RoomOccupancyPage() {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  const [propertyId, setPropertyId] = useState("");
  const [selectedDate, setSelectedDate] = useState(today);

  const inputClass =
    "border rounded p-2 h-10 bg-white text-gray-900 w-full appearance-none";

  /* ================= QUERIES ================= */

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ["properties"],
    queryFn: () => fetch("/api/properties").then((res) => res.json()),
  });

  const { data: rooms = [], isLoading: roomsLoading } = useQuery<Room[]>({
    queryKey: ["rooms", propertyId],
    enabled: !!propertyId,
    queryFn: () =>
      fetch(`/api/rooms?propertyId=${propertyId}`).then((res) => res.json()),
  });

  const { data: bookings = [] } = useQuery<Booking[]>({
    queryKey: ["occupancies", propertyId, selectedDate],
    enabled: !!propertyId,
    queryFn: () =>
      fetch(`/api/bookings?propertyId=${propertyId}&date=${selectedDate}`).then(
        (res) => res.json()
      ),
  });

  const { data: unassigned = [] } = useQuery<Booking[]>({
    queryKey: ["unassignedBookings"],
    queryFn: () =>
      fetch(`/api/bookings?unassigned=true`).then((res) => res.json()),
  });

  /* ================= MUTATION ================= */

  const bookingMutation = useMutation({
    mutationFn: (payload: any) =>
      fetch("/api/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["occupancies"] });
      queryClient.invalidateQueries({ queryKey: ["unassignedBookings"] });
    },
  });

  /* ================= HELPERS ================= */

  const bookingsForRoomOnDate = (roomId: string) =>
    bookings.filter((b) => b.roomId === roomId);

  const isRoomAvailable = (roomId: string) => {
    const roomBookings = bookingsForRoomOnDate(roomId);
    if (roomBookings.length === 0) return true;

    return roomBookings.every(
      (b) =>
        b.type === "checkout" && b.checkOutDate.slice(0, 10) === selectedDate
    );
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  /* ================= UI ================= */

  return (
    <div className="min-h-screen bg-gray-100 p-1 sm:p-6 lg:p-8">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6">🏨 Room Occupancy</h1>

      {/* ================= FILTERS ================= */}
      <div className="bg-white rounded-xl shadow p-4 mb-6 flex flex-col sm:flex-row gap-3">
        <select
          className={`${inputClass} sm:w-64`}
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

        <input
          type="date"
          className={`${inputClass} sm:w-auto`}
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </div>

      {roomsLoading && <p className="text-gray-500">Loading rooms...</p>}

      {/* ================= ROOMS GRID ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rooms.map((room) => {
          const roomBookings = bookingsForRoomOnDate(room._id);
          const isAvailable = isRoomAvailable(room._id);

          return (
            <div
              key={room._id}
              className={`rounded-xl shadow-md p-4 ${
                isAvailable ? "bg-green-50" : "bg-red-50"
              }`}
            >
              {/* Header */}
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Room {room.roomNo}</h2>
                <span
                  className={`text-xs px-3 py-1 rounded-full font-medium ${
                    isAvailable
                      ? "bg-green-200 text-green-800"
                      : "bg-red-200 text-red-800"
                  }`}
                >
                  {isAvailable ? "Available" : "Occupied"}
                </span>
              </div>

              {/* Guest Cards */}
              <div className="space-y-3">
                {roomBookings.map((b) => (
                  <div key={b._id} className="p-3 rounded-lg bg-white shadow">
                    <div className="flex justify-between mb-1">
                      <p
                        onClick={() =>
                          bookingMutation.mutate({
                            bookingId: b._id,
                            roomId: null,
                            action: "assign",
                          })
                        }
                        className=" text-red-900 hover:bg-red-100 px-2 cursor-pointer"
                      >
                        Remove
                      </p>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          b.status === "checked_out"
                            ? "bg-gray-200 text-gray-700"
                            : b.type === "checkin"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {b.status.replace("_", " ")}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mb-1">
                      <p className="font-semibold">👤 {b.guestName}</p>
                    </div>

                    <p className="text-xs text-gray-600 mb-2">
                      📅 {formatDate(b.checkInDate)} →{" "}
                      {formatDate(b.checkOutDate)}
                    </p>

                    <div className="flex flex-col sm:flex-row gap-2">
                      {b.type === "checkin" && b.status === "booked" && (
                        <button
                          onClick={() =>
                            bookingMutation.mutate({
                              bookingId: b._id,
                              action: "checkin",
                            })
                          }
                          className="bg-blue-500 text-white px-3 py-2 rounded text-sm w-full sm:w-auto"
                        >
                          Check-in
                        </button>
                      )}

                      {b.type === "checkout" && b.status !== "checked_out" && (
                        <button
                          onClick={() =>
                            bookingMutation.mutate({
                              bookingId: b._id,
                              action: "checkout",
                            })
                          }
                          className="bg-red-600 text-white px-3 py-2 rounded text-sm w-full sm:w-auto"
                        >
                          Check-out
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Assign Guest */}
              {isAvailable && (
                <select
                  className={`${inputClass} mt-4`}
                  onChange={(e) =>
                    bookingMutation.mutate({
                      action: "assign",
                      roomId: room._id,
                      bookingId: e.target.value,
                    })
                  }
                >
                  <option value="">Assign Guest</option>
                  {unassigned.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.guestName} ({b.propertyId?.name || "No Property"}) 📅{" "}
                      {formatDate(b.checkInDate)} → {formatDate(b.checkOutDate)}
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
