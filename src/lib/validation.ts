/**
 * Validation utilities for form validation
 */

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: string) => string | null;
}

export interface ValidationRules {
  [key: string]: ValidationRule;
}

/**
 * Validates a single field against its rules
 */
export const validateField = (value: string, rules: ValidationRule): string | null => {
  // Required validation
  if (rules.required && (!value || !value.trim())) {
    return 'This field is required';
  }

  // Skip other validations if value is empty and not required
  if (!value || !value.trim()) {
    return null;
  }

  const trimmedValue = value.trim();

  // Min length validation
  if (rules.minLength && trimmedValue.length < rules.minLength) {
    return `Must be at least ${rules.minLength} characters`;
  }

  // Max length validation
  if (rules.maxLength && trimmedValue.length > rules.maxLength) {
    return `Must be no more than ${rules.maxLength} characters`;
  }

  // Pattern validation
  if (rules.pattern && !rules.pattern.test(trimmedValue)) {
    return 'Invalid format';
  }

  // Custom validation
  if (rules.custom) {
    return rules.custom(trimmedValue);
  }

  return null;
};

/**
 * Validates an entire form against its rules
 */
export const validateForm = (data: Record<string, string>, rules: ValidationRules): Record<string, string> => {
  const errors: Record<string, string> = {};

  for (const [fieldName, fieldRules] of Object.entries(rules)) {
    const error = validateField(data[fieldName] || '', fieldRules);
    if (error) {
      errors[fieldName] = error;
    }
  }

  return errors;
};

/**
 * Common validation rules
 */
export const commonRules = {
  email: {
    required: true,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    custom: (value: string) => {
      if (!value) return 'Email is required';
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) return 'Please enter a valid email address';
      return null;
    }
  },
  phone: {
    required: false,
    custom: (value: string) => {
      if (!value) return null; // Phone is optional
      const cleanPhone = value.replace(/\D/g, '');
      if (cleanPhone.length !== 10) return 'Phone must be 10 digits';
      return null;
    }
  },
  required: (fieldName: string) => ({
    required: true,
    custom: (value: string) => {
      if (!value || !value.trim()) return `${fieldName} is required`;
      return null;
    }
  }),
  gender: {
    required: true,
    custom: (value: string) => {
      if (!value) return 'Gender is required';
      if (!['MALE', 'FEMALE'].includes(value)) return 'Please select a valid gender';
      return null;
    }
  }
};

/**
 * Player form validation rules
 */
export const playerValidationRules: ValidationRules = {
  firstName: commonRules.required('First name'),
  lastName: commonRules.required('Last name'),
  gender: commonRules.gender,
  clubId: commonRules.required('Club'),
  email: commonRules.email,
  phone: commonRules.phone,
  city: {
    required: false
  },
  region: {
    required: false
  },
  country: {
    required: false
  }
};

/**
 * Club form validation rules
 */
export const clubValidationRules: ValidationRules = {
  name: commonRules.required('Club name'),
  fullName: commonRules.required('Full club name'),
  email: commonRules.email,
  address: commonRules.required('Address'),
  phone: commonRules.phone,
  city: {
    required: false
  },
  region: {
    required: false
  },
  country: {
    required: false
  }
};

/**
 * Club registration validation rules
 */
export const clubRegistrationValidationRules: ValidationRules = {
  name: commonRules.required('Club name'),
  address1: commonRules.required('Address'),
  city: commonRules.required('City'),
  region: commonRules.required('Province/State'),
  postalCode: commonRules.required('Postal Code'),
  contactEmail: commonRules.email,
  contactName: commonRules.required('Contact name'),
  contactPhone: commonRules.phone,
  phone: commonRules.phone
};
