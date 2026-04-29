'use client';

import { Settings } from 'lucide-react';

export default function ConfiguracionPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Configuración</h1>
        <p className="text-slate-500 text-sm mt-1">Ajustes generales de la plataforma</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
        <Settings className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-400">Próximamente: configuración de la plataforma.</p>
      </div>
    </div>
  );
}
