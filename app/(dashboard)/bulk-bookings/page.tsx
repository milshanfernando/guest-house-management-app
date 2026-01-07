/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

/* ================= TYPES ================= */

interface Property {
  _id: string;
  name: string;
}

interface ImportedBooking {
  rowId: string;
  reservationId: string;
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
  unitType: string;
  propertyId: string;
  paymentMethod: "online" | "bank" | "cash";
  status?: "pending" | "saved";
}

/* ================= API ================= */

const fetchJSON = (url: string) => fetch(url).then((r) => r.json());

/* ================= PAGE ================= */

export default function BulkBookingPage() {
  const qc = useQueryClient();
  const [rows, setRows] = useState<ImportedBooking[]>([]);

  /* ================= QUERIES ================= */

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ["properties"],
    queryFn: () => fetchJSON("/api/properties"),
  });

  /* ================= EXCEL UPLOAD ================= */

  const handleExcelUpload = (file: File) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const data = e.target?.result;
      if (!data) return;

      const workbook = XLSX.read(data, { type: "binary" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<any>(sheet);

      const parsed: ImportedBooking[] = json.map((r) => ({
        rowId: crypto.randomUUID(),
        reservationId: String(r["Book number"] || ""),
        guestName: r["Guest name"] || r["Booked by"] || "Unknown",
        checkInDate: r["Check-in"] || "",
        checkOutDate: r["Check-out"] || "",
        unitType: r["Unit type"] || "",
        propertyId: "",
        paymentMethod: "online",
        status: "pending",
      }));

      setRows(parsed);
    };

    reader.readAsBinaryString(file);
  };

  /* ================= SAVE MUTATION ================= */

  const saveBooking = useMutation({
    mutationFn: async (row: ImportedBooking) => {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationId: row.reservationId,
          guestName: row.guestName,
          phone: "",
          email: "",
          checkInDate: row.checkInDate,
          checkOutDate: row.checkOutDate,
          unitType: row.unitType,
          propertyId: row.propertyId,
          paymentMethod: row.paymentMethod,
          amount: 0,
          paymentDate: "",
          platform: "Booking.com",
          status: "booked",
        }),
      });

      if (!res.ok) throw new Error("Failed to save booking");
      return res.json();
    },
    onSuccess: (_, row) => {
      setRows((prev) =>
        prev.map((r) => (r.rowId === row.rowId ? { ...r, status: "saved" } : r))
      );
      qc.invalidateQueries({ queryKey: ["occupancies"] });
    },
  });

  /* ================= UI ================= */

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8">
      <h1 className="text-2xl font-bold mb-6">📥 Bulk Booking Import</h1>

      <div className="bg-white rounded-xl shadow p-4 mb-6">
        <h2 className="text-xl font-semibold mb-3">Booking.com</h2>

        <input
          type="file"
          accept=".xls,.xlsx"
          onChange={(e) =>
            e.target.files && handleExcelUpload(e.target.files[0])
          }
        />
      </div>

      {rows.length === 0 && (
        <p className="text-gray-500">Upload a Booking.com Excel file</p>
      )}

      {/* ================= CARD GRID ================= */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <div
            key={r.rowId}
            className={`rounded-xl border p-4 shadow-sm transition
              ${
                r.status === "saved"
                  ? "bg-green-50 border-green-300"
                  : "bg-white"
              }
            `}
          >
            {/* Header */}
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-sm text-gray-500">Book Number</p>
                <p className="font-semibold">{r.reservationId}</p>
              </div>

              {r.status === "saved" && (
                <span className="text-xs bg-green-600 text-white px-2 py-1 rounded">
                  Saved
                </span>
              )}
            </div>

            {/* Info */}
            <div className="text-sm space-y-1 mb-3">
              <p>
                <span className="text-gray-500">Guest:</span>{" "}
                <b>{r.guestName}</b>
              </p>
              <p>
                <span className="text-gray-500">Dates:</span> {r.checkInDate} →{" "}
                {r.checkOutDate}
              </p>
              <p>
                <span className="text-gray-500">Unit:</span> {r.unitType}
              </p>
            </div>

            {/* Controls */}
            {r.status !== "saved" && (
              <>
                <select
                  className="border rounded p-2 w-full mb-2"
                  value={r.propertyId}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((x) =>
                        x.rowId === r.rowId
                          ? { ...x, propertyId: e.target.value }
                          : x
                      )
                    )
                  }
                >
                  <option value="">Select Property</option>
                  {properties.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                <select
                  className="border rounded p-2 w-full mb-3"
                  value={r.paymentMethod}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((x) =>
                        x.rowId === r.rowId
                          ? {
                              ...x,
                              paymentMethod: e.target
                                .value as ImportedBooking["paymentMethod"],
                            }
                          : x
                      )
                    )
                  }
                >
                  <option value="online">Online</option>
                  <option value="bank">Bank</option>
                  <option value="cash">Cash</option>
                </select>

                <button
                  disabled={!r.propertyId}
                  onClick={() => saveBooking.mutate(r)}
                  className="w-full bg-black text-white py-2 rounded disabled:opacity-50"
                >
                  Save Booking
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
