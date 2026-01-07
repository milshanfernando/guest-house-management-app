/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

/* ================= TYPES ================= */

interface Property {
  _id: string;
  name: string;
}

interface IncomeTotals {
  booking: number;
  agoda: number;
  airbnb: number;
  expedia: number;
  directBank: number;
  directCash: number;
  netTotal: number;
}

interface IncomeResponse {
  totals: IncomeTotals;
  records: any[];
}

/* ================= API ================= */

const fetchJSON = (url: string) => fetch(url).then((r) => r.json());

/* ================= PAGE ================= */

export default function DailyIncomePage() {
  const [type, setType] = useState<"daily" | "monthly" | "range">("daily");
  const [date, setDate] = useState("");
  const [month, setMonth] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [platform, setPlatform] = useState("");

  const inputClass =
    "border rounded p-2 h-10 bg-white text-gray-900 w-full appearance-none";

  /* ================= QUERIES ================= */

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ["properties"],
    queryFn: () => fetchJSON("/api/properties"),
  });

  const { data, isLoading } = useQuery<IncomeResponse>({
    queryKey: ["income", type, date, month, from, to, propertyId, platform],
    queryFn: () =>
      fetchJSON(
        `/api/income?type=${type}&date=${date}&month=${month}&from=${from}&to=${to}&propertyId=${propertyId}&platform=${platform}`
      ),
    enabled:
      (type === "daily" && !!date) ||
      (type === "monthly" && !!month) ||
      (type === "range" && !!from && !!to),
  });

  /* ================= UI ================= */

  return (
    <div className="min-h-screen bg-gray-100 p-1 sm:p-6 lg:p-8">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6">💰 Income Report</h1>

      {/* ================= FILTERS ================= */}
      <div className="bg-white rounded-xl shadow p-4 sm:p-6 mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <select
          className={inputClass}
          value={type}
          onChange={(e) => setType(e.target.value as any)}
        >
          <option value="daily">Daily</option>
          <option value="monthly">Monthly</option>
          <option value="range">Date Range</option>
        </select>

        {type === "daily" && (
          <input
            type="date"
            className={inputClass}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        )}

        {type === "monthly" && (
          <input
            type="month"
            className={inputClass}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        )}

        {type === "range" && (
          <>
            <input
              type="date"
              className={inputClass}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <input
              type="date"
              className={inputClass}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </>
        )}

        <select
          className={inputClass}
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
        >
          <option value="">All Properties</option>
          {properties.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          className={inputClass}
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
        >
          <option value="">All Platforms</option>
          <option>Booking.com</option>
          <option>Agoda</option>
          <option>Airbnb</option>
          <option>Expedia</option>
          <option>Direct</option>
        </select>
      </div>

      {isLoading && <p className="text-gray-500">Loading income report...</p>}

      {/* ================= TOTAL CARDS ================= */}
      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <IncomeCard title="Booking.com" value={data.totals.booking} />
            <IncomeCard title="Agoda" value={data.totals.agoda} />
            <IncomeCard title="Airbnb" value={data.totals.airbnb} />
            <IncomeCard title="Expedia" value={data.totals.expedia} />
            <IncomeCard title="Direct Bank" value={data.totals.directBank} />
            <IncomeCard title="Direct Cash" value={data.totals.directCash} />
            <IncomeCard
              title="Net Total"
              value={data.totals.netTotal}
              highlight
            />
          </div>

          {/* ================= MOBILE ================= */}
          <div className="space-y-3 sm:hidden">
            {data.records.map((r) => (
              <div key={r._id} className="bg-white rounded-xl shadow p-4">
                <p className="font-semibold">{r.guestName}</p>
                <p className="text-sm text-gray-600">{r.propertyId?.name}</p>
                <div className="flex justify-between mt-2 text-sm">
                  <Badge text={r.platform} />
                  <span>{r.amount}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {r.paymentMethod} • {r.paymentDate?.slice(0, 10)}
                </p>
              </div>
            ))}
          </div>

          {/* ================= DESKTOP TABLE ================= */}
          <div className="hidden sm:block bg-white rounded-xl shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <Th>Guest</Th>
                  <Th>Property</Th>
                  <Th>Platform</Th>
                  <Th>Payment</Th>
                  <Th>Date</Th>
                  <Th>Amount</Th>
                </tr>
              </thead>
              <tbody>
                {data.records.map((r) => (
                  <tr key={r._id} className="border-t">
                    <Td>{r.guestName}</Td>
                    <Td>{r.propertyId?.name}</Td>
                    <Td>
                      <Badge text={r.platform} />
                    </Td>
                    <Td>{r.paymentMethod}</Td>
                    <Td>{r.paymentDate?.slice(0, 10)}</Td>
                    <Td>{r.amount}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/* ================= COMPONENTS ================= */

function IncomeCard({
  title,
  value,
  highlight,
}: {
  title: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-4 shadow ${
        highlight ? "bg-black text-white" : "bg-white"
      }`}
    >
      <p className="text-sm opacity-70">{title}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left p-3 text-sm">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="p-3 text-sm">{children}</td>;
}

function Badge({ text }: { text: string }) {
  return (
    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
      {text}
    </span>
  );
}
