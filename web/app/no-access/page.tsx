'use client';

import { useClerk } from '@clerk/nextjs';
import { ShieldX } from 'lucide-react';
import Image from 'next/image';

export default function NoAccessPage() {
  const { signOut } = useClerk();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-6">
      {/* Logo */}
      <div className="mb-10">
        <Image src="/logo.png" alt="VeloClub" width={140} height={40} className="object-contain" />
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <ShieldX className="w-8 h-8 text-red-500" />
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">Acceso restringido</h1>
        <p className="text-slate-500 text-sm leading-relaxed mb-8">
          Tu correo electrónico no está registrado en ningún club de VeloClub.
          Si crees que es un error, contacta al administrador de tu club para que te agregue.
        </p>

        <button
          onClick={() => signOut({ redirectUrl: '/sign-in' })}
          className="w-full bg-slate-900 hover:bg-slate-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors cursor-pointer"
        >
          Cerrar sesión e intentar con otro correo
        </button>
      </div>

      <p className="text-xs text-slate-400 mt-6">VeloClub · Plataforma de gestión deportiva</p>
    </div>
  );
}
