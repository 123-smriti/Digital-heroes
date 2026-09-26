import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute'

import Home from './pages/Home'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Charities from './pages/Charities'
import CharityDetail from './pages/CharityDetail'
import Draws from './pages/Draws'
import Subscribe from './pages/Subscribe'
import Donate from './pages/Donate'
import Dashboard from './pages/Dashboard'
import AdminDashboard from './pages/admin/AdminDashboard'

export default function App() {
  return (
    <>
      <Navbar />
      <main style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/charities" element={<Charities />} />
          <Route path="/charities/:id" element={<CharityDetail />} />
          <Route path="/draws" element={<Draws />} />
          <Route path="/subscribe" element={<Subscribe />} />
          <Route path="/donate" element={<Donate />} />
          <Route path="/donate/:charityId" element={<Donate />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </>
  )
}

function NotFound() {
  return (
    <div className="container" style={{ padding: '96px 24px', textAlign: 'center' }}>
      <h1>404</h1>
      <p>That page doesn't exist.</p>
    </div>
  )
}
