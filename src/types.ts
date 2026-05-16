export interface Condo {
  id: string;
  name: string;
  active: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface Block {
  id: string;
  condoId: string | null;
  name: string;
  qrToken?: string;
  active: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface Apartment {
  id: string;
  condoId: string | null;
  blockId: string | null;
  number: string;
  active: boolean;
  createdAt: any;
  updatedAt: any;
}

export type UserRole = 'ADMIN' | 'RESIDENT';

export interface User {
  id: string;
  apartmentId: string | null;
  name: string;
  email: string;
  role: UserRole;
  apartmentNumber?: string;
  apartmentBlock?: string;
  residencyNote?: string;
  active: boolean;
  createdAt: any;
  updatedAt: any;
}

export type BookStatus = 'AVAILABLE' | 'LOANED' | 'INACTIVE';
export type LocationType = 'HALL' | 'APARTMENT';

export interface Location {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface Book {
  id: string;
  title: string;
  author: any;
  isbn?: string;
  barcode?: string;
  category?: any;
  coverUrl?: string;
  backCoverUrl?: string;
  status: BookStatus;
  availableLocationType?: LocationType;
  availableLocationBlockId?: string;
  availableLocationLabel?: string;
  loanedToApartmentId?: string;
  loanedToApartmentLabel?: string;
  notes?: string;
  descricao?: string;
  createdAt: any;
  updatedAt: any;
  createdByUserId?: string | null;
  createdByUserEmail?: string | null;
  updatedByUserId?: string | null;
  updatedByUserEmail?: string | null;
}

export type LoanStatus = 'ACTIVE' | 'RETURNED';

export interface BookLoan {
  id: string;
  bookId: string;
  apartmentId: string;
  borrowerUserId: string;
  loanedAt: any;
  dueAt: any;
  renewalCount: number;
  lastRenewedAt?: any;
  returnedAt?: any;
  returnLocationType?: LocationType;
  returnLocationBlockId?: string;
  returnLocationLabel?: string;
  status: LoanStatus;
  createdAt: any;
  updatedAt: any;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}
