'use client'

import { Printer } from 'lucide-react'
import Button from '@/components/ui/Button'

export default function PrintButton() {
  return (
    <Button size="sm" icon={<Printer size={15} />} onClick={() => window.print()}>
      Print / Save PDF
    </Button>
  )
}
