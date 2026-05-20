import { SignIn } from '@clerk/nextjs';
import Image from 'next/image';

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-6">
      <Image
        src="/logo-full.jpg"
        alt="VeloClub"
        width={140}
        height={42}
        className="object-contain rounded-xl"
      />
      <div className="sign-in-wrapper">
        <SignIn
          appearance={{
            elements: {
              footer: 'hidden',
              card: 'shadow-md rounded-2xl border border-slate-200',
              headerTitle: 'hidden',
              headerSubtitle: 'hidden',
              dividerRow: 'hidden',
            },
          }}
        />
      </div>
      <style>{`
        .sign-in-wrapper .cl-socialButtonsBlock::before {
          content: 'Inicia sesión con:';
          display: block;
          text-align: center;
          font-size: 12px;
          font-weight: 600;
          color: #94a3b8;
          margin-bottom: 8px;
          font-family: var(--font-space-grotesk), sans-serif;
          letter-spacing: 0.02em;
        }
      `}</style>
    </div>
  );
}
