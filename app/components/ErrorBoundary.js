"use client";
import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service here
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
          return this.props.fallback(this.state.error);
      }
      return (
        <div className="flex flex-col items-center justify-center w-full h-screen bg-black text-[#ff0033] font-mono p-4 space-y-4">
          <h2 className="text-2xl font-bold tracking-[0.2em] uppercase text-center border-b border-[#ff0033]/30 pb-2">
            CRITICAL RENDER FAULT
          </h2>
          <p className="text-sm max-w-lg text-center opacity-80 mb-4">
            The neural UI layer experienced a fatal exception. A background process or malformed schema may have broken the visual matrix.
          </p>
          <div className="bg-[#ff0033]/10 border border-[#ff0033]/50 p-4 rounded text-xs w-full max-w-2xl overflow-auto max-h-[30vh]">
            <code>{this.state.error?.toString()}</code>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-8 py-3 bg-black border-2 border-[#ff0033] text-[#ff0033] hover:bg-[#ff0033] hover:text-black font-bold tracking-widest uppercase transition-all shadow-[0_0_15px_rgba(255,0,51,0.5)] cursor-pointer"
          >
            ♻️ RESTART INTERFACE
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
