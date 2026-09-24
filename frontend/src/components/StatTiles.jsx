import { formatDuration, formatNumber } from '../lib/format'

function Tile({ label, value, unit, sub }) {
  return (
    <div className="flex flex-col justify-between gap-3 rounded-xl border border-zinc-800 p-5">
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <div>
        <p className="text-2xl font-semibold tracking-tight text-ink">
          {value}
          {unit && <span className="ml-1 text-sm font-normal text-ink-muted">{unit}</span>}
        </p>
        {sub && <p className="mt-1 text-xs text-ink-muted">{sub}</p>}
      </div>
    </div>
  )
}

// Cifra protagonista (distancia) + métricas secundarias
export function StatTiles({ summary }) {
  const s = summary
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
      <div className="col-span-2 flex flex-col justify-between gap-4 rounded-xl border border-zinc-800 p-5 lg:row-span-2">
        <p className="text-xs font-medium text-ink-muted">Distancia total</p>
        <div>
          <p className="text-5xl font-semibold tracking-tight text-ink sm:text-6xl">
            {formatNumber(s.distanceKm, 1)}
            <span className="ml-2 text-xl font-normal text-ink-muted">km</span>
          </p>
          <p className="mt-2 text-sm text-ink-muted">
            {s.avgDistanceKm != null ? `${formatNumber(s.avgDistanceKm, 1)} km de media por salida` : 'Sin salidas en este periodo'}
          </p>
        </div>
      </div>
      <Tile label="Tiempo en movimiento" value={formatDuration(s.durationMin)}
        sub={s.avgDurationMin != null ? `${formatDuration(s.avgDurationMin)} por salida` : undefined} />
      <Tile label="Desnivel positivo" value={formatNumber(s.elevationGain)} unit="m" />
      <Tile label="Velocidad media" value={formatNumber(s.avgSpeedKmh, 1)} unit={s.avgSpeedKmh != null ? 'km/h' : undefined} />
      <Tile label="FC media" value={formatNumber(s.avgHr)} unit={s.avgHr != null ? 'bpm' : undefined}
        sub={s.maxHr != null ? `Máx. ${s.maxHr} bpm` : 'Sin datos de pulso'} />
      <Tile label="Salida más larga" value={s.records.longestDistance ? formatNumber(s.records.longestDistance.distanceKm, 1) : '—'}
        unit={s.records.longestDistance ? 'km' : undefined} sub={s.records.longestDistance?.title} />
      <Tile label="Mayor desnivel" value={s.records.biggestClimb ? formatNumber(s.records.biggestClimb.elevationGain) : '—'}
        unit={s.records.biggestClimb ? 'm' : undefined} sub={s.records.biggestClimb?.title} />
      <Tile label="Salida más duradera" value={s.records.longestDuration ? formatDuration(s.records.longestDuration.durationMin) : '—'}
        sub={s.records.longestDuration?.title} />
      <Tile label="Salidas" value={formatNumber(s.count)} />
    </div>
  )
}
