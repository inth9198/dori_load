# 🍗 전국 닭도리탕 원정대

친구와 함께 전국 닭도리탕을 먹고 **지도 · 5점 별점 · 코멘트**로 기록하는 정적 웹사이트입니다.
GitHub Pages로 무료 배포되고, 데이터 공유는 두 가지 — **온라인 모드(Firebase, 추천: 친구가 깃허브 없이 바로 입력)** 또는 **오프라인 모드(`data/restaurants.js` 커밋)** 중 선택할 수 있어요.

## 기능

- 🗺️ 카카오맵 위에 다녀온/가볼 닭도리탕 표시 (핀이 자동으로 다 보이게 화면 맞춤)
- ⭐ 5점 만점 별점 (0.5점 단위), 나·친구 각자 평가
- 💬 가게별 나·친구 코멘트
- 🟢 "네이버 지도에서 보기" + "길찾기" 버튼 (모바일은 네이버 앱으로 바로 길안내)
- ✍️ 사이트에서 바로 평가 입력 — 온라인 모드면 **실시간 공유**, 오프라인 모드면 "커밋용 내보내기"로 공유
- 👥 평가자 자유롭게 추가 가능 (`js/config.js` 의 `reviewers`)

## 폴더 구조

```
dori_load/
├── index.html              # 페이지
├── css/style.css           # 스타일
├── js/config.js            # ⚙️ 설정 (카카오 키, 평가자 이름, Firebase) — 여기만 고치면 됨
├── js/app.js               # 로직
└── data/restaurants.js     # 🍗 공유 데이터 (커밋해서 공유)
```

---

## 1. 카카오맵 JavaScript 키 발급 (카드·사업자등록증 불필요)

카카오맵은 **카카오 계정만으로 무료** 발급돼요. (네이버 NCP와 달리 결제수단 카드 등록이 필요 없어요.)

1. [Kakao Developers](https://developers.kakao.com) 에 카카오 계정으로 로그인
2. **내 애플리케이션 → 애플리케이션 추가하기** (앱 이름/회사명 아무거나)
3. **앱 설정 → 플랫폼 → Web 플랫폼 등록** → **사이트 도메인** 추가 — ⚠️ **이게 가장 중요**, 등록한 도메인에서만 지도가 떠요:
   - 로컬 테스트: `http://localhost:8000`
   - 배포 주소: `https://<깃허브아이디>.github.io`
4. **제품 설정 → 카카오맵 → 사용 ON** (2024-12-01부터 신규 앱은 카카오맵 사용 설정을 켜야 호출돼요)
5. **앱 설정 → 앱 키** 에서 **JavaScript 키** 복사
6. [js/config.js](js/config.js) 의 `KAKAO_JS_KEY` 에 붙여넣기:

```js
KAKAO_JS_KEY: "여기에_JavaScript_키",
```

> 도메인을 등록 안 하면 지도가 안 떠요(인증 오류). 로컬 주소와 배포 주소를 모두 등록하세요.
> 스크립트 URL 형식: `https://dapi.kakao.com/v2/maps/sdk.js?appkey=...&autoload=false` (app.js가 자동으로 만듭니다)

---

## 2. 로컬에서 미리보기

`file://` 로 열어도 동작하지만, 카카오맵 도메인 등록 때문에 **로컬 서버로 여는 걸 권장**해요.

```powershell
# 이 폴더에서
python -m http.server 8000
```

브라우저에서 `http://localhost:8000` 접속. (카카오 개발자센터에 `http://localhost:8000` 을 Web 도메인으로 등록해 두세요.)

카카오 키가 없어도 지도만 자리표시로 바뀌고 목록·평가 기능은 다 동작합니다.

---

## 3. GitHub Pages로 배포

1. 이 폴더를 깃허브 저장소로 push (이미 `dori_load` 저장소가 있다면 그대로)
   ```powershell
   git add .
   git commit -m "닭도리탕 평가 사이트"
   git push
   ```
2. 깃허브 저장소 → **Settings → Pages**
3. **Source: Deploy from a branch**, Branch: `main` / `/(root)` 선택 후 저장
4. 1~2분 뒤 `https://<깃허브아이디>.github.io/<저장소이름>/` 에서 열림
5. 그 주소를 **1번의 카카오 Web 도메인에도 추가** 등록 (안 하면 배포본에서 지도가 안 뜸)

---

## 4. 온라인 모드(Firebase) — 완진(친구)이 깃허브 없이 입력 (추천)

깃허브를 안 쓰는 사람도 폰에서 바로 평점·코멘트를 올리려면 **Firebase Firestore** 를 연결하세요. 무료이고 서버 코드가 없어요. 연결하면 **입력 즉시 실시간**으로 둘이 공유됩니다. (설정값을 비워두면 아래 5번 오프라인 모드로 동작해요.)

1. [Firebase 콘솔](https://console.firebase.google.com) → **프로젝트 추가** (구글 계정, 무료 Spark 플랜)
2. 좌측 **빌드 → Firestore Database** → **데이터베이스 만들기** → 위치는 `asia-northeast3 (서울)` 권장
3. **규칙(Rules)** 탭을 아래로 교체하고 **게시** — 누구나 읽고 쓰게(친구가 바로 입력 가능):
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /places/{id} {
         allow read, write: if true;
       }
     }
   }
   ```
   > 테스트 모드 기본 규칙은 30일 뒤 만료돼요. 위 규칙으로 바꿔두면 안 만료됩니다. 주소를 아는 사람은 누구나 쓸 수 있으니, 나중에 막고 싶으면 간단한 PIN/로그인을 추가할 수 있어요.
4. **⚙️ 프로젝트 설정** → 하단 **내 앱** → **웹(`</>`)** 앱 추가 → 표시되는 `firebaseConfig` 값 복사
5. [js/config.js](js/config.js) 의 `firebase` 에 붙여넣기:
   ```js
   firebase: {
     apiKey: "AIza...",
     authDomain: "내프로젝트.firebaseapp.com",
     projectId: "내프로젝트",
     appId: "1:...:web:..."
   }
   ```
6. 저장 후 새로고침 — 하단에 **"🟢 온라인 저장(Firestore) 연결됨"** 이 뜨면 성공. 처음 한 번은 현재 등록된 가게(야시장512·풍년닭도리탕)가 자동 업로드돼요.

이 모드에선 사이트 입력이 바로 저장·공유되어 **커밋이 필요 없어요.** (`apiKey` 가 코드에 노출되는 건 정상이에요 — 접근은 위 Firestore 보안 규칙으로 제어합니다. 평가자가 더 늘면 [js/config.js](js/config.js) 의 `reviewers` 에 한 줄 추가하면 됩니다.)

---

## 5. 오프라인(커밋) 모드 — Firebase를 안 쓸 때

위 4번을 설정하지 않으면 데이터는 정적 파일이라 "저장 버튼" 하나로 동기화되진 않아요. 흐름은 이렇습니다:

1. 사이트에서 **+ 맛집 추가 / 평가** 또는 카드의 **✏️ 수정** 으로 별점·코멘트 입력
2. 입력 즉시 **내 브라우저(localStorage)** 에 저장돼서 바로 보임 (하단에 "로컬에만 저장됨" 표시)
3. 친구와 공유하려면 하단 **📋 커밋용 내보내기** 클릭 → 나온 내용을 통째로 복사
4. `data/restaurants.js` 파일에 붙여넣고:
   ```powershell
   git add data/restaurants.js
   git commit -m "평가 업데이트"
   git push
   ```
5. 배포가 갱신되면 친구도 같은 데이터를 봄. (공유 후 **로컬 변경 초기화** 눌러 정리해도 됨)

> 한 명만 커밋 담당해도 되고, 둘 다 push 해도 됩니다. 같은 가게를 동시에 고치면 나중 push가 덮어쓰니 주의.

### 손으로 직접 고치기

`data/restaurants.js` 를 직접 편집해도 돼요. 규칙은 파일 상단 주석 참고. 핵심:
- `status`: `"visited"`(가본 곳) / `"wishlist"`(가볼 곳)
- `lat`/`lng`: 모르면 `null` → 사이트의 **지도에서 위치 찍기** 로 채우기
- `reviews[].rating`: `0`=미평가, `0.5`~`5.0`

---

## 평가자 이름 바꾸기

`js/config.js` 의 `reviewers` 에서 `name` 만 바꾸면 돼요. `key`(minho/friend)는 데이터 식별용이라 그대로 두세요.

```js
reviewers: [
  { key: "minho",  name: "민호" },
  { key: "friend", name: "완진" }
]
```

---

## 현재 등록된 가게 (둘 다 노원)

- **야시장512** (가본 곳) — 📍 주소/좌표 확인 필요 (온라인에 정보가 안 잡혀 비워둠 — 사이트에서 "지도에서 위치 찍기"로 채우기)
- **풍년닭도리탕 (노원직영점)** (가본 곳) — 서울 노원구 노해로75길 14-22 (상계동, 노원역 6번 출구). 좌표는 근사값이라 지도에서 미세 보정 권장
