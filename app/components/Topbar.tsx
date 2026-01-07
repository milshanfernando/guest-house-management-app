"use client";

import { Menu } from "lucide-react";

export default function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="h-16 bg-white border-b shadow-sm flex items-center px-4 md:px-6 gap-3">
      <button
        onClick={onMenuClick}
        className="md:hidden p-2 rounded-lg hover:bg-slate-100"
      >
        <Menu size={20} />
      </button>

      <h2 className="font-semibold text-slate-800 tracking-tight">Dashboard</h2>
    </header>
  );
}
