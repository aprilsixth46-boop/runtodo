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
    // 러너
    "🏃","🏃‍♀️","🏃‍♂️","🧍","🚶‍♀️","🚶‍♂️","🧗","🚴","🚴‍♀️","🤸",
    // 날씨
    "🌅","🌄","🌇","🌆","🌃","🌁","⛅","🌤️","🌥️","🌦️",
    "🌧️","⛈️","🌩️","🌨️","☀️","🌙","🌛","🌚","☔","❄️",
    // 자연·장소
    "🌿","🌲","🌳","🌾","🌊","🏞️","🏔️","⛰️","🗻","🏙️",
    "🌸","🍃","🍂","🍁","🌻","🌼","🌺","🌈","🦋","🐦",
    // 장비·복장
    "👟","🧢","🧤","🧦","🩳","🩺","🎽","🥾","👒","🕶️",
    // 파워·감정
    "💪","🔥","⚡","❤️‍🔥","🫀","💧","🫧","🥵","😤","😎",
    // 목표·기록
    "🎯","🏅","🥇","🥈","🏆","📍","⏱️","📈","🗓️","✅",
    // 기타 에너지
    "🚀","🌙","⭐","💫","✨","🎶","🎧","🧘","🤜","💥",
  ];

  let currentEmoji = RUN_EMOJIS[0];
  let editingId = null;
  let currentView = "list"; // "list" | "calendar"
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

  const detailModal = document.getElementById("detail-modal");
  const detailBackdrop = document.getElementById("detail-backdrop");
  const detailCloseBtn = document.getElementById("detail-close-btn");
  const detailTitle = document.getElementById("detail-title");
  const detailBody = document.getElementById("detail-body");
  const detailEditBtn = document.getElementById("detail-edit-btn");
  const detailDeleteBtn = document.getElementById("detail-delete-btn");
  let detailRunId = null;

  function randomEmoji() {
    return RUN_EMOJIS[Math.floor(Math.random() * RUN_EMOJIS.length)];
  }

  function nextEmoji() {
    const idx = RUN_EMOJIS.indexOf(currentEmoji);
    const next = (idx + 1) % RUN_EMOJIS.length;
    currentEmoji = RUN_EMOJIS[next];
    emojiBtn.textContent = currentEmoji;
    emojiBtn.classList.add("emoji-spin");
    emojiBtn.addEventListener("animationend", () => emojiBtn.classList.remove("emoji-spin"), { once: true });
  }

  emojiBtn.addEventListener("click", nextEmoji);

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

  function sortRuns(runs) {
    return [...runs].sort((a, b) => {
      const da = a.datetime || "";
      const db = b.datetime || "";
      return da.localeCompare(db);
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
      <article class="today-card">
        <h3 class="today-card__title"><span class="run-emoji" aria-hidden="true">${escapeHtml(r.emoji || "🏃")}</span>${escapeHtml(r.title)}</h3>
        <p class="today-card__meta"><strong>시간</strong> ${escapeHtml(formatDisplayDateTime(r.datetime))}</p>
        <p class="today-card__meta"><strong>장소</strong> ${escapeHtml(r.location || "")}</p>
        ${r.details ? `<p class="today-card__details">${escapeHtml(r.details)}</p>` : ""}
      </article>
    `
      )
      .join("");
  }

  function renderList(runs) {
    const sorted = sortRuns(runs);
    if (sorted.length === 0) {
      scheduleListEl.innerHTML =
        '<li class="list-empty">등록된 러닝 일정이 없습니다.</li>';
      return;
    }

    scheduleListEl.innerHTML = sorted
      .map(
        (r) => `
      <li class="schedule-item" data-id="${escapeAttr(r.id)}">
        <div class="schedule-item__main">
          <h3 class="schedule-item__title"><span class="run-emoji" aria-hidden="true">${escapeHtml(r.emoji || "🏃")}</span>${escapeHtml(r.title)}</h3>
          <p class="schedule-item__when">${escapeHtml(formatDisplayDateTime(r.datetime))}</p>
          <p class="schedule-item__location">📍 ${escapeHtml(r.location || "")}</p>
          ${r.details ? `<p class="schedule-item__details">${escapeHtml(r.details)}</p>` : ""}
        </div>
        <div class="schedule-item__actions">
          <button type="button" class="schedule-item__edit" data-edit="${escapeAttr(r.id)}">수정</button>
          <button type="button" class="schedule-item__delete" data-delete="${escapeAttr(r.id)}">삭제</button>
        </div>
      </li>
    `
      )
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
      if (isSun) cls += " cal-cell--sun";
      if (isSat) cls += " cal-cell--sat";

      const runsOnDay = byDate[key] || [];
      const runItems = runsOnDay
        .map((r) => `<span class="cal-run-chip" data-run-id="${escapeAttr(r.id)}" role="button" tabindex="0">${escapeHtml(r.emoji || "🏃")} ${escapeHtml(r.title)}</span>`)
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
        <dt>장소</dt>
        <dd>${run.location ? escapeHtml(run.location) : "—"}</dd>
        ${run.details ? `<dt>상세 내용</dt><dd class="detail-dl__pre">${escapeHtml(run.details)}</dd>` : ""}
      </dl>
    `;

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
    const location = String(fd.get("location") || "").trim();
    const details = String(fd.get("details") || "").trim();

    if (!title) return;

    if (editingId) {
      updateRun(editingId, { emoji: currentEmoji, title, datetime, location, details });
    } else {
      addRun({ emoji: currentEmoji, title, datetime, location, details });
    }
    editingId = null;
    closeModal();
  });

  scheduleListEl.addEventListener("click", (e) => {
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

  // Firestore 실시간 리스너 — orderBy 없이 JS에서 정렬 (인덱스 불필요)
  db.collection(COLLECTION)
    .onSnapshot(
      (snapshot) => {
        runs = snapshot.docs.map((doc) => fromFirestore(doc.id, doc.data()));
        render();
      },
      (err) => {
        console.error("Firestore 연결 오류:", err);
        render(); // Firebase 실패해도 UI는 동작하도록
      }
    );
})();
