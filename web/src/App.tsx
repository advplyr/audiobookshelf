import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import { Layout, useLibraries } from './components/Layout'
import { LibraryPage } from './pages/LibraryPage'
import { LoginPage } from './pages/LoginPage'
import { SECTIONS } from './sections'

export function App() {
  const { user, loading } = useAuth()
  if (loading) return null

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {user ? (
        <Route element={<Layout />}>
          <Route index element={<HomeRedirect />} />
          <Route path="library/:libraryId" element={<LibraryPage />} />
          {SECTIONS.map((s) => (
            <Route key={s.path} path={s.path} element={s.element} />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/login" replace />} />
      )}
    </Routes>
  )
}

function HomeRedirect() {
  const { defaultLibraryId } = useAuth()
  const { data: libraries, isLoading } = useLibraries()
  if (isLoading) return null
  const id = defaultLibraryId ?? libraries?.[0]?.id
  return id ? <Navigate to={`/library/${id}`} replace /> : <p className="text-muted">No libraries yet. Create one in the stock admin UI.</p>
}
