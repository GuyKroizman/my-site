import { ContractDialogData } from '../GameManager'
import { Fragment } from 'react'
import type { ReactNode } from 'react'

interface ContractDialogProps {
  dialog: ContractDialogData
  onContinue: () => void
}

export function ContractDialog({ dialog, onContinue }: ContractDialogProps) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/90 px-3 py-3 md:px-4 md:py-4">
      <div className="max-w-5xl w-full rounded-2xl border border-white/10 bg-neutral-950/95 p-3 shadow-2xl md:p-8">
        <div className="grid grid-cols-[minmax(120px,0.78fr)_minmax(0,1fr)] items-stretch gap-3 md:grid-cols-[320px_minmax(0,1fr)] md:gap-6">
          <div className="relative flex min-h-[56svh] items-end justify-center overflow-hidden rounded-2xl border border-cyan-300/20 bg-gradient-to-b from-cyan-500/5 to-fuchsia-500/5 p-2 md:min-h-[260px] md:p-4">
            <img
              src="/racing/contractor.png"
              alt="Contractor"
              className="h-full max-h-[70svh] w-full object-contain object-bottom drop-shadow-[0_0_28px_rgba(34,211,238,0.3)] md:max-h-[420px]"
            />
          </div>
          <div className="flex min-w-0 flex-col justify-between rounded-2xl border border-white/10 bg-black/55 p-3 shadow-xl backdrop-blur-sm md:bg-white/5 md:p-6 md:shadow-none">
            <div className="space-y-2 md:space-y-4">
              {dialog.lines.map((line, index) => (
                <p
                  key={`${line}-${index}`}
                  className={`leading-snug md:leading-relaxed ${index === 0 ? 'text-sm font-semibold text-white md:text-2xl' : 'text-[11px] text-neutral-200 md:text-lg'}`}
                >
                  {renderHighlightedText(line, dialog)}
                </p>
              ))}
            </div>
            <div className="mt-3 flex justify-end md:mt-6">
              <button
                onClick={onContinue}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black transition-colors hover:bg-amber-400 active:bg-amber-600 md:px-5 md:py-3"
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
