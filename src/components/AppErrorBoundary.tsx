import React from "react";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  error?: unknown;
};

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, errorInfo: unknown) {
    // Keep a console record for debugging in production.
    // eslint-disable-next-line no-console
    console.error("AppErrorBoundary caught error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const message =
      this.state.error instanceof Error
        ? this.state.error.message
        : "אירעה שגיאה לא צפויה";

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-lg border bg-card p-6 text-center">
          <h1 className="text-lg font-semibold">המערכת נתקלה בתקלה</h1>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
          <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-primary-foreground"
              onClick={() => window.location.reload()}
            >
              רענון
            </button>
            <button
              className="inline-flex h-10 items-center justify-center rounded-md border px-4"
              onClick={this.handleReset}
            >
              נסה שוב
            </button>
          </div>
        </div>
      </div>
    );
  }
}
