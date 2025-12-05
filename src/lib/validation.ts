import { z } from 'zod';

// Common schemas
export const CuidSchema = z.string().cuid();
export const EmailSchema = z.string().email().max(255);
export const TokenSchema = z.string().min(5).max(64);

// Lineup Validation
export const LineupPlayerSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).max(100),
  gender: z.enum(['MALE', 'FEMALE'])
});

export const TeamLineupSchema = z.array(LineupPlayerSchema)
  .length(4)
  .refine((players) => {
    // Validate exactly 2 males and 2 females
    const males = players.filter(p => p.gender === 'MALE').length;
    const females = players.filter(p => p.gender === 'FEMALE').length;
    return males === 2 && females === 2;
  }, { message: 'Lineup must contain exactly 2 males and 2 females' });

// Map<MatchId, Map<TeamId, Player[]>>
export const LineupsSchema = z.record(
  z.string().cuid(), // matchId
  z.record(
    z.string().cuid(), // teamId
    TeamLineupSchema
  )
);

// Score validation
export const ScoreSchema = z.object({
  slot: z.enum(['MENS_DOUBLES', 'WOMENS_DOUBLES', 'MIXED_1', 'MIXED_2', 'TIEBREAKER']),
  teamAScore: z.number().int().min(0).max(30).nullable(),
  teamBScore: z.number().int().min(0).max(30).nullable()
}).refine((data) => {
  // If one score is set, both must be set
  if (data.teamAScore !== null || data.teamBScore !== null) {
    return data.teamAScore !== null && data.teamBScore !== null;
  }
  return true;
}, { message: 'Both scores must be provided or both must be null' });

// Player creation
export const CreatePlayerSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  gender: z.enum(['MALE', 'FEMALE']),
  clubId: CuidSchema,
  email: EmailSchema.optional().or(z.literal('')),
  phone: z.string().max(20).optional().or(z.literal('')),
  dupr: z.number().min(0).max(10).optional(),
  birthday: z.string().datetime().optional()
});

/**
 * Form Validation Interfaces and Helpers
 */

export type ValidationRule = {
  required?: boolean;
  pattern?: RegExp;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  email?: boolean;
  custom?: (value: any) => string | undefined | null | boolean;
  message?: string;
};

export type ValidationRules = Record<string, ValidationRule>;

export const validateField = (value: any, rule: ValidationRule): string | null => {
  if (!rule) return null;

  // Check required
  if (rule.required) {
    if (value === null || value === undefined || value === '') {
      return rule.message || 'This field is required';
    }
  }

  // Skip other checks if value is empty and not required
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const strVal = String(value);

  // Pattern check
  if (rule.pattern && !rule.pattern.test(strVal)) {
    return rule.message || 'Invalid format';
  }

  // Length checks
  if (rule.minLength && strVal.length < rule.minLength) {
    return rule.message || `Must be at least ${rule.minLength} characters`;
  }
  if (rule.maxLength && strVal.length > rule.maxLength) {
    return rule.message || `Must be at most ${rule.maxLength} characters`;
  }

  // Numeric checks
  if (typeof value === 'number' || !isNaN(Number(value))) {
    const numVal = Number(value);
    if (rule.min !== undefined && numVal < rule.min) {
      return rule.message || `Must be at least ${rule.min}`;
    }
    if (rule.max !== undefined && numVal > rule.max) {
      return rule.message || `Must be at most ${rule.max}`;
    }
  }

  // Email check
  if (rule.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(strVal)) {
      return rule.message || 'Invalid email address';
    }
  }

  // Custom validation
  if (rule.custom) {
    const result = rule.custom(value);
    if (typeof result === 'string') return result;
    if (result === false) return rule.message || 'Invalid value';
  }

  return null;
};

export const validateForm = (data: Record<string, any>, rules: ValidationRules): Record<string, string> => {
  const errors: Record<string, string> = {};

  Object.keys(rules).forEach((field) => {
    const error = validateField(data[field], rules[field]);
    if (error) {
      errors[field] = error;
    }
  });

  return errors;
};

export const clubRegistrationValidationRules: ValidationRules = {
  fullName: { required: true, minLength: 2, message: 'Full name is required' },
  name: { required: true, minLength: 2, message: 'Club name is required' },
  email: { required: true, email: true, message: 'Valid email is required' },
  phoneNumber: { required: true, pattern: /^[\d\s()+-]{10,}$/, message: 'Valid phone number is required' },
  city: { required: true, minLength: 2, message: 'City is required' },
  state: { required: true, minLength: 2, message: 'State is required' },
  zipCode: { required: true, pattern: /^\d{5}(-\d{4})?$/, message: 'Valid ZIP code is required' },
  country: { required: true, minLength: 2, message: 'Country is required' },
};

export const clubValidationRules: ValidationRules = {
  fullName: { required: true, minLength: 2, message: 'Full name is required' },
  name: { required: true, minLength: 2, message: 'Nickname is required' },
  email: { required: true, email: true, message: 'Valid email is required' },
  address: { required: true, minLength: 5, message: 'Address is required' },
  city: { required: true, minLength: 2, message: 'City is required' },
  region: { required: true, minLength: 2, message: 'Province/State is required' },
  country: { required: true, message: 'Country is required' },
  directorId: { required: true, message: 'Director is required' }
};

export const playerValidationRules: ValidationRules = {
  firstName: { required: true, minLength: 2, message: 'First name is required' },
  lastName: { required: true, minLength: 2, message: 'Last name is required' },
  email: { required: true, email: true, message: 'Valid email is required' },
  clubId: { required: true, message: 'Primary club is required' },
  gender: { required: true, message: 'Gender is required' }
};
