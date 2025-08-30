// 'use client';   <-- remove this; make it a server layout

import type { ReactNode } from 'react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  // Providers are already applied at the root layout.
  return children;
}
