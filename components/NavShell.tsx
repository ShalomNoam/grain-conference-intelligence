"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconList, IconCalendar, IconBolt, IconUsers, IconCalc, IconGear } from "./icons";

const NAV = [
  { href: "/conferences", label: "Score", full: "Conferences", Icon: IconList },
  { href: "/planning", label: "Plan", full: "Planning", Icon: IconCalendar },
  { href: "/capture", label: "Capture", full: "Capture Lead", Icon: IconBolt },
  { href: "/contacts", label: "Contacts", full: "Contacts", Icon: IconUsers },
  { href: "/calculator", label: "Calc", full: "FX Calculator", Icon: IconCalc },
  { href: "/settings", label: "Settings", full: "Settings", Icon: IconGear },
];

export default function NavShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="backdrop-blur-md bg-white/80 border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Link href="/conferences" className="flex items-center gap-2 shrink-0">
            <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#3B82F6] to-[#1E255E] inline-block" aria-hidden />
            <span className="font-semibold text-[15px] tracking-tight text-ink">
              grain <span className="text-ink-faint font-normal text-[12px]">Conference Intel</span>
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map(({ href, full, Icon }) => {
              const active = pathname?.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13.5px] font-medium transition-all ${
                    active ? "bg-[#111827] text-white shadow-sm" : "text-ink-dim hover:bg-blue-50/60 hover:text-[#2563EB]"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {full}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 pb-24 md:pb-10">{children}</main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 backdrop-blur-md bg-white/85 border-t border-slate-100 grid grid-cols-6">
        {NAV.map(({ href, label, Icon }) => {
          const active = pathname?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium ${
                active ? "text-[#2563EB]" : "text-ink-faint"
              }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="hidden md:flex fixed bottom-4 right-4 z-40 bg-[#111827] text-white text-xs font-medium px-4 py-2.5 rounded-full shadow-lg items-center gap-2 hover:bg-[#1E293B] transition-colors cursor-default">
        <span className="w-1.5 h-1.5 rounded-full bg-[#60A5FA]" aria-hidden />
        Grain Sales Team
      </div>
    </div>
  );
}
