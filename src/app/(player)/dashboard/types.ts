import type { UserProfile } from '@/types';

export type PlayerAssignment = {
  tournamentId: string;
  tournamentName: string;
  teamId: string;
  teamName: string;
  teamClubName?: string | null;
  stopName?: string | null;
  stopStartAt?: string | null;
  stopEndAt?: string | null;
  isCaptain?: boolean;
  bracket?: string | null;
};

export type DashboardOverview = {
  player: UserProfile | null;
  assignments: PlayerAssignment[];
};



