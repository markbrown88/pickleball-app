'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type NavItem = {
  href: string;
  label: string;
  exact?: boolean;
  roles?: ('app-admin' | 'tournament-admin' | 'event-manager' | 'captain' | 'player')[];
  target?: '_blank';
};

export type UserRole = 'app-admin' | 'tournament-admin' | 'event-manager' | 'captain' | 'player';

function navLinkClasses(active: boolean) {
  return `block px-4 py-2 text-sm font-medium rounded-md transition-colors ${
    active
      ? 'text-primary bg-primary/10 border-r-2 border-primary'
      : 'text-muted border-transparent hover:text-primary hover:bg-surface-2'
  }`;
}

export function Navigation({ items, userRole, onMobileNavClose }: { items: NavItem[]; userRole: UserRole; onMobileNavClose?: () => void }) {
  const pathname = usePathname();

  // Filter items based on user role
  const visibleItems = items.filter(item => 
    !item.roles || item.roles.includes(userRole)
  );

  return (
    <nav className="py-4">
      <ul className="space-y-1">
        {visibleItems.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={navLinkClasses(active)}
                aria-current={active ? 'page' : undefined}
                target={item.target}
                onClick={onMobileNavClose}
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

export function getNavigationItems(): NavItem[] {
  return [
    { href: '/dashboard', label: 'Home', roles: ['app-admin', 'tournament-admin', 'event-manager', 'captain', 'player'] },
    { href: '/profile', label: 'Profile', roles: ['app-admin', 'tournament-admin', 'event-manager', 'captain', 'player'] },
    { href: '/tournaments', label: 'Tournaments', roles: ['app-admin', 'tournament-admin'] },
    { href: '/rosters', label: 'Rosters', roles: ['app-admin', 'tournament-admin', 'captain'] },
    { href: '/manager', label: 'Manage', roles: ['app-admin', 'event-manager'] },
    { href: '/clubs', label: 'Clubs', roles: ['app-admin', 'tournament-admin'] },
    { href: '/players', label: 'Players', roles: ['app-admin', 'tournament-admin'] },
    { href: '/dashboard/payments', label: 'Payments', roles: ['app-admin'] },
    { href: '/results', label: 'Results', roles: ['app-admin', 'tournament-admin', 'event-manager', 'captain', 'player'], target: '_blank' },
  ];
}
