// Solo lectura: que hace la base cuando se borra una sede.
// Lo que manda es la restriccion real, no lo que diga el esquema de Prisma.
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const filas = await prisma.$queryRawUnsafe<Array<{
    tabla: string; columna: string; regla: string; constraint: string;
  }>>(`
    SELECT tc.table_name  AS tabla,
           kcu.column_name AS columna,
           rc.delete_rule  AS regla,
           tc.constraint_name AS constraint
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'Location'
    ORDER BY rc.delete_rule, tc.table_name;
  `);

  console.log('Quien apunta a Location y que pasa al borrarla:\n');
  for (const f of filas) {
    const alerta = f.regla === 'NO ACTION' || f.regla === 'RESTRICT' ? '  <-- BLOQUEA EL BORRADO' : '';
    console.log(`  ${f.tabla}.${f.columna} -> ${f.regla}${alerta}`);
  }
}

main().finally(() => prisma.$disconnect());
