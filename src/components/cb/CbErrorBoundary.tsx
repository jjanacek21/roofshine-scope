import { Component, type ErrorInfo, type ReactNode } from "react";
import { CbButton, CbCard } from "./primitives";

interface State {
  error: Error | null;
}

/**
 * Nothing in the field should ever end on a white screen — a rep on a roof
 * needs a way back to the job list.
 */
export class CbErrorBoundary extends Component<
  { children: ReactNode; fallback?: (error: Error, reset: () => void) => ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[claim-buddy]", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback)
      return this.props.fallback(this.state.error, () => this.setState({ error: null }));

    return (
      <div className="mx-auto w-full max-w-[560px] px-5 py-16">
        <CbCard elevation="raised" style={{ padding: 22 }}>
          <h1 className="cb-display" style={{ fontSize: 22 }}>
            That screen hit a snag.
          </h1>
          <p className="mt-2 text-[13.5px]" style={{ color: "var(--cb-text-muted)" }}>
            Your photos and answers are saved. Head back to the inspections list and pick up where
            you left off.
          </p>
          <p className="mt-3 text-[12px]" style={{ color: "var(--cb-text-muted)" }}>
            {this.state.error.message}
          </p>
          <div className="mt-5 flex gap-2">
            <CbButton onClick={() => this.setState({ error: null })} variant="secondary">
              Try again
            </CbButton>
            <CbButton onClick={() => { window.location.href = "/cb"; }}>Back to inspections</CbButton>
          </div>
        </CbCard>
      </div>
    );
  }
}
