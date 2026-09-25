import { InfoIcon } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

// Icono (i) junto a una etiqueta que explica cómo se calcula el dato
export function InfoTip({ label, children }) {
  return (
    <Tooltip>
      <TooltipTrigger aria-label={`Cómo se calcula: ${label}`}
        className="-m-1 inline-flex rounded p-1 text-zinc-500 transition-colors hover:text-zinc-200 focus-visible:outline-2 focus-visible:outline-brand-2">
        <InfoIcon className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent className="max-w-60 text-pretty normal-case tracking-normal">{children}</TooltipContent>
    </Tooltip>
  )
}
