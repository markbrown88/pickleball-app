/**
 * Registration validation utilities
 */

export type ValidationError = {
  field: string;
  message: string;
};

export type PlayerInfo = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender?: 'MALE' | 'FEMALE' | '';
};

/**
 * Validate player information
 */
export function validatePlayerInfo(info: PlayerInfo): ValidationError[] {
  const errors: ValidationError[] = [];

  // First name validation
  if (!info.firstName.trim()) {
    errors.push({ field: 'firstName', message: 'First name is required' });
  } else if (info.firstName.trim().length < 2) {
    errors.push({ field: 'firstName', message: 'First name must be at least 2 characters' });
  } else if (info.firstName.trim().length > 50) {
    errors.push({ field: 'firstName', message: 'First name must be less than 50 characters' });
  } else if (!/^[a-zA-Z\s\-']+$/.test(info.firstName.trim())) {
    errors.push({
      field: 'firstName',
      message: 'First name can only contain letters, spaces, hyphens, and apostrophes',
    });
  }

  // Last name validation
  if (!info.lastName.trim()) {
    errors.push({ field: 'lastName', message: 'Last name is required' });
  } else if (info.lastName.trim().length < 2) {
    errors.push({ field: 'lastName', message: 'Last name must be at least 2 characters' });
  } else if (info.lastName.trim().length > 50) {
    errors.push({ field: 'lastName', message: 'Last name must be less than 50 characters' });
  } else if (!/^[a-zA-Z\s\-']+$/.test(info.lastName.trim())) {
    errors.push({
      field: 'lastName',
      message: 'Last name can only contain letters, spaces, hyphens, and apostrophes',
    });
  }

  // Email validation
  if (!info.email.trim()) {
    errors.push({ field: 'email', message: 'Email is required' });
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(info.email.trim())) {
    errors.push({ field: 'email', message: 'Please enter a valid email address' });
  } else if (info.email.trim().length > 100) {
    errors.push({ field: 'email', message: 'Email must be less than 100 characters' });
  }

  // Phone validation (optional - only validate format if provided)
  if (info.phone.trim()) {
    // Remove all non-digit characters for validation
    const digitsOnly = info.phone.replace(/\D/g, '');
    if (digitsOnly.length < 10) {
      errors.push({ field: 'phone', message: 'Phone number must be at least 10 digits' });
    } else if (digitsOnly.length > 15) {
      errors.push({ field: 'phone', message: 'Phone number must be less than 15 digits' });
    }
    // Check if it contains valid phone characters
    if (!/^[\d\s\-\+\(\)]+$/.test(info.phone)) {
      errors.push({
        field: 'phone',
        message: 'Phone number can only contain digits, spaces, hyphens, plus signs, and parentheses',
      });
    }
  }

  // Gender validation (required)
  if (!info.gender || (info.gender !== 'MALE' && info.gender !== 'FEMALE')) {
    errors.push({ field: 'gender', message: 'Gender selection is required' });
  }

  return errors;
}

/**
 * Validate stop selection
 */
export function validateStopSelection(
  selectedStopIds: string[],
  isTeamTournament: boolean,
  selectedClubId?: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (selectedStopIds.length === 0) {
    errors.push({ field: 'stops', message: 'Please select at least one tournament stop' });
  }

  if (isTeamTournament && !selectedClubId) {
    errors.push({ field: 'club', message: 'Please select your club for team tournament registration' });
  }

  return errors;
}

/**
 * Validate bracket selection
 */
export function validateBracketSelection(
  selectedBrackets: Array<{ stopId: string; bracketId: string; gameTypes: string[] }>,
  selectedStopIds: string[],
  isTeamTournament: boolean
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check that each selected stop has bracket selections
  for (const stopId of selectedStopIds) {
    const bracketsForStop = selectedBrackets.filter((sb) => sb.stopId === stopId);

    if (bracketsForStop.length === 0) {
      errors.push({
        field: `stop_${stopId}`,
        message: `Please select at least one ${isTeamTournament ? 'bracket' : 'game type'} for this stop`,
      });
      continue;
    }

    // Check that each bracket has game types
    for (const bracket of bracketsForStop) {
      if (bracket.gameTypes.length === 0) {
        errors.push({
          field: `bracket_${bracket.bracketId}`,
          message: 'Bracket must have at least one game type selected',
        });
      }
    }
  }

  return errors;
}

/**
 * Validate complete registration data
 */
export function validateRegistration(
  playerInfo: PlayerInfo,
  selectedStopIds: string[],
  selectedBrackets: Array<{ stopId: string; bracketId: string; gameTypes: string[] }>,
  isTeamTournament: boolean,
  selectedClubId?: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate player info
  errors.push(...validatePlayerInfo(playerInfo));

  // Validate stop selection
  errors.push(...validateStopSelection(selectedStopIds, isTeamTournament, selectedClubId));

  // Validate bracket selection
  errors.push(...validateBracketSelection(selectedBrackets, selectedStopIds, isTeamTournament));

  return errors;
}

/**
 * Format phone number for display (US format)
 */
export function formatPhoneNumber(phone: string): string {
  const digitsOnly = phone.replace(/\D/g, '');

  if (digitsOnly.length === 10) {
    return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
  }

  if (digitsOnly.length === 11 && digitsOnly[0] === '1') {
    return `+1 (${digitsOnly.slice(1, 4)}) ${digitsOnly.slice(4, 7)}-${digitsOnly.slice(7)}`;
  }

  return phone;
}

/**
 * Check if registration deadline has passed
 */
export function isRegistrationDeadlinePassed(deadline: string | null): boolean {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
}

/**
 * Check if stop is available for registration
 */
export function isStopAvailable(
  stop: {
    isRegistrationClosed: boolean;
    registrationDeadline: string | null;
  }
): boolean {
  if (stop.isRegistrationClosed) return false;
  if (isRegistrationDeadlinePassed(stop.registrationDeadline)) return false;
  return true;
}

/**
 * Check if a stop has passed (endAt or startAt is in the past)
 */
export function isStopInPast(stop: { endAt: Date | null; startAt: Date | null }): boolean {
  const now = new Date();
  
  // If stop has an endAt date, check if it's in the past
  if (stop.endAt) {
    const endDate = new Date(stop.endAt);
    if (endDate < now) {
      return true;
    }
  }
  
  // If no endAt, check startAt (if it exists)
  if (stop.startAt && !stop.endAt) {
    const startDate = new Date(stop.startAt);
    if (startDate < now) {
      return true;
    }
  }
  
  return false;
}

/**
 * Sanitize user input (prevent XSS)
 */
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove < and > characters
    .substring(0, 500); // Limit length
}
