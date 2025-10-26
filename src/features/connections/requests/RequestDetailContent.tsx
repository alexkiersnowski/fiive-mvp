interface RequestDetailContentProps {
  requestId: string
  title: string
  description: string
  mode?: 'modal' | 'page'
}

export function RequestDetailContent({ requestId, title, description, mode = 'modal' }: RequestDetailContentProps) {
  return (
    <div className={`grid grid-cols-[2fr_1fr] gap-8 ${mode === 'page' ? 'p-10' : ''}`}>
      {/* Left Column */}
      <div className="flex flex-col gap-6">
        <h2 className="text-2xl font-semibold text-[var(--color-base-text-primary)]">
          {title}
        </h2>
        <p className="text-[var(--color-base-text-secondary)] whitespace-pre-wrap">
          {description}
        </p>
      </div>

      {/* Right Column */}
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold text-[var(--color-base-text-primary)]">
          Details
        </h3>
      </div>
    </div>
  )
}

