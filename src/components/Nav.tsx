'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Ship, Fuel, Settings } from 'lucide-react'

const ITEMS = [
  { href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/vessels', label: 'Vessels', Icon: Ship },
  { href: '/locations', label: 'Locations', Icon: Fuel },
  { href: '/settings', label: 'Settings', Icon: Settings },
]

export default function Nav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white dark:bg-neutral-900 border-t border-gray-200 dark:border-neutral-800 flex justify-around py-2">
      {ITEMS.map(({ href, label, Icon }) => {
        const active = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-0.5 text-xs px-3 py-1 ${
              active
                ? 'text-sky-600 dark:text-sky-400'
                : 'text-gray-400 dark:text-gray-500'
            }`}
          >
            <Icon size={22} strokeWidth={1.75} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
