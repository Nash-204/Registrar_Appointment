import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { Protected } from './auth.jsx';
import Home from './pages/Home.jsx';
import About from './pages/About.jsx';
import Appointment from './pages/Appointment.jsx';
import Track from './pages/Track.jsx';
import Login from './pages/Login.jsx';
import Employee from './pages/staff/Employee.jsx';
import Admin from './pages/staff/Admin.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/appointment" element={<Appointment />} />
        <Route path="/track" element={<Track />} />
      </Route>
      <Route path="/login" element={<Login />} />
      <Route path="/employee" element={<Protected role="employee"><Employee /></Protected>} />
      <Route path="/admin" element={<Protected role="admin"><Admin /></Protected>} />
      <Route path="*" element={<Layout />}><Route path="*" element={<div className="mx-auto max-w-3xl px-4 py-24"><h1 className="text-3xl">Page not found</h1></div>} /></Route>
    </Routes>
  );
}
