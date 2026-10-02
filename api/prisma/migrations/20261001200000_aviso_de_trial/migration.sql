-- El ultimo aviso de fin de prueba que se le mando al club, en dias antes del
-- final: 7, 3 o 0. Sin esto el recorrido diario repetiria el mismo aviso todos
-- los dias, que es como se entrena a la gente a ignorarlos.
ALTER TABLE "Club" ADD COLUMN "trialUltimoAviso" INTEGER;
