import type { UserProfile } from '@/types';

export type PlayerAssignment = {
  tournamentId: string;
  tournamentName: string;
  teamId: string;
  teamName: string;
  teamClubName?: string | null;
  stopId: string;
  stopName: string;
  stopStartAt?: string | null;
  stopEndAt?: string | null;
  isCaptain: boolean;
  bracketId?: string | null;
  bracketName?: string | null;
};

export type DashboardOverview = {
  player: UserProfile | null;
  assignments: PlayerAssignment[];
};



