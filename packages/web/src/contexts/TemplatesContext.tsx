import { createContext, useContext, useState, useCallback, ReactNode, useMemo, useRef } from 'react';
import type { Template } from '@weft/shared';
import { getApiUrl } from '../lib/config';

interface TemplatesContextValue {
  templates: Template[];
  isLoading: boolean;
  error: Error | null;
  ensureLoaded: () => Promise<void>;
  createTemplate: (data: { title: string; content?: string; icon?: string; color?: string }) => Promise<Template>;
  updateTemplate: (id: string, data: { title?: string; content?: string; icon?: string; color?: string }) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  createTemplateFromNote: (noteId: string) => Promise<Template>;
  refresh: () => void;
}

const TemplatesContext = createContext<TemplatesContextValue | undefined>(undefined);

interface TemplatesProviderProps {
  children: ReactNode;
}

export function TemplatesProvider({ children }: TemplatesProviderProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const hasLoadedRef = useRef(false);

  const fetchTemplates = useCallback(async () => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${getApiUrl()}/api/templates`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch templates: ${response.statusText}`);
      }

      const result = await response.json() as { templates: Template[] };
      setTemplates(result.templates);
      hasLoadedRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  // Don't fetch on mount - only fetch when explicitly requested via ensureLoaded()

  const ensureLoaded = useCallback(async () => {
    if (!hasLoadedRef.current && !isLoading) {
      await fetchTemplates();
    }
  }, [fetchTemplates, isLoading]);

  const createTemplate = useCallback(async (data: { title: string; content?: string; icon?: string; color?: string }): Promise<Template> => {
    const response = await fetch(`${getApiUrl()}/api/templates`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to create template: ${response.statusText}`);
    }

    const createdTemplate = await response.json() as Template;
    setTemplates(prev => [createdTemplate, ...prev]);
    return createdTemplate;
  }, []);

  const updateTemplate = useCallback(async (id: string, data: { title?: string; content?: string; icon?: string; color?: string }): Promise<void> => {
    const response = await fetch(`${getApiUrl()}/api/templates/${id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to update template: ${response.statusText}`);
    }

    const updatedTemplate = await response.json() as Template;
    setTemplates(prev => prev.map(template =>
      template.id === id ? updatedTemplate : template
    ));
  }, []);

  const deleteTemplate = useCallback(async (id: string): Promise<void> => {
    const response = await fetch(`${getApiUrl()}/api/templates/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete template: ${response.statusText}`);
    }

    setTemplates(prev => prev.filter(template => template.id !== id));
  }, []);

  const createTemplateFromNote = useCallback(async (noteId: string): Promise<Template> => {
    const response = await fetch(`${getApiUrl()}/api/templates/from-note/${noteId}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to create template from note: ${response.statusText}`);
    }

    const createdTemplate = await response.json() as Template;
    setTemplates(prev => [createdTemplate, ...prev]);
    return createdTemplate;
  }, []);

  const refresh = useCallback(() => {
    hasLoadedRef.current = false;
    fetchTemplates();
  }, [fetchTemplates]);

  const value = useMemo<TemplatesContextValue>(
    () => ({
      templates,
      isLoading,
      error,
      ensureLoaded,
      createTemplate,
      updateTemplate,
      deleteTemplate,
      createTemplateFromNote,
      refresh,
    }),
    [
      templates,
      isLoading,
      error,
      ensureLoaded,
      createTemplate,
      updateTemplate,
      deleteTemplate,
      createTemplateFromNote,
      refresh,
    ]
  );

  return <TemplatesContext.Provider value={value}>{children}</TemplatesContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTemplatesContext() {
  const context = useContext(TemplatesContext);
  if (!context) {
    throw new Error('useTemplatesContext must be used within a TemplatesProvider');
  }
  return context;
}
