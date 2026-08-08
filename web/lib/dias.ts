// Los dias de la semana, en un solo lugar.
//
// Estaban definidos por separado en Ajustes ("Dias sin entrenamiento") y en el
// horario de clases, y las abreviaturas se habian ido separando: uno usaba
// X para miercoles y S para sabado, el otro Mi y Sá. Dos circulos de dias uno
// encima del otro con letras distintas se leen como dos cosas distintas.
//
// Dos letras y no una: con una sola, martes y miercoles compartian la M y
// sabado y domingo la D, y habia que adivinar por la posicion.
//
// `valor` es 0 = domingo … 6 = sabado, igual que `Date.getDay()` y que
// `Club.noAttendanceDays` en la base. El orden de la lista arranca en lunes
// porque asi se lee una semana de entrenamiento.

export interface DiaSemana {
  valor: number;
  nombre: string;
  /** La que va dentro del circulo: dos letras, solo la inicial en mayuscula */
  corto: string;
}

export const DIAS_SEMANA: DiaSemana[] = [
  { valor: 1, nombre: 'Lunes',     corto: 'Lu' },
  { valor: 2, nombre: 'Martes',    corto: 'Ma' },
  { valor: 3, nombre: 'Miércoles', corto: 'Mi' },
  { valor: 4, nombre: 'Jueves',    corto: 'Ju' },
  { valor: 5, nombre: 'Viernes',   corto: 'Vi' },
  { valor: 6, nombre: 'Sábado',    corto: 'Sá' },
  { valor: 0, nombre: 'Domingo',   corto: 'Do' },
];

/** Abreviaturas de tres letras, para listas y reportes donde hay ancho. */
export const DIA_CORTO_3 = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
