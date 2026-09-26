import { useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import { api } from '../lib/api'
import { formatDate, formatNumber, todayInput } from '../lib/format'
import { SEX_OPTIONS, bmiCategory, displayName } from '../lib/user'
import { AvatarPicker } from '../components/AvatarPicker'
import { Button } from '../components/ui/Button'
import { Card, CardHeader } from '../components/ui/Card'
import { Field, FormError, Input } from '../components/ui/Field'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { Label } from '../components/ui/Text'
import { StravaControls } from '../components/StravaControls'
import { useProviders } from '../lib/providers'
import { GoogleAccess } from '../components/GoogleAccess'
import { ChangePasswordCard } from '../components/ChangePasswordCard'
import { InfoTip } from '../components/InfoTip'
import { PageHeader } from '../components/PageHeader'

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

function EstimateTile({ label, value, unit, hint, accent, info, className = '' }) {
  return (
    <div className={`bg-zinc-900 p-4 ${className}`}>
      <Label className="flex items-center gap-2">
        <span aria-hidden className={`h-3 w-0.5 rounded-full ${accent ?? 'bg-zinc-600'}`} />
        {label}
        {info && <InfoTip label={label}>{info}</InfoTip>}
      </Label>
      <p className="mt-2 font-display text-2xl font-semibold tracking-tight text-zinc-50">
        {value ?? '—'}{value != null && unit && <span className="ml-1 text-sm font-normal text-zinc-400">{unit}</span>}
      </p>
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  )
}

export function ProfilePage() {
  const { user, setUser, logout } = useAuth()
  const { toast, refresh } = useApp()
  const providers = useProviders()
  const [form, setForm] = useState(() => toForm(user))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const bind = (key) => ({ value: form[key], onChange: (e) => setForm((f) => ({ ...f, [key]: e.target.value })) })
  const changes = useMemo(() => diff(form, user), [form, user])
  const dirty = Object.keys(changes).length > 0

  const e = user.estimates
  const effectiveMax = user.maxHr ?? e.maxHr
  const allEstimates = [
    { id: 'age', label: 'Edad', value: e.age, unit: 'años', missing: 'tu edad' },
    { id: 'bmi', label: 'IMC', value: e.bmi != null ? formatNumber(e.bmi, 1) : null, hint: bmiCategory(e.bmi), missing: 'tu IMC',
      info: 'Índice de masa corporal: peso (kg) dividido entre la altura (m) al cuadrado.' },
    { id: 'maxHr', label: 'FC máx.', value: effectiveMax, unit: 'bpm', accent: 'bg-hr', missing: 'tu FC máxima',
      info: 'Si no la indicas tú, se estima con la fórmula de Tanaka: 208 − 0,7 × edad. Es la base de tus zonas de pulso.',
      hint: user.maxHr ? 'de tu perfil' : 'estimada por edad' },
    { id: 'hrReserve', label: 'Reserva FC', value: e.hrReserve, unit: 'bpm', accent: 'bg-hr', hint: 'máx. − reposo', missing: 'tu reserva de pulso',
      info: 'FC máxima menos FC en reposo: el margen de pulso del que dispones al entrenar.' },
  ]
  const estimates = allEstimates.filter((t) => t.value != null)
  const missing = allEstimates.filter((t) => t.value == null).map((t) => t.missing)

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
      <PageHeader title="Perfil" description="Tus datos, tus zonas de pulso y tus conexiones"
        action={<Button variant="secondary" onClick={logout}>Cerrar sesión</Button>} />

      {/* Identidad */}
      <Card className="relative overflow-hidden p-5 sm:p-6">
        <div className="relative">
          <AvatarPicker>
            <h2 className="truncate text-2xl font-semibold tracking-tight text-zinc-50">{displayName(user)}</h2>
            <p className="mt-0.5 truncate text-sm text-zinc-400">{user.email ?? 'Entras con Strava'} · desde {formatDate(user.createdAt)}</p>
          </AvatarPicker>
        </div>
        {!user.name && (
          <p className="relative mt-5 rounded-lg border border-zinc-700 bg-zinc-950/40 px-4 py-3 text-sm text-zinc-300">
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
                <span className="text-[13px] font-medium text-zinc-300">Sexo</span>
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
            {/* Solo las estimaciones que se pueden calcular; lo que falta se explica en una línea, sin guiones */}
            {estimates.length ? (
              <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-zinc-800 bg-zinc-800">
                {estimates.map((t, i) => (
                  <EstimateTile key={t.id} {...t} className={i === estimates.length - 1 && estimates.length % 2 ? 'col-span-2' : ''} />
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-zinc-400">
                Rellena tu fecha de nacimiento, altura, peso y FC en reposo y aquí verás tu edad, IMC, FC máxima estimada y reserva de pulso.
              </p>
            )}
            {estimates.length > 0 && missing.length > 0 && (
              <p className="mt-3 text-xs text-zinc-500">Para ver {missing.join(', ')}, completa tus datos.</p>
            )}
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

          <ChangePasswordCard />

          {providers?.strava && (
            <Card className="p-5">
              <h2 className="text-sm font-medium text-zinc-100">Strava</h2>
              <p className="mt-1 mb-4 text-xs text-zinc-500">Sincroniza tus salidas automáticamente.</p>
              <div className="flex justify-start [&>div]:items-start"><StravaControls /></div>
            </Card>
          )}

          {providers?.google && (
            <Card className="p-5">
              <h2 className="text-sm font-medium text-zinc-100">Google</h2>
              <p className="mt-1 mb-4 text-xs text-zinc-500">Entra con tu cuenta de Google sin contraseña.</p>
              <GoogleAccess />
            </Card>
          )}
        </div>
      </div>
    </main>
  )
}
