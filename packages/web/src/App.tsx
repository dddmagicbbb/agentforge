import { useTranslation } from "react-i18next";
import { defaultDraft } from "@agentforge/core";

const STEP_KEYS = ["requirement", "routine", "developers", "skills", "connection", "generate"] as const;

// PH2 골격: 6단계 이름과 core 연결만 확인한다. 화면 구현은 T-307(최소), T-421~T-426.
export function App() {
  const { t } = useTranslation();
  const draft = defaultDraft();
  return (
    <main>
      <h1>{t("app.title")}</h1>
      <p>{t("app.subtitle")}</p>
      <ol>
        {STEP_KEYS.map((k) => (
          <li key={k}>{t(`steps.${k}`)}</li>
        ))}
      </ol>
      <p>{t("skeleton.draft", { name: draft.name, count: draft.developerCount })}</p>
    </main>
  );
}
