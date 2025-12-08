'use client';

import { useState, useEffect } from 'react';
// import { formatDateUTC } from '@/lib/utils'; // Not used, we use native Date

// Types
type Transaction = {
    id: string;
    amount: number;
    amountRefunded: number;
    currency: string;
    created: number;
    status: string;
    email: string | null;
    description: string | null;
    isRefunded: boolean;
};

// Utils helper since I might not have access to lib/utils right now inside this thinking block
const formatMoney = (amount: number, currency: string = 'usd') => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
    }).format(amount / 100);
};

export default function TransactionsPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [refundModalOpen, setRefundModalOpen] = useState(false);
    const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
    const [refundAmount, setRefundAmount] = useState<string>('');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        fetchTransactions();
    }, []);

    const fetchTransactions = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/admin/transactions');
            const data = await res.json();
            if (data.transactions) setTransactions(data.transactions);
        } catch (error) {
            console.error(error);
            alert('Failed to load transactions');
        } finally {
            setLoading(false);
        }
    };

    const openRefundModal = (tx: Transaction) => {
        setSelectedTx(tx);
        const refundable = tx.amount - tx.amountRefunded;
        setRefundAmount((refundable / 100).toFixed(2)); // Default to max
        setRefundModalOpen(true);
    };

    const handleRefund = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTx) return;

        setProcessing(true);
        try {
            const amountCents = Math.round(parseFloat(refundAmount) * 100);

            const res = await fetch('/api/admin/transactions/refund', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chargeId: selectedTx.id,
                    amount: amountCents
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Refund failed');
            }

            alert('Refund processed successfully');
            setRefundModalOpen(false);
            fetchTransactions(); // Refresh list
        } catch (error: any) {
            alert(error.message);
        } finally {
            setProcessing(false);
        }
    };

    if (loading && transactions.length === 0) return <div className="p-8">Loading transactions...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-primary">Transactions</h1>
                    <p className="text-muted">View recent charges and process refunds.</p>
                </div>
                <button onClick={fetchTransactions} className="btn btn-outline btn-sm">
                    Refresh
                </button>
            </div>

            <div className="bg-surface-1 rounded-lg border border-subtle overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-surface-2 border-b border-subtle">
                            <tr>
                                <th className="p-4 font-medium text-muted">ID & Date</th>
                                <th className="p-4 font-medium text-muted">Description</th>
                                <th className="p-4 font-medium text-muted">Customer</th>
                                <th className="p-4 font-medium text-muted">Amount</th>
                                <th className="p-4 font-medium text-muted">Refunded</th>
                                <th className="p-4 font-medium text-muted">Status</th>
                                <th className="p-4 font-medium text-muted text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-subtle">
                            {transactions.map((tx) => (
                                <tr key={tx.id} className="hover:bg-surface-2 transition-colors">
                                    <td className="p-4">
                                        <div className="font-mono text-xs text-muted">{tx.id.slice(-8)}</div>
                                        <div className="text-primary mt-1">
                                            {new Date(tx.created).toLocaleDateString()}
                                        </div>
                                    </td>
                                    <td className="p-4 text-primary font-medium">
                                        {tx.description || 'Club Subscription'}
                                    </td>
                                    <td className="p-4 text-muted">
                                        {tx.email || '—'}
                                    </td>
                                    <td className="p-4 font-bold text-primary">
                                        {formatMoney(tx.amount, tx.currency)}
                                    </td>
                                    <td className="p-4 text-muted">
                                        {tx.amountRefunded > 0 ? (
                                            <span className="text-red-500">-{formatMoney(tx.amountRefunded, tx.currency)}</span>
                                        ) : '—'}
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${tx.status === 'succeeded' ? 'bg-green-100 text-green-700' :
                                            tx.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-red-100 text-red-700'
                                            }`}>
                                            {tx.status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        {tx.status === 'succeeded' && tx.amountRefunded < tx.amount && (
                                            <button
                                                onClick={() => openRefundModal(tx)}
                                                className="btn btn-xs btn-outline-danger hover:bg-red-50 text-red-600 border-red-200"
                                            >
                                                Refund
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {transactions.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-muted">
                                        No transactions found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Refund Modal */}
            {refundModalOpen && selectedTx && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-surface-1 rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
                        <h3 className="text-xl font-bold text-primary">Refund Payment</h3>
                        <p className="text-sm text-muted">
                            Refunding charge <span className="font-mono">{selectedTx.id}</span>
                        </p>

                        <div className="bg-gray-50 p-4 rounded-lg flex justify-between items-center text-sm">
                            <span>Original Amount:</span>
                            <span className="font-bold">{formatMoney(selectedTx.amount, selectedTx.currency)}</span>
                        </div>
                        {selectedTx.amountRefunded > 0 && (
                            <div className="bg-red-50 p-4 rounded-lg flex justify-between items-center text-sm text-red-700">
                                <span>Already Refunded:</span>
                                <span className="font-bold">-{formatMoney(selectedTx.amountRefunded, selectedTx.currency)}</span>
                            </div>
                        )}

                        <form onSubmit={handleRefund} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Refund Amount ($)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    max={(selectedTx.amount - selectedTx.amountRefunded) / 100}
                                    className="input w-full"
                                    value={refundAmount}
                                    onChange={(e) => setRefundAmount(e.target.value)}
                                    required
                                />
                                <p className="text-xs text-muted">
                                    Max refundable: {formatMoney(selectedTx.amount - selectedTx.amountRefunded, selectedTx.currency)}
                                </p>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setRefundModalOpen(false)}
                                    className="btn btn-ghost flex-1"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="btn btn-primary flex-1 bg-red-600 hover:bg-red-700 border-none text-white"
                                >
                                    {processing ? 'Processing...' : 'Confirm Refund'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
