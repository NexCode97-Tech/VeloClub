/**
 * Escenarios de entrenamiento.
 *
 * Donde se entrena decide que se mide: en pista se cronometra, en gimnasio se
 * levanta peso. Solo aplica a entrenamientos, no a competencias, porque no se
 * compite en gimnasio.
 */

import { Dumbbell } from 'lucide-react';
import { IconPista } from '@/components/ui/custom-icons';

export type Escenario = 'PISTA' | 'GIMNASIO';

export interface EscenarioInfo {
  valor: Escenario;
  nombre: string;
  descripcion: string;
  color: string;
  fondo: string;
  icono: React.ElementType;
}

export const ESCENARIOS: EscenarioInfo[] = [
  {
    valor: 'PISTA',
    nombre: 'Pista',
    descripcion: 'Tiempos, distancia y vueltas',
    color: '#4361EE',
    fondo: 'rgba(67,97,238,0.10)',
    icono: IconPista,
  },
  {
    valor: 'GIMNASIO',
    nombre: 'Gimnasio',
    descripcion: 'Ejercicios, peso, series y repeticiones',
    color: '#06D6A0',
    fondo: 'rgba(6,214,160,0.10)',
    icono: Dumbbell,
  },
];

export function infoEscenario(valor?: string | null): EscenarioInfo {
  return ESCENARIOS.find(e => e.valor === valor) ?? ESCENARIOS[0];
}
