import { useState, useEffect, FormEvent, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { getApiUrl } from '../lib/config';

// Memory category type
type MemoryCategory = 'general' | 'preference' | 'fact' | 'reminder' | 'goal';

// Memory interface
interface Memory {
  id: string;
  content: string;
  category: MemoryCategory;
  importance: number;
  sourceType: string;
  sourceConversationId?: string;
  lastAccessedAt?: string;
  accessCount: number;
  createdAt: string;
  updatedAt: string;
}

// Category configuration
const CATEGORIES: { id: MemoryCategory; label: string; icon: string; color: string }[] = [
  { id: 'general', label: 'General', icon: '💭', color: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300' },
  { id: 'preference', label: 'Preferences', icon: '❤️', color: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300' },
  { id: 'fact', label: 'Facts', icon: '📚', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
  { id: 'reminder', label: 'Reminders', icon: '🔔', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
  { id: 'goal', label: 'Goals', icon: '🎯', color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' },
];

export function AiChatSettingsPage() {
  const navigate = useNavigate();

  // Memories state
  const [memories, setMemories] = useState<Memory[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter state
  const [activeCategory, setActiveCategory] = useState<MemoryCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [formData, setFormData] = useState({
    content: '',
    category: 'general' as MemoryCategory,
    importance: 5,
  });
  const [isSaving, setIsSaving] = useState(false);

  // Delete state
  const [deleteConfirm, setDeleteConfirm] = useState<Memory | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchMemories = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (activeCategory !== 'all') {
        params.append('category', activeCategory);
      }
      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const response = await fetch(`${getApiUrl()}/api/memories?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch memories');
      }

      const data = await response.json();
      setMemories(data.memories || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load memories');
    } finally {
      setIsLoading(false);
    }
  }, [activeCategory, searchQuery]);

  const fetchCategoryCounts = useCallback(async () => {
    try {
      const response = await fetch(`${getApiUrl()}/api/memories/categories`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setCategoryCounts(data.categories || {});
      }
    } catch (err) {
      console.error('Failed to fetch category counts:', err);
    }
  }, []);

  // Fetch memories on mount
  useEffect(() => {
    fetchMemories();
    fetchCategoryCounts();
  }, [fetchMemories, fetchCategoryCounts]);

  // Fetch memories when filter changes
  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  const openCreateForm = () => {
    setEditingMemory(null);
    setFormData({
      content: '',
      category: 'general',
      importance: 5,
    });
    setIsFormOpen(true);
  };

  const openEditForm = (memory: Memory) => {
    setEditingMemory(memory);
    setFormData({
      content: memory.content,
      category: memory.category,
      importance: memory.importance,
    });
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');

    try {
      const url = editingMemory
        ? `${getApiUrl()}/api/memories/${editingMemory.id}`
        : `${getApiUrl()}/api/memories`;
      const method = editingMemory ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save memory');
      }

      setIsFormOpen(false);
      setEditingMemory(null);
      await fetchMemories();
      await fetchCategoryCounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save memory');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    setIsDeleting(true);
    setError('');

    try {
      const response = await fetch(`${getApiUrl()}/api/memories/${deleteConfirm.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete memory');
      }

      setDeleteConfirm(null);
      await fetchMemories();
      await fetchCategoryCounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete memory');
    } finally {
      setIsDeleting(false);
    }
  };

  const getCategoryConfig = (category: MemoryCategory) => {
    return CATEGORIES.find((c) => c.id === category) || CATEGORIES[0];
  };

  const filteredCount = memories.length;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/ai-chat')}
          className="flex items-center gap-2 text-sm text-neutral-600 dark:text-dark-400 hover:text-neutral-900 dark:hover:text-dark-100 transition-colors mb-4"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Chat
        </button>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-dark-50 mb-2">
          AI Chat Settings
        </h1>
        <p className="text-neutral-600 dark:text-dark-400">
          Manage what the AI assistant remembers about you across conversations
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-error-light dark:bg-error/20 border border-error dark:border-error/50 rounded-lg p-4 mb-6 text-error text-sm">
          {error}
        </div>
      )}

      {/* Memories Section */}
      <section className="bg-white dark:bg-dark-800 rounded-lg p-6 border border-neutral-200 dark:border-dark-600">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-dark-50">
              Long-Term Memory
            </h2>
            <p className="text-sm text-neutral-600 dark:text-dark-400 mt-1">
              The AI assistant can store and recall important information about you
            </p>
          </div>
          <button
            onClick={openCreateForm}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Memory
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeCategory === 'all'
                ? 'bg-primary-500 text-white'
                : 'bg-neutral-100 dark:bg-dark-700 text-neutral-700 dark:text-dark-300 hover:bg-neutral-200 dark:hover:bg-dark-600'
            }`}
          >
            All ({Object.values(categoryCounts).reduce((a, b) => a + b, 0)})
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
                activeCategory === cat.id
                  ? 'bg-primary-500 text-white'
                  : `${cat.color} hover:opacity-80`
              }`}
            >
              <span>{cat.icon}</span>
              {cat.label} ({categoryCounts[cat.id] || 0})
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search memories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-neutral-200 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-neutral-900 dark:text-dark-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Memories List */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent mx-auto"></div>
            <p className="text-neutral-500 dark:text-dark-400 mt-4">Loading memories...</p>
          </div>
        ) : memories.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">🧠</div>
            <p className="text-neutral-600 dark:text-dark-400">
              {searchQuery || activeCategory !== 'all'
                ? 'No memories match your filters'
                : 'No memories yet. Add your first memory or chat with the AI assistant!'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {memories.map((memory) => {
              const catConfig = getCategoryConfig(memory.category);
              return (
                <div
                  key={memory.id}
                  className="border border-neutral-200 dark:border-dark-600 rounded-lg p-4 hover:border-neutral-300 dark:hover:border-dark-500 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Category and importance */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${catConfig.color}`}>
                          {catConfig.icon} {catConfig.label}
                        </span>
                        <span className="text-xs text-neutral-500 dark:text-dark-400">
                          Importance: {memory.importance}/10
                        </span>
                        {memory.sourceType === 'conversation' && (
                          <span className="text-xs text-neutral-400 dark:text-dark-500 italic">
                            (from conversation)
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      <p className="text-neutral-800 dark:text-dark-200 whitespace-pre-wrap">
                        {memory.content}
                      </p>

                      {/* Metadata */}
                      <div className="mt-2 text-xs text-neutral-500 dark:text-dark-400">
                        Created {new Date(memory.createdAt).toLocaleDateString()}
                        {memory.accessCount > 0 && ` · Accessed ${memory.accessCount} times`}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditForm(memory)}
                        className="p-2 text-neutral-500 hover:text-primary-500 hover:bg-neutral-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                        title="Edit memory"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(memory)}
                        className="p-2 text-neutral-500 hover:text-error hover:bg-neutral-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                        title="Delete memory"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Results count */}
        {!isLoading && memories.length > 0 && (
          <div className="mt-4 text-sm text-neutral-500 dark:text-dark-400 text-center">
            Showing {filteredCount} {filteredCount === 1 ? 'memory' : 'memories'}
          </div>
        )}
      </section>

      {/* Info Section */}
      <section className="bg-white dark:bg-dark-800 rounded-lg p-6 border border-neutral-200 dark:border-dark-600 mt-6">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-dark-50 mb-4">
          About Long-Term Memory
        </h2>
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <p className="text-neutral-600 dark:text-dark-400">
            The AI assistant can store important information about you to provide more personalized
            responses across conversations. Here's how it works:
          </p>
          <ul className="text-neutral-600 dark:text-dark-400 mt-3 space-y-2">
            <li>
              <strong>Automatic Storage:</strong> When you share important information with the AI,
              it may ask to store it as a memory for future reference.
            </li>
            <li>
              <strong>Semantic Search:</strong> Memories are indexed using vector embeddings, allowing
              the AI to find relevant information based on meaning, not just keywords.
            </li>
            <li>
              <strong>Privacy Control:</strong> You can view, edit, and delete any stored memory at
              any time. The AI will always ask before storing sensitive information.
            </li>
            <li>
              <strong>Categories & Importance:</strong> Organize memories by type (preferences, facts,
              goals, etc.) and set importance levels to help the AI prioritize what to recall.
            </li>
          </ul>
        </div>
      </section>

      {/* Create/Edit Form Modal */}
      {isFormOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => !isSaving && setIsFormOpen(false)}
        >
          <div
            className="bg-white dark:bg-dark-800 rounded-lg shadow-xl w-full max-w-lg p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-dark-50 mb-4">
              {editingMemory ? 'Edit Memory' : 'Add New Memory'}
            </h3>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {/* Content */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-dark-200 mb-1">
                  Content
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="What should the AI remember?"
                  rows={4}
                  required
                  minLength={10}
                  maxLength={2000}
                  disabled={isSaving}
                  className="w-full px-4 py-3 border border-neutral-200 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-neutral-900 dark:text-dark-50 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60 resize-none"
                />
                <p className="text-xs text-neutral-500 dark:text-dark-400 mt-1">
                  {formData.content.length}/2000 characters
                </p>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-dark-200 mb-2">
                  Category
                </label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, category: cat.id })}
                      disabled={isSaving}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
                        formData.category === cat.id
                          ? 'ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-dark-800'
                          : ''
                      } ${cat.color}`}
                    >
                      <span>{cat.icon}</span>
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Importance */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-dark-200 mb-2">
                  Importance: {formData.importance}/10
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={formData.importance}
                  onChange={(e) => setFormData({ ...formData, importance: parseInt(e.target.value) })}
                  disabled={isSaving}
                  className="w-full h-2 bg-neutral-200 dark:bg-dark-600 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-neutral-500 dark:text-dark-400 mt-1">
                  <span>Low priority</span>
                  <span>Critical</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  disabled={isSaving}
                  className="px-4 py-2 border border-neutral-200 dark:border-dark-600 rounded-lg text-neutral-700 dark:text-dark-300 hover:bg-neutral-100 dark:hover:bg-dark-700 transition-colors disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || formData.content.length < 10}
                  className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Saving...' : editingMemory ? 'Update Memory' : 'Add Memory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        title="Delete Memory?"
        message="This memory will be permanently removed and the AI will no longer be able to recall it in future conversations. This action cannot be undone."
        confirmLabel={isDeleting ? 'Deleting...' : 'Delete Memory'}
        cancelLabel="Cancel"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
        isDestructive={true}
      />
    </div>
  );
}
