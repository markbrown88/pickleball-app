'use client';

import { Component, ReactNode } from 'react';

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Registration Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-surface-1 flex items-center justify-center px-4">
          <div className="max-w-md w-full p-8 bg-surface-2 border border-border-subtle rounded-lg text-center">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-error"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <h1 className="text-2xl font-bold text-primary mb-2">Something Went Wrong</h1>
            <p className="text-muted mb-6">
              We encountered an unexpected error while processing your registration. Please try again or
              contact support if the problem persists.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-6 p-3 bg-error/10 border border-error text-left rounded">
                <p className="text-xs font-mono text-error">{this.state.error.message}</p>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="btn btn-ghost flex-1"
              >
                Try Again
              </button>
              <a href="/" className="btn btn-primary flex-1">
                Return Home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
