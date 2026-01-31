/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import Papa from "papaparse";

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
  reservationId: string;
  propertyId?: Property;
  unitType?: string;
  amount: number;
  expectedPayment?: number;
  platform: string;
}

interface CsvRow {
  reference: string;
  guest: string;
  net: number;
}

type Status =
  | "OK"
  | "MISSING_IN_DB"
  | "MISSING_IN_CSV"
  | "AMOUNT_MISMATCH"
  | "DUPLICATE_DB_REFERENCE"
  | "MULTI_PROPERTY_REFERENCE";

interface ReconciliationRow {
  property: string;
  reference: string;
  csvGuest?: string;
  dbGuests: string[];
  dbUnitTypes?: string[];
  dbRecords?: Booking[];
  csvNet?: number;
  dbTotal?: number;
  dbCount: number;
  status: Status;
}

/* ======================================================
   HELPERS
====================================================== */

const fetchJSON = (url: string) => fetch(url).then((r) => r.json());

const money = (v?: number) =>
  v !== undefined
    ? v.toLocaleString(undefined, { minimumFractionDigits: 2 })
    : "—";

const statusStyle = (s: Status) => {
  switch (s) {
    case "OK":
      return "bg-green-50 text-green-700";
    case "AMOUNT_MISMATCH":
      return "bg-yellow-50 text-yellow-700";
    case "DUPLICATE_DB_REFERENCE":
      return "bg-orange-50 text-orange-700";
    case "MULTI_PROPERTY_REFERENCE":
      return "bg-red-100 text-red-800 font-semibold";
    default:
      return "bg-red-50 text-red-700";
  }
};

/* ✅ ONLY NEW HELPER */
const getUnitGroup = (unitTypes?: string[]) => {
  if (!unitTypes || unitTypes.length === 0) return "Other";

  return unitTypes.some((u) => u.toLowerCase().includes("single"))
    ? "Single"
    : "Other";
};

/* ======================================================
   PAGE
====================================================== */

export default function BookingComCheckPage() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);

  const { data: allBookings = [], isLoading } = useQuery<Booking[]>({
    queryKey: ["bookings", start, end],
    enabled: !!start && !!end,
    queryFn: () =>
      fetchJSON(`/api/by-checkout-range?start=${start}&end=${end}`),
  });

  const dbBookings = useMemo(
    () => allBookings.filter((b) => b.platform === "Booking.com"),
    [allBookings],
  );

  const handleCsvUpload = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const rows: CsvRow[] = [];

        for (const r of res.data as any[]) {
          if (!r["Reference number"]) continue;

          rows.push({
            reference: String(r["Reference number"]).trim(),
            guest: r["Guest name"] || r["Guest(s) name"] || "",
            net: Number(r["Net"]),
          });
        }

        setCsvRows(rows);
      },
    });
  };

  const rows = useMemo<ReconciliationRow[]>(() => {
    const output: ReconciliationRow[] = [];
    const usedDbIds = new Set<string>();

    for (const csv of csvRows) {
      const matched = dbBookings.filter((b) =>
        b.reservationId?.includes(csv.reference),
      );

      if (matched.length === 0) {
        output.push({
          property: "Unmatched CSV",
          reference: csv.reference,
          csvGuest: csv.guest,
          csvNet: csv.net,
          dbGuests: [],
          dbCount: 0,
          status: "MISSING_IN_DB",
        });
        continue;
      }

      matched.forEach((b) => usedDbIds.add(b._id));

      const properties = new Set(
        matched.map((b) => b.propertyId?.name || "Unknown Property"),
      );

      const dbTotal = matched.reduce(
        (s, b) => s + (b.expectedPayment ?? b.amount),
        0,
      );

      let status: Status = "OK";

      if (properties.size > 1) status = "MULTI_PROPERTY_REFERENCE";
      else if (matched.length > 1) status = "DUPLICATE_DB_REFERENCE";
      else if (Math.abs(dbTotal - csv.net) > 0.01) status = "AMOUNT_MISMATCH";

      output.push({
        property:
          properties.size === 1 ? [...properties][0] : "⚠ Cross-Property Issue",
        reference: csv.reference,
        csvGuest: csv.guest,
        csvNet: csv.net,
        dbGuests: matched.map((m) => m.guestName),
        dbUnitTypes: matched.map((m) => m.unitType || "—"),
        dbRecords: matched,
        dbTotal,
        dbCount: matched.length,
        status,
      });
    }

    for (const b of dbBookings) {
      if (!usedDbIds.has(b._id)) {
        output.push({
          property: b.propertyId?.name || "Unknown Property",
          reference: b.reservationId,
          dbGuests: [b.guestName],
          dbUnitTypes: [b.unitType || "—"],
          dbRecords: [b],
          dbTotal: b.expectedPayment ?? b.amount,
          dbCount: 1,
          status: "MISSING_IN_CSV",
        });
      }
    }

    return output;
  }, [csvRows, dbBookings]);

  /* ===============================
     GROUP BY PROPERTY + UNIT (Single / Other)
  =============================== */
  const grouped = useMemo(() => {
    const map: Record<
      string,
      {
        rows: ReconciliationRow[];
        safeTotal: number;
        csvTotal: number;
        dbTotal: number;
      }
    > = {};

    for (const r of rows) {
      const unitGroup = getUnitGroup(r.dbUnitTypes);
      const key = `${r.property} • ${unitGroup}`;

      if (!map[key])
        map[key] = {
          rows: [],
          safeTotal: 0,
          csvTotal: 0,
          dbTotal: 0,
        };

      map[key].rows.push(r);

      map[key].csvTotal += r.csvNet || 0;
      map[key].dbTotal += r.dbTotal || 0;

      if (r.status === "OK") map[key].safeTotal += r.csvNet || 0;
    }

    return map;
  }, [rows]);

  /* ===============================
     UI (UNCHANGED)
  =============================== */

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold">
          Booking.com – Professional Reconciliation
        </h1>

        {isLoading && <p>Loading Booking.com data…</p>}

        {Object.entries(grouped).map(([property, g]) => (
          <div key={property} className="bg-white rounded-xl border p-6">
            <div className="flex justify-between mb-3">
              <h2 className="text-xl font-semibold">{property}</h2>
              <span className="font-bold">
                ✅ Safe Total: {money(g.safeTotal)}
              </span>
            </div>

            <table className="w-full text-sm border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-2">Reference</th>
                  <th className="border px-2">CSV Guest</th>
                  <th className="border px-2">DB Guest(s)</th>
                  <th className="border px-2">Unit Type</th>
                  <th className="border px-2 text-right">CSV Net</th>
                  <th className="border px-2 text-right">DB Total</th>
                  <th className="border px-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r, i) => (
                  <tr key={i} className={statusStyle(r.status)}>
                    <td className="border px-2">{r.reference}</td>
                    <td className="border px-2">{r.csvGuest || "—"}</td>
                    <td className="border px-2">{r.dbGuests.join(", ")}</td>
                    <td className="border px-2">
                      {r.dbUnitTypes?.join(", ") || "—"}
                    </td>
                    <td className="border px-2 text-right">
                      {money(r.csvNet)}
                    </td>
                    <td className="border px-2 text-right">
                      {money(r.dbTotal)}
                    </td>
                    <td className="border px-2 text-center">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
