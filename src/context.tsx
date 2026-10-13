import { createContext, useContext } from 'react';
import type { AppData } from './types';
export interface AppContextValue {
  data: AppData;
  update: (fn: (draft: AppData) => void) => void;
  replace: (data: AppData) => void;
  notify: (message: string) => void;
  go: (tab: string) => void;
  resumeWorkout: () => void;
  storageError: string | null;
}
export const AppContext = createContext<AppContextValue>(null!);
export const useApp = () => useContext(AppContext);
