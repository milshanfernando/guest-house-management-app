"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Bed, Home, Wallet, X } from "lucide-react";

const menu = [
  { name: "Bookings", href: "/bookings", icon: ClipboardList },
  { name: "Bulk Bookings", href: "/bulk-bookings", icon: ClipboardList },
  { name: "Rooms", href: "/rooms", icon: Bed },
  { name: "Room Occupancy", href: "/room-occupancy", icon: Home },
  { name: "Daily Income", href: "/incomes", icon: Wallet },
];

export default function Sidebar({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed md:relative z-40 w-72 bg-white h-full border-r shadow-sm transition-transform duration-300
        ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b">
          <h1 className="font-semibold text-lg tracking-tight">
            🏨 Guest House
          </h1>
          <button
            className="md:hidden p-2 rounded hover:bg-gray-100"
            onClick={() => setOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        {/* Menu */}
        <nav className="p-4 space-y-1">
          {menu.map(({ name, href, icon: Icon }) => {
            const active = pathname === href;

            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all
                ${
                  active
                    ? "bg-slate-900 text-white shadow"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <Icon size={18} />
                {name}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
