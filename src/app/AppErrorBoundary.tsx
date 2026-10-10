import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '../components/Primitives';

export class AppErrorBoundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  state: { error: string | null } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return {
      error:
        error instanceof Error
          ? error.message
          : 'An unknown interface error occurred.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('OS Lab interface error', error, info.componentStack);
  }

  render() {
    if (this.state.error)
      return (
        <main className="help-content panel" role="alert">
          <h1>The workspace could not render</h1>
          <p>{this.state.error}</p>
          <p>
            Your workload inputs remain in the active lab state. Try reopening
            the workspace.
          </p>
          <Button primary onClick={() => this.setState({ error: null })}>
            Try again
          </Button>
        </main>
      );
    return this.props.children;
  }
}
