import { useState, useEffect, useCallback } from 'react';
import type { Template } from '@weft/shared';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface CreateTemplateData {
  title: string;
  content?: string;
  icon?: string;
  color?: string;
}

export interface UpdateTemplateData {
  title?: string;
  content?: string;
  icon?: string;
  color?: string;
}

interface UseTemplatesReturn {
  templates: Template[];
  isLoading: boolean;
  error: Error | null;
  createTemplate: (data: CreateTemplateData) => Promise<Template>;
  updateTemplate: (id: string, data: UpdateTemplateData) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  createTemplateFromNote: (noteId: string) => Promise<Template>;
  refresh: () => void;
}

export function useTemplates(): UseTemplatesReturn {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/templates`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch templates: ${response.statusText}`);
      }

      const result = await response.json() as { templates: Template[] };
      setTemplates(result.templates);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createTemplate = useCallback(async (data: CreateTemplateData): Promise<Template> => {
    const response = await fetch(`${API_BASE}/api/templates`, {
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

    // Optimistically add to local state
    setTemplates(prev => [createdTemplate, ...prev]);

    return createdTemplate;
  }, []);

  const updateTemplate = useCallback(async (id: string, data: UpdateTemplateData): Promise<void> => {
    const response = await fetch(`${API_BASE}/api/templates/${id}`, {
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

    // Update local state
    setTemplates(prev => prev.map(template =>
      template.id === id ? updatedTemplate : template
    ));
  }, []);

  const deleteTemplate = useCallback(async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/api/templates/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete template: ${response.statusText}`);
    }

    // Remove from local state
    setTemplates(prev => prev.filter(template => template.id !== id));
  }, []);

  const createTemplateFromNote = useCallback(async (noteId: string): Promise<Template> => {
    const response = await fetch(`${API_BASE}/api/templates/from-note/${noteId}`, {
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

    // Optimistically add to local state
    setTemplates(prev => [createdTemplate, ...prev]);

    return createdTemplate;
  }, []);

  const refresh = useCallback(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return {
    templates,
    isLoading,
    error,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    createTemplateFromNote,
    refresh,
  };
}
