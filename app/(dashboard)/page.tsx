/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useQuery } from "@tanstack/react-query";

const today = new Date().toISOString().split("T")[0];

/* -------------------- API FUNCTIONS -------------------- */

const fetchIncome = async () => {
  const res = await fetch(`/api/income?date=${today}`);
  return res.json();
};

const fetchTodayBookings = async () => {
  const res = await fetch(`/api/bookings?date=${today}`);
  return res.json();
};

const fetchActiveGuests = async () => {
  const res = await fetch(`/api/bookings?active=true`);
  return res.json();
};

/* -------------------- PAGE -------------------- */

export default function DashboardPage() {
  const incomeQuery = useQuery({
    queryKey: ["income", today],
    queryFn: fetchIncome,
  });

  const bookingQuery = useQuery({
    queryKey: ["bookings", today],
    queryFn: fetchTodayBookings,
  });

  const activeGuestQuery = useQuery({
    queryKey: ["activeGuests"],
    queryFn: fetchActiveGuests,
  });

  if (
    incomeQuery.isLoading ||
    bookingQuery.isLoading ||
    activeGuestQuery.isLoading
  ) {
    return <div className="p-6">Loading dashboard...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-6">
        <StatCard
          title="Today Income"
          value={`₹ ${incomeQuery.data?.totals?.netTotal || 0}`}
        />
        <StatCard
          title="Today Bookings"
          value={bookingQuery.data?.length || 0}
        />
        <StatCard
          title="Active Guests"
          value={activeGuestQuery.data?.length || 0}
        />
      </div>

      {/* Active Guests Table */}
      <ActiveGuestTable data={activeGuestQuery.data || []} />
    </div>
  );
}

/* -------------------- COMPONENTS -------------------- */

function StatCard({ title, value }: { title: string; value: any }) {
  return (
    <div className="bg-white border rounded-xl p-6 shadow-sm">
      <p className="text-gray-500 text-sm">{title}</p>
      <p className="text-2xl font-bold mt-2">{value}</p>
    </div>
  );
}

function ActiveGuestTable({ data }: { data: any[] }) {
  return (
    <div className="bg-white border rounded-xl p-6 shadow-sm">
      <h2 className="text-xl font-bold mb-4">Active Guests</h2>

      {data.length === 0 ? (
        <p className="text-gray-500">No active guests</p>
      ) : (
        <table className="w-full border">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-2">Guest</th>
              <th className="border p-2">Property</th>
              <th className="border p-2">Room</th>
              <th className="border p-2">Check-in</th>
            </tr>
          </thead>
          <tbody>
            {data.map((g) => (
              <tr key={g._id}>
                <td className="border p-2">{g.guestName}</td>
                <td className="border p-2">{g.propertyId?.name}</td>
                <td className="border p-2">{g.roomId?.roomNo || "-"}</td>
                <td className="border p-2">
                  {new Date(g.checkInDate).toDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
