import { useState } from 'react'
import { SOURCE_INFO } from '../../lib/sources'
import { Button } from '../ui/Button'
import { Field, FormError, Input } from '../ui/Field'

// Email y contraseña de un servicio que no ofrece OAuth. `onSubmit` conecta;
// si falla, el error se queda en el formulario
export function CredentialsForm({ connection, onSubmit, onCancel }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [connecting, setConnecting] = useState(false)
  const note = SOURCE_INFO[connection.provider]?.credentialsNote

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setConnecting(true)
    try {
      await onSubmit({ email, password })
    } catch (err) {
      setError(err.message)
      setConnecting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label={`Email de ${connection.name}`}>
        {(id) => <Input id={id} type="email" autoComplete="off" required autoFocus value={email}
          onChange={(e) => setEmail(e.target.value)} disabled={connecting} />}
      </Field>
      <Field label="Contraseña">
        {(id) => <Input id={id} type="password" autoComplete="off" required value={password}
          onChange={(e) => setPassword(e.target.value)} disabled={connecting} />}
      </Field>
      {note && <p className="text-xs text-zinc-500">{note}</p>}
      <FormError>{error}</FormError>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={connecting}>Cancelar</Button>
        <Button type="submit" loading={connecting} disabled={!email || !password}>Conectar</Button>
      </div>
    </form>
  )
}
