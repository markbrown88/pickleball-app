/**
 * Calculate registration amount based on pricing model
 * This function is shared between registration creation and payment processing
 */
export function calculateRegistrationAmount(
  tournament: {
    registrationCost: number | null;
    pricingModel: string | null;
  },
  registrationDetails: {
    stopIds?: string[];
    brackets?: Array<{ stopId: string; bracketId: string; gameTypes?: string[] }>;
  }
): number {
  if (!tournament.registrationCost || tournament.registrationCost <= 0) {
    return 0;
  }

  const baseCost = tournament.registrationCost;

  switch (tournament.pricingModel) {
    case 'PER_TOURNAMENT':
    case 'TOURNAMENT_WIDE':
      return baseCost;

    case 'PER_STOP':
      return baseCost * (registrationDetails.stopIds?.length || 1);

    case 'PER_BRACKET':
      // Count unique brackets
      const uniqueBrackets = new Set(
        registrationDetails.brackets?.map((b) => b.bracketId) || []
      );
      return baseCost * uniqueBrackets.size;

    case 'PER_STOP_PER_BRACKET':
      // Count unique stop-bracket combinations
      const uniqueCombinations = new Set(
        registrationDetails.brackets?.map((b) => `${b.stopId}:${b.bracketId}`) || []
      );
      return baseCost * uniqueCombinations.size;

    case 'PER_GAME_TYPE':
      // For PER_GAME_TYPE, brackets array contains gameTypes
      // Count total game types from brackets
      const totalGameTypes = registrationDetails.brackets?.reduce(
        (sum, b) => sum + ((b as any).gameTypes?.length || 0),
        0
      ) || 0;
      return baseCost * totalGameTypes;

    default:
      return baseCost;
  }
}

