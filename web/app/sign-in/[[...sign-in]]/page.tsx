import { SignIn } from '@clerk/nextjs';
import Image from 'next/image';

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-6">
      <Image src="/logo-full.jpg" alt="VeloClub" width={140} height={42} className="object-contain" />
      <SignIn
        appearance={{
          elements: {
            footer: 'hidden',
            card: 'shadow-md rounded-2xl border border-slate-200',
            headerTitle: 'hidden',
            headerSubtitle: 'hidden',
          },
        }}
      />
    </div>
  );
}
