'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { formatAmountFromStripe } from '@/lib/stripe/helpers';

type PaymentAnalyticsClientProps = {
  stats: {
    totalRevenue: number;
    totalRegistrations: number;
    paidRegistrations: number;
    pendingRegistrations: number;
    failedRegistrations: number;
    refundedRegistrations: number;
    successRate: string;
  };
  revenueBreakdown: Array<{
    tournamentId: string;
    tournamentName: string;
    revenue: number;
    count: number;
  }>;
  recentPayments: Array<{
    id: string;
    tournamentId: string;
    tournamentName: string;
    playerName: string;
    playerEmail: string;
    amount: number;
    paymentStatus: string;
    registeredAt: string;
    paymentId: string | null;
  }>;
};

export function PaymentAnalyticsClient({
  stats,
  revenueBreakdown,
  recentPayments,
}: PaymentAnalyticsClientProps) {
  const formatAmount = (amountInCents: number) => {
    return `$${formatAmountFromStripe(amountInCents).toFixed(2)}`;
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
      case 'COMPLETED':
        return <span className="chip chip-success">Paid</span>;
      case 'PENDING':
        return <span className="chip chip-warning">Pending</span>;
      case 'FAILED':
        return <span className="chip chip-error">Failed</span>;
      case 'REFUNDED':
        return <span className="chip chip-muted">Refunded</span>;
      default:
        return <span className="chip chip-muted">Unknown</span>;
    }
  };

  const totalRevenueFormatted = formatAmount(stats.totalRevenue);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-primary">Payment Analytics</h1>
        <p className="text-muted">View payment statistics and revenue breakdown</p>
      </header>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <div className="text-sm text-muted mb-1">Total Revenue</div>
          <div className="text-2xl font-bold text-primary">{totalRevenueFormatted}</div>
        </div>
        <div className="card">
          <div className="text-sm text-muted mb-1">Total Registrations</div>
          <div className="text-2xl font-bold text-primary">{stats.totalRegistrations}</div>
        </div>
        <div className="card">
          <div className="text-sm text-muted mb-1">Success Rate</div>
          <div className="text-2xl font-bold text-success">{stats.successRate}%</div>
          <div className="text-xs text-muted mt-1">
            {stats.paidRegistrations} paid / {stats.totalRegistrations} total
          </div>
        </div>
        <div className="card">
          <div className="text-sm text-muted mb-1">Pending Payments</div>
          <div className="text-2xl font-bold text-warning">{stats.pendingRegistrations}</div>
        </div>
      </div>

      {/* Payment Status Breakdown */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Payment Status Breakdown</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="text-center p-4 bg-success/10 rounded-lg">
            <div className="text-2xl font-bold text-success">{stats.paidRegistrations}</div>
            <div className="text-sm text-muted">Paid</div>
          </div>
          <div className="text-center p-4 bg-warning/10 rounded-lg">
            <div className="text-2xl font-bold text-warning">{stats.pendingRegistrations}</div>
            <div className="text-sm text-muted">Pending</div>
          </div>
          <div className="text-center p-4 bg-error/10 rounded-lg">
            <div className="text-2xl font-bold text-error">{stats.failedRegistrations}</div>
            <div className="text-sm text-muted">Failed</div>
          </div>
          <div className="text-center p-4 bg-muted/10 rounded-lg">
            <div className="text-2xl font-bold text-muted">{stats.refundedRegistrations}</div>
            <div className="text-sm text-muted">Refunded</div>
          </div>
        </div>
      </div>

      {/* Revenue by Tournament */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Revenue by Tournament</h2>
        {revenueBreakdown.length === 0 ? (
          <div className="text-center py-8 text-muted">No revenue data available</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-1">
                <tr>
                  <th className="text-left p-3 text-sm font-medium text-secondary">Tournament</th>
                  <th className="text-right p-3 text-sm font-medium text-secondary">Revenue</th>
                  <th className="text-right p-3 text-sm font-medium text-secondary">Registrations</th>
                  <th className="text-right p-3 text-sm font-medium text-secondary">Average</th>
                </tr>
              </thead>
              <tbody>
                {revenueBreakdown.map((item) => (
                  <tr key={item.tournamentId} className="border-t border-border-subtle hover:bg-surface-2">
                    <td className="p-3">
                      <Link
                        href={`/tournament/${item.tournamentId}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {item.tournamentName}
                      </Link>
                    </td>
                    <td className="p-3 text-right font-semibold">
                      {formatAmount(item.revenue)}
                    </td>
                    <td className="p-3 text-right text-muted">{item.count}</td>
                    <td className="p-3 text-right text-muted">
                      {formatAmount(item.revenue / item.count)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Payments */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Recent Payments</h2>
        {recentPayments.length === 0 ? (
          <div className="text-center py-8 text-muted">No payments found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-1">
                <tr>
                  <th className="text-left p-3 text-sm font-medium text-secondary">Date</th>
                  <th className="text-left p-3 text-sm font-medium text-secondary">Tournament</th>
                  <th className="text-left p-3 text-sm font-medium text-secondary">Player</th>
                  <th className="text-left p-3 text-sm font-medium text-secondary">Status</th>
                  <th className="text-right p-3 text-sm font-medium text-secondary">Amount</th>
                  <th className="text-right p-3 text-sm font-medium text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.map((payment) => (
                  <tr key={payment.id} className="border-t border-border-subtle hover:bg-surface-2">
                    <td className="p-3 text-sm text-muted">
                      {new Date(payment.registeredAt).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      <Link
                        href={`/tournament/${payment.tournamentId}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {payment.tournamentName}
                      </Link>
                    </td>
                    <td className="p-3">
                      <div className="font-medium">{payment.playerName}</div>
                      <div className="text-xs text-muted">{payment.playerEmail}</div>
                    </td>
                    <td className="p-3">
                      {getPaymentStatusBadge(payment.paymentStatus)}
                    </td>
                    <td className="p-3 text-right font-semibold">
                      {formatAmount(payment.amount)}
                    </td>
                    <td className="p-3 text-right">
                      <Link
                        href={`/register/${payment.tournamentId}/payment/status/${payment.id}`}
                        className="btn btn-ghost btn-sm"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

