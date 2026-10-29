import { assertFilled, fillFirst } from "../util/tpl.js";
import { fmModel, type RenderContext } from "./context.js";
import { dropSkillLine, mdTpl } from "./tpl-source.js";
import type { SeqAgentIdT } from "../schema/index.js";

// 순차 단계 에이전트(RTN-02): planner, analyst, ux-designer, architect, common-dev, integrator

export function renderSeqAgent(c: RenderContext, id: SeqAgentIdT): string {
  let s = fillFirst(mdTpl(`${id}.md`, c.p.language), "MODEL", fmModel(c.p.agents[id]));
  if (id === "common-dev") {
    s = dropSkillLine(s, "tdd", c.p.skills.tdd);
    s = dropSkillLine(s, "conventions", c.p.skills.conventions);
  }
  return assertFilled(`md/${id}.md`, s);
}
