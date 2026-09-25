require('dotenv').config({ quiet: true });

const { configProblems } = require('./config');

const problems = configProblems();
if (problems.length) {
  console.error(`Configuración incompleta (ver .env.example):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}

const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚴 BikeTelemetry API escuchando en http://localhost:${PORT}`);
});
