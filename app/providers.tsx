'use client'

import { SessionProvider } from 'next-auth/react'
import { PaidTermsGate } from '@/components/legal/PaidTermsGate'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <PaidTermsGate />
    </SessionProvider>
  )
}
