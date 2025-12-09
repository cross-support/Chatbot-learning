import { useEffect, useCallback } from 'react';
import { useApplicationStore, Application } from '../stores/applicationStore';
import { useAuthStore } from '../stores/authStore';

interface UseApplicationsReturn {
  applications: Application[];
  currentApplication: Application | null;
  isLoading: boolean;
  error: string | null;
  switchApplication: (app: Application) => void;
  refreshApplications: () => Promise<void>;
}

export function useApplications(): UseApplicationsReturn {
  const { token } = useAuthStore();
  const { applications, currentApplication, setApplications, setCurrentApplication } = useApplicationStore();

  const fetchApplications = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch('/api/applications/my-apps', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setApplications(data);
      }
    } catch (error) {
      console.error('Failed to fetch applications:', error);
    }
  }, [token, setApplications]);

  useEffect(() => {
    if (token && applications.length === 0) {
      fetchApplications();
    }
  }, [token, applications.length, fetchApplications]);

  const switchApplication = useCallback(
    (app: Application) => {
      setCurrentApplication(app);
    },
    [setCurrentApplication]
  );

  return {
    applications,
    currentApplication,
    isLoading: false,
    error: null,
    switchApplication,
    refreshApplications: fetchApplications,
  };
}
