import { useEffect, useRef, useState } from 'react'
import { droppedFiles } from './deviceFiles'

// Detecta archivos arrastrados sobre la ventana y entrega el primero que se suelte
// y una promesa con todos (con el contenido de las carpetas)
export function useWindowFileDrag(enabled, onDropFile) {
  const [dragging, setDragging] = useState(false)
  const depth = useRef(0)
  const onDropRef = useRef(onDropFile)
  useEffect(() => {
    onDropRef.current = onDropFile
  })

  useEffect(() => {
    const hasFiles = (e) => e.dataTransfer?.types?.includes('Files')
    const reset = () => {
      depth.current = 0
      setDragging(false)
    }
    const onEnter = (e) => {
      if (!enabled || !hasFiles(e)) return
      depth.current += 1
      setDragging(true)
    }
    const onLeave = (e) => {
      if (!enabled || !hasFiles(e)) return
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setDragging(false)
    }
    // Siempre se evita que el navegador abra el archivo si se suelta fuera de una zona válida
    const onOver = (e) => hasFiles(e) && e.preventDefault()
    const onDrop = (e) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      const file = e.dataTransfer.files?.[0]
      const wasDragging = depth.current > 0
      reset()
      // Las carpetas soltadas solo se pueden abrir durante el evento: se recorren ya y se entrega la promesa
      if (enabled && wasDragging && file) onDropRef.current(file, droppedFiles(e.dataTransfer))
    }

    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('dragover', onOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [enabled])

  return enabled && dragging
}
