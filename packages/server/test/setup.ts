// 시험 파일마다 만든 임시 폴더를 지운다
import { afterAll } from "vitest";
import { cleanupTmp } from "./helpers.js";

afterAll(() => cleanupTmp());
