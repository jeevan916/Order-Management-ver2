
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { errorService } from './services/errorService';
import { geminiService } from './services/geminiService';
import { whatsappService } from './services/whatsappService';
import './index.css'; 

// Initialize global error monitoring
errorService.initGlobalListeners();

// Dependency Injection to solve Circular Dependency
errorService.setDependencies(
  (msg, src) => geminiService.diagnoseError(msg, src),
  (payload) => whatsappService.createMetaTemplate(payload)
);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
