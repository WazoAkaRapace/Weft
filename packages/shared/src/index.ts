/**
 * Shared utilities, types, and constants for the Weft application.
 */

export const APP_NAME = 'Weft';

export interface AppConfig {
  name: string;
  version: string;
}

export const config: AppConfig = {
  name: APP_NAME,
  version: '0.0.1',
};

export function greet(name: string): string {
  return `Hello, ${name}!`;
}

/**
 * Authentication types shared between server and client
 */
export interface User {
  id: string;
  username: string | null;
  email: string | null;
  emailVerified: boolean;
  image: string | null;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
  token: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: User;
}

export interface AuthResponse {
  user: User | null;
  session: Session | null;
}

export interface SignInCredentials {
  email: string;
  password: string;
}

export interface SignUpCredentials extends SignInCredentials {
  username?: string;
  name?: string;
}

/**
 * Pagination and filtering types
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface DateFilter {
  startDate?: Date;
  endDate?: Date;
}

export interface JournalListParams extends PaginationParams, DateFilter {
  search?: string;
}

/**
 * Journal entry type
 */
export interface Journal {
  id: string;
  userId: string;
  title: string;
  videoPath: string;
  thumbnailPath: string | null;
  duration: number;
  location: string | null;
  notes: string | null;
  transcriptPreview: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Video streaming types
 */
export * from './video.js';
