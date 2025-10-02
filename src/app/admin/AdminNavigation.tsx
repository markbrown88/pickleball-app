'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type AdminNavItem = {
  href: string;
  label: string;
  exact?: boolean;
};

function isActive(pathname: string, item: AdminNavItem) {
  if (item.exact) {
    return pathname === item.href;
  }
  return pathname.startsWith(item.href);
}

export function AdminNavigation({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="py-4">
      <ul className="space-y-1">
        {items.map((item) => {
          const active = isActive(pathname, item);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-l-2 ${
                  active
                    ? 'text-secondary border-secondary bg-secondary/10'
                    : 'text-muted border-transparent hover:text-primary hover:bg-surface-2'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
