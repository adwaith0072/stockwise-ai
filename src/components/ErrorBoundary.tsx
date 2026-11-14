import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw } from "lucide-react";
import React from "react";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Local application error boundary that renders a fallback recovery UI.
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Unhandled application error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
          <div className="max-w-md w-full border border-border rounded-lg p-6 bg-card space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-semibold">Something went wrong</h1>
            <p className="text-sm text-muted-foreground break-words">
              {this.state.error?.message || "An unexpected runtime error occurred."}
            </p>
            <Button
              onClick={() => window.location.reload()}
              className="w-full"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reload Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
