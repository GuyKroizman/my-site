import { ContractDialogData } from '../GameManager'
import { Fragment } from 'react'
import type { ReactNode } from 'react'

interface ContractDialogProps {
  dialog: ContractDialogData
  onContinue: () => void
}

export function ContractDialog({ dialog, onContinue }: ContractDialogProps) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/90 px-4 py-4">
      <div className="max-w-5xl w-full rounded-2xl border border-white/10 bg-neutral-950/95 p-5 shadow-2xl md:p-8">
        <div className="grid gap-6 md:grid-cols-[320px_minmax(0,1fr)] md:items-stretch">
          <div className="flex min-h-[260px] items-end justify-center rounded-2xl border border-cyan-300/20 bg-gradient-to-b from-cyan-500/5 to-fuchsia-500/5 p-4">
            <img
              src="/racing/contractor.png"
              alt="Contractor"
              className="max-h-[420px] w-auto object-contain drop-shadow-[0_0_28px_rgba(34,211,238,0.3)]"
            />
          </div>
          <div className="flex min-w-0 flex-col justify-between rounded-2xl bg-white/5 p-5 md:p-6">
            <div className="space-y-4">
              {dialog.lines.map((line, index) => (
                <p
                  key={`${line}-${index}`}
                  className={`leading-relaxed ${index === 0 ? 'text-2xl font-semibold text-white' : 'text-lg text-neutral-200'}`}
                >
                  {renderHighlightedText(line, dialog)}
                </p>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={onContinue}
                className="rounded-lg bg-amber-500 px-5 py-3 font-bold text-black transition-colors hover:bg-amber-400 active:bg-amber-600"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function renderHighlightedText(line: string, dialog: ContractDialogData) {
  const highlights = [
    dialog.upgradeName
      ? { value: dialog.upgradeName, className: 'font-semibold text-orange-400' }
      : null,
    dialog.taskText
      ? { value: dialog.taskText, className: 'font-semibold text-red-400' }
      : null,
  ].filter((highlight): highlight is { value: string; className: string } => highlight !== null)

  if (highlights.length === 0) {
    return line
  }

  const matches: Array<{ start: number; end: number; value: string; className: string }> = []

  highlights.forEach((highlight) => {
    const start = line.indexOf(highlight.value)
    if (start === -1) {
      return
    }

    matches.push({
      start,
      end: start + highlight.value.length,
      value: highlight.value,
      className: highlight.className,
    })
  })

  if (matches.length === 0) {
    return line
  }

  matches.sort((a, b) => a.start - b.start)

  const parts: ReactNode[] = []
  let cursor = 0

  matches.forEach((match, index) => {
    if (match.start < cursor) {
      return
    }

    if (cursor < match.start) {
      parts.push(
        <Fragment key={`text-${index}-${cursor}`}>
          {line.slice(cursor, match.start)}
        </Fragment>
      )
    }

    parts.push(
      <span key={`highlight-${index}-${match.start}`} className={match.className}>
        {match.value}
      </span>
    )

    cursor = match.end
  })

  if (cursor < line.length) {
    parts.push(
      <Fragment key={`text-tail-${cursor}`}>
        {line.slice(cursor)}
      </Fragment>
    )
  }

  return parts
}
