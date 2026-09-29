-- Strava ya no sirve para entrar: toda cuenta tiene email (contraseña o Google)
ALTER TABLE "User" ALTER COLUMN "email" SET NOT NULL;
