// ──────────────────────────────────────────────────────────────
// 사이트 설정 — 여기만 고치면 됩니다.
// ──────────────────────────────────────────────────────────────
window.CONFIG = {
  // 사이트 제목
  title: "도리로드",
  subtitle: "친구와 떠나는 전국 닭도리탕 원정",

  // 카카오맵 JavaScript 키 (Kakao Developers에서 발급).
  // 발급 전에는 "YOUR_KAKAO_JS_KEY" 그대로 두면 지도 자리에 안내가 뜹니다.
  // 발급 + 도메인 등록 방법은 README.md 참고. (도메인 등록 필수!)
  KAKAO_JS_KEY: "937ab0bb4632668cd19075e51c071170",

  // 평가하는 두 사람. key는 데이터 식별용(고정), name은 화면 표시용(자유롭게 변경).
  reviewers: [
    { key: "minho",  name: "민호" },
    { key: "friend", name: "완진" }
  ],

  // 지도 첫 화면(마커가 없을 때의 기본값). 카카오맵은 level이 클수록 축소(전국≈13, 동네≈5).
  // 마커가 있으면 자동으로 모든 핀이 보이게 맞춰집니다.
  map: {
    center: { lat: 36.2, lng: 127.9 },
    level: 13
  },

  // 온라인 공유 저장소 (Firebase Firestore).
  //   - 값을 채우면 "온라인 모드": 입력 즉시 실시간으로 둘이 공유됨 (완진님도 깃허브 없이 바로 입력).
  //   - 비워두면 "오프라인 모드": 기존처럼 data/restaurants.js 커밋으로 공유.
  // 값은 Firebase 콘솔 → 프로젝트 설정(⚙️) → "내 앱"에서 웹 앱 추가 → SDK 설정 및 구성에서 복사.
  // (자세한 단계는 README "온라인 모드(Firebase)" 참고)
  firebase: {
    apiKey: "AIzaSyClcZ-NDSP5TA-2k6pqwhJCAl5WHClnvYg",
    authDomain: "doriload.firebaseapp.com",
    projectId: "doriload",
    storageBucket: "doriload.firebasestorage.app",
    messagingSenderId: "403174420159",
    appId: "1:403174420159:web:430fb12593f898b25ca00a",
    measurementId: "G-QZ0VCBYWE7"
  }
};
