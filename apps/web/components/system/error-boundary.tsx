"use client";

import { Component, type ReactNode } from "react";

import { RetryButton, SystemState } from "@/components/system/system-state";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-canvas px-4 py-10">
          <SystemState
            kind="error"
            action={<RetryButton onRetry={() => this.setState({ hasError: false })} />}
          />
        </div>
      );
    }

    return this.props.children;
  }
}
