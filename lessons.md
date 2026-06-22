# lessons.md — 버그/교훈 기록

새 세션은 이 파일을 먼저 본다.

## 2026-06-22 — `hidden` 속성이 CSS `display`에 가려져 안 숨겨짐

- **문제**: 카카오 키가 설정돼 지도가 정상 렌더되는데도, "키가 필요해요" 안내 박스(`#map-placeholder`)가 지도 아래에 계속 보임.
- **원인**: `.map-placeholder { display: flex }` 같은 author CSS가 브라우저 UA 기본 규칙 `[hidden] { display: none }`을 가린다. HTML `hidden` 속성을 줘도 클래스 규칙의 `display`가 우선이라 요소가 안 숨겨진다.
- **수정**: `.map-placeholder[hidden] { display: none; }` 추가 (속성 선택자가 클래스 규칙보다 우선).
- **규칙**: `display`를 지정한 요소를 `hidden` 속성으로 토글하려면, 반드시 `.selector[hidden] { display: none; }` 를 함께 둔다. 또는 `hidden` 대신 클래스 토글을 쓴다.
- **검증 한계**: jsdom은 CSS 표시(display)를 계산하지 않아 `hidden` 속성만 보고 통과 처리한다 → 이런 CSS 캐스케이드 버그는 jsdom 테스트로 못 잡는다. 표시 관련은 실제 브라우저 확인 필요.
