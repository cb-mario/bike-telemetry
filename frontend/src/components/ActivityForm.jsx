import { useState } from 'react'
import { Button } from './ui/Button'
import { Field, FormError, Input, Textarea } from './ui/Field'
import { api } from '../lib/api'
import { todayInput } from '../lib/format'

const EMPTY = {
  title: '', date: todayInput(), distanceKm: '', hours: '', minutes: '',
  elevationGain: '', avgHr: '', maxHr: '', notes: '',
}

const toNumber = (value) => (value === '' ? undefined : Number(value))

// Valida en cliente con mensajes claros; el backend vuelve a validar todo
function buildPayload(form) {
  const durationMin = (toNumber(form.hours) ?? 0) * 60 + (toNumber(form.minutes) ?? 0)
  const payload = {
    title: form.title.trim(),
    date: form.date,
    distanceKm: toNumber(form.distanceKm),
    durationMin,
    elevationGain: toNumber(form.elevationGain),
    avgHr: toNumber(form.avgHr),
    maxHr: toNumber(form.maxHr),
    notes: form.notes.trim() || undefined,
  }

  if (!payload.title) return { error: 'Ponle un título a la salida.' }
  if (!payload.date) return { error: 'Indica la fecha de la salida.' }
  if (payload.date > todayInput()) return { error: 'La fecha no puede estar en el futuro.' }
  if (!(payload.distanceKm > 0)) return { error: 'La distancia debe ser mayor que 0 km.' }
  if (!Number.isInteger(durationMin) || durationMin <= 0) return { error: 'Indica una duración en horas y minutos enteros.' }
  for (const [key, label] of [['avgHr', 'La FC media'], ['maxHr', 'La FC máxima']]) {
    const v = payload[key]
    if (v !== undefined && (!Number.isInteger(v) || v < 40 || v > 220)) {
      return { error: `${label} debe estar entre 40 y 220 bpm.` }
    }
  }
  if (payload.avgHr && payload.maxHr && payload.avgHr > payload.maxHr) {
    return { error: 'La FC media no puede superar a la máxima.' }
  }
  return { payload }
}

export function ActivityForm({ onCreated, onCancel }) {
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const bind = (key) => ({
    value: form[key],
    onChange: (e) => setForm((prev) => ({ ...prev, [key]: e.target.value })),
  })

  async function handleSubmit(e) {
    e.preventDefault()
    const { payload, error: validationError } = buildPayload(form)
    if (validationError) return setError(validationError)

    setSaving(true)
    setError('')
    try {
      await api('/activities', { method: 'POST', body: payload })
      onCreated()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid grid-cols-2 gap-4">
      <Field label="Título" className="col-span-2">
        {(id) => <Input id={id} autoFocus maxLength={100} placeholder="Puertos de Madrid" {...bind('title')} />}
      </Field>
      <Field label="Fecha">
        {(id) => <Input id={id} type="date" max={todayInput()} {...bind('date')} />}
      </Field>
      <Field label="Distancia (km)">
        {(id) => <Input id={id} type="number" inputMode="decimal" min="0" step="0.01" placeholder="85,4" {...bind('distanceKm')} />}
      </Field>
      <Field label="Duración">
        {(id) => (
          <div className="flex items-center gap-2">
            <Input id={id} type="number" inputMode="numeric" min="0" step="1" placeholder="3" aria-label="Horas" {...bind('hours')} />
            <span className="text-xs text-ink-muted">h</span>
            <Input type="number" inputMode="numeric" min="0" max="59" step="1" placeholder="30" aria-label="Minutos" {...bind('minutes')} />
            <span className="text-xs text-ink-muted">min</span>
          </div>
        )}
      </Field>
      <Field label="Desnivel (m)">
        {(id) => <Input id={id} type="number" inputMode="numeric" min="0" step="1" placeholder="Opcional" {...bind('elevationGain')} />}
      </Field>
      <Field label="FC media (bpm)">
        {(id) => <Input id={id} type="number" inputMode="numeric" min="40" max="220" step="1" placeholder="Opcional" {...bind('avgHr')} />}
      </Field>
      <Field label="FC máxima (bpm)">
        {(id) => <Input id={id} type="number" inputMode="numeric" min="40" max="220" step="1" placeholder="Opcional" {...bind('maxHr')} />}
      </Field>
      <Field label="Notas" className="col-span-2">
        {(id) => <Textarea id={id} maxLength={2000} placeholder="Sensaciones, clima, recorrido…" {...bind('notes')} />}
      </Field>

      <div className="col-span-2"><FormError>{error}</FormError></div>

      <div className="col-span-2 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancelar</Button>
        <Button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar salida'}</Button>
      </div>
    </form>
  )
}
