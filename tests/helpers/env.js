// Se carga con --import antes de cada fichero de test: entorno aislado del de desarrollo
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./test.db';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_EXPIRES_IN = '1h';
process.env.BCRYPT_ROUNDS = '4';
process.env.TOKEN_ENCRYPTION_KEY = '0'.repeat(64);
process.env.STRAVA_CLIENT_ID = '12345';
process.env.STRAVA_CLIENT_SECRET = 'strava-secret';
process.env.STRAVA_REDIRECT_URI = 'http://localhost:3000/api/strava/callback';
process.env.FRONTEND_URL = 'http://front.test';
process.env.GOOGLE_CLIENT_ID = 'google-client.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'google-secret';
process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/api/auth/google/callback';
