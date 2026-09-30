'use client';
// Unknown addresses go home, as the old app did.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter();
  useEffect(() => { router.replace('/'); }, [router]);
  return null;
}
