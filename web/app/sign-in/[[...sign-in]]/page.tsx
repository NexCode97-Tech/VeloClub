'use client';

import dynamic from 'next/dynamic';

const SignInClient = dynamic(() => import('./_signin-client'), { ssr: false });

export default function SignInPage() {
  return <SignInClient />;
}
