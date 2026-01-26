import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { VibeKanbanWebCompanion } from 'vibe-kanban-web-companion';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { DashboardPage } from './pages/DashboardPage';
import { RecordingPage } from './pages/RecordingPage';
import { HistoryPage } from './pages/HistoryPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { OnboardingGuard } from './components/OnboardingGuard';
import { OnboardingRouteGuard } from './components/OnboardingRouteGuard';
import './index.css';

export function App() {
  return (
    <BrowserRouter>
      <VibeKanbanWebCompanion />
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

        {/* Dashboard - protected route */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        {/* Recording - protected route */}
        <Route
          path="/record"
          element={
            <ProtectedRoute>
              <RecordingPage />
            </ProtectedRoute>
          }
        />

        {/* History - protected route */}
        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <HistoryPage />
            </ProtectedRoute>
          }
        />

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
    </BrowserRouter>
  );
}
