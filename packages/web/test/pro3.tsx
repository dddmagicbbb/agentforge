import { defaultDraft } from "@agentforge/core";
import { App } from "../src/App";

/** 기존 시험은 core 기본값(개발자 3명) 전제다. Pro 를 주입해 같은 의도를 유지한다(LIC-01: 화면 기본값은 Free 용 2명). */
export function App3(props: Parameters<typeof App>[0] = {}) {
  return <App initialDraft={defaultDraft()} initialLicense={{ tier: "pro", fromServer: true }} {...props} />;
}
