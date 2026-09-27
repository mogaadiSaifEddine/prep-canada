// A small bridge from non-React modules (the coaches, the paths store) to the app state that the
// React provider owns: who is signed in, what their plan includes, toasts and error handling.
// AppProvider fills these in on every render, so callers always see the latest values.
import type { ApiError } from './api';
import type { Entitlement, Exam, Me } from '../shared/types';

export const bridge = {
  me: (): Me | null => null,
  ent: (_exam: Exam): Partial<Entitlement> => ({}),
  toast: (_msg: string) => {},
  errCopy: (_e: unknown): string => '',
  handleError: (_e: unknown) => {},
  navigate: (_path: string) => {}
};
export type { ApiError };
