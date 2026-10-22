import type { ReactNode } from "react";

export interface TerminalPanelProps {
  title: string;
  testId?: string;
  className?: string;
  headerActions?: ReactNode;
  children: ReactNode;
}

export function TerminalPanel({ title, testId, className = "", headerActions, children }: TerminalPanelProps) {
  return <section data-testid={testId} className={`terminal-panel ${className}`}>
    <header className="terminal-panel-header">
      <h2 className="text-[12px] font-semibold text-foreground">{title}</h2>
      {headerActions && <div className="flex min-w-0 items-center gap-1.5">{headerActions}</div>}
    </header>
    {children}
  </section>;
}

export function TerminalEmpty({ title, detail, retry }: { title: string; detail?: string; retry?: () => void }) {
  return <div className="flex min-h-36 flex-col items-center justify-center px-5 py-8 text-center">
    <span className="mb-3 h-1 w-8 bg-[#32a9ff]/70" />
    <p className="text-[12px] font-medium text-foreground">{title}</p>
    {detail && <p className="mt-1.5 max-w-[250px] text-[11px] leading-relaxed text-muted-foreground">{detail}</p>}
    {retry && <button type="button" onClick={retry} className="mt-3 text-[11px] font-semibold text-sky-400 hover:text-sky-300">Retry feed</button>}
  </div>;
}
