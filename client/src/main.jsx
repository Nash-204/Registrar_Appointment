import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './auth.jsx';
import './index.css';

class Boundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e) { console.error(e); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div style={{ padding: '4rem 1rem', textAlign: 'center' }}>
        <h1>Something went wrong</h1>
        <p>Please reload the page. If it keeps happening, contact the office.</p>
        <button onClick={() => window.location.assign('/')}>Back to home</button>
      </div>
    );
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <Boundary>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider><App /></AuthProvider>
    </BrowserRouter>
  </Boundary>
);
