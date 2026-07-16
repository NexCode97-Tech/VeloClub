'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth, useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Headset, ArrowLeft, Check, AlertTriangle, Loader2,
  Trophy, MessageCircle,
} from 'lucide-react';
import { COLOMBIA } from '@/lib/colombia';
import { apiFetch } from '@/lib/api-client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhoneInput } from '@/components/ui/phone-input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';

const DEPORTES = [
  'Fútbol', 'Microfútbol', 'Natación', 'Atletismo', 'Ciclismo', 'Ciclomontañismo',
  'Patinaje', 'Baloncesto', 'Voleibol', 'Tenis', 'Boxeo', 'Gimnasia', 'Otro',
];

// Número de contacto del equipo VeloClub para el flujo "Contáctenos".
const WHATSAPP = '573006359008';

type NameStatus = 'idle' | 'checking' | 'ok' | 'similar' | 'taken';
type Mode = 'choice' | 'create' | 'contact' | 'contact_done';

const GRAD = 'linear-gradient(135deg, #7C3AED 0%, #4361EE 100%)';

export default function OnboardingPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('choice');

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }
  if (!isSignedIn) {
    router.push('/sign-in');
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-5 py-10">
      <div className="mb-6">
        <Image src="/logo.png" alt="VeloClub" width={80} height={80} className="object-contain" style={{ width: 56, height: 'auto' }} />
      </div>

      <div className="w-full max-w-md">
        <AnimatePresence mode="wait">
          {mode === 'choice' && (
            <motion.div key="choice" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <ChoiceScreen onCreate={() => setMode('create')} onContact={() => setMode('contact')} onSignOut={() => signOut({ redirectUrl: '/sign-in' })} />
            </motion.div>
          )}
          {mode === 'create' && (
            <motion.div key="create" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>
              <CreateClubForm getToken={getToken} onBack={() => setMode('choice')} onDone={() => router.push('/dashboard')} />
            </motion.div>
          )}
          {mode === 'contact' && (
            <motion.div key="contact" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>
              <ContactForm getToken={getToken} onBack={() => setMode('choice')} onDone={() => setMode('contact_done')} />
            </motion.div>
          )}
          {mode === 'contact_done' && (
            <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <ContactDone />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="text-xs text-slate-400 mt-6">VeloClub · Plataforma de gestión deportiva</p>
    </div>
  );
}

// ── Pantalla de elección ─────────────────────────────────────────────────────
function ChoiceScreen({ onCreate, onContact, onSignOut }: { onCreate: () => void; onContact: () => void; onSignOut: () => void }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
      <h1 className="text-[22px] font-semibold text-slate-900 text-center">Bienvenido a VeloClub</h1>
      <p className="text-slate-500 text-sm text-center mt-1.5 mb-7">¿Cómo quieres empezar?</p>

      <button onClick={onCreate}
        className="w-full text-left rounded-xl border border-slate-200 hover:border-transparent hover:shadow-md transition-all p-4 flex items-center gap-3.5 cursor-pointer group mb-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-white" style={{ background: GRAD }}>
          <Building2 className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 text-[15px]">Crear mi club</p>
          <p className="text-[12.5px] text-slate-500 leading-snug">Empieza gratis 15 días. Lo tienes listo en un minuto.</p>
        </div>
      </button>

      <button onClick={onContact}
        className="w-full text-left rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all p-4 flex items-center gap-3.5 cursor-pointer">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(67,97,238,0.10)' }}>
          <Headset className="w-5 h-5" style={{ color: '#4361EE' }} />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 text-[15px]">Contáctenos</p>
          <p className="text-[12.5px] text-slate-500 leading-snug">¿Prefieres que te ayudemos a montarlo? Escríbenos.</p>
        </div>
      </button>

      <button onClick={onSignOut} className="w-full text-center text-[12.5px] text-slate-400 hover:text-slate-600 transition-colors mt-6 cursor-pointer">
        Cerrar sesión
      </button>
    </div>
  );
}

// ── Formulario: Crear mi club ────────────────────────────────────────────────
function CreateClubForm({ getToken, onBack, onDone }: {
  getToken: () => Promise<string | null>; onBack: () => void; onDone: () => void;
}) {
  const [clubName, setClubName] = useState('');
  const [deporte, setDeporte] = useState('');
  const [department, setDepartment] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [nameStatus, setNameStatus] = useState<NameStatus>('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const departments = Object.keys(COLOMBIA).sort();
  const municipios = department ? (COLOMBIA[department] ?? []).slice().sort() : [];

  // Chequeo de disponibilidad del nombre en vivo (con debounce)
  useEffect(() => {
    if (clubName.trim().length < 2) { setNameStatus('idle'); return; }
    setNameStatus('checking');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const token = await getToken();
        const r = await apiFetch<{ status: NameStatus }>(`/clubs/name-availability?name=${encodeURIComponent(clubName.trim())}`, { token });
        setNameStatus(r.status);
      } catch { setNameStatus('idle'); }
    }, 450);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubName]);

  const canSubmit = clubName.trim().length >= 2 && !!deporte && nameStatus !== 'taken' && nameStatus !== 'checking' && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true); setError(null);
    try {
      const token = await getToken();
      await apiFetch('/clubs', {
        method: 'POST', token,
        body: JSON.stringify({
          clubName: clubName.trim(),
          deporte: deporte || undefined,
          department: department || undefined,
          city: city || undefined,
          phone: phone || undefined,
        }),
      });
      onDone();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error';
      setError(msg.includes('name_taken') ? 'Ya existe un club verificado con ese nombre. Diferéncialo con tu ciudad o un distintivo.' : msg);
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-7">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[13px] text-slate-500 hover:text-slate-700 transition-colors mb-4 cursor-pointer">
        <ArrowLeft className="w-4 h-4" /> Volver
      </button>
      <h1 className="text-[20px] font-semibold text-slate-900 mb-5">Crea tu club</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Nombre del club *</Label>
          <div className="relative">
            <Input value={clubName} onChange={e => setClubName(e.target.value)} placeholder="Ej: Club Halcones de Bogotá" minLength={2} required />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {nameStatus === 'checking' && <Loader2 className="w-4 h-4 animate-spin text-slate-300" />}
              {nameStatus === 'ok' && <Check className="w-4 h-4 text-emerald-500" />}
              {(nameStatus === 'similar' || nameStatus === 'taken') && <AlertTriangle className="w-4 h-4" style={{ color: nameStatus === 'taken' ? '#EF476F' : '#F59E0B' }} />}
            </div>
          </div>
          {nameStatus === 'taken' && <p className="text-[12px]" style={{ color: '#EF476F' }}>Ya existe un club verificado con ese nombre. Diferéncialo con tu ciudad o un distintivo.</p>}
          {nameStatus === 'similar' && <p className="text-[12px]" style={{ color: '#B45309' }}>Hay un club con un nombre parecido. Puedes continuar; lo revisaremos al verificar.</p>}
        </div>

        <div className="space-y-1.5">
          <Label>Deporte *</Label>
          <Select value={deporte} onValueChange={v => setDeporte(v ?? '')}>
            <SelectTrigger className="w-full h-11 rounded-xl">
              <span className={deporte ? 'text-slate-900' : 'text-muted-foreground'}>{deporte || 'Selecciona el deporte'}</span>
            </SelectTrigger>
            <SelectContent>
              {DEPORTES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Departamento</Label>
            <Select value={department} onValueChange={v => { setDepartment(v ?? ''); setCity(''); }}>
              <SelectTrigger className="w-full h-11 rounded-xl">
                <span className={department ? 'text-slate-900' : 'text-muted-foreground'}>{department || 'Selecciona'}</span>
              </SelectTrigger>
              <SelectContent>
                {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Municipio</Label>
            <Select value={city} onValueChange={v => setCity(v ?? '')} disabled={!department}>
              <SelectTrigger className="w-full h-11 rounded-xl">
                <span className={city ? 'text-slate-900' : 'text-muted-foreground'}>{city || (department ? 'Selecciona' : '—')}</span>
              </SelectTrigger>
              <SelectContent>
                {municipios.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Teléfono de contacto</Label>
          <PhoneInput value={phone} onChange={setPhone} placeholder="Número del club" />
        </div>

        {error && <p className="text-sm" style={{ color: '#EF476F' }}>{error}</p>}

        <button type="submit" disabled={!canSubmit}
          className="w-full py-3 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer transition-opacity"
          style={{ background: GRAD }}>
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creando...</> : <><Trophy className="w-4 h-4" /> Crear club y empezar gratis</>}
        </button>
        <p className="text-[11.5px] text-slate-400 text-center">15 días gratis. Tu club queda por verificar hasta que lo revisemos o realices el primer pago.</p>
      </form>
    </div>
  );
}

// ── Formulario: Contáctenos ──────────────────────────────────────────────────
function ContactForm({ getToken, onBack, onDone }: {
  getToken: () => Promise<string | null>; onBack: () => void; onDone: () => void;
}) {
  const [f, setF] = useState({ clubName: '', deporte: '', department: '', city: '', contactName: '', contactPhone: '', message: '', memberCount: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (v: string) => setF(s => ({ ...s, [k]: v }));

  const canSubmit = f.clubName.trim().length >= 2 && f.contactName.trim().length >= 2 && f.contactPhone.trim().length >= 5 && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true); setError(null);
    try {
      const token = await getToken();
      await apiFetch('/clubs/lead', {
        method: 'POST', token,
        body: JSON.stringify({
          clubName: f.clubName.trim(),
          deporte: f.deporte || undefined,
          department: f.department || undefined,
          city: f.city || undefined,
          contactName: f.contactName.trim(),
          contactPhone: f.contactPhone.trim(),
          memberCountApprox: f.memberCount ? Number(f.memberCount) : undefined,
          message: f.message || undefined,
        }),
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-7">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[13px] text-slate-500 hover:text-slate-700 transition-colors mb-4 cursor-pointer">
        <ArrowLeft className="w-4 h-4" /> Volver
      </button>
      <h1 className="text-[20px] font-semibold text-slate-900">Cuéntanos de tu club</h1>
      <p className="text-[13px] text-slate-500 mt-1 mb-5">Te contactamos para ayudarte a montarlo.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Nombre del club *</Label>
          <Input value={f.clubName} onChange={e => set('clubName')(e.target.value)} required minLength={2} />
        </div>
        <div className="space-y-1.5">
          <Label>Deporte</Label>
          <Select value={f.deporte} onValueChange={v => set('deporte')(v ?? '')}>
            <SelectTrigger className="w-full h-11 rounded-xl">
              <span className={f.deporte ? 'text-slate-900' : 'text-muted-foreground'}>{f.deporte || 'Selecciona'}</span>
            </SelectTrigger>
            <SelectContent>
              {DEPORTES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Tu nombre *</Label>
          <Input value={f.contactName} onChange={e => set('contactName')(e.target.value)} required minLength={2} />
        </div>
        <div className="space-y-1.5">
          <Label>Teléfono *</Label>
          <PhoneInput value={f.contactPhone} onChange={set('contactPhone')} placeholder="Tu número" />
        </div>
        <div className="space-y-1.5">
          <Label># aproximado de miembros</Label>
          <Input type="number" min={0} value={f.memberCount} onChange={e => set('memberCount')(e.target.value)} placeholder="Ej: 40" />
        </div>
        <div className="space-y-1.5">
          <Label>Mensaje (opcional)</Label>
          <textarea value={f.message} onChange={e => set('message')(e.target.value)} rows={3}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            placeholder="Cuéntanos qué necesitas" />
        </div>

        {error && <p className="text-sm" style={{ color: '#EF476F' }}>{error}</p>}

        <button type="submit" disabled={!canSubmit}
          className="w-full py-3 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer transition-opacity"
          style={{ background: GRAD }}>
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</> : 'Enviar solicitud'}
        </button>
      </form>
    </div>
  );
}

// ── Confirmación de contacto ─────────────────────────────────────────────────
function ContactDone() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
      <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: 'rgba(6,214,160,0.12)' }}>
        <Check className="w-8 h-8" style={{ color: '#06D6A0' }} />
      </div>
      <h1 className="text-[20px] font-semibold text-slate-900 mb-2">¡Solicitud enviada!</h1>
      <p className="text-slate-500 text-sm leading-relaxed mb-7">
        Recibimos tu solicitud. Te contactamos muy pronto para ayudarte a montar tu club.
      </p>
      <a href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noopener noreferrer"
        className="w-full py-3 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
        style={{ background: '#25D366' }}>
        <MessageCircle className="w-4 h-4" /> Escríbenos por WhatsApp
      </a>
    </div>
  );
}
