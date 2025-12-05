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
