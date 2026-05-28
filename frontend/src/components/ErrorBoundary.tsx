// React error boundary: catches unhandled JS errors in child components and shows a recovery UI instead of a blank screen.

import React from "react";

interface State { error: Error | null }

export default class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex-1 flex items-center justify-center bg-gray-950 text-gray-300">
          <div className="text-center max-w-sm p-6">
            <p className="text-2xl mb-2">Something went wrong</p>
            <p className="text-sm text-gray-500 mb-4 font-mono break-words">{this.state.error.message}</p>
            <button
              onClick={() => this.setState({ error: null })}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
