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

interface Booking {
  _id: string;
  reservationId: string;
}

interface ImportedBooking {
  rowId: string;
  reservationId: string;
  guestName: string;
  checkInDate: Date;
  checkOutDate: Date;
  unitType: string;
  platform: string;
  propertyId: string;

  paymentMethod: "online" | "bank" | "cash";
  expectedPayment: number;

  status: "pending" | "saved" | "error" | "exists";
  errorMessage?: string;
  existingBookingId?: string;
}

/* ================= HELPERS ================= */

const parseDMY = (value: string): Date => {
  if (!value) return new Date();
  const [d, m, y] = value.replace(/=/g, "").replace(/"/g, "").split("/");
  return new Date(`${y}-${m}-${d}`);
};

/* ✅ ADDED — safe number parser */
const toNumber = (val: any): number => {
  if (!val) return 0;
  return Number(String(val).replace(/[^0-9.-]+/g, "")) || 0;
};

const fetchJSON = (url: string) => fetch(url).then((r) => r.json());

/* ================= PAGE ================= */

export default function BulkBookingCSVPage() {
  const qc = useQueryClient();

  const [rows, setRows] = useState<ImportedBooking[]>([]);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [bulkProperty, setBulkProperty] = useState("");

  /* ================= PROPERTIES ================= */

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ["properties"],
    queryFn: () => fetchJSON("/api/properties"),
  });

  const propertyMap = Object.fromEntries(
    properties.map((p) => [p._id, p.name])
  );

  const getPropertyIdByName = (keyword: string) =>
    properties.find((p) => p.name.toLowerCase().includes(keyword.toLowerCase()))
      ?._id || "";

  /* ================= EXISTING BOOKINGS ================= */

  const { data: bookings = [], isLoading } = useQuery<Booking[]>({
    queryKey: ["bookings-range", start, end],
    queryFn: () =>
      fetchJSON(`/api/bookingsfordaterange?start=${start}&end=${end}`),
    enabled: !!start && !!end,
  });

  const checkExistingRecords = () => {
    const map = new Map(
      bookings.map((b) => [String(b.reservationId).trim(), b])
    );

    setRows((prev) =>
      prev.map((r) => {
        const match = map.get(r.reservationId);
        if (!match) return r;

        return {
          ...r,
          status: "exists",
          existingBookingId: match._id,
        };
      })
    );
  };

  /* ================= CSV UPLOAD ================= */

  const handleCSVUpload = (file: File) => {
    const reader = new FileReader();

    reader.onload = () => {
      const wb = XLSX.read(reader.result, { type: "string" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<any>(sheet, { defval: "" });

      const imported: ImportedBooking[] = json
        .filter((r) => r["Status"] === "Active")
        .map((r) => {
          /* ✅ FIXED LOGIC ONLY */
          const deposit = toNumber(r["Deposit"]);
          const commission = toNumber(r["Commission"]);
          const channel = toNumber(r["channel"]);

          return {
            rowId: crypto.randomUUID(),
            reservationId: String(r["Voucher"] || "").trim(),
            guestName: String(r["Guest Name"] || "Unknown"),
            checkInDate: parseDMY(String(r["Arrival"])),
            checkOutDate: parseDMY(String(r["Dept"])),
            unitType: String(r["Room"] || ""),
            platform: String(r["Source"] || "Booking.com"),
            propertyId: "",
            paymentMethod: "online",

            /* ✅ CORRECT EXPECTED PAYMENT */
            expectedPayment: deposit - commission - channel,

            status: "pending",
          };
        });

      setRows(imported);
    };

    reader.readAsText(file);
  };

  /* ================= SAVE ================= */

  const saveBooking = useMutation({
    mutationFn: async (row: ImportedBooking) => {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationId: row.reservationId,
          guestName: row.guestName,
          checkInDate: row.checkInDate,
          checkOutDate: row.checkOutDate,
          unitType: row.unitType,
          propertyId: row.propertyId,
          platform: row.platform,
          paymentMethod: row.paymentMethod,
          amount: 0,
          expectedPayment: row.expectedPayment,
          status: "booked",
        }),
      });

      if (!res.ok) throw new Error("Save failed");
    },
    onSuccess: (_, row) => {
      setRows((prev) =>
        prev.map((r) => (r.rowId === row.rowId ? { ...r, status: "saved" } : r))
      );
      qc.invalidateQueries();
    },
    onError: (err: any, row) => {
      setRows((prev) =>
        prev.map((r) =>
          r.rowId === row.rowId
            ? { ...r, status: "error", errorMessage: err.message }
            : r
        )
      );
    },
  });

  /* ================= BULK ACTIONS ================= */

  const applyPropertyToAll = () => {
    if (!bulkProperty) return;

    setRows((prev) =>
      prev.map((r) =>
        r.status === "pending" ? { ...r, propertyId: bulkProperty } : r
      )
    );
  };

  const autoAssignByRoom = () => {
    const p401 = getPropertyIdByName("401");
    const p302 = getPropertyIdByName("302");

    if (!p401 || !p302) {
      alert("Property mapping failed. Check property names.");
      return;
    }

    setRows((prev) =>
      prev.map((r) => {
        if (r.status !== "pending") return r;
        if (r.unitType.toLowerCase().includes("deluxe"))
          return { ...r, propertyId: p401 };
        return { ...r, propertyId: p302 };
      })
    );
  };

  /* ================= UI ================= */

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-2xl font-bold mb-6">📥 Booking CSV Import</h1>

      {/* CHECK EXISTING */}
      <div className="bg-white p-4 rounded-xl shadow mb-6">
        <h2 className="font-semibold mb-3">🔍 Check Existing Bookings</h2>
        <div className="flex gap-3 flex-wrap items-end">
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="border rounded p-2"
          />
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="border rounded p-2"
          />
          <button
            disabled={!start || !end || isLoading}
            onClick={checkExistingRecords}
            className="bg-black text-white px-4 py-2 rounded disabled:opacity-40"
          >
            {isLoading ? "Checking..." : "Check Existing"}
          </button>
        </div>
      </div>

      {/* BULK CONTROLS */}
      <div className="bg-white p-4 rounded-xl shadow mb-6 flex gap-3 flex-wrap">
        <select
          value={bulkProperty}
          onChange={(e) => setBulkProperty(e.target.value)}
          className="border rounded p-2"
        >
          <option value="">Select property for ALL</option>
          {properties.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </select>

        <button
          onClick={applyPropertyToAll}
          className="bg-black text-white px-4 py-2 rounded"
        >
          Apply to all
        </button>

        <button onClick={autoAssignByRoom} className="border px-4 py-2 rounded">
          Auto assign by room
        </button>
      </div>

      {/* UPLOAD */}
      <div className="bg-white p-4 rounded-xl shadow mb-6">
        <input
          type="file"
          accept=".csv"
          onChange={(e) => e.target.files && handleCSVUpload(e.target.files[0])}
        />
      </div>

      {/* CARDS */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <div
            key={r.rowId}
            className={`border rounded-xl p-4 shadow-sm ${
              r.status === "saved"
                ? "bg-green-50"
                : r.status === "exists"
                ? "bg-yellow-50"
                : r.status === "error"
                ? "bg-red-50"
                : "bg-white"
            }`}
          >
            <p className="font-semibold">{r.reservationId}</p>
            <p>{r.guestName}</p>
            <p className="text-sm">
              {r.checkInDate.toLocaleDateString()} →{" "}
              {r.checkOutDate.toLocaleDateString()}
            </p>
            <p className="text-sm">Room: {r.unitType}</p>
            <p className="text-sm font-semibold">
              Expected: {r.expectedPayment}
            </p>

            {r.status === "exists" && (
              <p className="text-yellow-700">⚠ Already exists</p>
            )}
            {r.status === "saved" && (
              <p className="text-green-700">
                ✔ Saved — {propertyMap[r.propertyId]}
              </p>
            )}
            {r.status === "error" && (
              <p className="text-red-600">{r.errorMessage}</p>
            )}

            {r.status === "pending" && (
              <>
                <select
                  className="border rounded p-2 w-full my-2"
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

                <button
                  disabled={!r.propertyId}
                  onClick={() => saveBooking.mutate(r)}
                  className="w-full bg-black text-white py-2 rounded"
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

// /* eslint-disable @typescript-eslint/no-explicit-any */
// "use client";

// import { useState } from "react";
// import * as XLSX from "xlsx";
// import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// /* ================= TYPES ================= */

// interface Property {
//   _id: string;
//   name: string;
// }

// interface Booking {
//   _id: string;
//   reservationId: string;
// }

// interface ImportedBooking {
//   rowId: string;
//   reservationId: string;
//   guestName: string;
//   checkInDate: Date;
//   checkOutDate: Date;
//   unitType: string;
//   platform: string;
//   propertyId: string;

//   paymentMethod: "online" | "bank" | "cash";
//   expectedPayment: number;

//   status: "pending" | "saved" | "error" | "exists";
//   errorMessage?: string;
//   existingBookingId?: string;
// }

// /* ================= HELPERS ================= */

// const parseDMY = (value: string): Date => {
//   if (!value) return new Date();
//   const [d, m, y] = value.split("/");
//   return new Date(`${y}-${m}-${d}`);
// };

// const fetchJSON = (url: string) => fetch(url).then((r) => r.json());

// /* ================= PAGE ================= */

// export default function BulkBookingCSVPage() {
//   const qc = useQueryClient();

//   const [rows, setRows] = useState<ImportedBooking[]>([]);
//   const [start, setStart] = useState("");
//   const [end, setEnd] = useState("");
//   const [bulkProperty, setBulkProperty] = useState("");

//   /* ================= PROPERTIES ================= */

//   const { data: properties = [] } = useQuery<Property[]>({
//     queryKey: ["properties"],
//     queryFn: () => fetchJSON("/api/properties"),
//   });

//   const propertyMap = Object.fromEntries(
//     properties.map((p) => [p._id, p.name])
//   );

//   const getPropertyIdByName = (keyword: string) =>
//     properties.find((p) => p.name.toLowerCase().includes(keyword.toLowerCase()))
//       ?._id || "";

//   /* ================= EXISTING BOOKINGS ================= */

//   const { data: bookings = [], isLoading } = useQuery<Booking[]>({
//     queryKey: ["bookings-range", start, end],
//     queryFn: () =>
//       fetchJSON(`/api/bookingsfordaterange?start=${start}&end=${end}`),
//     enabled: !!start && !!end,
//   });

//   const checkExistingRecords = () => {
//     const map = new Map(
//       bookings.map((b) => [String(b.reservationId).trim(), b])
//     );

//     setRows((prev) =>
//       prev.map((r) => {
//         const match = map.get(r.reservationId);
//         if (!match) return r;

//         return {
//           ...r,
//           status: "exists",
//           existingBookingId: match._id,
//         };
//       })
//     );
//   };

//   /* ================= CSV UPLOAD ================= */

//   const handleCSVUpload = (file: File) => {
//     const reader = new FileReader();

//     reader.onload = () => {
//       const wb = XLSX.read(reader.result, { type: "string" });
//       const sheet = wb.Sheets[wb.SheetNames[0]];
//       const json = XLSX.utils.sheet_to_json<any>(sheet, { defval: "" });

//       const imported: ImportedBooking[] = json
//         .filter((r) => r["Status"] === "Active")
//         .map((r) => {
//           const total = Number(r["Total Charges"] || 0);
//           const commission = Number(r["Commission"] || 0);

//           return {
//             rowId: crypto.randomUUID(),
//             reservationId: String(r["Voucher"] || "").trim(),
//             guestName: String(r["Guest Name"] || "Unknown"),
//             checkInDate: parseDMY(String(r["Arrival"])),
//             checkOutDate: parseDMY(String(r["Dept"])),
//             unitType: String(r["Room"] || ""),
//             platform: String(r["Source"] || "Booking.com"),
//             propertyId: "",
//             paymentMethod: "online",
//             expectedPayment: total - commission,
//             status: "pending",
//           };
//         });

//       setRows(imported);
//     };

//     reader.readAsText(file);
//   };

//   /* ================= SAVE ================= */

//   const saveBooking = useMutation({
//     mutationFn: async (row: ImportedBooking) => {
//       const res = await fetch("/api/bookings", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           reservationId: row.reservationId,
//           guestName: row.guestName,
//           checkInDate: row.checkInDate,
//           checkOutDate: row.checkOutDate,
//           unitType: row.unitType,
//           propertyId: row.propertyId,
//           platform: row.platform,
//           paymentMethod: row.paymentMethod,
//           amount: 0,
//           expectedPayment: row.expectedPayment,
//           status: "booked",
//         }),
//       });

//       if (!res.ok) throw new Error("Save failed");
//     },
//     onSuccess: (_, row) => {
//       setRows((prev) =>
//         prev.map((r) => (r.rowId === row.rowId ? { ...r, status: "saved" } : r))
//       );
//       qc.invalidateQueries();
//     },
//     onError: (err: any, row) => {
//       setRows((prev) =>
//         prev.map((r) =>
//           r.rowId === row.rowId
//             ? { ...r, status: "error", errorMessage: err.message }
//             : r
//         )
//       );
//     },
//   });

//   /* ================= BULK ACTIONS ================= */

//   const applyPropertyToAll = () => {
//     if (!bulkProperty) return;

//     setRows((prev) =>
//       prev.map((r) =>
//         r.status === "pending" ? { ...r, propertyId: bulkProperty } : r
//       )
//     );
//   };

//   const autoAssignByRoom = () => {
//     const p401 = getPropertyIdByName("401");
//     const p302 = getPropertyIdByName("302");

//     if (!p401 || !p302) {
//       alert("Property mapping failed. Check property names.");
//       return;
//     }

//     setRows((prev) =>
//       prev.map((r) => {
//         if (r.status !== "pending") return r;
//         if (r.unitType.toLowerCase().includes("deluxe"))
//           return { ...r, propertyId: p401 };
//         return { ...r, propertyId: p302 };
//       })
//     );
//   };

//   /* ================= UI ================= */

//   return (
//     <div className="min-h-screen bg-gray-100 p-6">
//       <h1 className="text-2xl font-bold mb-6">📥 Booking CSV Import</h1>

//       {/* CHECK EXISTING */}
//       <div className="bg-white p-4 rounded-xl shadow mb-6">
//         <h2 className="font-semibold mb-3">🔍 Check Existing Bookings</h2>
//         <div className="flex gap-3 flex-wrap items-end">
//           <input
//             type="date"
//             value={start}
//             onChange={(e) => setStart(e.target.value)}
//             className="border rounded p-2"
//           />
//           <input
//             type="date"
//             value={end}
//             onChange={(e) => setEnd(e.target.value)}
//             className="border rounded p-2"
//           />
//           <button
//             disabled={!start || !end || isLoading}
//             onClick={checkExistingRecords}
//             className="bg-black text-white px-4 py-2 rounded disabled:opacity-40"
//           >
//             {isLoading ? "Checking..." : "Check Existing"}
//           </button>
//         </div>
//       </div>

//       {/* BULK CONTROLS */}
//       <div className="bg-white p-4 rounded-xl shadow mb-6 flex gap-3 flex-wrap">
//         <select
//           value={bulkProperty}
//           onChange={(e) => setBulkProperty(e.target.value)}
//           className="border rounded p-2"
//         >
//           <option value="">Select property for ALL</option>
//           {properties.map((p) => (
//             <option key={p._id} value={p._id}>
//               {p.name}
//             </option>
//           ))}
//         </select>

//         <button
//           onClick={applyPropertyToAll}
//           className="bg-black text-white px-4 py-2 rounded"
//         >
//           Apply to all
//         </button>

//         <button onClick={autoAssignByRoom} className="border px-4 py-2 rounded">
//           Auto assign by room
//         </button>
//       </div>

//       {/* UPLOAD */}
//       <div className="bg-white p-4 rounded-xl shadow mb-6">
//         <input
//           type="file"
//           accept=".csv"
//           onChange={(e) => e.target.files && handleCSVUpload(e.target.files[0])}
//         />
//       </div>

//       {/* CARDS */}
//       <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
//         {rows.map((r) => (
//           <div
//             key={r.rowId}
//             className={`border rounded-xl p-4 shadow-sm ${
//               r.status === "saved"
//                 ? "bg-green-50"
//                 : r.status === "exists"
//                 ? "bg-yellow-50"
//                 : r.status === "error"
//                 ? "bg-red-50"
//                 : "bg-white"
//             }`}
//           >
//             <p className="font-semibold">{r.reservationId}</p>
//             <p>{r.guestName}</p>
//             <p className="text-sm">
//               {r.checkInDate.toLocaleDateString()} →{" "}
//               {r.checkOutDate.toLocaleDateString()}
//             </p>
//             <p className="text-sm">Room: {r.unitType}</p>
//             <p className="text-sm font-semibold">
//               Expected: {r.expectedPayment}
//             </p>

//             {r.status === "exists" && (
//               <p className="text-yellow-700">⚠ Already exists</p>
//             )}
//             {r.status === "saved" && (
//               <p className="text-green-700">
//                 ✔ Saved — {propertyMap[r.propertyId]}
//               </p>
//             )}
//             {r.status === "error" && (
//               <p className="text-red-600">{r.errorMessage}</p>
//             )}

//             {r.status === "pending" && (
//               <>
//                 <select
//                   className="border rounded p-2 w-full my-2"
//                   value={r.propertyId}
//                   onChange={(e) =>
//                     setRows((prev) =>
//                       prev.map((x) =>
//                         x.rowId === r.rowId
//                           ? { ...x, propertyId: e.target.value }
//                           : x
//                       )
//                     )
//                   }
//                 >
//                   <option value="">Select Property</option>
//                   {properties.map((p) => (
//                     <option key={p._id} value={p._id}>
//                       {p.name}
//                     </option>
//                   ))}
//                 </select>

//                 <button
//                   disabled={!r.propertyId}
//                   onClick={() => saveBooking.mutate(r)}
//                   className="w-full bg-black text-white py-2 rounded"
//                 >
//                   Save Booking
//                 </button>
//               </>
//             )}
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// }
