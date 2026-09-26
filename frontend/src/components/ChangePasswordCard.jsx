import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import { api } from '../lib/api'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { Field, FormError, Input } from './ui/Field'

const MIN_PASSWORD_LENGTH = 8
const EMPTY = { currentPassword: '', newPassword: '', confirm: '' }

// Cambiar la contraseña, o crear una si la cuenta entró con Google.
// Una cuenta de Strava sin email no puede usar contraseña: no se muestra
export function ChangePasswordCard() {
  const { user, setUser } = useAuth()
  const { toast } = useApp()
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const bind = (key) => ({ value: form[key], onChange: (e) => setForm((f) => ({ ...f, [key]: e.target.value })) })

  if (!user.email) return null
  const creating = !user.hasPassword

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (form.newPassword.length < MIN_PASSWORD_LENGTH) return setError(`La contraseña nueva debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`)
    if (form.newPassword !== form.confirm) return setError('Las contraseñas nuevas no coinciden')
    setSaving(true)
    try {
      const body = { newPassword: form.newPassword, ...(!creating && { currentPassword: form.currentPassword }) }
      const { user: updated } = await api('/auth/me/password', { method: 'PUT', body })
      setUser(updated)
      setForm(EMPTY)
      toast(creating ? 'Contraseña creada. Ya puedes entrar también con tu email.' : 'Contraseña cambiada.', 'success')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const ready = form.newPassword && form.confirm && (creating || form.currentPassword)
  return (
    <Card className="p-5">
      <h2 className="text-sm font-medium text-zinc-100">Contraseña</h2>
      <p className="mt-1 mb-4 text-xs text-zinc-500">
        {creating ? 'Crea una para entrar también con tu email.' : 'Cámbiala cuando quieras; la sesión sigue abierta.'}
      </p>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {/* Campo oculto con el email para que el gestor de contraseñas sepa a qué cuenta pertenece */}
        <input type="email" autoComplete="username" value={user.email} readOnly hidden />
        {!creating && (
          <Field label="Contraseña actual">
            {(id) => <Input id={id} type="password" autoComplete="current-password" {...bind('currentPassword')} />}
          </Field>
        )}
        <Field label="Contraseña nueva" hint={`Al menos ${MIN_PASSWORD_LENGTH} caracteres.`}>
          {(id) => <Input id={id} type="password" autoComplete="new-password" {...bind('newPassword')} />}
        </Field>
        <Field label="Repite la contraseña nueva">
          {(id) => <Input id={id} type="password" autoComplete="new-password" {...bind('confirm')} />}
        </Field>
        <FormError>{error}</FormError>
        <Button type="submit" variant="secondary" className="self-end" loading={saving} disabled={!ready}>
          {creating ? 'Crear contraseña' : 'Cambiar contraseña'}
        </Button>
      </form>
    </Card>
  )
}
