import type { TxRow as TxRowType } from '../../api/types';
import { StatusBadge } from './StatusBadge';

export function TxRow({ tx }: { tx: TxRowType }): JSX.Element {
  return (
    <tr className="table-row border-t border-[var(--border)] text-sm text-[var(--text-primary)]">
      <td className="p-2 font-mono text-xs">{tx.walletAddress?.slice(0, 10)}…</td>
      <td className="p-2">{tx.side}</td>
      <td className="p-2">{tx.inputAmount}</td>
      <td className="p-2">
        <StatusBadge status={tx.status} />
      </td>
      <td className="p-2">
        {tx.txHash ? (
          <a
            className="text-[var(--brand-dark)] underline"
            href={`https://bscscan.com/tx/${tx.txHash}`}
            target="_blank"
            rel="noreferrer"
          >
            tx
          </a>
        ) : (
          '—'
        )}
      </td>
    </tr>
  );
}
