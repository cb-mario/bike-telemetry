require('dotenv').config({ quiet: true });

if (!process.env.JWT_SECRET) {
  console.error('Falta la variable de entorno JWT_SECRET (ver .env.example)');
  process.exit(1);
}

const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚴 BikeTelemetry API escuchando en http://localhost:${PORT}`);
});
