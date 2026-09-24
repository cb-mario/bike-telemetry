import { useState } from 'react'
import { Card, CardHeader } from './ui/Card'
import { Button } from './ui/Button'
import { Input } from './ui/Field'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { formatDuration, formatKm, formatNumber } from '../lib/format'
// Rampa ordinal: más intensidad → azul más claro (validada sobre las tarjetas)
import { ZONE_BG } from '../lib/zones'


const SOURCE_LABEL = {
  profile: 'de tu perfil',
  activities: 'estimada',
}

export function HrZonesCard({ zones: data, loading, onProfileChange }) {
  return (
    <Card className="flex flex-col">
      <CardHeader title="Zonas de pulso" description="Cada salida cuenta en la zona de su FC media" />
      <div className={`flex flex-1 flex-col px-5 pt-4 pb-5 transition-opacity ${loading ? 'opacity-50' : ''}`}>
        {data.zones ? <ZoneBars data={data} /> : <EmptyZones />}
        <MaxHrEditor data={data} onSaved={onProfileChange} />
      </div>
    </Card>
  )
}

function EmptyZones() {
  return (
    <p className="flex flex-1 items-center justify-center py-8 text-center text-sm text-ink-muted">
      Añade tu FC máxima o registra salidas con pulso para ver tus zonas.
    </p>
  )
}

function ZoneBars({ data }) {
  const [active, setActive] = useState(null)
  const maxPercent = Math.max(...data.zones.map((z) => z.percentTime), 1)

  return (
    <div>
      <ul className="flex flex-col gap-4">
        {[...data.zones].reverse().map((z) => {
          const i = z.zone - 1
          const width = (z.percentTime / maxPercent) * 100
          return (
            <li key={z.zone}
              tabIndex={0}
              onPointerEnter={() => setActive(z.zone)} onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(z.zone)} onBlur={() => setActive(null)}
              className="group rounded-md outline-none focus-visible:ring-2 focus-visible:ring-series/50"
              aria-label={`Zona ${z.zone}, ${z.name}, ${z.minBpm} a ${z.maxBpm} bpm: ${z.percentTime} % del tiempo, ${z.count} salidas`}
            >
              <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
                <span className="flex items-center gap-2 text-ink">
                  <span aria-hidden className={`size-2 rounded-full ${ZONE_BG[i]}`} />
                  <span className="font-medium">Z{z.zone}</span>
                  <span className="text-ink-secondary">{z.name}</span>
                </span>
                <span className="font-medium text-ink tabular-nums">{formatNumber(z.percentTime, 1)} %</span>
              </div>
              <div className="flex items-center">
                <div className="h-2 flex-1 rounded-r bg-zinc-800/60" aria-hidden>
                  {/* Barra horizontal: extremo redondeado, base recta en el origen */}
                  {z.percentTime > 0 && (
                    <div style={{ width: `${width}%` }}
                      className={`h-full rounded-r ${ZONE_BG[i]} transition-[filter] ${active === z.zone ? 'brightness-125' : ''}`} />
                  )}
                </div>
              </div>
              <p className={`mt-1 text-[11px] transition-colors ${active === z.zone ? 'text-ink-secondary' : 'text-ink-muted'}`}>
                {z.minBpm}–{z.maxBpm} bpm · {z.count === 1 ? '1 salida' : `${z.count} salidas`}
                {z.count > 0 && ` · ${formatDuration(z.durationMin)} · ${formatKm(z.distanceKm)}`}
              </p>
            </li>
          )
        })}
      </ul>
      {data.activitiesWithoutHr > 0 && (
        <p className="mt-4 text-xs text-ink-muted">
          {data.activitiesWithoutHr === 1 ? '1 salida sin' : `${data.activitiesWithoutHr} salidas sin`} datos de pulso no se incluyen.
        </p>
      )}
    </div>
  )
}

function MaxHrEditor({ data, onSaved }) {
  const { user, setUser } = useAuth()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function save(maxHr) {
    setSaving(true)
    setError('')
    try {
      const { user: updated } = await api('/auth/me', { method: 'PATCH', body: { maxHr } })
      setUser(updated)
      setEditing(false)
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-zinc-800 pt-4 text-xs">
        <p className="text-ink-muted">
          FC máx.{' '}
          {data.maxHr
            ? <><span className="font-medium text-ink">{data.maxHr} bpm</span> · {SOURCE_LABEL[data.maxHrSource]}</>
            : 'sin definir'}
        </p>
        <Button variant="ghost" size="sm" onClick={() => {
          setValue(user.maxHr ?? data.maxHr ?? '')
          setEditing(true)
        }}>
          {user.maxHr ? 'Editar' : 'Definir'}
        </Button>
      </div>
    )
  }

  return (
    <form
      className="mt-5 border-t border-zinc-800 pt-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        const maxHr = Number(value)
        if (value === '' || !Number.isInteger(maxHr) || maxHr < 100 || maxHr > 220) {
          return setError('La FC máxima debe ser un número entero entre 100 y 220 bpm.')
        }
        save(maxHr)
      }}
    >
      <label htmlFor="max-hr" className="text-xs font-medium text-ink-secondary">FC máxima (bpm)</label>
      <div className="mt-1.5 flex gap-2">
        <Input id="max-hr" type="number" inputMode="numeric" min={100} max={220} step={1} required autoFocus
          value={value} onChange={(e) => setValue(e.target.value)} className="w-24" />
        <Button type="submit" size="md" loading={saving}>Guardar</Button>
        {user.maxHr && (
          <Button variant="ghost" onClick={() => save(null)} disabled={saving}>Quitar</Button>
        )}
        <Button variant="ghost" onClick={() => setEditing(false)} disabled={saving}>Cancelar</Button>
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-ink"><span aria-hidden className="text-critical">● </span>{error}</p>}
    </form>
  )
}
