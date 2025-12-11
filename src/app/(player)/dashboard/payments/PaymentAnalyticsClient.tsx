'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatAmountFromStripe } from '@/lib/stripe/helpers';

type Payment = {
  id: string;
  tournamentId: string;
  tournamentName: string;
  playerName: string;
  playerEmail: string;
  amount: number;
  paymentStatus: string;
  registeredAt: string;
  paymentId: string | null;
};

type Pagination = {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

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
  initialPayments: Payment[];
  initialPendingPayments: Payment[];
};

export function PaymentAnalyticsClient({
  stats,
  revenueBreakdown,
  initialPayments,
  initialPendingPayments,
}: PaymentAnalyticsClientProps) {
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED'>('ALL');
  const [isRefundingId, setIsRefundingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [payments, setPayments] = useState<Payment[]>(initialPayments);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 25,
    totalCount: initialPayments.length,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch payments when filter, search, or page changes
  const fetchPayments = useCallback(async (page: number, status: string, search: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '25',
        status,
        search,
      });
      const response = await fetch(`/api/payments/list?${params}`);
      if (response.ok) {
        const data = await response.json();
        setPayments(data.payments);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Failed to fetch payments:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Trigger fetch when dependencies change
  useEffect(() => {
    // Only fetch if search is active or filter changed from ALL
    if (debouncedSearch || paymentFilter !== 'ALL' || pagination.page > 1) {
      fetchPayments(pagination.page, paymentFilter, debouncedSearch);
    } else {
      // Reset to initial data when no search/filter
      setPayments(initialPayments);
      setPagination({
        page: 1,
        limit: 25,
        totalCount: initialPayments.length,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      });
    }
  }, [debouncedSearch, paymentFilter]);

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
    fetchPayments(newPage, paymentFilter, debouncedSearch);
  };

  // Handle filter change - reset to page 1
  const handleFilterChange = (filter: 'ALL' | 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED') => {
    setPaymentFilter(filter);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

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

  const canRefund = (status: string) => status === 'PAID' || status === 'COMPLETED';

  const handleRefund = async (payment: Payment) => {
    if (isRefundingId) {
      return;
    }

    if (!canRefund(payment.paymentStatus)) {
      window.alert('Only paid registrations can be refunded.');
      return;
    }

    const defaultAmount = formatAmountFromStripe(payment.amount).toFixed(2);
    const amountInput = window.prompt(
      'Enter refund amount in dollars (leave blank for full refund):',
      defaultAmount
    );

    if (amountInput === null) {
      return;
    }

    const normalizedAmount = amountInput.trim();
    const amount =
      normalizedAmount.length === 0 ? undefined : parseFloat(normalizedAmount.replace(/[^0-9.]/g, ''));

    if (amount !== undefined && (Number.isNaN(amount) || amount <= 0)) {
      window.alert('Please enter a valid refund amount greater than 0.');
      return;
    }

    const reason =
      window.prompt('Enter a refund reason (optional):', 'Admin refund')?.trim() || 'Admin refund';

    setIsRefundingId(payment.id);
    try {
      const response = await fetch('/api/payments/refund', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          registrationId: payment.id,
          amount,
          reason,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to process refund.';
        try {
          const data = await response.json();
          errorMessage = data.details || data.error || errorMessage;
        } catch {
          // ignore parse error
        }
        window.alert(errorMessage);
        return;
      }

      window.alert('Refund processed successfully.');
      router.refresh();
    } catch (error) {
      console.error('Refund request failed:', error);
      window.alert('Unexpected error processing refund. Please try again.');
    } finally {
      setIsRefundingId(null);
    }
  };

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

      {/* Pending Payments Section */}
      {initialPendingPayments.length > 0 && (
        <div className="card border-warning/20">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Pending Payments ({initialPendingPayments.length})</h2>
            <span className="chip chip-warning">Action Required</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-1">
                <tr>
                  <th className="text-left p-3 text-sm font-medium text-secondary">Date</th>
                  <th className="text-left p-3 text-sm font-medium text-secondary">Tournament</th>
                  <th className="text-left p-3 text-sm font-medium text-secondary">Player</th>
                  <th className="text-right p-3 text-sm font-medium text-secondary">Amount</th>
                  <th className="text-right p-3 text-sm font-medium text-secondary">Days Pending</th>
                  <th className="text-center p-3 text-sm font-medium text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody>
                {initialPendingPayments.map((payment: Payment) => {
                  const daysPending = Math.floor(
                    (Date.now() - new Date(payment.registeredAt).getTime()) / (1000 * 60 * 60 * 24)
                  );
                  return (
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
                      <td className="p-3 text-right font-semibold">
                        {formatAmount(payment.amount)}
                      </td>
                      <td className="p-3 text-right">
                        <span className={daysPending >= 1 ? 'text-warning font-medium' : 'text-muted'}>
                          {daysPending} {daysPending === 1 ? 'day' : 'days'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/register/${payment.tournamentId}/payment/status/${payment.id}`}
                            className="btn btn-ghost btn-sm"
                          >
                            View
                          </Link>
                          {canRefund(payment.paymentStatus) && (
                            <button
                              type="button"
                              onClick={() => handleRefund(payment)}
                              className="btn btn-outline btn-sm"
                              disabled={isRefundingId === payment.id}
                            >
                              {isRefundingId === payment.id ? 'Processing...' : 'Refund'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* All Payments */}
      <div className="card">
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold">All Payments</h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleFilterChange('ALL')}
                className={`btn btn-sm ${paymentFilter === 'ALL' ? 'btn-primary' : 'btn-ghost'}`}
              >
                All
              </button>
              <button
                onClick={() => handleFilterChange('PAID')}
                className={`btn btn-sm ${paymentFilter === 'PAID' ? 'btn-primary' : 'btn-ghost'}`}
              >
                Paid
              </button>
              <button
                onClick={() => handleFilterChange('PENDING')}
                className={`btn btn-sm ${paymentFilter === 'PENDING' ? 'btn-primary' : 'btn-ghost'}`}
              >
                Pending
              </button>
              <button
                onClick={() => handleFilterChange('FAILED')}
                className={`btn btn-sm ${paymentFilter === 'FAILED' ? 'btn-primary' : 'btn-ghost'}`}
              >
                Failed
              </button>
              <button
                onClick={() => handleFilterChange('REFUNDED')}
                className={`btn btn-sm ${paymentFilter === 'REFUNDED' ? 'btn-primary' : 'btn-ghost'}`}
              >
                Refunded
              </button>
            </div>
          </div>
          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search by name, email, or tournament..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input w-full sm:w-80"
            />
            {isLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            )}
          </div>
        </div>

        {/* Results info */}
        {(debouncedSearch || paymentFilter !== 'ALL') && (
          <div className="text-sm text-muted mb-4">
            Showing {payments.length} of {pagination.totalCount} results
            {debouncedSearch && <span> for &quot;{debouncedSearch}&quot;</span>}
          </div>
        )}

        {payments.length === 0 ? (
          <div className="text-center py-8 text-muted">
            No {paymentFilter === 'ALL' ? '' : paymentFilter.toLowerCase()} payments found
            {debouncedSearch && <span> matching &quot;{debouncedSearch}&quot;</span>}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-surface-1">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium text-secondary">Date</th>
                    <th className="text-left p-3 text-sm font-medium text-secondary">Tournament</th>
                    <th className="text-left p-3 text-sm font-medium text-secondary">Player</th>
                    <th className="text-left p-3 text-sm font-medium text-secondary">Status</th>
                    <th className="text-right p-3 text-sm font-medium text-secondary">Amount</th>
                    <th className="text-center p-3 text-sm font-medium text-secondary">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment: Payment) => (
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
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/register/${payment.tournamentId}/payment/status/${payment.id}`}
                            className="btn btn-ghost btn-sm"
                          >
                            View
                          </Link>
                          {canRefund(payment.paymentStatus) && (
                            <button
                              type="button"
                              onClick={() => handleRefund(payment)}
                              className="btn btn-outline btn-sm"
                              disabled={isRefundingId === payment.id}
                            >
                              {isRefundingId === payment.id ? 'Processing...' : 'Refund'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border-subtle">
                <div className="text-sm text-muted">
                  Page {pagination.page} of {pagination.totalPages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={!pagination.hasPrevPage || isLoading}
                    className="btn btn-sm btn-ghost disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={!pagination.hasNextPage || isLoading}
                    className="btn btn-sm btn-ghost disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

