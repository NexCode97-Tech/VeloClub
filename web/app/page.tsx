import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 bg-slate-50">
      <h1 className="text-5xl font-bold">VeloClub</h1>
      <p className="text-lg text-slate-600">La plataforma de tu club de patinaje</p>
      <div className="flex gap-3">
        <Link href="/sign-in"><Button size="lg">Iniciar sesión</Button></Link>
        <Link href="/sign-up"><Button size="lg" variant="outline">Crear cuenta</Button></Link>
        <Link href="/dashboard"><Button size="lg" variant="ghost">Ir al dashboard</Button></Link>
      </div>
    </main>
  );
}
