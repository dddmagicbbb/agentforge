import { useTranslation } from "react-i18next";
import type { AgentModelT, ProviderIdT } from "@agentforge/core";
import { defaultModel, modelsOf, PROVIDER_IDS } from "../catalog";

interface Props {
  /** aria-label·datalist id 에 쓰는 식별자(예: planner) */
  readonly id: string;
  readonly value: AgentModelT;
  readonly disabled?: boolean;
  readonly onChange: (next: AgentModelT) => void;
}

/** 제공자 select + 모델 input(datalist 추천). 제공자 변경 시 모델을 추천 기본값으로 바꾼다. */
export function ModelPicker({ id, value, disabled = false, onChange }: Props) {
  const { t } = useTranslation();
  const listId = `models-${id}`;
  return (
    <>
      <select
        aria-label={t("routine.providerLabel", { id })}
        value={value.provider}
        disabled={disabled}
        onChange={(e) => {
          const provider = e.target.value as ProviderIdT;
          onChange({ provider, model: defaultModel(provider) });
        }}
      >
        {PROVIDER_IDS.map((id) => <option key={id} value={id}>{t(`provider.${id}`)}</option>)}
      </select>
      <input
        aria-label={t("routine.modelLabel", { id })}
        list={listId}
        value={value.model}
        disabled={disabled}
        onChange={(e) => onChange({ provider: value.provider, model: e.target.value })}
      />
      <datalist id={listId}>{modelsOf(value.provider).map((m) => <option key={m} value={m} />)}</datalist>
    </>
  );
}
