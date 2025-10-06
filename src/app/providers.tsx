'use client';

import { ClerkProvider } from '@clerk/nextjs';
import type { ReactNode } from 'react';
import { ModalProvider } from './shared/ModalContext';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <ModalProvider>
        {children}
      </ModalProvider>
    </ClerkProvider>
  );
}
