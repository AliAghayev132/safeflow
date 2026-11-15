import { clsx } from 'clsx'

/** Thin styled wrappers around native table elements. */
export const Table = ({ children, className }) => (
  <div className={clsx('overflow-x-auto rounded-xl border border-border bg-panel', className)}>
    <table className="w-full text-sm border-collapse">{children}</table>
  </div>
)

const Head = ({ children }) => (
  <thead className="bg-panel-2 text-[11px] uppercase tracking-wide text-muted">{children}</thead>
)

const Th = ({ children, className }) => (
  <th className={clsx('text-left font-semibold px-4 py-3 whitespace-nowrap', className)}>
    {children}
  </th>
)

const Row = ({ children, className, ...props }) => (
  <tr className={clsx('border-t border-border hover:bg-panel-2/60', className)} {...props}>
    {children}
  </tr>
)

const Td = ({ children, className, ...props }) => (
  <td className={clsx('px-4 py-3 align-middle', className)} {...props}>
    {children}
  </td>
)

Table.Head = Head
Table.Th = Th
Table.Row = Row
Table.Td = Td
