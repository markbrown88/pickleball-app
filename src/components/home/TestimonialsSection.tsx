'use client';

import { useState } from 'react';

type Testimonial = {
    id: string;
    name: string;
    role: string;
    club?: string;
    quote: string;
    image?: string;
};

// TODO: Replace with real testimonials
const TESTIMONIALS: Testimonial[] = [
    {
        id: '1',
        name: 'John Smith',
        role: 'Club Director',
        club: 'Pickleplex',
        quote: 'Klyng Cup transformed how we run tournaments. The multi-stop format keeps our members engaged all season long.',
    },
    {
        id: '2',
        name: 'Sarah Johnson',
        role: 'Tournament Player',
        club: 'Belleville Pickleball Club',
        quote: 'The competitive format is amazing. Every match matters, and the cumulative points system keeps it exciting from start to finish.',
    },
    {
        id: '3',
        name: 'Mike Chen',
        role: 'Club Owner',
        club: 'Toronto Pickleball',
        quote: 'The platform makes tournament management so easy. Bracket generation, live scoring, registration—everything we need in one place.',
    },
];

interface TestimonialsSectionProps {
    /** Set to true to show the section. Default: false (hidden) */
    visible?: boolean;
}

export default function TestimonialsSection({ visible = false }: TestimonialsSectionProps) {
    // Hidden by default until real testimonials are added
    if (!visible) {
        return null;
    }

    return (
        <section className="py-20 bg-surface-1">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-16">
                    <h2 className="text-4xl font-bold text-primary mb-6">
                        What Our Community Says
                    </h2>
                    <p className="text-xl text-muted max-w-3xl mx-auto">
                        Hear from club directors and players who are part of the Klyng Cup experience
                    </p>
                </div>

                <div className="grid md:grid-cols-3 gap-8">
                    {TESTIMONIALS.map((testimonial) => (
                        <div key={testimonial.id} className="card hover:shadow-xl transition-shadow duration-300">
                            {/* Quote Icon */}
                            <div className="mb-4">
                                <svg className="w-10 h-10 text-brand-secondary/30" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                                </svg>
                            </div>

                            {/* Quote */}
                            <p className="text-secondary text-lg mb-6 leading-relaxed">
                                "{testimonial.quote}"
                            </p>

                            {/* Author */}
                            <div className="flex items-center gap-4 pt-4 border-t border-subtle">
                                {testimonial.image ? (
                                    <img
                                        src={testimonial.image}
                                        alt={testimonial.name}
                                        className="w-12 h-12 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-brand-secondary/20 flex items-center justify-center">
                                        <span className="text-brand-secondary font-bold text-lg">
                                            {testimonial.name.charAt(0)}
                                        </span>
                                    </div>
                                )}
                                <div>
                                    <div className="font-semibold text-primary">{testimonial.name}</div>
                                    <div className="text-sm text-muted">
                                        {testimonial.role}
                                        {testimonial.club && ` • ${testimonial.club}`}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
