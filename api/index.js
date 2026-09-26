// Punto de entrada en Vercel: toda la API de Express como una única función serverless.
// vercel.json redirige aquí /api/*; Express recibe la ruta original y la resuelve como en local
const { configProblems } = require('../src/config');

const problems = configProblems();
if (problems.length) {
  throw new Error(`Configuración incompleta (variables de entorno en Vercel):\n- ${problems.join('\n- ')}`);
}

module.exports = require('../src/app');
