import React, { Component, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message?: string;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error) {
    console.error('Uncaught error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F5F5F5] flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-white max-w-md w-full p-8 rounded-2xl border border-gray-200 shadow-2xl">
            <div className="w-16 h-16 bg-shift-dark rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold">
              !
            </div>
            <h2 className="text-2xl font-bold text-shift-dark mb-2">Something went wrong</h2>
            <p className="text-gray-500 mb-6 text-sm">
              {this.state.message || 'An unexpected error occurred.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-shift-blue text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
