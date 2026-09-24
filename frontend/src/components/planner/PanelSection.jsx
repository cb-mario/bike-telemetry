import { Label } from '../ui/Text'

export function PanelSection({ title, children, action }) {
  return (
    <section className="flex flex-col gap-3 border-t border-zinc-800 pt-4">
      <div className="flex items-center justify-between">
        <Label as="h2">{title}</Label>
        {action}
      </div>
      {children}
    </section>
  )
}
