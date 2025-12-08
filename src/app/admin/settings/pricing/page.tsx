'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PricingSettingsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [settings, setSettings] = useState({
        monthlySubscriptionPrice: 6999,
        annualSubscriptionPrice: 79999,
        isSubscriptionEnabled: true,
    });

    useEffect(() => {
        fetch('/api/admin/settings/pricing')
            .then(res => res.json())
            .then(data => {
                if (data.settings) {
                    setSettings(data.settings);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch('/api/admin/settings/pricing', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            });

            if (!res.ok) throw new Error('Failed to save settings');
            alert('Settings saved successfully');
        } catch (error) {
            console.error(error);
            alert('Error saving settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8">Loading settings...</div>;

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-primary">Subscription Pricing</h1>
                <p className="text-muted">Manage the costs for Club Plans.</p>
            </div>

            <form onSubmit={handleSubmit} className="bg-surface-1 p-6 rounded-lg border border-subtle space-y-6">

                <div className="flex items-center justify-between p-4 bg-surface-2 rounded-lg">
                    <div>
                        <h3 className="font-semibold text-primary">Enable Subscriptions</h3>
                        <p className="text-sm text-muted">Allow clubs to sign up for paid plans.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={settings.isSubscriptionEnabled}
                            onChange={(e) => setSettings({ ...settings, isSubscriptionEnabled: e.target.checked })}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>

                <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Monthly Price (Cents)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2 text-muted">$</span>
                            <input
                                type="number"
                                className="input pl-8 w-full"
                                value={settings.monthlySubscriptionPrice}
                                onChange={(e) => setSettings({ ...settings, monthlySubscriptionPrice: parseInt(e.target.value) || 0 })}
                            />
                        </div>
                        <p className="text-xs text-muted">
                            Display: ${(settings.monthlySubscriptionPrice / 100).toFixed(2)}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Annual Price (Cents)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2 text-muted">$</span>
                            <input
                                type="number"
                                className="input pl-8 w-full"
                                value={settings.annualSubscriptionPrice}
                                onChange={(e) => setSettings({ ...settings, annualSubscriptionPrice: parseInt(e.target.value) || 0 })}
                            />
                        </div>
                        <p className="text-xs text-muted">
                            Display: ${(settings.annualSubscriptionPrice / 100).toFixed(2)}
                        </p>
                    </div>
                </div>

                <div className="pt-4 border-t border-subtle">
                    <button
                        type="submit"
                        disabled={saving}
                        className="btn btn-primary w-full sm:w-auto"
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </form>
        </div>
    );
}
