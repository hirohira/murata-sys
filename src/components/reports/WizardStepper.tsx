'use client';

interface Step {
  number: number;
  label: string;
}

interface Props {
  steps: Step[];
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export default function WizardStepper({ steps, currentStep, onStepClick }: Props) {
  return (
    <div className="flex items-center gap-1 sm:gap-2 mb-6">
      {steps.map((step, index) => {
        const isActive = step.number === currentStep;
        const isCompleted = step.number < currentStep;
        const isClickable = onStepClick && step.number < currentStep;

        return (
          <div key={step.number} className="flex items-center flex-1">
            <button
              type="button"
              onClick={() => isClickable && onStepClick(step.number)}
              disabled={!isClickable}
              className={`flex items-center gap-1.5 sm:gap-2 w-full px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-murata-primary text-white'
                  : isCompleted
                    ? 'bg-murata-primary/10 text-murata-primary cursor-pointer hover:bg-murata-primary/20'
                    : 'bg-gray-100 text-gray-400'
              }`}
            >
              <span
                className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  isActive
                    ? 'bg-white text-murata-primary'
                    : isCompleted
                      ? 'bg-murata-primary text-white'
                      : 'bg-gray-300 text-white'
                }`}
              >
                {isCompleted ? (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step.number
                )}
              </span>
              <span className="truncate hidden sm:inline">{step.label}</span>
              <span className="truncate sm:hidden">{step.label.replace(/[①-⑨]/g, '').slice(0, 4)}</span>
            </button>
            {index < steps.length - 1 && (
              <div
                className={`w-4 sm:w-6 h-0.5 flex-shrink-0 mx-0.5 ${
                  step.number < currentStep ? 'bg-murata-primary' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
