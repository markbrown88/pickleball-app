'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

export type NavItem = {
  href?: string;
  label: string;
  exact?: boolean;
  roles?: ('app-admin' | 'tournament-admin' | 'event-manager' | 'captain' | 'player')[];
  target?: '_blank';
  children?: NavItem[];
};

export type UserRole = 'app-admin' | 'tournament-admin' | 'event-manager' | 'captain' | 'player';

function navLinkClasses(active: boolean, isSubItem: boolean = false) {
  const baseClasses = `block text-sm font-medium rounded-md transition-colors ${
    isSubItem ? 'pl-10 pr-4 py-1.5' : 'px-4 py-2'
  }`;

  if (active) {
    return `${baseClasses} !text-primary bg-primary/10 border-r-2 border-primary`;
  }
  return `${baseClasses} !text-muted hover:!text-primary hover:bg-surface-2`;
}

function navHeadingClasses(hasActiveChild: boolean) {
  return `flex items-center justify-between px-4 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer ${
    hasActiveChild
      ? 'text-primary bg-primary/5'
      : 'text-muted hover:text-primary hover:bg-surface-2'
  }`;
}

export function Navigation({ items, userRole, onMobileNavClose }: { items: NavItem[]; userRole: UserRole; onMobileNavClose?: () => void }) {
  const pathname = usePathname();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'Tournaments': true, // Default to open
  });

  const toggleSection = (label: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [label]: !prev[label]
    }));
  };

  // Filter items based on user role
  const visibleItems = items.filter(item =>
    !item.roles || item.roles.includes(userRole)
  );

  const isChildActive = (children: NavItem[] | undefined): boolean => {
    if (!children) return false;
    return children.some(child => {
      if (child.href) {
        return child.exact ? pathname === child.href : pathname.startsWith(child.href);
      }
      return false;
    });
  };

  const hasVisibleChildren = (item: NavItem): boolean => {
    if (!item.children) return false;
    return item.children.some(child => !child.roles || child.roles.includes(userRole));
  };

  return (
    <nav className="py-4">
      <ul className="space-y-1">
        {visibleItems.map((item) => {
          // If item has children, render as expandable section
          if (item.children && hasVisibleChildren(item)) {
            const isExpanded = expandedSections[item.label] ?? false;
            const hasActiveChild = isChildActive(item.children);
            const visibleChildren = item.children.filter(child =>
              !child.roles || child.roles.includes(userRole)
            );

            return (
              <li key={item.label}>
                {/* Parent heading (not clickable) */}
                <div
                  className={navHeadingClasses(hasActiveChild)}
                  onClick={() => toggleSection(item.label)}
                >
                  <span>{item.label}</span>
                  <svg
                    className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>

                {/* Children (sub-items) */}
                {isExpanded && (
                  <ul className="mt-0.5 space-y-0.5">
                    {visibleChildren.map((child) => {
                      const active = child.href
                        ? (child.exact ? pathname === child.href : pathname.startsWith(child.href))
                        : false;

                      return (
                        <li key={child.href || child.label} className="relative group">
                          {/* Bullet indicator */}
                          <span className={`absolute left-6 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border-2 transition-colors ${
                            active
                              ? 'border-brand-secondary bg-brand-secondary/30'
                              : 'border-brand-secondary/40 group-hover:border-brand-secondary/80'
                          }`} />
                          <Link
                            href={child.href || '#'}
                            className={navLinkClasses(active, true)}
                            aria-current={active ? 'page' : undefined}
                            target={child.target}
                            onClick={onMobileNavClose}
                          >
                            {child.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          }

          // Regular item (no children)
          if (item.href) {
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
          }

          return null;
        })}
      </ul>
    </nav>
  );
}

export function getNavigationItems(): NavItem[] {
  return [
    { href: '/dashboard', label: 'Home', roles: ['app-admin', 'tournament-admin', 'event-manager', 'captain', 'player'] },
    { href: '/profile', label: 'Profile', roles: ['app-admin', 'tournament-admin', 'event-manager', 'captain', 'player'] },
    {
      label: 'Tournaments',
      roles: ['app-admin', 'tournament-admin', 'event-manager', 'captain'],
      children: [
        { href: '/tournaments', label: 'Setup', exact: true, roles: ['app-admin', 'tournament-admin'] },
        { href: '/tournaments/registrations', label: 'Registrations', roles: ['app-admin', 'tournament-admin'] },
        { href: '/rosters', label: 'Rosters', roles: ['app-admin', 'tournament-admin', 'captain'] },
        { href: '/manager', label: 'Match Control', roles: ['app-admin', 'event-manager'] },
        { href: '/dashboard/payments', label: 'Payments', roles: ['app-admin'] },
      ]
    },
    { href: '/clubs', label: 'Clubs', roles: ['app-admin', 'tournament-admin'] },
    { href: '/players', label: 'Players', roles: ['app-admin', 'tournament-admin'] },
    { href: '/results', label: 'Tournament Results', roles: ['app-admin', 'tournament-admin', 'event-manager', 'captain', 'player'], target: '_blank' },
  ];
}
