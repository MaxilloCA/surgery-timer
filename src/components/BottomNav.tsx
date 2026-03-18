"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Timer, History, BarChart2 } from "lucide-react";

const navItems = [
  { href: "/", label: "Timer", icon: Timer, id: "nav-timer" },
  { href: "/history", label: "History", icon: History, id: "nav-history" },
  { href: "/analytics", label: "Analytics", icon: BarChart2, id: "nav-analytics" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav fixed bottom-0 left-0 right-0 z-50 bg-bg-secondary border-t border-border">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-4">
        {navItems.map(({ href, label, icon: Icon, id }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              id={id}
              className={`flex flex-col items-center gap-1 flex-1 py-2 transition-colors duration-200 rounded-xl mx-1 ${
                active
                  ? "text-accent-teal"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              <Icon
                size={22}
                strokeWidth={active ? 2.5 : 1.8}
                className={active ? "drop-shadow-[0_0_6px_rgba(0,212,184,0.7)]" : ""}
              />
              <span className={`text-xs font-medium ${active ? "text-accent-teal" : ""}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
