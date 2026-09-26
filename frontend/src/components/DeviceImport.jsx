import { useEffect, useRef, useState } from 'react'
import { FolderOpenIcon } from 'lucide-react'
import { Button } from './ui/Button'
import { Icon } from './ui/Icon'
import { Spinner } from './ui/Spinner'
import { FormError } from './ui/Field'
import { Reading } from './OverviewCards'
import { droppedFiles, importFiles, pickActivityFiles } from '../lib/deviceFiles'
import { formatNumber } from '../lib/format'

const plural = (n, one, many) => `${formatNumber(n)} ${n === 1 ? one : many}`

// Carga de golpe las salidas del ciclocomputador: su carpeta de actividades por USB
// o los .fit/.gpx exportados de su app. Las que ya estaban se saltan.
export function DeviceImport({ initialFiles, onInitialFilesUsed, onImported, onClose }) {
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const [run, setRun] = useState(null) // { total, results: [] }
  const folderRef = useRef(null)
  const filesRef = useRef(null)
  const startedRef = useRef(null)
  const abortRef = useRef(null)

  const running = run && run.results.length < run.total

  async function start(rawFiles) {
    const files = pickActivityFiles(rawFiles)
    if (!files.length) {
      return setError('No hay archivos .fit ni .gpx. Están en la carpeta iGPSPORT/Activities o Garmin/Activity del aparato.')
    }
    setError('')
    setRun({ total: files.length, results: [] })
    const controller = new AbortController()
    abortRef.current = controller
    let imported = 0
    await importFiles(files, {
      signal: controller.signal,
      onResult: (result) => {
        if (controller.signal.aborted) return
        if (result.status === 'imported') imported += 1
        setRun((r) => ({ ...r, results: [...r.results, result] }))
      },
    })
    if (imported) onImported()
  }

  // Si se cierra el modal a medias, no se siguen subiendo archivos
  useEffect(() => () => abortRef.current?.abort(), [])

  // Archivos soltados sobre la app: se importan al abrir (una sola vez, también en StrictMode)
  useEffect(() => {
    if (initialFiles?.length && startedRef.current !== initialFiles) {
      startedRef.current = initialFiles
      onInitialFilesUsed?.()
      start(initialFiles)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFiles])

  async function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    if (running) return
    start(await droppedFiles(e.dataTransfer))
  }

  function pick(e) {
    const files = [...(e.target.files ?? [])]
    e.target.value = ''
    if (files.length) start(files)
  }

  if (run) return <Progress run={run} running={running} onAnother={() => setRun(null)} onClose={onClose} />

  return (
    <div className="flex flex-col gap-5">
      <div
        onDragEnter={(e) => { e.preventDefault(); setDragging(true) }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false) }}
        onDrop={handleDrop}
        className={`flex min-h-56 flex-col items-center justify-center gap-5 rounded-2xl border border-dashed px-6 py-10
          text-center transition-colors duration-150 ease-out
          ${dragging ? 'border-brand-2/70 bg-brand/10' : 'border-zinc-700 bg-zinc-950/40'}`}
      >
        <div className={`flex size-12 items-center justify-center rounded-full transition-colors duration-200
          ${dragging ? 'bg-brand text-brand-ink' : 'bg-zinc-800/80 text-zinc-300'}`}>
          <Icon name="upload" className="size-5" />
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-100">
            {dragging ? 'Suelta para importar' : 'Arrastra la carpeta del ciclocomputador o sus archivos .fit'}
          </p>
          <p className="mt-1 text-xs text-zinc-500">Se importan todas las salidas de una vez · las que ya tengas se saltan</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => folderRef.current?.click()}>
            <FolderOpenIcon className="size-4" />
            Elegir carpeta
          </Button>
          <Button variant="secondary" onClick={() => filesRef.current?.click()}>Elegir archivos</Button>
        </div>
        {/* webkitdirectory: el navegador entrega todos los archivos de la carpeta y sus subcarpetas */}
        <input ref={folderRef} type="file" className="sr-only" tabIndex={-1} webkitdirectory="" directory="" multiple onChange={pick} />
        <input ref={filesRef} type="file" className="sr-only" tabIndex={-1} accept=".fit,.gpx" multiple onChange={pick} />
      </div>

      <dl className="grid gap-px overflow-hidden rounded-xl border border-zinc-800 bg-zinc-800 text-sm sm:grid-cols-2">
        <div className="bg-zinc-900 p-4">
          <dt className="font-medium text-zinc-100">iGPSPORT, Garmin, Bryton y otros con USB</dt>
          <dd className="mt-1 text-zinc-400">
            Conéctalo al ordenador (en iGPSPORT, pulsa el botón izquierdo para el modo conexión) y elige su carpeta{' '}
            <span className="text-zinc-200">iGPSPORT/Activities</span> o <span className="text-zinc-200">Garmin/Activity</span>, o la unidad entera.
          </dd>
        </div>
        <div className="bg-zinc-900 p-4">
          <dt className="font-medium text-zinc-100">Wahoo, Hammerhead y Garmin recientes</dt>
          <dd className="mt-1 text-zinc-400">
            No aparecen como unidad: exporta los .fit desde su app o desde Garmin Connect (exportación de datos) y elígelos aquí.
          </dd>
        </div>
      </dl>
      <FormError>{error}</FormError>
    </div>
  )
}

function Progress({ run, running, onAnother, onClose }) {
  const count = (status) => run.results.filter((r) => r.status === status).length
  const imported = count('imported')
  const duplicates = count('duplicate')
  const failed = run.results.filter((r) => r.status === 'failed')
  const done = run.results.length
  const pct = Math.round((done / run.total) * 100)

  return (
    <div className="flex flex-col gap-5">
      <div aria-live="polite">
        <div className="flex items-baseline justify-between gap-4 text-sm">
          <p className="flex items-center gap-2 font-medium text-zinc-100">
            {running ? <Spinner className="size-4" /> : <Icon name="check" className="size-4" strokeWidth={2} />}
            {running ? `Importando ${formatNumber(done + 1)} de ${formatNumber(run.total)}…` : `Revisados ${plural(run.total, 'archivo', 'archivos')}`}
          </p>
          <span className="text-zinc-400 tabular-nums">{pct} %</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800" role="progressbar"
          aria-valuemin={0} aria-valuemax={run.total} aria-valuenow={done} aria-label="Progreso de la importación">
          <div className="h-full rounded-full bg-brand transition-[width] duration-300 ease-out" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-zinc-800 bg-zinc-800">
        <Reading label="Importadas" value={formatNumber(imported)} size="text-2xl" />
        <Reading label="Ya estaban" value={formatNumber(duplicates)} size="text-2xl" />
        <Reading label="Descartadas" value={formatNumber(failed.length)} size="text-2xl" />
      </div>

      {failed.length > 0 && (
        <details className="group rounded-xl border border-zinc-800 bg-zinc-950/40">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm text-zinc-300 hover:text-zinc-100">
            <Icon name="chevronRight" className="size-4 transition-transform duration-150 group-open:rotate-90" />
            Por qué se descartaron {plural(failed.length, 'archivo', 'archivos')}
          </summary>
          <ul className="max-h-48 divide-y divide-zinc-800 overflow-y-auto border-t border-zinc-800 text-xs">
            {failed.map(({ file, message }) => (
              <li key={`${file.webkitRelativePath || file.name}-${file.size}`} className="flex flex-col gap-0.5 px-4 py-2 sm:flex-row sm:gap-3">
                <span className="shrink-0 truncate text-zinc-200 sm:w-44">{file.name}</span>
                <span className="text-zinc-400">{message}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="flex justify-end gap-2">
        {running ? (
          // Las subidas en curso terminan; las pendientes ya no se envían
          <Button variant="secondary" onClick={onClose}>Detener</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onAnother}>Importar más</Button>
            <Button onClick={onClose}>Listo</Button>
          </>
        )}
      </div>
    </div>
  )
}
