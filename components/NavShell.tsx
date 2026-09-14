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
      <header className="border-b border-line bg-paper-surface sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Link href="/conferences" className="flex items-center gap-2 shrink-0">
            <span className="w-6 h-6 rounded-full bg-gradient-to-br from-gold to-teal inline-block" aria-hidden />
            <span className="font-serif font-semibold text-[15px] tracking-tight">
              Grain <span className="text-ink-faint font-sans font-normal text-[12px]">Conference Intel</span>
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map(({ href, full, Icon }) => {
              const active = pathname?.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13.5px] transition-colors ${
                    active ? "bg-ink text-white" : "text-ink-dim hover:bg-paper-alt"
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

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-paper-surface border-t border-line grid grid-cols-6">
        {NAV.map(({ href, label, Icon }) => {
          const active = pathname?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] ${
                active ? "text-teal" : "text-ink-faint"
              }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
