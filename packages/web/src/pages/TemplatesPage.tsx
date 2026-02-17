import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTemplatesContext } from '../contexts/TemplatesContext';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { TemplateEditorPanel } from '../components/notes/TemplateEditorPanel';
import type { Template } from '@weft/shared';

export function TemplatesPage() {
  const navigate = useNavigate();
  const { templateId } = useParams<{ templateId?: string }>();
  const { templates, isLoading, error, deleteTemplate, createTemplate, updateTemplate, ensureLoaded } = useTemplatesContext();

  // Load templates when page mounts
  useEffect(() => {
    ensureLoaded();
  }, [ensureLoaded]);
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);

  // Derive state from URL parameter
  const isCreatingNew = templateId === 'new';
  const selectedTemplateId = templateId && templateId !== 'new' ? templateId : null;

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  const handleBackToNotes = () => {
    navigate('/notes');
  };

  const handleSelectTemplate = (template: Template) => {
    navigate(`/notes/templates/${template.id}`, { replace: true });
  };

  const handleCreateNew = () => {
    navigate('/notes/templates/new');
  };

  const handleTemplateCreated = (createdTemplate: Template) => {
    // Switch to edit mode with the newly created template and update URL
    navigate(`/notes/templates/${createdTemplate.id}`, { replace: true });
  };

  const handleDeleteTemplate = (template: Template) => {
    setTemplateToDelete(template);
  };

  const confirmDelete = async () => {
    if (!templateToDelete) return;
    await deleteTemplate(templateToDelete.id);
    if (selectedTemplateId === templateToDelete.id) {
      navigate('/notes/templates', { replace: true });
    }
    setTemplateToDelete(null);
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-neutral-500 dark:text-dark-400">Loading templates...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-error">Error: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Templates Sidebar */}
      <div className="w-80 flex flex-col border-r border-neutral-200 dark:border-dark-600 bg-white dark:bg-dark-800">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-dark-600">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBackToNotes}
              className="p-1 hover:bg-neutral-200 dark:hover:bg-dark-600 rounded transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold text-neutral-900 dark:text-dark-50">Templates</h1>
          </div>
          <button
            onClick={handleCreateNew}
            className="p-1 hover:bg-neutral-200 dark:hover:bg-dark-600 rounded transition-colors"
            title="New template"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>

        {/* Templates List */}
        <div className="flex-1 overflow-y-auto p-2">
          {templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <div className="w-12 h-12 mb-3 text-neutral-300 dark:text-dark-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-neutral-700 dark:text-dark-200 mb-1">No templates</h3>
              <p className="text-xs text-neutral-500 dark:text-dark-400">
                Create a template to reuse note content
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    selectedTemplateId === template.id
                      ? 'bg-primary-50 dark:bg-primary-900/30'
                      : 'hover:bg-neutral-100 dark:hover:bg-dark-700'
                  }`}
                  style={{
                    borderLeft: selectedTemplateId === template.id ? '3px solid' : '3px solid transparent',
                    borderLeftColor: template.color || undefined,
                  }}
                  onClick={() => handleSelectTemplate(template)}
                >
                  <span className="text-lg flex-shrink-0">{template.icon}</span>
                  <span className="flex-1 truncate text-sm text-neutral-700 dark:text-dark-200">
                    {template.title}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTemplate(template);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-error-light dark:hover:bg-error-dark-light/30 text-error rounded transition-opacity"
                    title="Delete template"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Editor Panel */}
      {(isCreatingNew || selectedTemplate) ? (
        <div className="flex-1">
          <TemplateEditorPanel
            key={selectedTemplateId || 'new'}
            template={selectedTemplate || null}
            isCreating={isCreatingNew}
            onClose={() => {
              navigate('/notes/templates');
            }}
            createTemplate={createTemplate}
            updateTemplate={updateTemplate}
            onTemplateCreated={handleTemplateCreated}
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="text-6xl mb-4">📋</div>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-dark-50 mb-2">
              No template selected
            </h2>
            <p className="text-neutral-500 dark:text-dark-400 mb-6">
              Select a template from the sidebar or create a new one to get started.
            </p>
            <button
              onClick={() => navigate('/notes/templates/new')}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg font-medium transition-colors hover:bg-primary-600"
            >
              Create New Template
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {templateToDelete && (
        <ConfirmDialog
          isOpen={!!templateToDelete}
          title="Delete Template"
          message={`Are you sure you want to delete "${templateToDelete.title}"? This action cannot be undone.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onConfirm={confirmDelete}
          onCancel={() => setTemplateToDelete(null)}
        />
      )}
    </div>
  );
}
