'use client';

type Step = {
  id: string;
  label: string;
  description: string;
};

type RegistrationStepperProps = {
  steps: Step[];
  currentStep: string;
  onStepClick: (stepId: string) => void;
};

export function RegistrationStepper({ steps, currentStep, onStepClick }: RegistrationStepperProps) {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isComplete = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isClickable = index <= currentIndex;

          return (
            <div key={step.id} className="flex items-center flex-1">
              {/* Step Circle */}
              <div className="flex flex-col items-center">
                <button
                  onClick={() => isClickable && onStepClick(step.id)}
                  disabled={!isClickable}
                  className={`
                    relative w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all
                    ${
                      isComplete
                        ? 'bg-success text-white'
                        : isCurrent
                          ? 'bg-primary text-white ring-4 ring-primary/20'
                          : 'bg-surface-3 text-muted'
                    }
                    ${isClickable ? 'cursor-pointer hover:scale-110' : 'cursor-not-allowed'}
                  `}
                  aria-label={`Step ${index + 1}: ${step.label}`}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {isComplete ? (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </button>

                {/* Step Label */}
                <div className="mt-3 text-center max-w-[120px]">
                  <div
                    className={`text-sm font-medium ${isCurrent ? 'text-primary' : 'text-secondary'}`}
                  >
                    {step.label}
                  </div>
                  <div className="text-xs text-muted mt-0.5">{step.description}</div>
                </div>
              </div>

              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-4 transition-colors ${
                    index < currentIndex ? 'bg-success' : 'bg-border-subtle'
                  }`}
                  style={{ marginBottom: '60px' }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
