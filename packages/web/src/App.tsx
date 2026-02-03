import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { VibeKanbanWebCompanion } from 'vibe-kanban-web-companion';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { DashboardPage } from './pages/DashboardPage';
import { RecordingPage } from './pages/RecordingPage';
import { HistoryPage } from './pages/HistoryPage';
import { JournalDetailPage } from './pages/JournalDetailPage';
import { NotesPage } from './pages/NotesPage';
import { MainAppLayout } from './components/layout/MainAppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { OnboardingGuard } from './components/OnboardingGuard';
import { OnboardingRouteGuard } from './components/OnboardingRouteGuard';
import { NavigationProvider } from './contexts/NavigationContext';
import './index.css';

export function App() {
  return (
    <BrowserRouter>
      <VibeKanbanWebCompanion />
      <NavigationProvider>
        <Routes>
        {/* Onboarding route - only accessible when no users exist */}
        <Route
          path="/onboarding"
          element={
            <OnboardingRouteGuard>
              <OnboardingPage />
            </OnboardingRouteGuard>
          }
        />

        {/* Login route - redirects to onboarding if no users exist */}
        <Route
          path="/login"
          element={
            <OnboardingGuard>
              <LoginPage />
            </OnboardingGuard>
          }
        />

        {/* Register route - redirects to onboarding if no users exist */}
        <Route
          path="/register"
          element={
            <OnboardingGuard>
              <RegisterPage />
            </OnboardingGuard>
          }
        />

        {/* Main app routes with shared layout */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainAppLayout />
            </ProtectedRoute>
          }
        >
          {/* Dashboard */}
          <Route path="dashboard" element={<DashboardPage />} />

          {/* Recording */}
          <Route path="record" element={<RecordingPage />} />

          {/* History */}
          <Route path="history" element={<HistoryPage />} />

          {/* Journal Detail */}
          <Route path="journal/:id" element={<JournalDetailPage />} />

          {/* Notes */}
          <Route path="notes" element={<NotesPage />} />
          <Route path="notes/:noteId" element={<NotesPage />} />
        </Route>

        {/* Root route - redirects based on onboarding status */}
        <Route
          path="/"
          element={
            <OnboardingGuard>
              <Navigate to="/dashboard" replace />
            </OnboardingGuard>
          }
        />
      </Routes>
      </NavigationProvider>
    </BrowserRouter>
  );
}
