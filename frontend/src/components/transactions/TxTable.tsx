import type { TxRow as TxRowType } from '../../api/types';
import { TxRow } from './TxRow';

export function TxTable({ rows }: { rows: TxRowType[] }): JSX.Element {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="text-left text-xs text-[var(--text-muted)]">
          <th className="p-2">Wallet</th>
          <th className="p-2">Side</th>
          <th className="p-2">In</th>
          <th className="p-2">Status</th>
          <th className="p-2">Link</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((tx) => (
          <TxRow key={tx.id} tx={tx} />
        ))}
      </tbody>
    </table>
  );
}
