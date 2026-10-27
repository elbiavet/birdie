export type UserRole = 'player' | 'club_admin' | 'superadmin';

export interface PlayerProfile {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  federationLicense: string;
  handicapIndex: number;
  role: UserRole;
  phone?: string | null;
  bio?: string | null;
  isDirectoryVisible: boolean;
  updatedAt: string;
}

export interface HandicapHistoryEntry {
  id: string;
  userId: string;
  previousHandicap: number | null;
  newHandicap: number;
  reason: string;
  effectiveDate: string;
}

export interface CourseTee {
  id: string;
  courseId: string;
  name: string;
  colorHex: string;
  gender: 'men' | 'women' | 'mixed';
  courseRating: number;
  slopeRating: number;
  totalDistanceMeters: number;
}
