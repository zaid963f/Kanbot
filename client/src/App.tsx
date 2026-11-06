import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import Layout from './components/Layout';
import { GuestRoute, PrivateRoute } from './components/RouteGuards';
import BacklogPage from './pages/BacklogPage';
import BoardPage from './pages/BoardPage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import ProjectsPage from './pages/ProjectsPage';
import RegisterPage from './pages/RegisterPage';
import SprintsPage from './pages/SprintsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* only when logged out */}
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* only when logged in */}
        <Route element={<PrivateRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/projects" replace />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:projectId" element={<Navigate to="backlog" replace />} />
            <Route path="/projects/:projectId/backlog" element={<BacklogPage />} />
            <Route path="/projects/:projectId/board" element={<BoardPage />} />
            <Route path="/projects/:projectId/sprints" element={<SprintsPage />} />
            <Route path="/projects/:projectId/sprints/:sprintId" element={<SprintsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
