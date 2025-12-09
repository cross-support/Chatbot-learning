import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Application {
  id: string;
  name: string;
  siteId: string;
  domain?: string;
  description?: string;
  isActive: boolean;
}

interface ApplicationState {
  currentApplication: Application | null;
  applications: Application[];
  setCurrentApplication: (app: Application) => void;
  setApplications: (apps: Application[]) => void;
  clearApplications: () => void;
}

export const useApplicationStore = create<ApplicationState>()(
  persist(
    (set) => ({
      currentApplication: null,
      applications: [],
      setCurrentApplication: (app) =>
        set({
          currentApplication: app,
        }),
      setApplications: (apps) =>
        set({
          applications: apps,
          // 現在のアプリが設定されていない場合、最初のアプリを設定
          currentApplication: apps.length > 0 ? apps[0] : null,
        }),
      clearApplications: () =>
        set({
          currentApplication: null,
          applications: [],
        }),
    }),
    {
      name: 'crossbot-application',
    }
  )
);
