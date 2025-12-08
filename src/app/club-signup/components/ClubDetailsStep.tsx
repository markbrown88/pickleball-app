'use client';

import { useState } from 'react';
import { ClubData } from './ClubWizard';
import { useFormValidation } from '@/hooks/useFormValidation'; // assuming exists, or I'll generic it
import { showSuccess, showError } from '@/lib/toast'; // assuming exists

interface ClubDetailsStepProps {
    initialData: ClubData;
    userId: string;
    onNext: (data: ClubData) => void;
    onBack: () => void;
}

export default function ClubDetailsStep({ initialData, userId, onNext, onBack }: ClubDetailsStepProps) {
    const [formData, setFormData] = useState({
        name: initialData.name || '',
        city: initialData.city || '',
        region: initialData.region || '',
        address: initialData.address || '',
        description: initialData.description || '',
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            // Create or Update Club via API
            // We do this NOW so that for step 3 (Subscription) we have a real Club ID to attach payment to.
            const res = await fetch('/api/clubs/wizard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    id: initialData.isNew ? undefined : initialData.id,
                    userId, // Current user becomes director
                }),
            });

            if (!res.ok) throw new Error((await res.json()).error || 'Failed to save club');

            const savedClub = await res.json();

            // Pass the real ID forward
            // Pass the real ID and all updated data forward so it persists in Wizard state
            onNext({
                ...initialData,
                id: savedClub.id,
                name: savedClub.name,
                city: formData.city,
                region: formData.region,
                address: formData.address,
                description: formData.description
            });

        } catch (error: any) {
            console.error(error);
            // Assuming showEror exists, otherwise alert
            if (typeof showError === 'function') showError(error.message);
            else alert(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-primary">
                    {initialData.isNew ? 'Create New Club' : 'Confirm Club Details'}
                </h2>
                <p className="text-muted">Tell us a bit more about your club.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 bg-surface-1 p-6 rounded-lg border border-subtle">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Club Name</label>
                    <input
                        className="input w-full"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        required
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">City</label>
                        <input
                            className="input w-full"
                            value={formData.city}
                            onChange={e => setFormData({ ...formData, city: e.target.value })}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Region/Province</label>
                        <input
                            className="input w-full"
                            value={formData.region}
                            onChange={e => setFormData({ ...formData, region: e.target.value })}
                            required
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Address (Optional)</label>
                    <input
                        className="input w-full"
                        value={formData.address}
                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                        placeholder="123 Pickleball Lane"
                    />
                </div>

                <div className="flex gap-4 pt-4">
                    <button type="button" onClick={onBack} className="btn btn-ghost flex-1">
                        Back
                    </button>
                    <button type="submit" disabled={isSubmitting} className="btn btn-primary flex-1">
                        {isSubmitting ? 'Saving...' : 'Save & Continue'}
                    </button>
                </div>
            </form>
        </div>
    );
}
