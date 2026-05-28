// Root layout: renders the image library sidebar and the main editor panel side by side, each wrapped in an error boundary.

import React from "react";
import Sidebar from "./components/Sidebar";
import Editor from "./components/Editor";
import ErrorBoundary from "./components/ErrorBoundary";

export default function App() {
  return (
    <div className="flex h-screen overflow-hidden">
      <ErrorBoundary>
        <Sidebar />
      </ErrorBoundary>
      <main className="flex-1 flex flex-col min-w-0">
        <ErrorBoundary>
          <Editor />
        </ErrorBoundary>
      </main>
    </div>
  );
}
