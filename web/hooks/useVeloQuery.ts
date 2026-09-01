'use client';

/**
 * Hooks de datos con caché de TanStack Query.
 * - Primera visita: fetch normal con loading skeleton
 * - Visitas siguientes (< 5 min): muestra datos cacheados INSTANTÁNEAMENTE, refetch en background
 * - SSE invalida la caché → refetch automático en background sin spinner
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { apiFetch } from '@/lib/api-client';

// ── Query key factory ─────────────────────────────────────────────────────────
export const QK = {
  members:      () => ['members'] as const,
  locations:    () => ['locations'] as const,
  deportes:     () => ['deportes'] as const,
  grupos:       () => ['grupos'] as const,
  clubSettings: () => ['club', 'settings'] as const,
  payments:     (month: number, year: number) => ['payments', month, year] as const,
  cashflow:     (month: number, year: number) => ['cashflow', month, year] as const,
  // La clase entra en la clave: dos clases del mismo dia son dos planillas
  // distintas y no pueden compartir cache.
  attendance:   (date: string, claseId?: string | null) =>
    ['attendance', date, claseId ?? 'sin-clase'] as const,
  competitions: () => ['competitions'] as const,
  training:     () => ['training'] as const,
  calendar:     (month: number, year: number) => ['calendar', month, year] as const,
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────
function useToken() {
  const { getToken } = useAuth();
  return getToken;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useMembers() {
  const getToken = useToken();
  return useQuery({
    queryKey: QK.members(),
    queryFn: async () => {
      const token = await getToken();
      return apiFetch<{ members: unknown[] }>('/members', { token });
    },
  });
}

export function useLocations() {
  const getToken = useToken();
  return useQuery({
    queryKey: QK.locations(),
    queryFn: async () => {
      const token = await getToken();
      return apiFetch<{ locations: unknown[] }>('/locations', { token });
    },
  });
}

export function useGrupos() {
  const getToken = useToken();
  return useQuery({
    queryKey: QK.grupos(),
    queryFn: async () => {
      const token = await getToken();
      return apiFetch<{ grupos: { id: string; nombre: string; location: { id: string; name: string } }[] }>(
        '/grupos', { token });
    },
  });
}

export function useClubSettings() {
  const getToken = useToken();
  return useQuery({
    queryKey: QK.clubSettings(),
    queryFn: async () => {
      const token = await getToken();
      return apiFetch<{ club: { name: string; noAttendanceDays?: number[] } }>('/clubs/settings', { token });
    },
    retry: false, // no bloquear si falla settings
  });
}

export function usePayments(month: number, year: number) {
  const getToken = useToken();
  return useQuery({
    queryKey: QK.payments(month, year),
    queryFn: async () => {
      const token = await getToken();
      return apiFetch<{ payments: unknown[] }>(`/payments?month=${month}&year=${year}`, { token });
    },
  });
}

export function useCashflow(month: number, year: number) {
  const getToken = useToken();
  return useQuery({
    queryKey: QK.cashflow(month, year),
    queryFn: async () => {
      const token = await getToken();
      return apiFetch<{ entries: unknown[] }>(`/cashflow?month=${month}&year=${year}`, { token });
    },
  });
}

export function useAttendance(date: string) {
  const getToken = useToken();
  return useQuery({
    queryKey: QK.attendance(date),
    queryFn: async () => {
      const token = await getToken();
      return apiFetch<{ records: unknown[] }>(`/attendance?date=${date}`, { token });
    },
  });
}

export function useCompetitions() {
  const getToken = useToken();
  return useQuery({
    queryKey: QK.competitions(),
    queryFn: async () => {
      const token = await getToken();
      return apiFetch<{ competitions: unknown[] }>('/competitions', { token });
    },
  });
}

export function useTraining() {
  const getToken = useToken();
  return useQuery({
    queryKey: QK.training(),
    queryFn: async () => {
      const token = await getToken();
      return apiFetch<{ sessions: unknown[] }>('/training', { token });
    },
  });
}

// ── Invalidación por SSE ──────────────────────────────────────────────────────
/**
 * Llama esto desde useClubStream para invalidar las queries correctas.
 * Ejemplo:
 *   const invalidate = useSSEInvalidator();
 *   useClubStream(ev => invalidate(ev));
 */
export function useSSEInvalidator() {
  const qc = useQueryClient();
  return (event: string) => {
    switch (event) {
      case 'members':
        qc.invalidateQueries({ queryKey: QK.members() });
        break;
      // Las sedes faltaban, y por eso al crear una no aparecia en Miembros
      // hasta recargar: la lista quedaba fresca cinco minutos y nadie avisaba
      // que habia cambiado.
      case 'locations':
        qc.invalidateQueries({ queryKey: QK.locations() });
        break;
      case 'deportes':
        qc.invalidateQueries({ queryKey: QK.deportes() });
        break;
      case 'club':
        qc.invalidateQueries({ queryKey: QK.clubSettings() });
        break;
      case 'payments':
        qc.invalidateQueries({ queryKey: ['payments'] });
        break;
      case 'cashflow':
        qc.invalidateQueries({ queryKey: ['cashflow'] });
        break;
      case 'attendance':
        qc.invalidateQueries({ queryKey: ['attendance'] });
        // El horario viaja por este mismo evento: `clases.ts` lo emite al crear,
        // editar y borrar una clase. Sin estas dos, Asistencia seguia sirviendo
        // durante cinco minutos la lista que cargo antes de que existiera el
        // horario, y la pantalla se veia igual que un club sin clases.
        qc.invalidateQueries({ queryKey: ['clasesDia'] });
        qc.invalidateQueries({ queryKey: ['horarioClases'] });
        qc.invalidateQueries({ queryKey: QK.grupos() });
        break;
      case 'calendar':
        qc.invalidateQueries({ queryKey: ['calendar'] });
        break;
      case 'competitions':
        qc.invalidateQueries({ queryKey: QK.competitions() });
        break;
      case 'training':
        qc.invalidateQueries({ queryKey: QK.training() });
        break;
    }
  };
}
