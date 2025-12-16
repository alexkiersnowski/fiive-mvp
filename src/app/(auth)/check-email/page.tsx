import type { Metadata } from 'next';
import { Suspense } from "react"
import CheckEmailContent from './CheckEmailContent'

export const metadata: Metadata = {
  title: 'Fiive | Check Email',
};

export default function CheckEmailPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CheckEmailContent />
    </Suspense>
  )
}
