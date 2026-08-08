// Los dias de la semana, en un solo lugar.
//
// Estaban definidos por separado en Ajustes ("Dias sin entrenamiento") y en el
// horario de clases, y las abreviaturas se habian ido separando: uno usaba
// X para miercoles y S para sabado, el otro Mi y Sá. Dos circulos de dias uno
// encima del otro con letras distintas se leen como dos cosas distintas.
//
// Una sola letra, como venia siendo en "Dias sin entrenamiento". La X de
// miercoles no es un descuido: es la convencion en espanol justamente para no
// chocar con la M de martes.
//
// `valor` es 0 = domingo … 6 = sabado, igual que `Date.getDay()` y que
// `Club.noAttendanceDays` en la base. El orden de la lista arranca en lunes
// porque asi se lee una semana de entrenamiento.

export interface DiaSemana {
  valor: number;
  nombre: string;
  /** La que va dentro del circulo */
  corto: string;
}

export const DIAS_SEMANA: DiaSemana[] = [
  { valor: 1, nombre: 'Lunes',     corto: 'L' },
  { valor: 2, nombre: 'Martes',    corto: 'M' },
  { valor: 3, nombre: 'Miércoles', corto: 'X' },
  { valor: 4, nombre: 'Jueves',    corto: 'J' },
  { valor: 5, nombre: 'Viernes',   corto: 'V' },
  { valor: 6, nombre: 'Sábado',    corto: 'S' },
  { valor: 0, nombre: 'Domingo',   corto: 'D' },
];

/** Abreviaturas de tres letras, para listas y reportes donde hay ancho. */
export const DIA_CORTO_3 = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
