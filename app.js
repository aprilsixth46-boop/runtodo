(function () {
  // Firestore 초기화 (중복 방지)
  const firebaseApp = firebase.apps.length
    ? firebase.app()
    : firebase.initializeApp(firebaseConfig);
  const db = firebaseApp.firestore();
  const COLLECTION = "runs";

  // 로컬 캐시 — onSnapshot 이 실시간으로 갱신
  let runs = [];

  const RUN_EMOJIS = [
    // 러너·사람
    "🏃","🏃‍♀️","🏃‍♂️","🚶","🚶‍♀️","🚶‍♂️","🧗","🚴","🚴‍♀️","🤸",
    "🤸‍♀️","🧍","🧎","🧎‍♀️","🏋️","🏋️‍♀️","🤼","🤾","🤾‍♀️","🧜‍♀️",
    // 날씨·시간
    "🌅","🌄","🌇","🌆","🌃","🌁","⛅","🌤️","🌥️","🌦️",
    "🌧️","⛈️","🌩️","🌨️","☀️","🌙","🌛","🌚","☔","❄️",
    "🌬️","🌫️","🌪️","🌝","🌞","🌜","⛄","🌂","☁️","🔆",
    // 자연·장소
    "🌿","🌲","🌳","🌾","🌊","🏞️","🏔️","⛰️","🗻","🏙️",
    "🌸","🍃","🍂","🍁","🌻","🌼","🌺","🌈","🦋","🐦",
    "🦅","🐾","🌵","🏕️","🏖️","🏝️","🗺️","🌏","🌍","🍀",
    "🌱","🌴","🪨","🪵","🦜","🦢","🌋","🏜️","🌉","🌠",
    // 장비·복장
    "👟","🧢","🧤","🧦","🩳","🩺","🎽","🥾","👒","🕶️",
    "🧣","🧥","👕","🩱","🧴","🩹","💊","🔦","🎒","🧳",
    // 파워·감정
    "💪","🔥","⚡","❤️‍🔥","🫀","💧","🫧","🥵","😤","😎",
    "🤩","😁","😆","🥳","🤗","😮‍💨","🫶","🙌","👊","✊",
    "🤛","🤝","👏","🫁","🧠","💚","💙","🩵","🩶","🖤",
    // 목표·기록
    "🎯","🏅","🥇","🥈","🏆","📍","⏱️","📈","🗓️","✅",
    "📝","📊","🗒️","🔖","📌","🏁","🚩","🎌","⚑","🔔",
    // 음식·보충
    "🍌","🍊","🍋","🍎","🫐","🍇","🥝","🍉","🥤","💦",
    "🧃","🍵","☕","🥜","🍫","🥯","🍞","🥗","🍱","🧇",
    // 기타 에너지·재미
    "🚀","⭐","💫","✨","🎶","🎧","🧘","🤜","💥","🎵",
    "🎤","🎸","🥁","🎊","🎉","🪄","🎮","🕹️","🃏","🎲",
  ];

  let currentEmoji = RUN_EMOJIS[0];
  let editingId = null;
  let currentView = "list"; // "list" | "calendar"
  let filterMode = "upcoming"; // "upcoming" | "favorite" | "past"
  let calYear = new Date().getFullYear();
  let calMonth = new Date().getMonth(); // 0-based

  const todayRunsEl = document.getElementById("today-runs");
  const scheduleListEl = document.getElementById("schedule-list");
  const openModalBtn = document.getElementById("open-modal-btn");
  const modal = document.getElementById("modal");
  const backdrop = document.getElementById("modal-backdrop");
  const closeModalBtn = document.getElementById("close-modal-btn");
  const cancelBtn = document.getElementById("cancel-btn");
  const form = document.getElementById("run-form");
  const emojiBtn = document.getElementById("emoji-btn");
  const modalTitle = document.getElementById("modal-title");

  const viewListEl = document.getElementById("view-list");
  const viewCalendarEl = document.getElementById("view-calendar");
  const calLabel = document.getElementById("cal-label");
  const calGrid = document.getElementById("cal-grid");
  const btnListView = document.getElementById("btn-list-view");
  const btnCalendarView = document.getElementById("btn-calendar-view");
  const calPrev = document.getElementById("cal-prev");
  const calNext = document.getElementById("cal-next");
  const btnFilterUpcoming = document.getElementById("btn-filter-upcoming");

  const detailModal = document.getElementById("detail-modal");
  const detailBackdrop = document.getElementById("detail-backdrop");
  const detailCloseBtn = document.getElementById("detail-close-btn");
  const detailTitle = document.getElementById("detail-title");
  const detailBody = document.getElementById("detail-body");
  const detailEditBtn = document.getElementById("detail-edit-btn");
  const detailDeleteBtn = document.getElementById("detail-delete-btn");
  const detailFavBtn = document.getElementById("detail-fav-btn");
  const detailShareBtn = document.getElementById("detail-share-btn");
  let detailRunId = null;

  function randomEmoji() {
    return RUN_EMOJIS[Math.floor(Math.random() * RUN_EMOJIS.length)];
  }

  // ── Emoji picker modal ──
  const emojiPickerModal = document.getElementById("emoji-picker-modal");
  const emojiPickerBackdrop = document.getElementById("emoji-picker-backdrop");
  const emojiPickerGrid = document.getElementById("emoji-picker-grid");
  const emojiPickerClose = document.getElementById("emoji-picker-close");

  emojiPickerGrid.innerHTML = RUN_EMOJIS.map((e) =>
    `<button type="button" class="emoji-picker__item" data-emoji="${e}">${e}</button>`
  ).join("");

  function openEmojiPicker() {
    emojiPickerGrid.querySelectorAll(".emoji-picker__item").forEach((btn) => {
      btn.classList.toggle("is-selected", btn.dataset.emoji === currentEmoji);
    });
    emojiPickerModal.hidden = false;
    emojiPickerBackdrop.hidden = false;
    requestAnimationFrame(() => {
      emojiPickerModal.classList.add("is-open");
      emojiPickerBackdrop.classList.add("is-open");
    });
    const selected = emojiPickerGrid.querySelector(".is-selected");
    if (selected) selected.scrollIntoView({ block: "center" });
  }

  function closeEmojiPicker() {
    emojiPickerModal.classList.remove("is-open");
    emojiPickerBackdrop.classList.remove("is-open");
    window.setTimeout(() => {
      emojiPickerModal.hidden = true;
      emojiPickerBackdrop.hidden = true;
    }, 180);
  }

  emojiBtn.addEventListener("click", openEmojiPicker);
  emojiPickerClose.addEventListener("click", closeEmojiPicker);
  emojiPickerBackdrop.addEventListener("click", closeEmojiPicker);

  emojiPickerGrid.addEventListener("click", (e) => {
    const item = e.target.closest("[data-emoji]");
    if (!item) return;
    currentEmoji = item.dataset.emoji;
    emojiBtn.textContent = currentEmoji;
    emojiBtn.classList.add("emoji-spin");
    emojiBtn.addEventListener("animationend", () => emojiBtn.classList.remove("emoji-spin"), { once: true });
    closeEmojiPicker();
  });

  function loadRuns() {
    return runs;
  }

  // 앱 내부 필드명 → Firestore 필드명으로 변환
  function toFirestore(data) {
    return {
      emoji:        data.emoji       || "",
      title:        data.title       || "",
      date:         data.datetime    || "",
      place:        data.location    || "",
      describetion: data.details     || "",
      runner:       data.runner      || "",
      partners:     data.partners    || "",
      favorite:     data.favorite    || false,
    };
  }

  // Firestore 필드명 → 앱 내부 필드명으로 변환
  function fromFirestore(id, data) {
    return {
      id,
      emoji:    data.emoji        || "",
      title:    data.title        || "",
      datetime: data.date         || "",
      location: data.place        || "",
      details:  data.describetion || "",
      runner:   data.runner       || "",
      partners: data.partners     || "",
      favorite: data.favorite     || false,
    };
  }

  function addRun(data) {
    return db.collection(COLLECTION).add(toFirestore(data));
  }

  function updateRun(id, data) {
    return db.collection(COLLECTION).doc(id).update(toFirestore(data));
  }

  function deleteRun(id) {
    return db.collection(COLLECTION).doc(id).delete();
  }

  function shareRun(id) {
    const run = loadRuns().find((r) => r.id === id);
    if (!run) return;
    const lines = [
      `${run.emoji || "🏃"} ${run.title}`,
      run.datetime ? `🕐 ${formatDisplayDateTime(run.datetime)}` : "",
      run.runner ? `러너: ${run.runner}` : "",
      run.partners ? `함께: ${run.partners}` : "",
      run.location ? `📍 ${run.location}` : "",
      run.details ? `\n${run.details}` : "",
    ].filter(Boolean).join("\n");

    const appUrl = "https://aprilsixth46-boop.github.io/runtodo/";
    if (navigator.share) {
      navigator.share({ title: run.title, text: lines, url: appUrl }).catch(() => {});
    } else {
      navigator.clipboard.writeText(lines).then(() => {
        alert("클립보드에 복사됐어요!");
      }).catch(() => {
        alert(lines);
      });
    }
  }

  function toggleFavorite(id) {
    const run = loadRuns().find((r) => r.id === id);
    if (!run) return;
    return db.collection(COLLECTION).doc(id).update({ favorite: !run.favorite });
  }

  function todayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  /** @param {string} isoDatetime datetime-local value (YYYY-MM-DDTHH:mm) */
  function datePart(isoDatetime) {
    if (!isoDatetime || typeof isoDatetime !== "string") return "";
    return isoDatetime.slice(0, 10);
  }

  function formatDisplayDateTime(isoDatetime) {
    if (!isoDatetime) return "";
    const [datePartStr, timePart] = isoDatetime.split("T");
    if (!datePartStr) return isoDatetime;
    const [y, m, d] = datePartStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    if (timePart) {
      const [hh, mm] = timePart.split(":");
      date.setHours(Number(hh) || 0, Number(mm) || 0, 0, 0);
    }
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  // 오늘 날짜 기준(시간 제외) 과거 여부
  function isPast(isoDatetime) {
    if (!isoDatetime) return false;
    return datePart(isoDatetime) < todayKey();
  }

  function sortRuns(runs, dir) {
    const d = dir || 1;
    return [...runs].sort((a, b) => {
      const da = a.datetime || "";
      const db = b.datetime || "";
      return da.localeCompare(db) * d;
    });
  }

  function renderToday(runs) {
    const key = todayKey();
    const todays = sortRuns(runs.filter((r) => datePart(r.datetime) === key));

    if (todays.length === 0) {
      todayRunsEl.innerHTML =
        '<p class="today-empty">오늘은 러닝 일정이 없어요</p>';
      return;
    }

    todayRunsEl.innerHTML = todays
      .map(
        (r) => `
      <article class="today-card" data-id="${escapeAttr(r.id)}" role="button" tabindex="0" style="cursor:pointer;">
        <div class="today-card__header">
          <h3 class="today-card__title"><span class="run-emoji" aria-hidden="true">${escapeHtml(r.emoji || "🏃")}</span>${escapeHtml(r.title)}</h3>
          <button type="button" class="share-btn" data-share="${escapeAttr(r.id)}" aria-label="공유">↗</button>
        </div>
        <p class="today-card__meta"><strong>시간</strong> ${escapeHtml(formatDisplayDateTime(r.datetime))}</p>
        ${r.runner ? `<p class="today-card__meta"><strong>러너</strong> ${escapeHtml(r.runner)}</p>` : ""}
        ${r.partners ? `<p class="today-card__meta"><strong>함께</strong> ${escapeHtml(r.partners)}</p>` : ""}
        <p class="today-card__meta"><strong>장소</strong> ${escapeHtml(r.location || "")}</p>
        ${r.details ? `<p class="today-card__details">${escapeHtml(r.details)}</p>` : ""}
      </article>
    `
      )
      .join("");
  }

  function renderList(runs) {
    let filtered;
    const emptyMsg = {
      upcoming: '<li class="list-empty">다가오는 러닝 일정이 없습니다.</li>',
      favorite: '<li class="list-empty">즐겨찾기한 일정이 없습니다.</li>',
      past:     '<li class="list-empty">지난 러닝 일정이 없습니다.</li>',
    };

    if (filterMode === "upcoming") {
      filtered = sortRuns(runs.filter((r) => datePart(r.datetime) > todayKey()), 1); // 오늘 제외, 오름차순
    } else if (filterMode === "past") {
      filtered = sortRuns(runs.filter((r) => isPast(r.datetime)), -1); // 내림차순(최근과거부터)
    } else {
      filtered = sortRuns(runs.filter((r) => r.favorite), 1);
    }

    if (filtered.length === 0) {
      scheduleListEl.innerHTML = emptyMsg[filterMode];
      return;
    }

    scheduleListEl.innerHTML = filtered
      .map((r) => {
        const past = isPast(r.datetime);
        return `
      <li class="schedule-item${past ? " is-past" : ""}" data-id="${escapeAttr(r.id)}">
        <div class="schedule-item__main">
          <h3 class="schedule-item__title"><span class="run-emoji" aria-hidden="true">${escapeHtml(r.emoji || "🏃")}</span>${escapeHtml(r.title)}</h3>
          <p class="schedule-item__when">${escapeHtml(formatDisplayDateTime(r.datetime))}</p>
          ${r.runner ? `<p class="schedule-item__meta">🏃 ${escapeHtml(r.runner)}</p>` : ""}
          ${r.partners ? `<p class="schedule-item__meta">🏃‍♀️ ${escapeHtml(r.partners)}</p>` : ""}
          <p class="schedule-item__location">📍 ${escapeHtml(r.location || "")}</p>
          ${r.details ? `<p class="schedule-item__details">${escapeHtml(r.details)}</p>` : ""}
        </div>
        <div class="schedule-item__actions">
          <button type="button" class="schedule-item__fav${r.favorite ? " is-fav" : ""}" data-fav="${escapeAttr(r.id)}" aria-label="${r.favorite ? "즐겨찾기 해제" : "즐겨찾기"}">${r.favorite ? "♥" : "♡"}</button>
          <button type="button" class="schedule-item__share" data-share="${escapeAttr(r.id)}" aria-label="공유">↗</button>
          <button type="button" class="schedule-item__edit" data-edit="${escapeAttr(r.id)}">수정</button>
          <button type="button" class="schedule-item__delete" data-delete="${escapeAttr(r.id)}">삭제</button>
        </div>
      </li>`;
      })
      .join("");
  }

  function escapeHtml(s) {
    if (s == null) return "";
    const div = document.createElement("div");
    div.textContent = String(s);
    return div.innerHTML;
  }

  function escapeAttr(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  /* ── View toggle ── */
  function switchView(view) {
    currentView = view;
    if (view === "list") {
      viewListEl.hidden = false;
      viewCalendarEl.hidden = true;
      btnListView.classList.add("is-active");
      btnCalendarView.classList.remove("is-active");
    } else {
      viewListEl.hidden = true;
      viewCalendarEl.hidden = false;
      btnListView.classList.remove("is-active");
      btnCalendarView.classList.add("is-active");
      renderCalendar(loadRuns());
    }
  }

  btnListView.addEventListener("click", () => switchView("list"));
  btnCalendarView.addEventListener("click", () => switchView("calendar"));

  const btnFilterFav = document.getElementById("btn-filter-fav");
  const btnFilterPast = document.getElementById("btn-filter-past");

  function setFilter(mode) {
    filterMode = mode;
    btnFilterUpcoming.classList.toggle("is-active", mode === "upcoming");
    btnFilterFav.classList.toggle("is-active", mode === "favorite");
    btnFilterFav.textContent = mode === "favorite" ? "♥ Favorite" : "♡ Favorite";
    btnFilterPast.classList.toggle("is-active", mode === "past");
    renderList(loadRuns());
  }

  btnFilterUpcoming.addEventListener("click", () => setFilter("upcoming"));
  btnFilterFav.addEventListener("click", () => setFilter("favorite"));
  btnFilterPast.addEventListener("click", () => setFilter("past"));

  calPrev.addEventListener("click", () => {
    calMonth -= 1;
    if (calMonth < 0) { calMonth = 11; calYear -= 1; }
    renderCalendar(loadRuns());
  });
  calNext.addEventListener("click", () => {
    calMonth += 1;
    if (calMonth > 11) { calMonth = 0; calYear += 1; }
    renderCalendar(loadRuns());
  });

  /* ── Calendar renderer ── */
  const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

  function renderCalendar(runs) {
    const today = todayKey();
    calLabel.textContent = `${calYear}년 ${calMonth + 1}월`;

    // build map: "YYYY-MM-DD" → runs[]
    const byDate = {};
    runs.forEach((r) => {
      const d = datePart(r.datetime);
      if (!d) return;
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push(r);
    });

    const firstDay = new Date(calYear, calMonth, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const daysInPrev = new Date(calYear, calMonth, 0).getDate();

    let html = "";

    // header row
    DAY_NAMES.forEach((name, i) => {
      const cls = i === 0 ? "cal-day-name sun" : i === 6 ? "cal-day-name sat" : "cal-day-name";
      html += `<div class="${cls}">${name}</div>`;
    });

    // leading cells from previous month
    for (let i = 0; i < firstDay; i++) {
      const day = daysInPrev - firstDay + 1 + i;
      html += `<div class="cal-cell cal-cell--other"><span class="cal-cell__num">${day}</span></div>`;
    }

    // current month cells
    for (let d = 1; d <= daysInMonth; d++) {
      const pad = String(d).padStart(2, "0");
      const monthPad = String(calMonth + 1).padStart(2, "0");
      const key = `${calYear}-${monthPad}-${pad}`;
      const isToday = key === today;
      const dayOfWeek = new Date(calYear, calMonth, d).getDay();
      const isSun = dayOfWeek === 0;
      const isSat = dayOfWeek === 6;

      let cls = "cal-cell";
      if (isToday) cls += " cal-cell--today";
      else if (key < today) cls += " cal-cell--past";
      if (isSun) cls += " cal-cell--sun";
      if (isSat) cls += " cal-cell--sat";

      const runsOnDay = byDate[key] || [];
      const runItems = runsOnDay
        .map((r) => `<span class="cal-run-chip${key < today ? " cal-run-chip--past" : ""}" data-run-id="${escapeAttr(r.id)}" role="button" tabindex="0">${escapeHtml(r.emoji || "🏃")} ${escapeHtml(r.title)}</span>`)
        .join("");

      html += `<div class="${cls}" data-cal-date="${key}" role="button" tabindex="0"><span class="cal-cell__num">${d}</span>${runItems}</div>`;
    }

    // trailing cells
    const totalCells = firstDay + daysInMonth;
    const trailing = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 1; i <= trailing; i++) {
      html += `<div class="cal-cell cal-cell--other"><span class="cal-cell__num">${i}</span></div>`;
    }

    calGrid.innerHTML = html;
  }

  function render() {
    const runs = loadRuns();
    renderToday(runs);
    renderList(runs);
    if (currentView === "calendar") renderCalendar(runs);
  }

  function todayDefaultDatetime() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const y = now.getFullYear();
    const m = pad(now.getMonth() + 1);
    const d = pad(now.getDate());
    const hh = pad(now.getHours());
    const mm = pad(now.getMinutes());
    return `${y}-${m}-${d}T${hh}:${mm}`;
  }

  function showModal() {
    modal.hidden = false;
    backdrop.hidden = false;
    requestAnimationFrame(() => {
      modal.classList.add("is-open");
      backdrop.classList.add("is-open");
    });
    document.body.classList.add("modal-open");
    const first = form.querySelector("input[name=title]");
    if (first) first.focus();
  }

  function openModal() {
    editingId = null;
    form.reset();
    modalTitle.textContent = "새 러닝 일정";
    currentEmoji = randomEmoji();
    emojiBtn.textContent = currentEmoji;
    const datetimeInput = document.getElementById("input-datetime");
    if (datetimeInput) datetimeInput.value = todayDefaultDatetime();
    showModal();
  }

  function openEditModal(id) {
    const runs = loadRuns();
    const run = runs.find((r) => r.id === id);
    if (!run) return;

    editingId = id;
    form.reset();
    modalTitle.textContent = "러닝 일정 수정";
    currentEmoji = run.emoji || "🏃";
    emojiBtn.textContent = currentEmoji;

    form.querySelector("[name=title]").value = run.title || "";
    const datetimeInput = document.getElementById("input-datetime");
    if (datetimeInput) datetimeInput.value = run.datetime || todayDefaultDatetime();
    form.querySelector("[name=runner]").value = run.runner || "";
    form.querySelector("[name=partners]").value = run.partners || "";
    form.querySelector("[name=location]").value = run.location || "";
    form.querySelector("[name=details]").value = run.details || "";

    showModal();
  }

  function closeModal() {
    modal.classList.remove("is-open");
    backdrop.classList.remove("is-open");
    document.body.classList.remove("modal-open");
    window.setTimeout(() => {
      modal.hidden = true;
      backdrop.hidden = true;
    }, 220);
  }

  function openDetailModal(id) {
    const run = loadRuns().find((r) => r.id === id);
    if (!run) return;
    detailRunId = id;

    detailTitle.innerHTML = `<span class="run-emoji">${escapeHtml(run.emoji || "🏃")}</span>${escapeHtml(run.title)}`;

    detailBody.innerHTML = `
      <dl class="detail-dl">
        <dt>날짜 및 시간</dt>
        <dd>${run.datetime ? escapeHtml(formatDisplayDateTime(run.datetime)) : "—"}</dd>
        ${run.runner ? `<dt>러너</dt><dd>${escapeHtml(run.runner)}</dd>` : ""}
        ${run.partners ? `<dt>함께 달리는 사람들</dt><dd>${escapeHtml(run.partners)}</dd>` : ""}
        <dt>장소</dt>
        <dd>${run.location ? escapeHtml(run.location) : "—"}</dd>
        ${run.details ? `<dt>상세 내용</dt><dd class="detail-dl__pre">${escapeHtml(run.details)}</dd>` : ""}
      </dl>
    `;

    detailFavBtn.textContent = run.favorite ? "♥" : "♡";
    detailFavBtn.classList.toggle("is-fav", !!run.favorite);
    detailFavBtn.setAttribute("aria-label", run.favorite ? "즐겨찾기 해제" : "즐겨찾기");

    detailModal.hidden = false;
    detailBackdrop.hidden = false;
    requestAnimationFrame(() => {
      detailModal.classList.add("is-open");
      detailBackdrop.classList.add("is-open");
    });
    document.body.classList.add("modal-open");
  }

  function closeDetailModal() {
    detailModal.classList.remove("is-open");
    detailBackdrop.classList.remove("is-open");
    document.body.classList.remove("modal-open");
    window.setTimeout(() => {
      detailModal.hidden = true;
      detailBackdrop.hidden = true;
      detailRunId = null;
    }, 220);
  }

  detailCloseBtn.addEventListener("click", closeDetailModal);
  detailBackdrop.addEventListener("click", closeDetailModal);

  detailEditBtn.addEventListener("click", () => {
    const id = detailRunId;
    closeDetailModal();
    window.setTimeout(() => openEditModal(id), 230);
  });

  detailDeleteBtn.addEventListener("click", () => {
    if (!detailRunId) return;
    deleteRun(detailRunId);
    closeDetailModal();
  });

  detailShareBtn.addEventListener("click", () => {
    if (detailRunId) shareRun(detailRunId);
  });

  detailFavBtn.addEventListener("click", () => {
    if (!detailRunId) return;
    toggleFavorite(detailRunId);
    // 버튼 즉시 토글 (Firestore onSnapshot 이 업데이트하기 전 즉각 반응)
    const nowFav = detailFavBtn.textContent.trim() === "♥";
    detailFavBtn.textContent = nowFav ? "♡" : "♥";
    detailFavBtn.classList.toggle("is-fav", !nowFav);
    detailFavBtn.setAttribute("aria-label", nowFav ? "즐겨찾기" : "즐겨찾기 해제");
  });

  function openModalForDate(dateStr) {
    editingId = null;
    form.reset();
    modalTitle.textContent = "새 러닝 일정";
    currentEmoji = randomEmoji();
    emojiBtn.textContent = currentEmoji;
    const datetimeInput = document.getElementById("input-datetime");
    if (datetimeInput) {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      datetimeInput.value = `${dateStr}T${hh}:${mm}`;
    }
    showModal();
  }

  calGrid.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-run-id]");
    if (chip) {
      openDetailModal(chip.getAttribute("data-run-id"));
      return;
    }
    const cell = e.target.closest("[data-cal-date]");
    if (cell) openModalForDate(cell.getAttribute("data-cal-date"));
  });

  calGrid.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      const chip = e.target.closest("[data-run-id]");
      if (chip) { e.preventDefault(); openDetailModal(chip.getAttribute("data-run-id")); return; }
      const cell = e.target.closest("[data-cal-date]");
      if (cell) { e.preventDefault(); openModalForDate(cell.getAttribute("data-cal-date")); }
    }
  });

  todayRunsEl.addEventListener("click", (e) => {
    const shareBtn = e.target.closest("[data-share]");
    if (shareBtn) { e.stopPropagation(); shareRun(shareBtn.getAttribute("data-share")); return; }
    const card = e.target.closest("[data-id]");
    if (card) openDetailModal(card.getAttribute("data-id"));
  });

  todayRunsEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      const card = e.target.closest("[data-id]");
      if (card) { e.preventDefault(); openDetailModal(card.getAttribute("data-id")); }
    }
  });

  openModalBtn.addEventListener("click", openModal);
  closeModalBtn.addEventListener("click", closeModal);
  cancelBtn.addEventListener("click", closeModal);
  backdrop.addEventListener("click", closeModal);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!detailModal.hidden) closeDetailModal();
      else if (!modal.hidden) closeModal();
    }
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const title = String(fd.get("title") || "").trim();
    const datetime = String(fd.get("datetime") || "").trim();
    const runner = String(fd.get("runner") || "").trim();
    const partners = String(fd.get("partners") || "").trim();
    const location = String(fd.get("location") || "").trim();
    const details = String(fd.get("details") || "").trim();

    if (!title) return;

    if (editingId) {
      const existing = loadRuns().find((r) => r.id === editingId);
      updateRun(editingId, { emoji: currentEmoji, title, datetime, runner, partners, location, details, favorite: existing ? existing.favorite : false });
    } else {
      addRun({ emoji: currentEmoji, title, datetime, runner, partners, location, details });
    }
    editingId = null;
    closeModal();
  });

  scheduleListEl.addEventListener("click", (e) => {
    const shareBtn = e.target.closest("[data-share]");
    if (shareBtn) { shareRun(shareBtn.getAttribute("data-share")); return; }
    const favBtn = e.target.closest("[data-fav]");
    if (favBtn) {
      toggleFavorite(favBtn.getAttribute("data-fav"));
      return;
    }
    const editBtn = e.target.closest("[data-edit]");
    if (editBtn) {
      openEditModal(editBtn.getAttribute("data-edit"));
      return;
    }
    const deleteBtn = e.target.closest("[data-delete]");
    if (deleteBtn) {
      const id = deleteBtn.getAttribute("data-delete");
      if (id) deleteRun(id);
    }
  });

  db.collection(COLLECTION).onSnapshot(
    (snapshot) => {
      runs = snapshot.docs.map((doc) => fromFirestore(doc.id, doc.data()));
      // 지난 일정은 즐겨찾기 자동 해제
      runs.forEach((r) => {
        if (r.favorite && isPast(r.datetime)) {
          db.collection(COLLECTION).doc(r.id).update({ favorite: false });
        }
      });
      render();
    },
    (err) => {
      console.error("Firestore 연결 오류:", err);
    }
  );
})();
