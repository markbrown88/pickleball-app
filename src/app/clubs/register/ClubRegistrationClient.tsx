'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ClubRegistrationClient() {
  const [formData, setFormData] = useState({
    name: '',
    address1: '',
    city: '',
    region: '',
    postalCode: '',
    phone: '',
    contactEmail: '',
    contactName: '',
    contactPhone: '',
    description: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setSubmitStatus('success');
    } catch (error) {
      console.error(error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-app">
      <header className="bg-surface-1 border-b border-subtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="text-2xl font-bold text-primary">
                Klyng Cup
              </Link>
            </div>
            <nav className="hidden md:flex items-center space-x-8">
              <Link href="/about" className="nav-link">About</Link>
              <Link href="/tournaments" className="nav-link">Current Tournaments</Link>
              <Link href="/clubs" className="nav-link">Clubs</Link>
              <Link href="/rules" className="nav-link">Rules &amp; Format</Link>
            </nav>
            <div className="flex items-center space-x-4">
              <Link href="/" className="btn btn-ghost">
                Home
              </Link>
            </div>
          </div>
        </div>
      </header>

      <section className="py-20 bg-gradient-to-br from-brand-primary to-brand-primary-hover">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">Register Your Club</h1>
          <p className="text-xl text-brand-secondary mb-8">Join the Global Klyng Cup Community</p>
          <p className="text-lg text-white/90 max-w-3xl mx-auto">
            Register your pickleball club to participate in Klyng Cup tournaments anywhere in the world.
            Create custom tournaments, manage teams, and compete in the most exciting co-ed interclub league format.
          </p>
        </div>
      </section>

      <section className="py-20 bg-surface-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {submitStatus === 'success' ? (
            <div className="text-center py-12">
              <div className="bg-surface-2 rounded-lg p-8 max-w-md mx-auto">
                <div className="bg-status-success w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-primary mb-4">Registration Submitted!</h2>
                <p className="text-muted mb-6">
                  Thank you for registering your club for the Klyng Cup. We'll review your application and get back to you within 1-2 business days.
                </p>
                <div className="space-y-4">
                  <Link href="/clubs" className="btn btn-primary">
                    Back to Clubs
                  </Link>
                  <Link href="/" className="btn btn-ghost">
                    Home
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="mb-8">
                <h2 className="text-3xl Posted:3-15 font-bold text-primary mb-4">Club Information</h2>
                <p className="text-muted">Please provide the following information about your club. All fields marked with * are required.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                <div>
                  <h3 className="text-xl font-semibold text-primary mb-6">Club Details</h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-secondary mb-2">
                        Club Name *
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                        className="input"
                        placeholder="Enter your club name"
                      />
                    </div>

                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-secondary mb-2">
                        Club Phone
                      </label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="input"
                        placeholder="(555) 123-4567"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label htmlFor="description" className="block text-sm font-medium text-secondary mb-2">
                        Club Description
                      </label>
                      <textarea
                        id="description"
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        rows={4}
                        className="input"
                        placeholder="Tell us about your club, its history, and what makes it special..."
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-primary mb-6">Address Information</h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <label htmlFor="address1" className="block text-sm font-medium text-secondary mb-2">
                        Street Address *
                      </label>
                      <input
                        type="text"
                        id="address1"
                        name="address1"
                        value={formData.address1}
                        onChange={handleInputChange}
                        required
                        className="input"
                        placeholder="123 Main Street"
                      />
                    </div>

                    <div>
                      <label htmlFor="city" className="block text-sm font-medium text-secondary mb-2">
                        City *
                      </label>
                      <input
                        type="text"
                        id="city"
                        name="city"
                        value={formData.city}
                        onChange={handleInputChange}
                        required
                        className="input"
                        placeholder="Toronto"
                      />
                    </div>

                    <div>
                      <label htmlFor="region" className="block text-sm font-medium text-secondary mb-2">
                        Province *
                      </label>
                      <select
                        id="region"
                        name="region"
                        value={formData.region}
                        onChange={handleInputChange}
                        required
                        className="input"
                      >
                        <option value="">Select Province</option>
                        <option value="ON">Ontario</option>
                        <option value="BC">British Columbia</option>
                        <option value="AB">Alberta</option>
                        <option value="MB">Manitoba</option>
                        <option value="SK">Saskatchewan</option>
                        <option value="QC">Quebec</option>
                        <option value="NS">Nova Scotia</option>
                        <option value="NB">New Brunswick</option>
                        <option value="NL">Newfoundland and Labrador</option>
                        <option value="PE">Prince Edward Island</option>
                        <option value="YT">Yukon</option>
                        <option value="NT">Northwest Territories</option>
                        <option value="NU">Nunavut</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="postalCode" className="block text-sm font-medium text-secondary mb-2">
                        Postal Code *
                      </label>
                      <input
                        type="text"
                        id="postalCode"
                        name="postalCode"
                        value={formData.postalCode}
                        onChange={handleInputChange}
                        required
                        className="input"
                        placeholder="M5V 3A8"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-primary mb-6">Primary Contact</h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="contactName" className="block text-sm font-medium text-secondary mb-2">
                        Contact Name *
                      </label>
                      <input
                        type="text"
                        id="contactName"
                        name="contactName"
                        value={formData.contactName}
                        onChange={handleInputChange}
                        required
                        className="input"
                        placeholder="John Smith"
                      />
                    </div>

                    <div>
                      <label htmlFor="contactEmail" className="block text-sm font-medium text-secondary mb-2">
                        Contact Email *
                      </label>
                      <input
                        type="email"
                        id="contactEmail"
                        name="contactEmail"
                        value={formData.contactEmail}
                        onChange={handleInputChange}
                        required
                        className="input"
                        placeholder="john@example.com"
                      />
                    </div>

                    <div>
                      <label htmlFor="contactPhone" className="block text-sm font-medium text-secondary mb-2">
                        Contact Phone *
                      </label>
                      <input
                        type="tel"
                        id="contactPhone"
                        name="contactPhone"
                        value={formData.contactPhone}
                        onChange={handleInputChange}
                        required
                        className="input"
                        placeholder="(555) 123-4567"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-surface-2 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-primary mb-4">Terms and Conditions</h3>
                  <div className="space-y-4 text-sm text-muted">
                    <p>
                      By registering your club for Klyng Cup tournaments, you agree to:
                    </p>
                    <ul className="list-disc list-inside space-y-2 ml-4">
                      <li>Field teams according to tournament-specific requirements and skill divisions</li>
                      <li>Ensure all players are registered members of Klyng Cup</li>
                      <li>Submit team rosters and lineups according to tournament deadlines</li>
                      <li>Maintain good sportsmanship and follow all tournament rules</li>
                      <li>Pay entry fees according to tournament-specific requirements</li>
                      <li>Designate a Club Pro or Captain to manage team affairs</li>
                    </ul>
                    <p>
                      Registration is subject to approval. You will be notified within 1-2 business days of your application status.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn btn-primary text-lg py-4 px-8 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Submitting...' : 'Register Club'}
                  </button>
                  <Link href="/clubs" className="btn btn-ghost text-lg py-4 px-8">
                    Cancel
                  </Link>
                </div>

                {submitStatus === 'error' && (
                  <div className="text-center">
                    <p className="text-error">There was an error submitting your registration. Please try again.</p>
                  </div>
                )}
              </form>
            </div>
          )}
        </div>
      </section>

      <footer className="bg-surface-1 border-t border-subtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-xl font-bold text-primary mb-4">Klyng Cup</h3>
              <p className="text-muted mb-4">The ultimate multi-stop pickleball championship experience for clubs and communities.</p>
            </div>
            <div>
              <h4 className="font-semibold text-primary mb-4">Tournament</h4>
              <ul className="space-y-2">
                <li><Link href="/tournaments" className="text-muted hover:text-primary">Current Tournaments</Link></li>
                <li><Link href="/rules" className="text-muted hover:text-primary">Rules &amp; Format</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-primary mb-4">Community</h4>
              <ul className="space-y-2">
                <li><Link href="/clubs" className="text-muted hover:text-primary">Clubs</Link></li>
                <li><Link href="/about" className="text-muted hover:text-primary">About Us</Link></li>
                <li><Link href="/contact" className="text-muted hover:text-primary">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-primary mb-4">Quick Links</h4>
              <ul className="space-y-2">
                <li><Link href="/" className="text-muted hover:text-primary">Home</Link></li>
                <li><Link href="/dashboard" className="text-muted hover:text-primary">Dashboard</Link></li>
                <li><Link href="/profile" className="text-muted hover:text-primary">Profile</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-subtle mt-8 pt-8 text-center text-muted">
            <p>&copy; 2024 Klyng Cup. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}


