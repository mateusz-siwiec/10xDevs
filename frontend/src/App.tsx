import { BrowserRouter, Route, Routes } from 'react-router'
import { AuthProvider } from './auth/AuthContext'
import { RequireAuth } from './auth/RequireAuth'
import DashboardPage from './pages/DashboardPage'
import MuscleGroupStatsPage from './pages/MuscleGroupStatsPage'
import WorkoutPage from './pages/WorkoutPage'
import HistoryPage from './pages/HistoryPage'
import HistoryDetailPage from './pages/HistoryDetailPage'
import PlansPage from './pages/PlansPage'
import PlanEditorPage from './pages/PlanEditorPage'
import MyExercisesPage from './pages/MyExercisesPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <DashboardPage />
              </RequireAuth>
            }
          />
          <Route
            path="/muscle-groups"
            element={
              <RequireAuth>
                <MuscleGroupStatsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/workout"
            element={
              <RequireAuth>
                <WorkoutPage />
              </RequireAuth>
            }
          />
          <Route
            path="/history"
            element={
              <RequireAuth>
                <HistoryPage />
              </RequireAuth>
            }
          />
          <Route
            path="/history/:id"
            element={
              <RequireAuth>
                <HistoryDetailPage />
              </RequireAuth>
            }
          />
          <Route
            path="/plans"
            element={
              <RequireAuth>
                <PlansPage />
              </RequireAuth>
            }
          />
          <Route
            path="/plans/new"
            element={
              <RequireAuth>
                <PlanEditorPage />
              </RequireAuth>
            }
          />
          <Route
            path="/plans/:id"
            element={
              <RequireAuth>
                <PlanEditorPage />
              </RequireAuth>
            }
          />
          <Route
            path="/exercises"
            element={
              <RequireAuth>
                <MyExercisesPage />
              </RequireAuth>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
