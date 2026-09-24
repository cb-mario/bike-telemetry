import { useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import { api } from '../lib/api'
import { formatDate, formatNumber, todayInput } from '../lib/format'
import { SEX_OPTIONS, bmiCategory, displayName } from '../lib/user'
import { Avatar } from '../components/Avatar'
import { Button } from '../components/ui/Button'
import { Card, CardHeader } from '../components/ui/Card'
import { Field, FormError, Input } from '../components/ui/Field'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { Label } from '../components/ui/Text'
import { StravaControls } from '../components/StravaControls'

// Zonas por % de la FC máxima (mismo modelo que la tarjeta de zonas)
const ZONES = [
  { zone: 1, name: 'Recuperación', from: 0.5, dot: 'bg-zone-1' },
  { zone: 2, name: 'Resistencia aeróbica', from: 0.6, dot: 'bg-zone-2' },
  { zone: 3, name: 'Tempo', from: 0.7, dot: 'bg-zone-3' },
  { zone: 4, name: 'Umbral', from: 0.8, dot: 'bg-zone-4' },
  { zone: 5, name: 'VO2 máx', from: 0.9, dot: 'bg-zone-5' },
]

const toForm = (u) => ({
  name: u.name ?? '',
  birthDate: u.birthDate ? u.birthDate.slice(0, 10) : '',
  sex: u.sex ?? '',
  heightCm: u.heightCm ?? '',
  weightKg: u.weightKg ?? '',
  restingHr: u.restingHr ?? '',
  maxHr: u.maxHr ?? '',
})

// Solo los campos que han cambiado; '' → null para borrar
function diff(form, user) {
  const original = toForm(user)
  const changes = {}
  for (const [key, value] of Object.entries(form)) {
    if (String(value) === String(original[key])) continue
    if (value === '') changes[key] = null
    else if (['heightCm', 'weightKg', 'restingHr', 'maxHr'].includes(key)) changes[key] = Number(value)
    else changes[key] = typeof value === 'string' ? value.trim() : value
  }
  return changes
}

function EstimateTile({ label, value, unit, hint, accent }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
      <Label className="flex items-center gap-1.5">
        {accent && <span aria-hidden className={`size-1.5 rounded-full ${accent}`} />}
        {label}
      </Label>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">
        {value ?? '—'}{value != null && unit && <span className="ml-1 text-sm font-normal text-zinc-400">{unit}</span>}
      </p>
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  )
}

export function ProfilePage() {
  const { user, setUser, logout } = useAuth()
  const { toast, refresh } = useApp()
  const [form, setForm] = useState(() => toForm(user))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const bind = (key) => ({ value: form[key], onChange: (e) => setForm((f) => ({ ...f, [key]: e.target.value })) })
  const changes = useMemo(() => diff(form, user), [form, user])
  const dirty = Object.keys(changes).length > 0

  const e = user.estimates
  const effectiveMax = user.maxHr ?? e.maxHr

  async function save(ev) {
    ev.preventDefault()
    if (!form.name.trim()) return setError('El nombre no puede estar vacío.')
    setSaving(true)
    setError('')
    try {
      const { user: updated } = await api('/auth/me', { method: 'PATCH', body: changes })
      setUser(updated)
      setForm(toForm(updated))
      refresh() // las zonas y estimaciones de otras secciones dependen del perfil
      toast('Perfil actualizado.', 'success')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">
      {/* Cabecera del perfil */}
      <Card className="relative overflow-hidden p-6 sm:p-8">
        <div aria-hidden className="absolute -top-24 -right-24 size-72 rounded-full bg-brand/20 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-5">
          <Avatar user={user} size="size-20 text-2xl" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-3xl font-semibold tracking-tight text-zinc-50">{displayName(user)}</h1>
            <p className="mt-1 text-sm text-zinc-400">{user.email} · desde {formatDate(user.createdAt)}</p>
          </div>
          <Button variant="secondary" onClick={logout}>Cerrar sesión</Button>
        </div>
        {!user.name && (
          <p className="relative mt-5 rounded-xl border border-brand/30 bg-brand/10 px-4 py-3 text-sm text-zinc-200">
            Añade tu nombre para que aparezca en lugar del email.
          </p>
        )}
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        {/* Datos editables */}
        <Card className="lg:col-span-2">
          <CardHeader title="Tus datos" description="Personalizan las zonas de pulso y las estimaciones" />
          <form onSubmit={save} noValidate className="flex flex-col gap-6 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre" className="sm:col-span-2">{(id) => <Input id={id} maxLength={60} {...bind('name')} />}</Field>
              <Field label="Fecha de nacimiento" hint={e.age != null ? `${e.age} años` : undefined}>
                {(id) => <Input id={id} type="date" max={todayInput()} {...bind('birthDate')} />}
              </Field>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium tracking-wider text-zinc-400 uppercase">Sexo</span>
                <SegmentedControl label="Sexo" options={[...SEX_OPTIONS, { value: '', label: 'Sin indicar' }]}
                  value={form.sex} onChange={(sex) => setForm((f) => ({ ...f, sex }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-zinc-800 pt-6 sm:grid-cols-4">
              <Field label="Altura (cm)">{(id) => <Input id={id} type="number" inputMode="numeric" {...bind('heightCm')} />}</Field>
              <Field label="Peso (kg)">{(id) => <Input id={id} type="number" inputMode="decimal" step="0.1" {...bind('weightKg')} />}</Field>
              <Field label="FC reposo">{(id) => <Input id={id} type="number" inputMode="numeric" {...bind('restingHr')} />}</Field>
              <Field label="FC máxima">{(id) => <Input id={id} type="number" inputMode="numeric" placeholder={e.maxHr ? `≈ ${e.maxHr}` : ''} {...bind('maxHr')} />}</Field>
            </div>
            <FormError>{error}</FormError>
            <div className="flex items-center justify-end gap-2">
              {dirty && <Button variant="ghost" onClick={() => setForm(toForm(user))} disabled={saving}>Descartar</Button>}
              <Button type="submit" loading={saving} disabled={!dirty}>Guardar cambios</Button>
            </div>
          </form>
        </Card>

        {/* Estimaciones */}
        <div className="flex flex-col gap-6">
          <Card className="p-5">
            <h2 className="text-sm font-medium text-zinc-100">Estimaciones</h2>
            <div className="stagger mt-4 grid grid-cols-2 gap-3">
              <EstimateTile label="Edad" value={e.age} unit="años" />
              <EstimateTile label="IMC" value={e.bmi != null ? formatNumber(e.bmi, 1) : null} hint={bmiCategory(e.bmi)} />
              <EstimateTile label="FC máx." value={effectiveMax} unit="bpm" accent="bg-hr"
                hint={user.maxHr ? 'de tu perfil' : e.maxHr ? 'estimada por edad' : 'añade tu edad'} />
              <EstimateTile label="Reserva FC" value={e.hrReserve} unit="bpm" accent="bg-hr"
                hint={e.hrReserve ? 'máx. − reposo' : 'añade FC en reposo'} />
            </div>
          </Card>

          {effectiveMax && (
            <Card className="p-5">
              <h2 className="text-sm font-medium text-zinc-100">Tus zonas de pulso</h2>
              <ul className="mt-4 flex flex-col gap-2.5">
                {ZONES.map((z, i) => {
                  const lo = Math.round(z.from * effectiveMax)
                  const hi = ZONES[i + 1] ? Math.round(ZONES[i + 1].from * effectiveMax) - 1 : effectiveMax
                  return (
                    <li key={z.zone} className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2 text-zinc-300">
                        <span aria-hidden className={`size-2 rounded-full ${z.dot}`} />
                        <span className="font-medium text-zinc-100">Z{z.zone}</span> {z.name}
                      </span>
                      <span className="text-zinc-400 tabular-nums">{lo}–{hi} bpm</span>
                    </li>
                  )
                })}
              </ul>
            </Card>
          )}

          <Card className="p-5">
            <h2 className="text-sm font-medium text-zinc-100">Strava</h2>
            <p className="mt-1 mb-4 text-xs text-zinc-500">Sincroniza tus salidas automáticamente.</p>
            <div className="flex justify-start [&>div]:items-start"><StravaControls /></div>
          </Card>
        </div>
      </div>
    </main>
  )
}
