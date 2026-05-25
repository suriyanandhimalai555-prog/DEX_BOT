import { useQuery } from '@tanstack/react-query';
import * as adminApi from '../../api/adminApi';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/card';

export function AdminBots(): JSX.Element {
  const { data } = useQuery({ queryKey: ['admin-bots'], queryFn: adminApi.getAdminBots });

  return (
    <PageWrapper title="All bots">
      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[var(--text-muted)]">
              <th className="p-2">Name</th>
              <th className="p-2">Owner</th>
              <th className="p-2">Strategy</th>
              <th className="p-2">Status</th>
              <th className="p-2">DEX</th>
            </tr>
          </thead>
          <tbody>
            {(data?.bots as Array<Record<string, string>> | undefined)?.map((b) => (
              <tr key={b.id} className="border-t border-[var(--border)]">
                <td className="p-2">{b.name}</td>
                <td className="p-2">{b.ownerEmail ?? b.ownerName}</td>
                <td className="p-2">{b.strategyType}</td>
                <td className="p-2">{b.status}</td>
                <td className="p-2">
                  {b.dex} {b.dexVersion}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </PageWrapper>
  );
}
