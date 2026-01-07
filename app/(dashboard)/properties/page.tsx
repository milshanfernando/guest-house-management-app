"use client";
import { useEffect, useState } from "react";

interface Property {
  _id: string;
  name: string;
}

export default function PropertiesPage() {
  const [name, setName] = useState("");
  const [properties, setProperties] = useState<Property[]>([]);

  useEffect(() => {
    fetch("/api/properties")
      .then((res) => res.json())
      .then(setProperties);
  }, []);

  const addProperty = async () => {
    await fetch("/api/properties", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    setName("");
    location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-1 sm:p-6 lg:p-8">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6">🏢 Properties</h1>

      {/* Add Property Card */}
      <div className="bg-white rounded-xl shadow p-4 sm:p-6 mb-8 max-w-xl">
        <h2 className="text-lg font-semibold mb-4">➕ Add Property</h2>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            className="border rounded-lg p-3 w-full focus:outline-none focus:ring-2 focus:ring-black"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Property name"
          />

          <button
            className="bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition w-full sm:w-auto"
            onClick={addProperty}
          >
            Add
          </button>
        </div>
      </div>

      {/* Property List */}
      <div>
        <h2 className="text-xl font-semibold mb-4">📋 Property List</h2>

        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map((p, index) => (
            <li
              key={p._id}
              className="bg-white rounded-xl shadow p-4 hover:shadow-lg transition"
            >
              <div className="flex justify-between items-center">
                <span className="font-semibold text-lg">🏨 {p.name}</span>
                <span className="text-xs text-gray-400">#{index + 1}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
