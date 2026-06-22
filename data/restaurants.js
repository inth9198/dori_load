// ──────────────────────────────────────────────────────────────
// 닭도리탕 데이터 (공유 저장소).
//
// 이 파일이 "둘이서 공유하는" 데이터입니다.
// 사이트에서 평가를 입력하면 우선 내 브라우저(localStorage)에만 저장되고,
// "커밋용 내보내기" 버튼으로 나온 내용을 이 파일에 붙여넣고 git push 하면
// 친구도 같은 데이터를 보게 됩니다.
//
// 직접 손으로 고쳐도 됩니다. 규칙:
//   - id           : 영문/숫자 고유값 (중복 금지)
//   - status       : "visited"(가본 곳) 또는 "wishlist"(가볼 곳)
//   - lat/lng      : 위도/경도. 모르면 null 로 두고 사이트의 "지도에서 위치 찍기"로 채우세요.
//   - reviews      : reviewer 는 config.js 의 key 와 일치. rating 0 = 아직 평가 안 함, 0.5~5.0
// ──────────────────────────────────────────────────────────────
window.DORI_DATA = {
  restaurants: [
    {
      id: "yasijang512",
      name: "야시장512",
      address: "",                 // ← 정확한 주소를 넣어주세요
      lat: null,                   // ← 위치 미설정: 지도에서 찍거나 좌표 입력
      lng: null,
      status: "visited",
      needsLocationCheck: true,    // 위치 확인 필요 표시
      reviews: [
        { reviewer: "minho",  rating: 0, comment: "" },
        { reviewer: "friend", rating: 0, comment: "" }
      ]
    },
    {
      // 풍년닭도리탕 노원직영점(상계동). 노원역 7호선 6번 출구 도보 약 274m. 좌표는 근사값 — 지도에서 정확히 찍어 보정 권장.
      id: "pungnyeon",
      name: "풍년닭도리탕 (노원직영점)",
      address: "서울 노원구 노해로75길 14-22 (상계동, 노원역 6번 출구)",
      lat: 37.6557,                // 노원역 인근 근사 좌표 (정확도 확인 필요)
      lng: 127.0601,
      status: "visited",
      needsLocationCheck: true,
      reviews: [
        { reviewer: "minho",  rating: 0, comment: "" },
        { reviewer: "friend", rating: 0, comment: "" }
      ]
    }
  ]
};
