import { RefreshCwIcon } from 'lucide-react'
import { useConnections } from '../../lib/connections'
import { Button } from '../ui/Button'

// «Sincronizar» de la cabecera de Salidas: trae lo nuevo de todos los servicios conectados.
// Sin ninguno conectado no aparece (se conectan en el perfil)
export function SyncButton() {
  const { connections, syncing, sync } = useConnections()
  const connected = connections?.filter((c) => c.connected) ?? []
  if (!connected.length) return null

  const label = connected.length === 1 ? `Sincronizar ${connected[0].name}` : 'Sincronizar'
  return (
    <Button variant="secondary" onClick={() => sync(connected)} loading={Boolean(syncing)}
      title={connected.length > 1 ? connected.map((c) => c.name).join(', ') : undefined}>
      {!syncing && <RefreshCwIcon className="size-4" />}
      {syncing ? `Sincronizando ${syncing.name}…` : label}
    </Button>
  )
}
