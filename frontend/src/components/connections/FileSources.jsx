import { useRef } from 'react'
import { FolderOpenIcon } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { Button } from '../ui/Button'

// Aparatos sin conexión directa para apps personales (Garmin solo abre su API a empresas
// aprobadas): se importan sus .fit con la carga del ciclocomputador. Cada uno explica dónde están
// eslint-disable-next-line react-refresh/only-export-components
export const FILE_SOURCES = [
  {
    id: 'garmin',
    name: 'Garmin',
    detail: 'Importa los .fit del Edge o de Garmin Connect.',
    steps: [
      ['Edge por USB', <>Conéctalo al ordenador y elige su carpeta <Path>Garmin/Activity</Path>, o la unidad entera.</>],
      ['Edge recientes y relojes', <>En Mac no aparecen como unidad. En Garmin Connect (web), abre la salida, pulsa el engranaje y
        elige <Path>Exportar original</Path>; descomprime el .zip y elige el .fit.</>],
    ],
  },
]

// Pasos para sacar los .fit del aparato; al elegirlos se abre la importación del ciclocomputador
export function FileSourceSteps({ source, onClose }) {
  const { openNewActivity } = useApp()
  const folderRef = useRef(null)
  const filesRef = useRef(null)

  function pick(e) {
    const files = [...(e.target.files ?? [])]
    e.target.value = ''
    if (!files.length) return
    onClose()
    openNewActivity('device', files)
  }

  return (
    <div className="flex flex-col gap-5">
      <ol className="flex flex-col gap-px overflow-hidden rounded-xl border border-zinc-800 bg-zinc-800 text-sm">
        {source.steps.map(([title, text]) => (
          <li key={title} className="bg-zinc-900 p-4">
            <p className="font-medium text-zinc-100">{title}</p>
            <p className="mt-1 text-zinc-400">{text}</p>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="secondary" onClick={() => filesRef.current?.click()}>Elegir archivos</Button>
        <Button onClick={() => folderRef.current?.click()}>
          <FolderOpenIcon className="size-4" />
          Elegir carpeta
        </Button>
      </div>
      {/* webkitdirectory: el navegador entrega todos los archivos de la carpeta y sus subcarpetas */}
      <input ref={folderRef} type="file" className="sr-only" tabIndex={-1} webkitdirectory="" directory="" multiple onChange={pick} />
      <input ref={filesRef} type="file" className="sr-only" tabIndex={-1} accept=".fit,.gpx" multiple onChange={pick} />
    </div>
  )
}

function Path({ children }) {
  return <span className="text-zinc-200">{children}</span>
}
