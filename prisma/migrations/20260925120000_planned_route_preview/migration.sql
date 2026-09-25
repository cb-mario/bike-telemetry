-- Miniatura del trazado para los listados (evita leer la geometría completa).
-- Opcional: las rutas anteriores la calculan y guardan la primera vez que se listan
ALTER TABLE "PlannedRoute" ADD COLUMN "preview" TEXT;
