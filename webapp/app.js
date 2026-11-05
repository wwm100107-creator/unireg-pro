/**
 * UniReg Pro — Web Tool Xếp Thời Khóa Biểu & Auto Đăng Ký Học Phần Đa Trường
 */
(function () {
  "use strict";

  const STORAGE_KEYS = {
    COURSES: "unireg_courses_v2",
    ACTIVE_PROFILE: "unireg_active_profile_v2",
    SAVED_PROFILES: "unireg_saved_profiles_v2",
  };

  const UNIVERSITY_PRESETS = [
    {
      id: "smart",
      name: "Tự động nhận diện (Mọi trường)",
      domain: "*",
      description: "Tự quét mọi bảng môn học có ô tick / nút chọn và tự tìm nút Lưu/Ghi nhận.",
      rowSelector: "table tbody tr, .grid-row, .course-row",
      actionSelector: "input[type='checkbox'], input[type='radio'], button.btn-reg, .btn-select-course",
      searchSelector: "",
      submitSelector: "#btnGhiNhan, #btnLuu, #btnDangKy, button.btn-confirm-registration, .button-confirm",
      interval: 2.5,
      autoSubmit: true,
    },
    {
      id: "vnu",
      name: "ĐHQG Hà Nội (VNU Portal)",
      domain: "dangkyhoc.vnu.edu.vn",
      description: "Chuẩn cổng ĐKMH ĐHQGHN: hỗ trợ cả Mã lớp học phần (BSA2002 6) và Mã ẩn (data-rowindex).",
      rowSelector: "#divDanhSachMonHoc table tbody tr, table.table-course-list tbody tr",
      actionSelector: "input[type='checkbox']",
      searchSelector: "",
      submitSelector: "#btnGhiNhan, button.btn-confirm-registration, .button-confirm",
      interval: 3,
      autoSubmit: true,
    },
    {
      id: "edusoft",
      name: "Hệ thống Edusoft.Net / AQTech",
      domain: "dkmh.*, edusoft.*",
      description: "Dùng cho HUTECH, PTIT, SGU, TDTU, ĐH Nông Lâm, Tài nguyên Môi trường...",
      rowSelector: "#divTDK table tbody tr, .grid-roll table tbody tr, table tbody tr",
      actionSelector: "input[type='checkbox']",
      searchSelector: "#txtMaMH1, input[id*='txtMaMH']",
      submitSelector: "#btnLuu, input[value*='Lưu'], button[id*='btnLuu']",
      interval: 2,
      autoSubmit: true,
    },
    {
      id: "psc_uis",
      name: "Hệ thống PSC UIS / MyUIS",
      domain: "uis.*, myuis.*",
      description: "Dùng cho UEH, HCMUTE, HUIT, ĐH Luật, ĐH Ngân Hàng, ĐH Mở...",
      rowSelector: "table.grid tbody tr, .k-grid-content tbody tr, table tbody tr",
      actionSelector: "input[type='checkbox'], input[type='radio'], a.btn-chon",
      searchSelector: "",
      submitSelector: "#btnDangKy, button[id*='Save'], input[value*='Đăng ký']",
      interval: 2.5,
      autoSubmit: true,
    },
    {
      id: "hust_sis",
      name: "ĐH Bách Khoa (HUST CTT / SIS)",
      domain: "ctt-sis.hust.edu.vn",
      description: "Hỗ trợ điền ô nhập mã lớp (txtMaLop) hoặc chọn trong bảng lớp học phần.",
      rowSelector: "table.dxgvTable tbody tr, table tbody tr",
      actionSelector: "input[type='checkbox'], .dxbButton",
      searchSelector: "input[id*='txtMaLop'], input.class-code-input",
      submitSelector: "div[id*='btnDangKy'], button[id*='btnGui'], input[value*='Đăng ký']",
      interval: 2,
      autoSubmit: true,
    },
  ];

  const SAMPLE_COURSES = [
    {
      id: "c1",
      code: "BSA2002 6",
      name: "Nguyên lý Marketing",
      credits: 3,
      day: 2,
      startPeriod: 1,
      endPeriod: 3,
      room: "304-G2",
      lecturer: "ThS. Đặng Hồng Vân",
      enabled: true,
    },
    {
      id: "c2",
      code: "INT2204 1",
      name: "Lập trình hướng đối tượng",
      credits: 3,
      day: 4,
      startPeriod: 4,
      endPeriod: 6,
      room: "201-GĐ2",
      lecturer: "TS. Lê Văn Minh",
      enabled: true,
    },
    {
      id: "c3",
      code: "BSA2103 1",
      name: "Nguyên lý Quản trị kinh doanh",
      credits: 3,
      day: 6,
      startPeriod: 7,
      endPeriod: 9,
      room: "105-G3",
      lecturer: "TS. Lưu Hữu Văn",
      enabled: true,
    },
    {
      id: "c4",
      code: "PES1025 19",
      name: "Giáo dục thể chất (Bóng đá)",
      credits: 1,
      day: 3,
      startPeriod: 1,
      endPeriod: 2,
      room: "Sân ĐHNN",
      lecturer: "TT GDTC",
      enabled: true,
    },
  ];

  let courses = [];
  let activeProfile = { ...UNIVERSITY_PRESETS[0] };
  let savedProfiles = [];
  let sandboxAutoTimer = null;
  let sandboxCycleCount = 0;
  let activePickerMode = null; // "action" | "submit" | null

  function normalizeCode(str) {
    return String(str || "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  }

  function dayLabel(dayNum) {
    return Number(dayNum) === 8 ? "Chủ nhật" : `Thứ ${dayNum}`;
  }

  // ==================== STORAGE ====================
  function loadState() {
    try {
      const rawCourses = localStorage.getItem(STORAGE_KEYS.COURSES);
      courses = rawCourses ? JSON.parse(rawCourses) : [...SAMPLE_COURSES];
    } catch {
      courses = [...SAMPLE_COURSES];
    }

    try {
      const rawProf = localStorage.getItem(STORAGE_KEYS.ACTIVE_PROFILE);
      if (rawProf) activeProfile = JSON.parse(rawProf);
    } catch {
      activeProfile = { ...UNIVERSITY_PRESETS[0] };
    }

    try {
      const rawSaved = localStorage.getItem(STORAGE_KEYS.SAVED_PROFILES);
      savedProfiles = rawSaved ? JSON.parse(rawSaved) : [...UNIVERSITY_PRESETS.slice(1)];
    } catch {
      savedProfiles = [...UNIVERSITY_PRESETS.slice(1)];
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEYS.COURSES, JSON.stringify(courses));
    localStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE, JSON.stringify(activeProfile));
    localStorage.setItem(STORAGE_KEYS.SAVED_PROFILES, JSON.stringify(savedProfiles));
    updateHeaderStats();
    updateGeneratorView();
  }

  // ==================== CONFLICT DETECTION ====================
  function detectConflicts() {
    const enabledCourses = courses.filter((c) => c.enabled);
    const conflictPairs = [];
    const conflictedIds = new Set();

    for (let i = 0; i < enabledCourses.length; i++) {
      for (let j = i + 1; j < enabledCourses.length; j++) {
        const a = enabledCourses[i];
        const b = enabledCourses[j];
        if (
          Number(a.day) === Number(b.day) &&
          Number(a.startPeriod) <= Number(b.endPeriod) &&
          Number(b.startPeriod) <= Number(a.endPeriod)
        ) {
          conflictedIds.add(a.id);
          conflictedIds.add(b.id);
          conflictPairs.push({ a, b });
        }
      }
    }
    return { conflictPairs, conflictedIds };
  }

  // ==================== RENDER TIMETABLE & COURSES ====================
  function renderTimetableAndCourses() {
    const { conflictPairs, conflictedIds } = detectConflicts();

    // 1. Update conflict alert box
    const alertBox = document.getElementById("conflict-alert-box");
    if (conflictPairs.length === 0) {
      alertBox.className = "conflict-banner ok";
      alertBox.innerHTML =
        "✅ <strong>Hợp lệ:</strong> Không có học phần nào bị trùng lịch học. Bạn có thể xuất sang Auto ĐK ngay!";
    } else {
      alertBox.className = "conflict-banner";
      const details = conflictPairs
        .map(
          ({ a, b }) =>
            `<li><strong>${a.code}</strong> (${a.name}) trùng với <strong>${b.code}</strong> (${b.name}) vào <strong>${dayLabel(a.day)} (Tiết ${Math.max(a.startPeriod, b.startPeriod)}-${Math.min(a.endPeriod, b.endPeriod)})</strong></li>`
        )
        .join("");
      alertBox.innerHTML = `⚠️ <strong>Phát hiện ${conflictPairs.length} cặp môn trùng lịch học:</strong><ul style="margin:6px 0 0 18px;padding:0;">${details}</ul>`;
    }

    // 2. Render 12-period timetable grid
    const ttTbody = document.getElementById("timetable-tbody");
    ttTbody.innerHTML = "";
    const enabledCourses = courses.filter((c) => c.enabled);

    for (let period = 1; period <= 12; period++) {
      const tr = document.createElement("tr");
      const periodCell = document.createElement("td");
      periodCell.className = "period-col";
      periodCell.textContent = `Tiết ${period}`;
      tr.appendChild(periodCell);

      for (let day = 2; day <= 8; day++) {
        const td = document.createElement("td");
        const matching = enabledCourses.filter(
          (c) =>
            Number(c.day) === day &&
            period >= Number(c.startPeriod) &&
            period <= Number(c.endPeriod)
        );

        matching.forEach((c) => {
          const card = document.createElement("div");
          card.className =
            "tt-slot-card" + (conflictedIds.has(c.id) ? " is-conflict" : "");
          card.innerHTML = `<strong>${c.code}</strong><br/>${c.name}${
            c.room ? `<br/><small>📍 ${c.room}</small>` : ""
          }`;
          td.appendChild(card);
        });

        tr.appendChild(td);
      }
      ttTbody.appendChild(tr);
    }

    // 3. Render Course List Table
    const listTbody = document.getElementById("course-list-tbody");
    listTbody.innerHTML = "";

    if (courses.length === 0) {
      listTbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:18px;">Chưa có môn học nào. Hãy thêm môn ở khung bên trái hoặc bấm "Nạp dữ liệu mẫu".</td></tr>`;
    } else {
      courses.forEach((c) => {
        const isConflict = conflictedIds.has(c.id);
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>
            <input type="checkbox" class="toggle-course-chk" data-id="${c.id}" ${
          c.enabled ? "checked" : ""
        } />
          </td>
          <td><strong>${c.code}</strong></td>
          <td>${c.name}</td>
          <td>${c.credits}</td>
          <td>${dayLabel(c.day)} (Tiết ${c.startPeriod}-${c.endPeriod})</td>
          <td>${[c.room, c.lecturer].filter(Boolean).join(" • ") || "—"}</td>
          <td>
            ${
              !c.enabled
                ? '<span class="badge">Tạm tắt</span>'
                : isConflict
                ? '<span class="badge badge-red">Trùng lịch</span>'
                : '<span class="badge badge-green">Sẵn sàng</span>'
            }
          </td>
          <td>
            <button type="button" class="btn btn-outline btn-sm delete-course-btn" data-id="${
              c.id
            }">✕</button>
          </td>
        `;
        listTbody.appendChild(tr);
      });
    }

    // Attach listeners
    listTbody.querySelectorAll(".toggle-course-chk").forEach((chk) => {
      chk.addEventListener("change", (e) => {
        const id = e.target.getAttribute("data-id");
        const target = courses.find((item) => item.id === id);
        if (target) {
          target.enabled = e.target.checked;
          saveState();
          renderTimetableAndCourses();
          syncSandboxCodesInput();
        }
      });
    });

    listTbody.querySelectorAll(".delete-course-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-id");
        courses = courses.filter((item) => item.id !== id);
        saveState();
        renderTimetableAndCourses();
        syncSandboxCodesInput();
      });
    });

    updateHeaderStats();
  }

  function updateHeaderStats() {
    const enabled = courses.filter((c) => c.enabled);
    const totalCredits = enabled.reduce((sum, c) => sum + Number(c.credits || 0), 0);
    const { conflictPairs } = detectConflicts();

    document.getElementById("stat-school").textContent = `Profile: ${activeProfile.name}`;
    document.getElementById("stat-courses").textContent = `Đã chọn: ${enabled.length} môn (${totalCredits} TC)`;

    const conflictPill = document.getElementById("stat-conflicts");
    if (conflictPairs.length > 0) {
      conflictPill.textContent = `⚠️ Cảnh báo: ${conflictPairs.length} cặp trùng lịch`;
      conflictPill.classList.add("conflict-alert");
    } else {
      conflictPill.textContent = `✅ Không trùng lịch`;
      conflictPill.classList.remove("conflict-alert");
    }
  }

  // ==================== PROFILES & PRESETS ====================
  function populateProfileForm(prof) {
    document.getElementById("prof-name").value = prof.name || "";
    document.getElementById("prof-domain").value = prof.domain || "*";
    document.getElementById("prof-row-selector").value = prof.rowSelector || "";
    document.getElementById("prof-action-selector").value = prof.actionSelector || "";
    document.getElementById("prof-search-selector").value = prof.searchSelector || "";
    document.getElementById("prof-submit-selector").value = prof.submitSelector || "";
    document.getElementById("prof-interval").value = prof.interval || 2.5;
    document.getElementById("prof-auto-submit").value = String(prof.autoSubmit !== false);
  }

  function readProfileForm() {
    return {
      id: activeProfile.id || "custom_" + Date.now(),
      name: document.getElementById("prof-name").value.trim() || "Profile Tùy chỉnh",
      domain: document.getElementById("prof-domain").value.trim() || "*",
      rowSelector: document.getElementById("prof-row-selector").value.trim() || "table tbody tr",
      actionSelector:
        document.getElementById("prof-action-selector").value.trim() ||
        "input[type='checkbox']",
      searchSelector: document.getElementById("prof-search-selector").value.trim(),
      submitSelector: document.getElementById("prof-submit-selector").value.trim(),
      interval: parseFloat(document.getElementById("prof-interval").value) || 2.5,
      autoSubmit: document.getElementById("prof-auto-submit").value === "true",
    };
  }

  function renderPresetsAndSavedProfiles() {
    const presetGrid = document.getElementById("preset-grid");
    presetGrid.innerHTML = "";

    UNIVERSITY_PRESETS.forEach((preset) => {
      const card = document.createElement("div");
      card.className =
        "preset-card" + (activeProfile.id === preset.id ? " selected" : "");
      card.innerHTML = `
        <h4>${preset.name}</h4>
        <p>${preset.description}</p>
      `;
      card.addEventListener("click", () => {
        activeProfile = { ...preset };
        populateProfileForm(activeProfile);
        saveState();
        renderPresetsAndSavedProfiles();
      });
      presetGrid.appendChild(card);
    });

    const tbody = document.getElementById("saved-profiles-tbody");
    tbody.innerHTML = "";
    savedProfiles.forEach((prof, index) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${prof.name}</strong></td>
        <td><code>${prof.domain || "*"}</code></td>
        <td>${prof.interval || 2.5}s</td>
        <td>
          <button type="button" class="btn btn-outline btn-sm apply-prof-btn" data-idx="${index}">Áp dụng</button>
          <button type="button" class="btn btn-outline btn-sm del-prof-btn" data-idx="${index}">Xóa</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".apply-prof-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const idx = Number(e.currentTarget.getAttribute("data-idx"));
        if (savedProfiles[idx]) {
          activeProfile = { ...savedProfiles[idx] };
          populateProfileForm(activeProfile);
          saveState();
          renderPresetsAndSavedProfiles();
        }
      });
    });

    tbody.querySelectorAll(".del-prof-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const idx = Number(e.currentTarget.getAttribute("data-idx"));
        savedProfiles.splice(idx, 1);
        saveState();
        renderPresetsAndSavedProfiles();
      });
    });
  }

  // ==================== UNIVERSAL INJECTED SCRIPT GENERATOR ====================
  function buildUniversalStandaloneScript() {
    const enabledCodes = courses
      .filter((c) => c.enabled)
      .map((c) => c.code.trim())
      .filter(Boolean);

    const configPayload = {
      profile: activeProfile,
      codes: enabledCodes,
    };

    return `// ==UserScript==
// @name         UniReg Pro — Auto Đăng Ký Học Phần Đa Trường (${activeProfile.name})
// @namespace    https://unireg.pro/universal
// @version      2.0.0
// @description  Tự động nhận diện bảng môn học, hỗ trợ Click chọn phần tử (Visual Picker) và Auto Canh Slot cho mọi trường ĐH/CĐ.
// @match        *://*/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  "use strict";
  const INITIAL_CONFIG = ${JSON.stringify(configPayload, null, 2)};

  if (document.getElementById("unireg-universal-widget")) {
    document.getElementById("unireg-universal-widget").style.display = "block";
    return;
  }

  let timerId = null;
  let cycle = 0;
  let isBusy = false;
  let pickerMode = null;

  const norm = (s) => String(s || "").replace(/\\s+/g, " ").trim().toUpperCase();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function getDocs() {
    const docs = [document];
    document.querySelectorAll("iframe, frame").forEach((f) => {
      try { if (f.contentDocument) docs.push(f.contentDocument); } catch {}
    });
    return docs;
  }

  function qAll(sel) {
    if (!sel) return [];
    const res = [];
    getDocs().forEach((d) => { try { res.push(...d.querySelectorAll(sel)); } catch {} });
    return res;
  }

  function qOne(sel) {
    if (!sel) return null;
    for (const d of getDocs()) {
      try { const el = d.querySelector(sel); if (el) return el; } catch {}
    }
    return null;
  }

  function setNativeValue(el, val) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(el, val); else el.value = val;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
  }

  function buildUniqueSelector(el) {
    if (!el || el.nodeType !== 1) return "";
    if (el.id) return "#" + CSS.escape(el.id);
    if (el.tagName === "INPUT" && (el.type === "checkbox" || el.type === "radio")) return "input[type='" + el.type + "']";
    const classes = Array.from(el.classList).filter((c) => !c.startsWith("unireg-"));
    if (classes.length > 0) {
      return el.tagName.toLowerCase() + "." + classes.map((c) => CSS.escape(c)).join(".");
    }
    return el.tagName.toLowerCase();
  }

  const widget = document.createElement("div");
  widget.id = "unireg-universal-widget";
  widget.style.cssText = "position:fixed;bottom:16px;left:16px;width:305px;background:#fff;border:2px solid #2563eb;border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,0.22);z-index:2147483647;font-family:Arial,sans-serif;font-size:12.5px;color:#0f172a;overflow:hidden;";
  widget.innerHTML = \`
    <div style="background:#1e3a8a;color:#fff;padding:9px 12px;font-weight:700;display:flex;justify-content:space-between;align-items:center;">
      <span>🎓 UniReg Auto (\${INITIAL_CONFIG.profile.name})</span>
      <button id="unireg-close" style="background:none;border:none;color:#fff;cursor:pointer;font-size:15px;">✕</button>
    </div>
    <div style="padding:10px;">
      <label style="font-weight:600;display:block;margin-bottom:4px;">Danh sách mã lớp / mã ẩn (mỗi dòng 1 mã):</label>
      <textarea id="unireg-codes" rows="4" style="width:100%;box-sizing:border-box;padding:6px;border:1px solid #cbd5e1;border-radius:4px;font-size:12px;"></textarea>
      <div style="display:flex;gap:5px;margin-top:6px;">
        <button id="unireg-pick-search" style="flex:1;padding:5px;font-size:11px;cursor:pointer;border:1px solid #cbd5e1;background:#f8fafc;border-radius:4px;">🎯 Ô Tìm</button>
        <button id="unireg-pick-action" style="flex:1;padding:5px;font-size:11px;cursor:pointer;border:1px solid #cbd5e1;background:#f8fafc;border-radius:4px;">🎯 Ô/Nút ĐK</button>
        <button id="unireg-pick-submit" style="flex:1;padding:5px;font-size:11px;cursor:pointer;border:1px solid #cbd5e1;background:#f8fafc;border-radius:4px;">🎯 Nút Lưu</button>
      </div>
      <div style="display:flex;gap:6px;margin-top:8px;align-items:center;">
        <button id="unireg-btn-now" style="flex:1;background:#16a34a;color:#fff;border:none;padding:7px 10px;border-radius:4px;font-weight:700;cursor:pointer;">⚡ ĐK Nhanh</button>
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" id="unireg-autosubmit" checked /> Ghi nhận</label>
      </div>
      <div style="display:flex;gap:6px;margin-top:6px;align-items:center;">
        <button id="unireg-btn-auto" style="flex:1;background:#2563eb;color:#fff;border:none;padding:7px 10px;border-radius:4px;font-weight:700;cursor:pointer;">🔄 Auto ĐK</button>
        <span>mỗi</span>
        <input type="number" id="unireg-interval" value="\${INITIAL_CONFIG.profile.interval || 2.5}" min="1" step="0.5" style="width:46px;padding:4px;text-align:center;border:1px solid #cbd5e1;border-radius:4px;" />
        <span>s</span>
      </div>
      <div id="unireg-log" style="margin-top:8px;background:#0f172a;color:#86efac;padding:7px;border-radius:4px;font-family:monospace;font-size:11px;max-height:110px;overflow-y:auto;white-space:pre-line;">Sẵn sàng trên trang cổng trường hiện tại!</div>
    </div>
  \`;
  document.body.appendChild(widget);

  const codesEl = document.getElementById("unireg-codes");
  const logEl = document.getElementById("unireg-log");
  codesEl.value = (INITIAL_CONFIG.codes || []).join("\\n");
  document.getElementById("unireg-autosubmit").checked = INITIAL_CONFIG.profile.autoSubmit !== false;

  let searchSel = INITIAL_CONFIG.profile.searchSelector || "";
  let actionSel = INITIAL_CONFIG.profile.actionSelector || "input[type='checkbox']";
  let submitSel = INITIAL_CONFIG.profile.submitSelector || "#btnGhiNhan, #btnLuu, #btnDangKy";

  function log(lines) {
    logEl.textContent = ["[" + new Date().toLocaleTimeString("vi-VN") + "]", ...lines].join("\\n");
  }

  async function runPass(label) {
    if (isBusy) return;
    isBusy = true;
    try {
      const targets = codesEl.value.split(/\\r?\\n/).map((l) => norm(l.split("|")[0])).filter(Boolean);
      if (!targets.length) return log(["Vui lòng nhập ít nhất 1 mã lớp học phần!"]);
      const out = ["Nguồn: " + label];
      let hit = 0;
      const searchBox = searchSel ? qOne(searchSel) : null;

      for (const code of targets) {
        if (searchBox) {
          setNativeValue(searchBox, code);
          await sleep(320);
        }
        const rows = qAll(INITIAL_CONFIG.profile.rowSelector || "table tbody tr").filter((tr) => !widget.contains(tr));
        const row = rows.find((tr) => {
          const cb = tr.querySelector("input[type='checkbox'][data-rowindex]");
          if (cb && norm(cb.getAttribute("data-rowindex")) === code) return true;
          return norm(tr.textContent).includes(code);
        });
        if (!row) {
          out.push("- [" + code + "]: Không tìm thấy dòng môn học.");
          continue;
        }
        const act = row.querySelector(actionSel) || row.querySelector("input[type='checkbox'], input[type='radio'], button, a.btn");
        if (!act || act.disabled) {
          out.push("- [" + code + "]: Ô/nút chọn đang bị khóa.");
          continue;
        }
        hit++;
        if (act.type === "checkbox" || act.type === "radio") {
          if (!act.checked) {
            act.click();
            if (!act.checked) {
              act.checked = true;
              act.dispatchEvent(new Event("change", { bubbles: true }));
            }
            out.push("+ [" + code + "]: Đã tick chọn thành công!");
          } else {
            out.push("= [" + code + "]: Đã được tick sẵn.");
          }
        } else {
          act.click();
          out.push("+ [" + code + "]: Đã bấm nút chọn môn!");
        }
      }

      if (hit > 0 && document.getElementById("unireg-autosubmit").checked) {
        const sub = qOne(submitSel);
        if (sub && !sub.disabled) {
          sub.click();
          out.push("=> Đã bấm nút Lưu / Ghi nhận!");
          await sleep(250);
          const modalBtn = qOne(".swal2-confirm, .bootbox-accept, .modal.show .btn-primary, .ui-dialog-buttonset button:first-child");
          if (modalBtn && !modalBtn.disabled) {
            modalBtn.click();
            out.push("=> Đã tự động xác nhận Popup!");
          }
        }
      }
      log(out);
    } finally {
      isBusy = false;
    }
  }

  document.getElementById("unireg-btn-now").onclick = () => runPass("Đăng Ký Nhanh");
  document.getElementById("unireg-btn-auto").onclick = function () {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
      this.textContent = "🔄 Auto ĐK";
      this.style.background = "#2563eb";
      return log(["Đã dừng Auto ĐK."]);
    }
    const sec = Math.max(1, parseFloat(document.getElementById("unireg-interval").value) || 2.5);
    cycle = 1;
    this.textContent = "⏹ Dừng Auto";
    this.style.background = "#dc2626";
    runPass("Auto #" + cycle);
    timerId = setInterval(() => {
      cycle++;
      runPass("Auto #" + cycle);
    }, sec * 1000);
  };

  function bindPicker() {
    getDocs().forEach((d) => {
      if (d._uniregBound) return;
      d._uniregBound = true;
      d.addEventListener("click", (e) => {
        if (!pickerMode || widget.contains(e.target)) return;
        e.preventDefault();
        e.stopPropagation();
        const sel = buildUniqueSelector(e.target);
        if (pickerMode === "search") {
          searchSel = sel;
          log(["✅ Đã học Ô tìm kiếm môn: " + sel]);
        } else if (pickerMode === "action") {
          actionSel = sel;
          log(["✅ Đã học Ô/Nút chọn môn: " + sel]);
        } else {
          submitSel = sel;
          log(["✅ Đã học Nút Lưu/Ghi nhận: " + sel]);
        }
        pickerMode = null;
      }, true);
    });
  }

  document.getElementById("unireg-pick-search").onclick = () => {
    pickerMode = "search"; bindPicker();
    log(["🎯 Hãy click vào Ô Tìm kiếm / Lọc môn trên trang trường!"]);
  };
  document.getElementById("unireg-pick-action").onclick = () => {
    pickerMode = "action"; bindPicker();
    log(["🎯 Hãy click vào Ô tick hoặc Nút đăng ký của 1 môn bất kỳ trên trang!"]);
  };
  document.getElementById("unireg-pick-submit").onclick = () => {
    pickerMode = "submit"; bindPicker();
    log(["🎯 Hãy click vào Nút Lưu / Ghi nhận đăng ký trên trang!"]);
  };

  document.getElementById("unireg-close").onclick = () => {
    widget.style.display = "none";
  };
})();`;
  }

  function updateGeneratorView() {
    const enabledCourses = courses.filter((c) => c.enabled);
    document.getElementById("gen-course-count").textContent = String(
      enabledCourses.length
    );
    document.getElementById("gen-profile-name").textContent = activeProfile.name;

    const fullScript = buildUniversalStandaloneScript();
    document.getElementById("generated-script-box").value = fullScript;

    // Build compact Bookmarklet URI
    const oneLineCode = fullScript
      .replace(/\/\/.*$/gm, "")
      .replace(/\s+/g, " ")
      .trim();
    const bookmarkletHref = "javascript:" + encodeURIComponent(oneLineCode);
    document.getElementById("bookmarklet-link").setAttribute("href", bookmarkletHref);
  }

  // ==================== MULTI-UNIVERSITY SANDBOX ====================
  function syncSandboxCodesInput() {
    const sbInput = document.getElementById("sb-codes-input");
    if (!sbInput) return;
    const enabledCodes = courses
      .filter((c) => c.enabled)
      .map((c) => c.code);
    sbInput.value = enabledCodes.join("\n");
  }

  function renderSandboxPortal() {
    const portalType = document.getElementById("sandbox-portal-select").value;
    const viewport = document.getElementById("sandbox-portal-viewport");
    const actionSelInput = document.getElementById("sb-action-sel");
    const submitSelInput = document.getElementById("sb-submit-sel");

    if (portalType === "vnu") {
      actionSelInput.value = "input[type='checkbox']";
      submitSelInput.value = "#sandbox-submit-btn";
      viewport.innerHTML = `
        <div style="background:#63b567;color:#fff;padding:10px 14px;font-weight:700;font-size:15px;border-radius:6px 6px 0 0;">
          [Mô phỏng Cổng ĐHQGHN - VNU] Đăng ký học ngành 1 (Hỗ trợ Mã lớp &amp; Mã ẩn data-rowindex)
        </div>
        <table class="data-table" id="sandbox-course-table" style="border:1px solid #ddd;">
          <thead>
            <tr>
              <th style="width:65px;text-align:center;">Chọn</th>
              <th>Tên môn học</th>
              <th>TC</th>
              <th>Mã lớp học phần</th>
              <th>Sĩ số</th>
              <th>Giảng viên</th>
            </tr>
          </thead>
          <tbody>
            <tr data-rowindex="159">
              <td style="text-align:center;">
                <input type="checkbox" data-rowindex="159" />
                <div style="font-size:11px;font-weight:700;">159</div>
              </td>
              <td>Nguyên lý Marketing</td>
              <td>3</td>
              <td><strong>BSA2002 6</strong></td>
              <td>34/50</td>
              <td>ThS. Đặng Hồng Vân</td>
            </tr>
            <tr data-rowindex="160">
              <td style="text-align:center;">
                <input type="checkbox" data-rowindex="160" />
                <div style="font-size:11px;font-weight:700;">160</div>
              </td>
              <td>Lập trình hướng đối tượng</td>
              <td>3</td>
              <td><strong>INT2204 1</strong></td>
              <td>42/50</td>
              <td>TS. Lê Văn Minh</td>
            </tr>
            <tr data-rowindex="163">
              <td style="text-align:center;">
                <input type="checkbox" data-rowindex="163" />
                <div style="font-size:11px;font-weight:700;">163</div>
              </td>
              <td>Nguyên lý Quản trị kinh doanh</td>
              <td>3</td>
              <td><strong>BSA2103 1</strong></td>
              <td>68/100</td>
              <td>TS. Lưu Hữu Văn</td>
            </tr>
            <tr data-rowindex="168">
              <td style="text-align:center;">
                <input type="checkbox" data-rowindex="168" />
                <div style="font-size:11px;font-weight:700;">168</div>
              </td>
              <td>Giáo dục thể chất (Bóng đá)</td>
              <td>1</td>
              <td><strong>PES1025 19</strong></td>
              <td>29/35</td>
              <td>TT GDTC</td>
            </tr>
          </tbody>
        </table>
        <div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center;background:#f8fafc;padding:10px 14px;border:1px solid #e2e8f0;border-radius:6px;">
          <span id="sandbox-portal-feedback" style="font-weight:600;color:#15803d;">Trạng thái cổng trường: Đang chờ sinh viên chọn môn...</span>
          <button type="button" id="sandbox-submit-btn" class="btn btn-success">Ghi nhận</button>
        </div>
      `;
    } else if (portalType === "edusoft") {
      actionSelInput.value = "input[type='checkbox']";
      submitSelInput.value = "#sandbox-submit-btn";
      viewport.innerHTML = `
        <div style="background:#0284c7;color:#fff;padding:10px 14px;font-weight:700;font-size:15px;border-radius:6px 6px 0 0;">
          [Mô phỏng Hệ thống Edusoft.Net - HUTECH / PTIT / SGU / TDTU]
        </div>
        <table class="data-table" id="sandbox-course-table" style="border:1px solid #bae6fd;">
          <thead>
            <tr>
              <th style="width:55px;text-align:center;">ĐK</th>
              <th>Mã MH</th>
              <th>Tên môn học</th>
              <th>NMH (Mã lớp)</th>
              <th>STC</th>
              <th>Còn lại</th>
              <th>Thời khóa biểu</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="text-align:center;"><input type="checkbox" /></td>
              <td>BSA2002</td>
              <td>Nguyên lý Marketing</td>
              <td><strong>BSA2002 6</strong></td>
              <td>3</td>
              <td>16</td>
              <td>Thứ Hai, Tiết 1->3, P.304</td>
            </tr>
            <tr>
              <td style="text-align:center;"><input type="checkbox" /></td>
              <td>INT2204</td>
              <td>Lập trình hướng đối tượng</td>
              <td><strong>INT2204 1</strong></td>
              <td>3</td>
              <td>8</td>
              <td>Thứ Tư, Tiết 4->6, P.201</td>
            </tr>
            <tr>
              <td style="text-align:center;"><input type="checkbox" /></td>
              <td>BSA2103</td>
              <td>Nguyên lý Quản trị kinh doanh</td>
              <td><strong>BSA2103 1</strong></td>
              <td>3</td>
              <td>32</td>
              <td>Thứ Sáu, Tiết 7->9, P.105</td>
            </tr>
            <tr>
              <td style="text-align:center;"><input type="checkbox" /></td>
              <td>PES1025</td>
              <td>Giáo dục thể chất (Bóng đá)</td>
              <td><strong>PES1025 19</strong></td>
              <td>1</td>
              <td>6</td>
              <td>Thứ Ba, Tiết 1->2, Sân tập</td>
            </tr>
          </tbody>
        </table>
        <div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center;background:#f0f9ff;padding:10px 14px;border:1px solid #bae6fd;border-radius:6px;">
          <span id="sandbox-portal-feedback" style="font-weight:600;color:#0369a1;">EdusoftWeb: Tích chọn các nhóm môn học và bấm Lưu đăng ký.</span>
          <button type="button" id="sandbox-submit-btn" class="btn btn-primary">Lưu đăng ký</button>
        </div>
      `;
    } else {
      // Custom portal with custom action buttons to showcase Visual Picker
      actionSelInput.value = "button.btn-custom-pick";
      submitSelInput.value = "#btn-final-commit";
      viewport.innerHTML = `
        <div style="background:#7c3aed;color:#fff;padding:10px 14px;font-weight:700;font-size:15px;border-radius:6px 6px 0 0;">
          [Mô phỏng Cổng Trường Đặc Thù - Không dùng Checkbox mà dùng Nút Bấm Riêng]
        </div>
        <p style="font-size:12.5px;color:var(--text-secondary);margin:8px 0;">
          💡 Thử nghiệm <strong>Visual Picker</strong>: Bấm <strong>"🎯 1. Click chọn Ô/Nút ĐK"</strong> ở bên trái, sau đó click vào một nút <strong>"Chọn lớp này"</strong> bất kỳ trong bảng dưới đây!
        </p>
        <table class="data-table" id="sandbox-course-table" style="border:1px solid #ddd6fe;">
          <thead>
            <tr>
              <th>Mã lớp</th>
              <th>Học phần</th>
              <th>TC</th>
              <th>Lịch học</th>
              <th style="text-align:center;">Thao tác đăng ký</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>BSA2002 6</strong></td>
              <td>Nguyên lý Marketing</td>
              <td>3</td>
              <td>T2 (1-3)</td>
              <td style="text-align:center;">
                <button type="button" class="btn btn-outline btn-sm btn-custom-pick" data-picked="false">Chọn lớp này</button>
              </td>
            </tr>
            <tr>
              <td><strong>INT2204 1</strong></td>
              <td>Lập trình hướng đối tượng</td>
              <td>3</td>
              <td>T4 (4-6)</td>
              <td style="text-align:center;">
                <button type="button" class="btn btn-outline btn-sm btn-custom-pick" data-picked="false">Chọn lớp này</button>
              </td>
            </tr>
            <tr>
              <td><strong>BSA2103 1</strong></td>
              <td>Nguyên lý Quản trị kinh doanh</td>
              <td>3</td>
              <td>T6 (7-9)</td>
              <td style="text-align:center;">
                <button type="button" class="btn btn-outline btn-sm btn-custom-pick" data-picked="false">Chọn lớp này</button>
              </td>
            </tr>
            <tr>
              <td><strong>PES1025 19</strong></td>
              <td>Giáo dục thể chất (Bóng đá)</td>
              <td>1</td>
              <td>T3 (1-2)</td>
              <td style="text-align:center;">
                <button type="button" class="btn btn-outline btn-sm btn-custom-pick" data-picked="false">Chọn lớp này</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center;background:#f5f3ff;padding:10px 14px;border:1px solid #ddd6fe;border-radius:6px;">
          <span id="sandbox-portal-feedback" style="font-weight:600;color:#6d28d9;">Cổng đặc thù: Bấm vào nút "Chọn lớp này" rồi bấm "Xác nhận gửi".</span>
          <button type="button" id="btn-final-commit" class="btn btn-primary" style="background:#7c3aed;">Xác nhận gửi đăng ký</button>
        </div>
      `;

      viewport.querySelectorAll(".btn-custom-pick").forEach((btn) => {
        btn.addEventListener("click", function () {
          if (activePickerMode) return;
          this.setAttribute("data-picked", "true");
          this.textContent = "✅ Đã chọn";
          this.className = "btn btn-success btn-sm btn-custom-pick";
        });
      });
    }

    const submitBtn =
      document.getElementById("sandbox-submit-btn") ||
      document.getElementById("btn-final-commit");
    if (submitBtn) {
      submitBtn.addEventListener("click", () => {
        if (activePickerMode) return;
        const checkedCount = viewport.querySelectorAll(
          "input[type='checkbox']:checked, button[data-picked='true']"
        ).length;
        const fb = document.getElementById("sandbox-portal-feedback");
        if (fb) {
          fb.textContent = `🎉 Cổng trường phản hồi: Đã lưu đăng ký thành công ${checkedCount} học phần (${new Date().toLocaleTimeString(
            "vi-VN"
          )})!`;
        }
      });
    }
  }

  function runSandboxPass(sourceLabel) {
    const rawCodes = document.getElementById("sb-codes-input").value;
    const targets = rawCodes
      .split(/\r?\n/)
      .map(normalizeCode)
      .filter(Boolean);

    const logBox = document.getElementById("sb-status-log");
    const actionSel =
      document.getElementById("sb-action-sel").value.trim() ||
      "input[type='checkbox']";
    const submitSel = document.getElementById("sb-submit-sel").value.trim();
    const viewport = document.getElementById("sandbox-portal-viewport");

    if (targets.length === 0) {
      logBox.textContent = "⚠️ Vui lòng nhập ít nhất 1 mã lớp vào ô danh sách!";
      return;
    }

    const rows = Array.from(viewport.querySelectorAll("table tbody tr"));
    const lines = [`[${new Date().toLocaleTimeString("vi-VN")}] Nguồn: ${sourceLabel}`];
    let matchedCount = 0;

    targets.forEach((code) => {
      const row = rows.find((tr) => {
        const rowIdx = normalizeCode(tr.getAttribute("data-rowindex"));
        if (rowIdx && rowIdx === code) return true;
        return normalizeCode(tr.textContent).includes(code);
      });

      if (!row) {
        lines.push(`- [${code}]: Không tìm thấy trên bảng.`);
        return;
      }

      const actEl =
        row.querySelector(actionSel) ||
        row.querySelector("input[type='checkbox'], button");

      if (!actEl || actEl.disabled) {
        lines.push(`- [${code}]: Không tìm thấy nút/ô chọn hợp lệ.`);
        return;
      }

      matchedCount++;
      if (actEl.type === "checkbox" || actEl.type === "radio") {
        if (!actEl.checked) {
          actEl.checked = true;
          lines.push(`+ [${code}]: Đã tick chọn checkbox!`);
        } else {
          lines.push(`= [${code}]: Checkbox đã được tick sẵn.`);
        }
      } else {
        actEl.click();
        lines.push(`+ [${code}]: Đã kích hoạt nút chọn (${actionSel})!`);
      }
    });

    if (matchedCount > 0 && document.getElementById("sb-chk-autosubmit").checked) {
      const subBtn = viewport.querySelector(submitSel);
      if (subBtn) {
        subBtn.click();
        lines.push(`=> Đã tự động bấm nút Lưu (${submitSel})!`);
      } else {
        lines.push(`=> Không tìm thấy nút Lưu với selector: ${submitSel}`);
      }
    }

    logBox.textContent = lines.join("\n");
  }

  function computeSelectorInSandbox(el) {
    if (el.id) return `#${el.id}`;
    if (el.tagName === "INPUT" && el.type === "checkbox") {
      return "input[type='checkbox']";
    }
    const cls = Array.from(el.classList).filter(
      (c) => !["btn", "btn-sm", "btn-outline", "btn-success", "btn-primary", "picker-active-highlight"].includes(c)
    );
    if (cls.length > 0) {
      return `${el.tagName.toLowerCase()}.${cls[0]}`;
    }
    return el.tagName.toLowerCase();
  }

  // ==================== INITIALIZATION & EVENTS ====================
  function init() {
    loadState();
    populateProfileForm(activeProfile);
    renderTimetableAndCourses();
    renderPresetsAndSavedProfiles();
    updateGeneratorView();
    syncSandboxCodesInput();
    renderSandboxPortal();

    // Navigation Tabs
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
        document.querySelectorAll(".tab-pane").forEach((p) => p.classList.remove("active"));
        btn.classList.add("active");
        const targetId = btn.getAttribute("data-tab");
        document.getElementById(targetId).classList.add("active");
      });
    });

    document.getElementById("btn-go-generator").addEventListener("click", () => {
      document.querySelector('.tab-btn[data-tab="tab-generator"]').click();
    });

    // Add Single Course
    document.getElementById("form-add-course").addEventListener("submit", (e) => {
      e.preventDefault();
      const startP = Number(document.getElementById("inp-start-period").value);
      const endP = Math.max(startP, Number(document.getElementById("inp-end-period").value));

      courses.push({
        id: "c_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
        code: document.getElementById("inp-class-code").value.trim(),
        name: document.getElementById("inp-course-name").value.trim(),
        credits: Number(document.getElementById("inp-credits").value) || 3,
        day: Number(document.getElementById("inp-day").value) || 2,
        startPeriod: startP,
        endPeriod: endP,
        room: document.getElementById("inp-room").value.trim(),
        lecturer: document.getElementById("inp-lecturer").value.trim(),
        enabled: true,
      });

      document.getElementById("inp-class-code").value = "";
      document.getElementById("inp-course-name").value = "";
      saveState();
      renderTimetableAndCourses();
      syncSandboxCodesInput();
    });

    // Bulk Import Courses
    document.getElementById("btn-bulk-import").addEventListener("click", () => {
      const raw = document.getElementById("inp-bulk-codes").value.trim();
      if (!raw) return;
      const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);

      lines.forEach((line, idx) => {
        const parts = line.split("|").map((p) => p.trim());
        const code = parts[0];
        if (!code) return;
        const name = parts[1] || `Học phần ${code}`;
        const credits = Number(parts[2]) || 3;
        const day = Number(parts[3]) || ((idx % 6) + 2);
        let startPeriod = 1;
        let endPeriod = 3;
        if (parts[4] && parts[4].includes("-")) {
          const [s, e] = parts[4].split("-").map(Number);
          if (s && e) {
            startPeriod = s;
            endPeriod = Math.max(s, e);
          }
        }

        courses.push({
          id: "cb_" + Date.now() + "_" + idx,
          code,
          name,
          credits,
          day,
          startPeriod,
          endPeriod,
          room: "",
          lecturer: "",
          enabled: true,
        });
      });

      document.getElementById("inp-bulk-codes").value = "";
      saveState();
      renderTimetableAndCourses();
      syncSandboxCodesInput();
    });

    // Load Sample & Clear Courses
    document.getElementById("btn-load-sample").addEventListener("click", () => {
      courses = SAMPLE_COURSES.map((c) => ({ ...c }));
      saveState();
      renderTimetableAndCourses();
      syncSandboxCodesInput();
    });

    document.getElementById("btn-clear-courses").addEventListener("click", () => {
      courses = [];
      saveState();
      renderTimetableAndCourses();
      syncSandboxCodesInput();
    });

    // Save Profile
    document.getElementById("btn-save-profile").addEventListener("click", () => {
      const newProf = readProfileForm();
      newProf.id = "prof_" + Date.now();
      activeProfile = { ...newProf };
      savedProfiles.unshift({ ...newProf });
      saveState();
      renderPresetsAndSavedProfiles();
    });

    // Export / Import JSON Bundle
    document.getElementById("btn-export-bundle").addEventListener("click", () => {
      activeProfile = readProfileForm();
      const bundle = {
        exportedAt: new Date().toISOString(),
        profile: activeProfile,
        courses,
      };
      document.getElementById("bundle-json-box").value = JSON.stringify(bundle, null, 2);
    });

    document.getElementById("btn-import-bundle").addEventListener("click", () => {
      const raw = document.getElementById("bundle-json-box").value.trim();
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (parsed.profile) {
          activeProfile = parsed.profile;
          populateProfileForm(activeProfile);
        }
        if (Array.isArray(parsed.courses)) {
          courses = parsed.courses;
        }
        saveState();
        renderTimetableAndCourses();
        renderPresetsAndSavedProfiles();
        syncSandboxCodesInput();
      } catch {
        alert("Mã JSON không hợp lệ. Vui lòng kiểm tra lại!");
      }
    });

    // Copy & Download Userscript
    document.getElementById("btn-copy-script").addEventListener("click", function () {
      const box = document.getElementById("generated-script-box");
      navigator.clipboard.writeText(box.value);
      const oldText = this.textContent;
      this.textContent = "✅ Đã Copy thành công!";
      setTimeout(() => {
        this.textContent = oldText;
      }, 2000);
    });

    document.getElementById("btn-download-userscript").addEventListener("click", () => {
      const content = document.getElementById("generated-script-box").value;
      const blob = new Blob([content], { type: "text/javascript;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "unireg-universal.user.js";
      a.click();
      URL.revokeObjectURL(url);
    });

    // Sandbox Controls & Visual Picker
    document.getElementById("sandbox-portal-select").addEventListener("change", () => {
      renderSandboxPortal();
    });

    document.getElementById("sb-btn-quick").addEventListener("click", () => {
      runSandboxPass("Đăng Ký Nhanh");
    });

    document.getElementById("sb-btn-auto").addEventListener("click", function () {
      if (sandboxAutoTimer !== null) {
        clearInterval(sandboxAutoTimer);
        sandboxAutoTimer = null;
        this.textContent = "🔄 Bật Auto Canh Slot";
        this.className = "btn btn-primary";
        document.getElementById("sb-status-log").textContent =
          `Đã dừng Auto Canh Slot sau ${sandboxCycleCount} lượt chạy.`;
        return;
      }

      const sec = Math.max(
        1,
        parseFloat(document.getElementById("sb-inp-interval").value) || 2
      );
      sandboxCycleCount = 1;
      this.textContent = "⏹ Dừng Auto";
      this.className = "btn btn-danger";
      runSandboxPass(`Auto Canh Slot (Lượt #${sandboxCycleCount})`);

      sandboxAutoTimer = setInterval(() => {
        sandboxCycleCount++;
        runSandboxPass(`Auto Canh Slot (Lượt #${sandboxCycleCount})`);
      }, sec * 1000);
    });

    // Visual Picker inside Sandbox
    const viewport = document.getElementById("sandbox-portal-viewport");
    const pickerHint = document.getElementById("picker-hint");

    document.getElementById("btn-pick-action").addEventListener("click", () => {
      activePickerMode = "action";
      pickerHint.style.display = "block";
      document.getElementById("sb-status-log").textContent =
        "🎯 Chế độ Visual Picker: Hãy click vào một Ô Checkbox hoặc Nút Chọn môn ở bảng bên phải!";
    });

    document.getElementById("btn-pick-submit").addEventListener("click", () => {
      activePickerMode = "submit";
      pickerHint.style.display = "block";
      document.getElementById("sb-status-log").textContent =
        "🎯 Chế độ Visual Picker: Hãy click vào Nút Lưu / Ghi nhận đăng ký ở khung bên phải!";
    });

    viewport.addEventListener("mouseover", (e) => {
      if (!activePickerMode) return;
      e.target.classList.add("picker-active-highlight");
    });

    viewport.addEventListener("mouseout", (e) => {
      e.target.classList.remove("picker-active-highlight");
    });

    viewport.addEventListener(
      "click",
      (e) => {
        if (!activePickerMode) return;
        e.preventDefault();
        e.stopPropagation();
        e.target.classList.remove("picker-active-highlight");

        const selector = computeSelectorInSandbox(e.target);
        if (activePickerMode === "action") {
          document.getElementById("sb-action-sel").value = selector;
          document.getElementById("sb-status-log").textContent =
            `✅ Visual Picker đã học thành công Selector Ô/Nút chọn môn: "${selector}"`;
        } else {
          document.getElementById("sb-submit-sel").value = selector;
          document.getElementById("sb-status-log").textContent =
            `✅ Visual Picker đã học thành công Selector Nút Lưu: "${selector}"`;
        }

        activePickerMode = null;
        pickerHint.style.display = "none";
      },
      true
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
