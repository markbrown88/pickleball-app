import { useState, useCallback } from 'react';
import { validateField, validateForm, ValidationRules } from '@/lib/validation';

export interface UseFormValidationReturn {
  errors: Record<string, string>;
  validateField: (fieldName: string, value: string) => string | null;
  validateForm: (data: Record<string, string>) => Record<string, string>;
  clearErrors: () => void;
  clearFieldError: (fieldName: string) => void;
  setFieldError: (fieldName: string, error: string) => void;
  hasErrors: boolean;
  isValid: boolean;
}

/**
 * Custom hook for form validation
 */
export const useFormValidation = (rules: ValidationRules): UseFormValidationReturn => {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateFieldValue = useCallback((fieldName: string, value: string): string | null => {
    const fieldRules = rules[fieldName];
    if (!fieldRules) return null;

    const error = validateField(value, fieldRules);
    
    // Update errors state
    setErrors(prev => {
      if (error) {
        return { ...prev, [fieldName]: error };
      } else {
        const { [fieldName]: removed, ...rest } = prev;
        return rest;
      }
    });

    return error;
  }, [rules]);

  const validateFormData = useCallback((data: Record<string, string>): Record<string, string> => {
    const formErrors = validateForm(data, rules);
    setErrors(formErrors);
    return formErrors;
  }, [rules]);

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  const clearFieldError = useCallback((fieldName: string) => {
    setErrors(prev => {
      const { [fieldName]: removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const setFieldError = useCallback((fieldName: string, error: string) => {
    setErrors(prev => ({ ...prev, [fieldName]: error }));
  }, []);

  const hasErrors = Object.keys(errors).length > 0;
  const isValid = !hasErrors;

  return {
    errors,
    validateField: validateFieldValue,
    validateForm: validateFormData,
    clearErrors,
    clearFieldError,
    setFieldError,
    hasErrors,
    isValid
  };
};
