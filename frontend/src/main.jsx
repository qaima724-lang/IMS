import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './AuthContext.jsx';
import './styles.css';
import { useState, useEffect } from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by React boundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  componentDidMount() {
    this.unhandledRejectionHandler = (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      this.setState({ hasError: true, error: event.reason });
    };
    window.addEventListener('unhandledrejection', this.unhandledRejectionHandler);
  }

  componentWillUnmount() {
    window.removeEventListener('unhandledrejection', this.unhandledRejectionHandler);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: 'red', textAlign: 'center' }}>
          <h2>Something went wrong</h2>
          <p>We're experiencing some technical difficulties. Please try again later.</p>
          <details style={{ whiteSpace: 'pre-wrap', textAlign: 'left', margin: '20px auto', maxWidth: '600px', backgroundColor: '#fdd', padding: '10px', borderRadius: '5px' }}>
            <strong>{this.state.error && this.state.error.toString()}</strong>
            <br />
            {this.state.errorInfo?.componentStack}
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
    <ErrorBoundary>
    <AuthProvider>
        <App />
      </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>
);
