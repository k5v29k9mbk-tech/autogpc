// The one thing between a thrown render error and a white screen. Without it
// React unmounts the whole tree on any error — including a rejected lazy()
// import — and the user gets a blank page with nothing to act on.

import { Component, type ErrorInfo, type ReactNode } from "react";

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[nexus] render failed:", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="auth-shell">
        <div className="card stack" style={{ gap: "var(--s3)", maxWidth: 520 }}>
          <div className="card-title">Something broke</div>
          <div className="alert alert-error" role="alert">
            <div>{error.message || "The screen failed to load."}</div>
          </div>
          <p className="muted" style={{ fontSize: 13 }}>
            Reloading usually clears this. Any document you were reviewing but hadn't saved will
            need to be scanned again.
          </p>
          <button
            className="btn btn-primary"
            style={{ width: "fit-content" }}
            onClick={() => location.reload()}
          >
            Reload Nexus
          </button>
        </div>
      </div>
    );
  }
}
