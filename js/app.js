// ──────────────────────────────────────────────────────────────
// 전국 닭도리탕 원정대 — 메인 로직
// 데이터 = 커밋된 base(data/restaurants.js) + 내 브라우저의 로컬 수정(localStorage) 병합.
// 평가 입력은 즉시 로컬에 저장되고, "커밋용 내보내기"로 친구와 공유.
// ──────────────────────────────────────────────────────────────
(function () {
  "use strict";

  var CONFIG = window.CONFIG || {};
  var REVIEWERS = CONFIG.reviewers || [
    { key: "minho", name: "민호" },
    { key: "friend", name: "친구" }
  ];
  var LS_KEY = "dori_local_edits_v1";
  var LS_DELETED = "dori_deleted_ids_v1";

  // DOM 참조
  var $list = document.getElementById("restaurant-list");
  var $stats = document.getElementById("stats");
  var $filters = document.getElementById("filters");
  var $banner = document.getElementById("banner");
  var $mapEl = document.getElementById("map");
  var $mapPlaceholder = document.getElementById("map-placeholder");
  var $layout = document.getElementById("layout");
  var $viewToggle = document.getElementById("view-toggle");

  // 좁은 화면(모바일 토글 동작 기준). UA 기반 isMobile()(딥링크용)과 별개.
  function isNarrow() { return window.innerWidth < 880; }

  var state = {
    filter: "all",
    activeId: null
  };

  var mapObj = null;            // kakao.maps.Map
  var markers = {};             // id -> kakao.maps.Marker
  var infoWindow = null;        // 현재 열린 인포윈도우
  var boundsFitted = false;     // 첫 마커 렌더 시 한 번만 화면 맞춤
  var pickMode = false;         // 폼에서 "지도에서 위치 찍기" 모드
  var pickMarker = null;

  // 온라인 모드(Firebase) 상태
  var online = false;           // Firestore 연결 성공 여부
  var fb = null;                // { db, fs }
  var onlineData = [];          // Firestore 스냅샷의 최신 데이터

  // ── 데이터 로드/병합 ─────────────────────────────────────────
  function loadBase() {
    var raw = (window.DORI_DATA && window.DORI_DATA.restaurants) || [];
    // 깊은 복사로 base 보호
    return JSON.parse(JSON.stringify(raw));
  }

  function loadEdits() {
    try {
      var s = localStorage.getItem(LS_KEY);
      return s ? JSON.parse(s) : {};
    } catch (e) {
      return {};
    }
  }

  function saveEdits(edits) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(edits));
    } catch (e) {
      alert("로컬 저장에 실패했어요(저장공간/시크릿모드 확인).");
    }
  }

  // 오프라인 모드에서 삭제한 가게 id 목록
  function loadDeleted() {
    try {
      var s = localStorage.getItem(LS_DELETED);
      return s ? JSON.parse(s) : [];
    } catch (e) {
      return [];
    }
  }

  function saveDeleted(ids) {
    try {
      localStorage.setItem(LS_DELETED, JSON.stringify(ids));
    } catch (e) { /* 무시 */ }
  }

  // base + edits 병합 → 화면에 쓰는 작업 데이터
  function getWorkingData() {
    // 온라인 모드면 Firestore 데이터가 진실의 원천
    if (online) return onlineData.slice();

    var base = loadBase();
    var edits = loadEdits();
    var deleted = loadDeleted();
    var byId = {};
    base.forEach(function (r) { byId[r.id] = r; });
    Object.keys(edits).forEach(function (id) { byId[id] = edits[id]; });
    // base 순서 유지 + 신규(edits에만 있는 것) 뒤에 붙임
    var ordered = [];
    var seen = {};
    base.forEach(function (r) { ordered.push(byId[r.id]); seen[r.id] = true; });
    Object.keys(edits).forEach(function (id) {
      if (!seen[id]) ordered.push(edits[id]);
    });
    return ordered.filter(function (r) { return deleted.indexOf(r.id) < 0; });
  }

  // ── 별점 계산/렌더 ──────────────────────────────────────────
  function avgRating(r) {
    var rated = (r.reviews || []).filter(function (rv) { return rv.rating > 0; });
    if (!rated.length) return null;
    var sum = rated.reduce(function (a, rv) { return a + rv.rating; }, 0);
    return sum / rated.length;
  }

  function starsDisplay(rating, size) {
    var pct = Math.max(0, Math.min(100, (rating / 5) * 100));
    var cls = "stars" + (size ? " " + size : "");
    return '<span class="' + cls + '"><span style="width:' + pct + '%"></span></span>';
  }

  function reviewerName(key) {
    var r = REVIEWERS.find(function (x) { return x.key === key; });
    return r ? r.name : key;
  }

  // 평가자 아바타 색상 (config 순서 기준)
  var AVATAR_COLORS = ["#e23b30", "#2f8f9d", "#7a5cc4", "#d98324", "#3f8e4f", "#c64f8e"];
  function reviewerColor(key) {
    var i = REVIEWERS.findIndex(function (x) { return x.key === key; });
    if (i < 0) i = 0;
    return AVATAR_COLORS[i % AVATAR_COLORS.length];
  }

  // ── 외부 링크: 네이버 지도 / 길찾기 ─────────────────────────
  function isMobile() {
    return /android|iphone|ipad|ipod/i.test(navigator.userAgent);
  }

  function openNaverPlace(r) {
    var q = encodeURIComponent(r.name + (r.address ? " " + r.address : ""));
    var appname = location.hostname || "dakdoritang-review";
    if (isMobile() && r.lat != null && r.lng != null) {
      var scheme = "nmap://place?lat=" + r.lat + "&lng=" + r.lng +
        "&name=" + encodeURIComponent(r.name) + "&appname=" + appname;
      var web = "https://map.naver.com/p/search/" + q;
      deepLinkOrFallback(scheme, web);
    } else {
      window.open("https://map.naver.com/p/search/" + q, "_blank");
    }
  }

  function openNaverRoute(r) {
    if (r.lat == null || r.lng == null) {
      alert("위치가 아직 설정되지 않았어요. 카드의 '수정'에서 위치를 먼저 지정해주세요.");
      return;
    }
    var dname = encodeURIComponent(r.name);
    var appname = location.hostname || "dakdoritang-review";
    if (isMobile()) {
      // 문서화된 앱 스킴(출발지 생략 시 현위치 기준). 실패하면 모바일 웹 길찾기로 폴백.
      var scheme = "nmap://route/car?dlat=" + r.lat + "&dlng=" + r.lng +
        "&dname=" + dname + "&appname=" + appname;
      var web = "https://m.map.naver.com/route.nhn?menu=route&ename=" + dname +
        "&ex=" + r.lng + "&ey=" + r.lat + "&pathType=1";
      deepLinkOrFallback(scheme, web);
    } else {
      // 데스크톱: 도착지 장소를 열면 화면에서 길찾기 한 번에 가능.
      window.open("https://map.naver.com/p/search/" + encodeURIComponent(r.name + (r.address ? " " + r.address : "")), "_blank");
    }
  }

  // 앱 스킴 시도 → 일정 시간 내 앱 전환이 없으면 웹으로 폴백
  function deepLinkOrFallback(scheme, webUrl) {
    var moved = false;
    function onHide() { if (document.hidden) moved = true; }
    document.addEventListener("visibilitychange", onHide);
    window.location.href = scheme;
    setTimeout(function () {
      document.removeEventListener("visibilitychange", onHide);
      if (!moved) window.location.href = webUrl;
    }, 1200);
  }

  // ── 카드 렌더 ───────────────────────────────────────────────
  function cardHtml(r) {
    var avg = avgRating(r);
    var ratedCount = (r.reviews || []).filter(function (rv) { return rv.rating > 0; }).length;

    var statusBadge = r.status === "wishlist"
      ? '<span class="badge wishlist">가볼 곳</span>'
      : '<span class="badge visited">가본 곳</span>';
    var warnBadge = r.needsLocationCheck ? '<span class="badge warn">📍 위치 확인 필요</span>' : "";

    var addr = r.address
      ? '<p class="card-address">' + escapeHtml(r.address) + "</p>"
      : '<p class="card-address empty">주소 미입력</p>';

    var scoreChip = avg != null
      ? '<div class="score-chip" title="' + ratedCount + '명 평가"><span class="score-star">★</span><span class="score-num">' + avg.toFixed(1) + "</span></div>"
      : '<div class="score-chip empty"><span class="score-num">미평가</span></div>';

    var reviews = (r.reviews || []).map(function (rv) {
      var hasComment = rv.comment && rv.comment.trim();
      var nm = reviewerName(rv.reviewer);
      var ratingPart = rv.rating > 0
        ? '<span class="review-stars">' + starsDisplay(rv.rating, "sm") + '<span class="num">' + rv.rating.toFixed(1) + "</span></span>"
        : '<span class="review-stars"><span class="num">미평가</span></span>';
      return '<div class="review-row">' +
        '<span class="avatar" style="background:' + reviewerColor(rv.reviewer) + '">' + escapeHtml(nm.charAt(0)) + "</span>" +
        '<div class="review-body">' +
          '<div class="review-head"><span class="reviewer-name">' + escapeHtml(nm) + "</span>" + ratingPart + "</div>" +
          '<p class="review-comment' + (hasComment ? "" : " empty") + '">' +
            (hasComment ? escapeHtml(rv.comment) : "코멘트 없음") + "</p>" +
        "</div>" +
      "</div>";
    }).join("");

    return '' +
      '<li class="card' + (state.activeId === r.id ? " active" : "") + '" data-id="' + r.id + '">' +
        '<div class="card-head">' +
          '<div class="card-head-left">' +
            '<h3 class="card-name">' + escapeHtml(r.name) + "</h3>" +
            '<div class="badges">' + statusBadge + warnBadge + "</div>" +
          "</div>" +
          scoreChip +
        "</div>" +
        addr +
        '<div class="reviews">' + reviews + "</div>" +
        '<div class="card-actions">' +
          '<a class="naver" data-act="naver">네이버 지도</a>' +
          '<a class="route" data-act="route">길찾기</a>' +
          '<button class="edit" data-act="edit">✏️ 수정</button>' +
        "</div>" +
      "</li>";
  }

  function render() {
    var data = getWorkingData();
    var filtered = data.filter(function (r) {
      if (state.filter === "all") return true;
      return r.status === state.filter;
    });

    $list.innerHTML = filtered.map(cardHtml).join("") ||
      '<li class="small" style="color:var(--muted)">해당 분류에 맛집이 없어요.</li>';

    var visited = data.filter(function (r) { return r.status === "visited"; }).length;
    var wish = data.filter(function (r) { return r.status === "wishlist"; }).length;
    $stats.textContent = "🍗 가본 곳 " + visited + "곳 · 🎯 가볼 곳 " + wish + "곳";

    renderMarkers(data);
    updateLocalStateLabel();
  }

  // ── 지도 (카카오맵) ─────────────────────────────────────────
  function initMap() {
    if (!(window.kakao && window.kakao.maps)) return;
    mapObj = new kakao.maps.Map($mapEl, {
      center: new kakao.maps.LatLng(CONFIG.map.center.lat, CONFIG.map.center.lng),
      level: CONFIG.map.level || 13
    });

    // 위치 찍기 모드: 지도 클릭 시 좌표를 폼에 반영
    kakao.maps.event.addListener(mapObj, "click", function (mouseEvent) {
      if (!pickMode) return;
      var latlng = mouseEvent.latLng;
      document.getElementById("f-lat").value = latlng.getLat().toFixed(6);
      document.getElementById("f-lng").value = latlng.getLng().toFixed(6);
      if (pickMarker) pickMarker.setMap(null);
      pickMarker = new kakao.maps.Marker({ position: latlng });
      pickMarker.setMap(mapObj);
    });

    render();
  }

  function renderMarkers(data) {
    if (!mapObj) return;
    // 기존 마커 제거
    Object.keys(markers).forEach(function (id) { markers[id].setMap(null); });
    markers = {};

    var points = [];
    data.forEach(function (r) {
      if (r.lat == null || r.lng == null) return;
      var pos = new kakao.maps.LatLng(r.lat, r.lng);
      var marker = new kakao.maps.Marker({ position: pos, title: r.name });
      marker.setMap(mapObj);
      kakao.maps.event.addListener(marker, "click", function () {
        selectRestaurant(r.id, false);
        if (markers[r.id]) openInfo(r, markers[r.id]); // 재렌더로 새로 생긴 마커 참조
      });
      markers[r.id] = marker;
      points.push(pos);
    });

    // 첫 렌더에서 한 번만 모든 핀이 보이도록 화면 맞춤
    if (!boundsFitted && points.length) {
      fitToMarkers();
      boundsFitted = true;
    }
  }

  // 현재 마커들이 모두 보이도록 화면 맞춤 (1개면 적당히 확대)
  function fitToMarkers() {
    if (!mapObj) return;
    var pts = Object.keys(markers).map(function (id) { return markers[id].getPosition(); });
    if (!pts.length) return;
    if (pts.length === 1) {
      mapObj.setCenter(pts[0]);
      mapObj.setLevel(5);
    } else {
      var bounds = new kakao.maps.LatLngBounds();
      pts.forEach(function (p) { bounds.extend(p); });
      mapObj.setBounds(bounds);
    }
  }

  function openInfo(r, marker) {
    if (!mapObj) return;
    if (infoWindow) infoWindow.close();
    var avg = avgRating(r);
    var content = '<div style="padding:8px 10px;font-size:13px;line-height:1.4;max-width:220px;">' +
      '<strong>' + escapeHtml(r.name) + "</strong><br>" +
      (avg != null ? "⭐ " + avg.toFixed(1) : "평가 없음") +
      (r.address ? '<br><span style="color:#888">' + escapeHtml(r.address) + "</span>" : "") +
      "</div>";
    infoWindow = new kakao.maps.InfoWindow({ content: content, removable: true });
    infoWindow.open(mapObj, marker);
  }

  function selectRestaurant(id, panTo) {
    state.activeId = id;
    render();
    var card = $list.querySelector('[data-id="' + id + '"]');
    if (card) card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    if (panTo && markers[id]) {
      mapObj.panTo(markers[id].getPosition());
    }
  }

  function getById(id) {
    return getWorkingData().find(function (x) { return x.id === id; });
  }

  // 모바일 목록/지도 토글. 지도 표시 시 카카오맵 relayout 후 핀 맞춤(또는 특정 핀 포커스).
  function setView(view, focusId) {
    if (!$layout) return;
    $layout.dataset.view = view;
    if ($viewToggle) {
      Array.prototype.forEach.call($viewToggle.children, function (b) {
        b.classList.toggle("active", b.dataset.view === view);
      });
    }
    if (view === "map" && mapObj) {
      // 숨겨졌다 보이면 지도 크기 재계산이 필요함
      setTimeout(function () {
        mapObj.relayout();
        if (focusId && markers[focusId]) {
          mapObj.setLevel(4);
          mapObj.panTo(markers[focusId].getPosition());
          var r = getById(focusId);
          if (r) openInfo(r, markers[focusId]);
        } else {
          fitToMarkers();
        }
      }, 60);
    }
  }

  // ── 폼(추가/수정) ──────────────────────────────────────────
  var $modal = document.getElementById("modal");
  var $form = document.getElementById("form");
  var $reviewFields = document.getElementById("review-fields");
  var starValues = {}; // reviewerKey -> rating

  function openForm(existing) {
    document.getElementById("modal-title").textContent = existing ? "맛집 수정" : "맛집 추가";
    document.getElementById("f-id").value = existing ? existing.id : "";
    document.getElementById("f-name").value = existing ? existing.name : "";
    document.getElementById("f-address").value = existing ? (existing.address || "") : "";
    document.getElementById("f-lat").value = existing && existing.lat != null ? existing.lat : "";
    document.getElementById("f-lng").value = existing && existing.lng != null ? existing.lng : "";
    var status = existing ? existing.status : "visited";
    $form.querySelector('input[name="status"][value="' + status + '"]').checked = true;

    // 리뷰어별 별점/코멘트 입력 생성
    starValues = {};
    $reviewFields.innerHTML = "";
    REVIEWERS.forEach(function (rev) {
      var existingReview = existing && (existing.reviews || []).find(function (x) { return x.reviewer === rev.key; });
      var initRating = existingReview ? existingReview.rating : 0;
      var initComment = existingReview ? existingReview.comment : "";
      starValues[rev.key] = initRating;

      var box = document.createElement("div");
      box.className = "review-input";
      box.innerHTML =
        '<div class="ri-head">' +
          '<span class="ri-name">' + escapeHtml(rev.name) + "</span>" +
          '<span class="star-input" data-reviewer="' + rev.key + '"></span>' +
        "</div>" +
        '<textarea data-comment="' + rev.key + '" placeholder="' + escapeHtml(rev.name) + '의 코멘트">' +
          escapeHtml(initComment || "") + "</textarea>";
      $reviewFields.appendChild(box);

      var starEl = box.querySelector(".star-input");
      buildStarInput(starEl, rev.key, initRating);
    });

    // 안내 문구 (온라인/오프라인에 따라 다르게)
    var note = document.getElementById("form-note");
    if (note) {
      note.innerHTML = online
        ? "저장하면 <strong>바로 온라인에 반영</strong>되어 둘이 같이 봐요."
        : "저장하면 이 브라우저에 바로 반영돼요. 친구와 공유하려면 하단 \"커밋용 내보내기\"로 나온 내용을 <code>data/restaurants.js</code> 에 붙여넣고 push 하세요.";
    }

    // 삭제 버튼은 기존 가게 수정일 때만 노출
    document.getElementById("delete-btn").hidden = !existing;

    clearSearch();
    pickMode = false;
    document.getElementById("pick-hint").hidden = true;
    if (pickMarker) { pickMarker.setMap(null); pickMarker = null; }
    $modal.hidden = false;
  }

  function buildStarInput(el, reviewerKey, value) {
    el.innerHTML = "";
    for (var i = 1; i <= 5; i++) {
      var star = document.createElement("span");
      star.className = "si-star";
      star.dataset.index = i;
      star.innerHTML = "★<span class='half'>★</span>";
      el.appendChild(star);
    }
    var clear = document.createElement("button");
    clear.type = "button";
    clear.className = "star-clear";
    clear.textContent = "지움";
    el.parentNode.appendChild(clear);

    function paint(v) {
      Array.prototype.forEach.call(el.children, function (s) {
        var idx = parseInt(s.dataset.index, 10);
        s.classList.remove("full", "half-on");
        if (v >= idx) s.classList.add("full");
        else if (v >= idx - 0.5) s.classList.add("half-on");
      });
    }
    paint(value);

    el.addEventListener("click", function (e) {
      var s = e.target.closest(".si-star");
      if (!s) return;
      var idx = parseInt(s.dataset.index, 10);
      var rect = s.getBoundingClientRect();
      var isLeft = (e.clientX - rect.left) < rect.width / 2;
      var v = isLeft ? idx - 0.5 : idx;
      starValues[reviewerKey] = v;
      paint(v);
    });
    clear.addEventListener("click", function () {
      starValues[reviewerKey] = 0;
      paint(0);
    });
  }

  function closeForm() {
    $modal.hidden = true;
    pickMode = false;
    if (pickMarker) { pickMarker.setMap(null); pickMarker = null; }
  }

  // 가게 삭제 (온라인: Firestore에서 / 오프라인: 로컬에서)
  function deletePlace(id) {
    if (!id) return;
    var r = getById(id);
    var name = r ? r.name : "이 가게";
    if (!confirm('"' + name + '" 을(를) 삭제할까요? 되돌릴 수 없어요.')) return;

    if (online && fb) {
      fb.fs.deleteDoc(fb.fs.doc(fb.db, "places", id))
        .then(function () { state.activeId = null; closeForm(); }) // 스냅샷이 다시 그림
        .catch(function (e) { alert("삭제 실패: " + e.message); });
      return;
    }

    // 오프라인: edits에서 제거 + 삭제 목록에 등록(base 가게도 가려짐)
    var edits = loadEdits();
    delete edits[id];
    saveEdits(edits);
    var deleted = loadDeleted();
    if (deleted.indexOf(id) < 0) { deleted.push(id); saveDeleted(deleted); }
    state.activeId = null;
    closeForm();
    render();
  }

  // ── 장소 검색 (카카오 Places) → 이름/주소/좌표 자동 입력 ──────
  function clearSearch() {
    var $s = document.getElementById("f-search");
    var $res = document.getElementById("search-results");
    if ($s) $s.value = "";
    if ($res) { $res.hidden = true; $res.innerHTML = ""; }
  }

  function doPlaceSearch() {
    var q = document.getElementById("f-search").value.trim();
    var $res = document.getElementById("search-results");
    if (!q) return;
    if (!(window.kakao && kakao.maps && kakao.maps.services)) {
      alert("장소 검색은 카카오 지도 키가 설정돼야 동작해요. (config의 KAKAO_JS_KEY)");
      return;
    }
    var ps = new kakao.maps.services.Places();
    ps.keywordSearch(q, function (data, status) {
      $res.innerHTML = "";
      if (status !== kakao.maps.services.Status.OK || !data.length) {
        $res.innerHTML = '<li class="sr-empty">검색 결과가 없어요. 키워드를 바꿔보세요.</li>';
        $res.hidden = false;
        return;
      }
      data.slice(0, 8).forEach(function (p) {
        var addr = p.road_address_name || p.address_name || "";
        var li = document.createElement("li");
        li.className = "sr-item";
        li.innerHTML = '<span class="sr-name">' + escapeHtml(p.place_name) + "</span>" +
          (addr ? '<span class="sr-addr">' + escapeHtml(addr) + "</span>" : "");
        li.addEventListener("click", function () {
          document.getElementById("f-name").value = p.place_name;
          document.getElementById("f-address").value = addr;
          document.getElementById("f-lat").value = parseFloat(p.y).toFixed(6);
          document.getElementById("f-lng").value = parseFloat(p.x).toFixed(6);
          $res.hidden = true;
          $res.innerHTML = "";
        });
        $res.appendChild(li);
      });
      $res.hidden = false;
    });
  }

  function slugify(name) {
    var base = (name || "").trim().toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-+|-+$/g, "");
    if (!base) base = "place";
    // 한글이 섞이면 인코딩 대신 타임스탬프 보조 (Date.now 미사용 → performance 기반)
    if (/[가-힣]/.test(base)) base = "place-" + Math.round(performance.now());
    return base;
  }

  function onSubmit(e) {
    e.preventDefault();
    var name = document.getElementById("f-name").value.trim();
    if (!name) { alert("가게 이름은 필수예요."); return; }

    var latRaw = document.getElementById("f-lat").value.trim();
    var lngRaw = document.getElementById("f-lng").value.trim();
    var lat = latRaw === "" ? null : parseFloat(latRaw);
    var lng = lngRaw === "" ? null : parseFloat(lngRaw);
    if ((lat != null && isNaN(lat)) || (lng != null && isNaN(lng))) {
      alert("좌표 형식이 올바르지 않아요."); return;
    }

    var id = document.getElementById("f-id").value || slugify(name);
    var status = $form.querySelector('input[name="status"]:checked').value;
    var address = document.getElementById("f-address").value.trim();

    var reviews = REVIEWERS.map(function (rev) {
      var comment = $reviewFields.querySelector('textarea[data-comment="' + rev.key + '"]').value.trim();
      return { reviewer: rev.key, rating: starValues[rev.key] || 0, comment: comment };
    });

    var record = {
      id: id, name: name, address: address,
      lat: lat, lng: lng, status: status,
      reviews: reviews
    };
    // 위치가 채워졌으면 확인 필요 플래그 해제
    if (lat == null || lng == null) record.needsLocationCheck = true;

    // 온라인 모드: Firestore에 저장 (스냅샷이 자동으로 다시 그림)
    if (online && fb) {
      state.activeId = id;
      fb.fs.setDoc(fb.fs.doc(fb.db, "places", id), toDoc(record), { merge: true })
        .then(function () {
          closeForm();
          if (lat != null && lng != null && mapObj && markers[id]) {
            mapObj.panTo(markers[id].getPosition());
          }
        })
        .catch(function (err) { alert("온라인 저장 실패: " + err.message); });
      return;
    }

    // 오프라인 모드: 로컬 저장 후 다시 그림
    var edits = loadEdits();
    edits[id] = record;
    saveEdits(edits);

    closeForm();
    state.activeId = id;
    render();
    if (lat != null && lng != null && mapObj && markers[id]) {
      mapObj.panTo(markers[id].getPosition());
    }
  }

  // ── 내보내기 ────────────────────────────────────────────────
  function buildExportText() {
    var data = getWorkingData();
    // needsLocationCheck 가 false 의미면 굳이 직렬화하지 않도록 정리
    var clean = data.map(function (r) {
      var o = {
        id: r.id, name: r.name, address: r.address || "",
        lat: r.lat != null ? r.lat : null, lng: r.lng != null ? r.lng : null,
        status: r.status
      };
      if (r.needsLocationCheck && (r.lat == null || r.lng == null)) o.needsLocationCheck = true;
      o.reviews = REVIEWERS.map(function (rev) {
        var rv = (r.reviews || []).find(function (x) { return x.reviewer === rev.key; }) || { rating: 0, comment: "" };
        return { reviewer: rev.key, rating: rv.rating || 0, comment: rv.comment || "" };
      });
      return o;
    });
    var header = "// 자동 생성됨 — 이 파일 전체를 교체하세요. (사이트의 '커밋용 내보내기')\n";
    return header + "window.DORI_DATA = " + JSON.stringify({ restaurants: clean }, null, 2) + ";\n";
  }

  var $exportModal = document.getElementById("export-modal");
  function openExport() {
    document.getElementById("export-text").value = buildExportText();
    $exportModal.hidden = false;
  }

  function updateLocalStateLabel() {
    if (online) return; // 온라인 모드는 별도 표시(updateOnlineUI)
    var edits = loadEdits();
    var n = Object.keys(edits).length;
    var label = document.getElementById("local-state");
    if (n > 0) {
      label.textContent = "⚠️ 로컬에만 저장된 변경 " + n + "건 — 친구와 공유하려면 '커밋용 내보내기' 후 push 하세요.";
    } else {
      label.textContent = "로컬 변경 없음 (커밋된 데이터와 동일).";
    }
  }

  // ── 온라인 모드 (Firebase Firestore) ────────────────────────
  function firebaseConfigured() {
    var f = CONFIG.firebase;
    return !!(f && f.apiKey && f.projectId && f.apiKey.indexOf("YOUR") !== 0);
  }

  // 우리 레코드(reviews 배열) → Firestore 문서(reviews 맵: reviewerKey -> {rating,comment})
  function toDoc(r) {
    var reviews = {};
    (r.reviews || []).forEach(function (rv) {
      reviews[rv.reviewer] = { rating: rv.rating || 0, comment: rv.comment || "" };
    });
    return {
      name: r.name,
      address: r.address || "",
      lat: r.lat == null ? null : r.lat,
      lng: r.lng == null ? null : r.lng,
      status: r.status || "visited",
      needsLocationCheck: !!(r.needsLocationCheck && (r.lat == null || r.lng == null)),
      reviews: reviews
    };
  }

  // Firestore 문서 → 우리 레코드
  function fromDoc(id, data) {
    var reviews = REVIEWERS.map(function (rev) {
      var rv = (data.reviews && data.reviews[rev.key]) || { rating: 0, comment: "" };
      return { reviewer: rev.key, rating: rv.rating || 0, comment: rv.comment || "" };
    });
    return {
      id: id,
      name: data.name,
      address: data.address || "",
      lat: data.lat == null ? null : data.lat,
      lng: data.lng == null ? null : data.lng,
      status: data.status || "visited",
      needsLocationCheck: !!data.needsLocationCheck,
      reviews: reviews
    };
  }

  // base(seed) 순서를 우선 유지하고, seed에 없는 신규는 이름순으로 뒤에 붙임
  function sortByBase(arr) {
    var order = {};
    loadBase().forEach(function (r, i) { order[r.id] = i; });
    return arr.slice().sort(function (a, b) {
      var oa = order[a.id], ob = order[b.id];
      if (oa != null && ob != null) return oa - ob;
      if (oa != null) return -1;
      if (ob != null) return 1;
      return (a.name || "").localeCompare(b.name || "");
    });
  }

  async function initOnline() {
    var cfg = CONFIG.firebase;
    try {
      var mods = await Promise.all([
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js")
      ]);
      var appMod = mods[0], fsMod = mods[1];
      var app = appMod.initializeApp(cfg);
      var db = fsMod.getFirestore(app);
      fb = { db: db, fs: fsMod };
      var col = fsMod.collection(db, "places");

      // 컬렉션이 비어 있으면 seed(data/restaurants.js)로 초기화
      var snap = await fsMod.getDocs(col);
      if (snap.empty) {
        await Promise.all(loadBase().map(function (r) {
          return fsMod.setDoc(fsMod.doc(db, "places", r.id), toDoc(r));
        }));
      }

      online = true;
      updateOnlineUI(true);

      // 실시간 구독
      fsMod.onSnapshot(col, function (qs) {
        var arr = [];
        qs.forEach(function (d) { arr.push(fromDoc(d.id, d.data())); });
        onlineData = sortByBase(arr);
        render();
      }, function (err) {
        console.error("Firestore 구독 오류", err);
        showBanner("온라인 데이터 수신 오류 — Firestore 보안 규칙(read/write 허용)을 확인해주세요.");
      });
    } catch (e) {
      console.error("Firebase 초기화 실패", e);
      online = false;
      showBanner("온라인 저장(Firebase) 연결 실패 — config.js의 firebase 설정값을 확인해주세요. 우선 오프라인(커밋) 모드로 동작해요.");
      render();
    }
  }

  function updateOnlineUI(isOnline) {
    var exportBtn = document.getElementById("export-btn");
    var resetBtn = document.getElementById("reset-local");
    var label = document.getElementById("local-state");
    if (isOnline) {
      // 오프라인 전용 버튼 숨김
      exportBtn.style.display = "none";
      resetBtn.style.display = "none";
      label.textContent = "🟢 온라인 저장(Firestore) 연결됨 — 입력하면 바로 둘이 공유돼요.";
    }
  }

  // ── 배너 ────────────────────────────────────────────────────
  function showBanner(html) {
    $banner.innerHTML = html;
    $banner.hidden = false;
  }

  // ── 유틸 ────────────────────────────────────────────────────
  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  // ── 이벤트 바인딩 ───────────────────────────────────────────
  function bindEvents() {
    // 필터
    $filters.addEventListener("click", function (e) {
      var btn = e.target.closest(".filter");
      if (!btn) return;
      state.filter = btn.dataset.filter;
      Array.prototype.forEach.call($filters.children, function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      render();
    });

    // 카드 클릭/액션 (이벤트 위임)
    $list.addEventListener("click", function (e) {
      var card = e.target.closest(".card");
      if (!card) return;
      var id = card.dataset.id;
      var data = getWorkingData();
      var r = data.find(function (x) { return x.id === id; });
      if (!r) return;

      var actEl = e.target.closest("[data-act]");
      if (actEl) {
        var act = actEl.dataset.act;
        if (act === "naver") { openNaverPlace(r); return; }
        if (act === "route") { openNaverRoute(r); return; }
        if (act === "edit") { openForm(r); return; }
      }
      // 카드 본문 클릭 → 하이라이트 + 지도로 이동
      if (isNarrow()) {
        // 모바일: 지도 뷰로 전환하면서 해당 핀 포커스
        selectRestaurant(id, false);
        setView("map", id);
      } else {
        selectRestaurant(id, true);
        if (markers[id]) openInfo(r, markers[id]);
      }
    });

    // 추가 버튼 (데스크톱 툴바 + 모바일 FAB)
    document.getElementById("add-btn").addEventListener("click", function () { openForm(null); });
    var fab = document.getElementById("fab");
    if (fab) fab.addEventListener("click", function () { openForm(null); });

    // 목록/지도 토글 (모바일)
    if ($viewToggle) {
      $viewToggle.addEventListener("click", function (e) {
        var b = e.target.closest("button[data-view]");
        if (b) setView(b.dataset.view);
      });
    }

    // 장소 검색
    document.getElementById("search-btn").addEventListener("click", doPlaceSearch);
    document.getElementById("f-search").addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); doPlaceSearch(); }
    });

    // 삭제
    document.getElementById("delete-btn").addEventListener("click", function () {
      deletePlace(document.getElementById("f-id").value);
    });

    // 모달 닫기
    Array.prototype.forEach.call(document.querySelectorAll("[data-close]"), function (el) {
      el.addEventListener("click", closeForm);
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-close-export]"), function (el) {
      el.addEventListener("click", function () { $exportModal.hidden = true; });
    });

    // 위치 찍기 토글
    document.getElementById("pick-on-map").addEventListener("click", function () {
      if (!mapObj) { alert("지도가 로드되어야 위치를 찍을 수 있어요. (네이버 클라이언트 ID 필요)"); return; }
      pickMode = !pickMode;
      document.getElementById("pick-hint").hidden = !pickMode;
      this.textContent = pickMode ? "📍 위치 찍는 중… (지도 클릭)" : "📍 지도에서 위치 찍기";
    });

    // 폼 제출
    $form.addEventListener("submit", onSubmit);

    // 내보내기
    document.getElementById("export-btn").addEventListener("click", openExport);
    document.getElementById("copy-export").addEventListener("click", function () {
      var ta = document.getElementById("export-text");
      ta.select();
      navigator.clipboard ? navigator.clipboard.writeText(ta.value).then(toastCopied, function () { document.execCommand("copy"); toastCopied(); })
        : (document.execCommand("copy"), toastCopied());
    });
    document.getElementById("download-export").addEventListener("click", function () {
      var blob = new Blob([document.getElementById("export-text").value], { type: "text/javascript" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "restaurants.js";
      a.click();
      URL.revokeObjectURL(a.href);
    });

    // 로컬 초기화
    document.getElementById("reset-local").addEventListener("click", function () {
      if (!confirm("로컬에 저장한 변경을 모두 지우고 커밋된 데이터로 되돌릴까요?")) return;
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem(LS_DELETED);
      state.activeId = null;
      render();
    });

    // ESC로 모달 닫기
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { closeForm(); $exportModal.hidden = true; }
    });
  }

  function toastCopied() {
    var btn = document.getElementById("copy-export");
    var old = btn.textContent;
    btn.textContent = "복사됨 ✓";
    setTimeout(function () { btn.textContent = old; }, 1500);
  }

  // ── 부트스트랩 ──────────────────────────────────────────────
  function boot() {
    // 제목/부제 반영
    if (CONFIG.title) {
      document.getElementById("site-title").textContent = CONFIG.title;
      document.title = CONFIG.title;
    }
    if (CONFIG.subtitle) document.getElementById("site-subtitle").textContent = CONFIG.subtitle;

    bindEvents();

    // 온라인 모드(Firebase): 설정돼 있으면 실시간 공유 저장 사용. (지도 로드와 독립적으로 진행)
    if (firebaseConfigured()) initOnline();

    var hasKey = CONFIG.KAKAO_JS_KEY && CONFIG.KAKAO_JS_KEY !== "YOUR_KAKAO_JS_KEY";
    if (!hasKey) {
      $mapEl.hidden = true;
      $mapPlaceholder.hidden = false;
      showBanner('지도를 보려면 <code>js/config.js</code> 의 <code>KAKAO_JS_KEY</code> 를 채워주세요. (발급 방법은 README)');
      render(); // 지도 없이 목록만
      return;
    }

    // 카카오 스크립트 로드 완료 대기
    if (window.__KAKAO_READY__) {
      initMap();
    } else if (window.__KAKAO_ERROR__) {
      onKakaoFail();
    } else {
      window.onKakaoReady = initMap;
      window.onKakaoError = onKakaoFail;
    }
  }

  function onKakaoFail() {
    $mapEl.hidden = true;
    $mapPlaceholder.hidden = false;
    showBanner('카카오맵 로드에 실패했어요. JavaScript 키와 카카오 개발자센터의 <strong>플랫폼 → Web 도메인 등록</strong>을 확인해주세요.');
    render();
  }

  // 디버깅/테스트용 훅 (내부 변환 함수 노출). 동작에는 영향 없음.
  window.__DORI__ = {
    toDoc: toDoc, fromDoc: fromDoc, sortByBase: sortByBase,
    firebaseConfigured: firebaseConfigured, getWorkingData: getWorkingData,
    isNarrow: isNarrow, setView: setView
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
