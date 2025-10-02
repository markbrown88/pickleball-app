'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type PlayerNavItem = {
  href: string;
  label: string;
  exact?: boolean;
};

function navLinkClasses(active: boolean) {
  return `flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-l-2 ${
    active
      ? 'text-secondary border-secondary bg-secondary/10'
      : 'text-muted border-transparent hover:text-primary hover:bg-surface-2'
  }`;
}

export function PlayerNavigation({ items }: { items: PlayerNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="py-4">
      <ul className="space-y-1">
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={navLinkClasses(active)}
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


