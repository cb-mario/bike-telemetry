import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useApp } from '../../context/AppContext'
import { useConnections } from '../../lib/connections'
import { formatNumber, timeAgo } from '../../lib/format'
import { SOURCE_INFO } from '../../lib/sources'
import { Button } from '../ui/Button'
import { Card, CardHeader } from '../ui/Card'
import { Dialog } from '../ui/Dialog'
import { Spinner } from '../ui/Spinner'
import { CredentialsForm } from './CredentialsForm'
import { FILE_SOURCES, FileSourceSteps } from './FileSources'

// Tarjeta «Conexiones» del perfil: de dónde llegan las salidas. Una fila por servicio configurado
// en el servidor y otra por aparato del que se importan archivos; los datos de acceso y los pasos
// para sacar los archivos van en un diálogo
export function ConnectionsCard() {
  const { connections, syncing, sync, connect, disconnect } = useConnections()
  const [asking, setAsking] = useState(null) // conexión que pide usuario y contraseña
  const [fileSource, setFileSource] = useState(null)
  useOAuthResult()

  function handleConnect(connection) {
    if (connection.auth === 'credentials') return setAsking(connection)
    return connect(connection) // OAuth: navega al servicio
  }

  async function connectWithCredentials(body) {
    const connection = asking
    await connect(connection, body)
    setAsking(null)
    sync([connection]) // primera vez: se trae todo el historial
  }

  return (
    <Card>
      <CardHeader title="Conexiones" description="De dónde llegan tus salidas. Las que ya tengas nunca se duplican." />
      <ul className="mt-2 divide-y divide-zinc-800 border-t border-zinc-800">
        {connections?.map((c) => (
          <ConnectionRow key={c.provider} connection={c} syncing={syncing} busy={Boolean(syncing)}
            onConnect={() => handleConnect(c)} onSync={() => sync([c])} onDisconnect={() => disconnect(c)} />
        ))}
        {FILE_SOURCES.map((source) => (
          <Row key={source.id} name={source.name} kind="Archivos .fit" detail={source.detail}
            action={<Button variant="secondary" size="sm" onClick={() => setFileSource(source)}>Importar</Button>} />
        ))}
      </ul>

      <Dialog open={Boolean(fileSource)} onClose={() => setFileSource(null)} title={fileSource ? `Importar desde ${fileSource.name}` : ''}
        description={fileSource && `${fileSource.name} no ofrece conexión directa para apps personales: se importan sus archivos .fit, con pulso, potencia y cadencia.`}>
        {fileSource && <FileSourceSteps source={fileSource} onClose={() => setFileSource(null)} />}
      </Dialog>

      <Dialog open={Boolean(asking)} onClose={() => setAsking(null)} title={asking ? `Conectar ${asking.name}` : ''}
        description={asking && SOURCE_INFO[asking.provider]?.detail}>
        {asking && (
          <CredentialsForm connection={asking} onCancel={() => setAsking(null)} onSubmit={connectWithCredentials} />
        )}
      </Dialog>
    </Card>
  )
}

function ConnectionRow({ connection: c, syncing, busy, onConnect, onSync, onDisconnect }) {
  const { toast } = useApp()
  const [connecting, setConnecting] = useState(false)
  const info = SOURCE_INFO[c.provider] ?? {}
  const current = syncing?.provider === c.provider

  async function handleConnect() {
    setConnecting(true)
    try {
      await onConnect()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setConnecting(false)
    }
  }

  const detail = c.connected ? (
    <span className="flex flex-wrap items-center gap-x-1.5">
      <span aria-hidden className="size-1.5 rounded-full bg-brand" />
      <span>Conectada{c.account && <> como <span className="text-zinc-200">{c.account}</span></>}</span>
      <span>· {c.lastSyncAt ? `sincronizada ${timeAgo(c.lastSyncAt)}` : 'aún sin sincronizar'}</span>
    </span>
  ) : info.detail

  const action = c.connected ? (
    <>
      <Button variant="ghost" size="sm" onClick={onDisconnect} disabled={busy}>Desconectar</Button>
      <Button variant="secondary" size="sm" onClick={onSync} loading={current} disabled={busy}>Sincronizar</Button>
    </>
  ) : (
    <Button variant={info.connectVariant ?? 'secondary'} size="sm" onClick={handleConnect} loading={connecting} disabled={busy}>
      Conectar
    </Button>
  )

  return (
    <Row name={c.name} kind="Sincronización" detail={detail} action={action}>
      {current && (
        <p className="mt-3 flex items-center gap-2 text-sm text-zinc-300" aria-live="polite">
          <Spinner className="size-4" />
          {syncing.imported
            ? `${formatNumber(syncing.imported)} ${syncing.imported === 1 ? 'salida importada' : 'salidas importadas'}… (el historial largo tarda unos minutos)`
            : `Buscando salidas en ${c.name}…`}
        </p>
      )}
    </Row>
  )
}

function Row({ name, kind, detail, action, children }) {
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-baseline gap-2">
            <span className="text-sm font-medium text-zinc-100">{name}</span>
            <span className="text-xs text-zinc-500">{kind}</span>
          </p>
          <div className="mt-0.5 text-sm text-zinc-400">{detail}</div>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>
      {children}
    </li>
  )
}

// Resultado de la vuelta desde un servicio OAuth (?strava=connected|denied|…), mostrado una sola vez
function useOAuthResult() {
  const { toast } = useApp()
  const [searchParams, setSearchParams] = useSearchParams()
  const handled = useRef(null)
  useEffect(() => {
    for (const [provider, { results }] of Object.entries(SOURCE_INFO)) {
      const result = results && searchParams.get(provider)
      if (!result || handled.current === `${provider}:${result}`) continue
      handled.current = `${provider}:${result}`
      const [message, tone] = results[result] ?? results.error
      toast(message, tone)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams, toast])
}
