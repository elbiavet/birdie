export interface ClubDomains {
  staging: string;
  production: string;
}

export interface ClubTheme {
  primary: string;
  primaryForeground: string;
  secondary: string;
  accent: string;
  background: string;
}

export interface ClubCoordinates {
  lat: number;
  lng: number;
}

export interface ClubContact {
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
}

export interface ClubFeatures {
  scorecard: boolean;
  gps: boolean;
  stats: boolean;
  calendar: boolean;
  tournaments: boolean;
  bookings: boolean;
  playerDirectory: boolean;
  clubDirectory: boolean;
  news: boolean;
  clubInfo: boolean;
  forum: boolean;
  adminChat: boolean;
  specialEvents: boolean;
}

export type ClubFeatureKey = keyof ClubFeatures;

export interface ClubConfig {
  clubId: string;
  name: string;
  shortName: string;
  tagline?: string;
  appId: string;
  domains: ClubDomains;
  theme: ClubTheme;
  coordinates: ClubCoordinates;
  defaultCourseExternalId: string;
  contact?: ClubContact;
  features: ClubFeatures;
}
