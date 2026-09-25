const statsService = require('../services/stats.service');
const { HttpError } = require('../errors');
const { parseDateRange } = require('../utils/validation');

const PERIODS = ['week', 'month'];

async function summary(req, res) {
  res.json(await statsService.summary(req.user.id, parseDateRange(req.query, req.timeZone)));
}

// Todo el historial, el mes en curso y el mismo tramo del mes anterior (el Resumen, de una vez)
async function overview(req, res) {
  res.json(await statsService.overview(req.user.id, { timeZone: req.timeZone }));
}

async function evolution(req, res) {
  const period = req.query.period ?? 'week';
  if (!PERIODS.includes(period)) {
    throw new HttpError(400, `period debe ser uno de: ${PERIODS.join(', ')}`);
  }
  res.json(await statsService.evolution(req.user.id, { period, timeZone: req.timeZone, ...parseDateRange(req.query, req.timeZone) }));
}

async function hrZones(req, res) {
  res.json(await statsService.hrZones(req.user.id, parseDateRange(req.query, req.timeZone)));
}

module.exports = { summary, overview, evolution, hrZones };
