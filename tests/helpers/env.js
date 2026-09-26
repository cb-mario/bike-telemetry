// Se carga con --import antes de cada fichero de test: entorno aislado del de desarrollo
process.env.NODE_ENV = 'test';
// Base de PostgreSQL solo para los tests (se vacía entera): nunca la de desarrollo ni la de Supabase
// (por defecto, el PostgreSQL local con el usuario del sistema, como lo deja Homebrew)
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
  || `postgresql://${require('node:os').userInfo().username}@localhost:5432/biketelemetry_test`;
delete process.env.DIRECT_URL;
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_EXPIRES_IN = '1h';
// Los tests existentes cuentan días en UTC; los de zona horaria envían X-Timezone
process.env.APP_TIMEZONE = 'UTC';
process.env.BCRYPT_ROUNDS = '4';
process.env.TOKEN_ENCRYPTION_KEY = '0'.repeat(64);
process.env.STRAVA_CLIENT_ID = '12345';
process.env.STRAVA_CLIENT_SECRET = 'strava-secret';
process.env.STRAVA_REDIRECT_URI = 'http://localhost:3000/api/strava/callback';
process.env.FRONTEND_URL = 'http://front.test';
process.env.GOOGLE_CLIENT_ID = 'google-client.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'google-secret';
process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/api/auth/google/callback';
