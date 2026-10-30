import { Component, type ReactNode } from "react";

interface Props {
  readonly children: ReactNode;
  readonly fallback: ReactNode;
}

/** 하위 화면이 예외로 깨져도 앱 전체가 내려앉지 않게 한다(원문 메시지는 노출하지 않는다). */
export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
