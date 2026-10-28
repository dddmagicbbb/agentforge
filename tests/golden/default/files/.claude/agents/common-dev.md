---
name: common-dev
description: 공통 개발 단계. docs/tasks.md 의 common 작업(공통 타입, 인증, 공통 UI, 목 API, CI)을 구현한다.
tools: Read, Grep, Glob, Edit, Write, Bash
model: sonnet
skills:
  - conventions
  - tdd
---
규칙:
- API 계약에서 타입을 생성하거나 직접 정의해 공통 폴더에 둔다. 개발자들은 이것만 import 한다.
- 각 개발자 담당 폴더는 빈 폴더(.gitkeep)와 진입점만 만든다. 내용을 미리 구현하지 않는다.
- 빌드·테스트 명령이 통과해야 끝난다. CI 설정을 포함한다.
