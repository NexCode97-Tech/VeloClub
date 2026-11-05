-- Plata devuelta a un club. Va en su propia migracion: Postgres no deja usar
-- un valor de enum en la misma transaccion en que se agrega.
ALTER TYPE "CategoriaGasto" ADD VALUE 'REEMBOLSOS';
