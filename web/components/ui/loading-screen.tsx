import Image from 'next/image';

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white">
      <Image src="/logo.png" alt="VeloClub" width={130} height={40} className="object-contain mb-8" />
      <div className="flex gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-purple-600 animate-bounce [animation-delay:-0.3s]" />
        <span className="w-2.5 h-2.5 rounded-full bg-purple-600 animate-bounce [animation-delay:-0.15s]" />
        <span className="w-2.5 h-2.5 rounded-full bg-purple-600 animate-bounce" />
      </div>
      <p className="text-slate-400 text-sm mt-6">Verificando acceso...</p>
    </div>
  );
}
