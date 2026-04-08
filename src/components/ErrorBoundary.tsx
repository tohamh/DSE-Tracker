import React, { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen bg-slate-900 text-white">
          <div className="p-8 bg-slate-800 rounded-lg shadow-xl text-center">
            <h2 className="text-2xl font-bold mb-4">Something went wrong.</h2>
            <p className="mb-4">Please refresh the page to try again.</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-teal-500 rounded hover:bg-teal-600"
            >
              Refresh
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
