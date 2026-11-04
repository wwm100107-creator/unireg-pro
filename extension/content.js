/**
 * UniReg Pro v2.0 — Universal Multi-University Course Registration Content Script
 * Hỗ trợ đăng ký học phần cho tất cả các trường ĐH/CĐ:
 * - Tự động nhận diện các hệ thống phổ biến (VNU, Edusoft.Net, PSC UIS, HUST/SIS, Smart Auto-Detect)
 * - Chế độ "Click chọn phần tử" (Visual Element Picker) cho phép click trực tiếp vào ô/nút trên web trường bất kỳ
 * - Đăng ký nhanh hàng loạt & Auto Canh Slot theo chu kỳ
 */
(function () {
  "use strict";

  const PRESETS = {
    smart: {
      name: "🌐 Tự động nhận diện (Mọi trường)",
      rowSelector: "table tbody tr, .grid-row, .course-row",
      actionSelector:
        "input[type='checkbox'], input[type='radio'], button.btn-reg, .btn-select-course",
      submitSelector:
        "#btnGhiNhan, #btnLuu, #btnDangKy, button.btn-confirm-registration, .button-confirm",
    },
    vnu: {
      name: "🏛️ ĐHQG Hà Nội (VNU Portal)",
      rowSelector:
        "#divDanhSachMonHoc table tbody tr, table.table-course-list tbody tr, table tbody tr",
      actionSelector: "input[type='checkbox']",
      submitSelector:
        "#btnGhiNhan, button.btn-confirm-registration, .button-confirm",
    },
    edusoft: {
      name: "📘 Hệ thống Edusoft.Net (HUTECH, PTIT, SGU, TDTU...)",
      rowSelector:
        "#divTDK table tbody tr, .grid-roll table tbody tr, table tbody tr",
      actionSelector: "input[type='checkbox']",
      submitSelector: "#btnLuu, input[value*='Lưu'], button[id*='btnLuu']",
    },
    psc_uis: {
      name: "📙 Hệ thống PSC UIS / MyUIS (UEH, UTE, HUIT...)",
      rowSelector:
        "table.grid tbody tr, .k-grid-content tbody tr, table tbody tr",
      actionSelector: "input[type='checkbox'], input[type='radio'], a.btn-chon",
      submitSelector:
        "#btnDangKy, button[id*='Save'], input[value*='Đăng ký']",
    },
    hust_sis: {
      name: "📕 ĐH Bách Khoa (HUST CTT / SIS)",
      rowSelector: "table.dxgvTable tbody tr, table tbody tr",
      actionSelector: "input[type='checkbox'], .dxbButton",
      submitSelector:
        "div[id*='btnDangKy'], button[id*='btnGui'], input[value*='Đăng ký']",
    },
  };

  const hostKey = location.hostname || "local";
  const STORAGE_KEYS = {
    COURSE_LIST: "unireg_ext_courses",
    AUTO_CONFIRM: "unireg_ext_autoconfirm",
    INTERVAL_SEC: "unireg_ext_interval",
    PRESET_ID: `unireg_ext_preset_${hostKey}`,
    CUSTOM_ACTION_SEL: `unireg_ext_action_${hostKey}`,
    CUSTOM_SUBMIT_SEL: `unireg_ext_submit_${hostKey}`,
  };

  let autoTimerId = null;
  let cycleCount = 0;
  let pickerMode = null; // "action" | "submit" | null

  function normalizeCode(str) {
    return String(str || "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  }

  function parseTargetQueries(rawText) {
    return String(rawText || "")
      .split(/\r?\n/)
      .map((line) => normalizeCode(line.split("|")[0]))
      .filter((line) => line.length > 0);
  }

  function detectDefaultPresetKey() {
    const h = hostKey.toLowerCase();
    if (h.includes("vnu.edu.vn")) return "vnu";
    if (h.includes("hust.edu.vn")) return "hust_sis";
    if (h.includes("uis") || h.includes("ueh") || h.includes("hcmute")) return "psc_uis";
    if (document.getElementById("divTDK") || document.getElementById("btnLuu")) return "edusoft";
    if (document.getElementById("divDanhSachMonHoc")) return "vnu";
    return "smart";
  }

  function getActiveSelectors() {
    const presetSelect = document.getElementById("autodkmh-preset-select");
    const presetKey = (presetSelect && presetSelect.value) || "smart";
    const base = PRESETS[presetKey] || PRESETS.smart;

    const customAction = localStorage.getItem(STORAGE_KEYS.CUSTOM_ACTION_SEL);
    const customSubmit = localStorage.getItem(STORAGE_KEYS.CUSTOM_SUBMIT_SEL);

    return {
      rowSelector: base.rowSelector,
      actionSelector: customAction || base.actionSelector,
      submitSelector: customSubmit || base.submitSelector,
    };
  }

  function getCourseRows() {
    const { rowSelector } = getActiveSelectors();
    const candidates = Array.from(document.querySelectorAll(rowSelector)).filter(
      (tr) => !tr.closest("#autodkmh-panel")
    );
    const withCheckboxes = candidates.filter((tr) =>
      tr.querySelector("input[type='checkbox'], input[type='radio'], button")
    );
    return withCheckboxes.length > 0 ? withCheckboxes : candidates;
  }

  function annotateCourseCheckboxes() {
    const rows = getCourseRows();
    rows.forEach((tr, idx) => {
      const checkbox = tr.querySelector('input[type="checkbox"]');
      if (!checkbox) return;

      const rowIndex =
        checkbox.getAttribute("data-rowindex") ||
        tr.getAttribute("data-rowindex") ||
        String(idx + 1);

      if (!checkbox.getAttribute("data-rowindex")) {
        checkbox.setAttribute("data-rowindex", rowIndex);
      }

      const cell = checkbox.closest("td") || checkbox.parentElement;
      if (cell && !cell.querySelector(".autodkmh-rowindex-badge")) {
        const badge = document.createElement("span");
        badge.className = "autodkmh-rowindex-badge";
        badge.textContent = rowIndex;
        cell.appendChild(badge);
      }
    });
  }

  function findConfirmButton(submitSelector) {
    if (submitSelector) {
      const explicit = document.querySelector(submitSelector);
      if (explicit && !explicit.disabled) return explicit;
    }

    const candidates = Array.from(
      document.querySelectorAll("button, a.btn, input[type='button'], input[type='submit']")
    );
    return (
      candidates.find((el) => {
        if (el.closest("#autodkmh-panel")) return false;
        const text = normalizeCode(el.textContent || el.value || "");
        return (
          text.includes("GHI NHẬN") ||
          text.includes("LƯU ĐĂNG KÝ") ||
          text.includes("XÁC NHẬN") ||
          text === "LƯU" ||
          text === "ĐĂNG KÝ"
        );
      }) || null
    );
  }

  function updateStatusLog(lines) {
    const statusEl = document.getElementById("autodkmh-status");
    if (!statusEl) return;
    const timestamp = new Date().toLocaleTimeString("vi-VN");
    statusEl.textContent = [`[${timestamp}]`, ...lines].join("\n");
  }

  function executeRegistrationPass(sourceLabel) {
    annotateCourseCheckboxes();

    const inputEl = document.getElementById("autodkmh-input");
    const confirmCheckbox = document.getElementById("autodkmh-confirm-chk");
    const queries = parseTargetQueries(inputEl ? inputEl.value : "");

    if (queries.length === 0) {
      updateStatusLog(["⚠️ Vui lòng nhập ít nhất 1 mã lớp hoặc mã số môn học!"]);
      return;
    }

    const rows = getCourseRows();
    if (rows.length === 0) {
      updateStatusLog(["⚠️ Không tìm thấy bảng môn học trên trang hiện tại."]);
      return;
    }

    const { actionSelector, submitSelector } = getActiveSelectors();
    const logs = [`Nguồn: ${sourceLabel}`];
    let matchedCount = 0;

    queries.forEach((query) => {
      const matchedRow = rows.find((tr, idx) => {
        const cb = tr.querySelector('input[type="checkbox"]');
        const rIdx = normalizeCode(
          (cb && cb.getAttribute("data-rowindex")) ||
            tr.getAttribute("data-rowindex") ||
            String(idx + 1)
        );
        if (rIdx === query) return true;
        return normalizeCode(tr.textContent).includes(query);
      });

      if (!matchedRow) {
        logs.push(`- [${query}]: Không tìm thấy trong bảng.`);
        return;
      }

      const actEl =
        matchedRow.querySelector(actionSelector) ||
        matchedRow.querySelector("input[type='checkbox'], input[type='radio'], button");

      if (!actEl || actEl.disabled) {
        logs.push(`- [${query}]: Ô/nút chọn đang bị khóa (disabled).`);
        return;
      }

      matchedCount++;
      if (actEl.type === "checkbox" || actEl.type === "radio") {
        if (!actEl.checked) {
          actEl.click();
          if (!actEl.checked) {
            actEl.checked = true;
            actEl.dispatchEvent(new Event("change", { bubbles: true }));
          }
          logs.push(`+ [${query}]: Đã tick chọn thành công!`);
        } else {
          logs.push(`= [${query}]: Đã được tick sẵn.`);
        }
      } else {
        actEl.click();
        logs.push(`+ [${query}]: Đã bấm nút chọn trên dòng!`);
      }
    });

    if (confirmCheckbox && confirmCheckbox.checked && matchedCount > 0) {
      const confirmBtn = findConfirmButton(submitSelector);
      if (confirmBtn) {
        confirmBtn.click();
        logs.push("=> Đã kích hoạt nút Lưu / Ghi nhận!");
      } else {
        logs.push("=> Không tìm thấy nút Lưu/Ghi nhận khả dụng.");
      }
    }

    updateStatusLog(logs);
  }

  function toggleAutoRegistration() {
    const autoBtn = document.getElementById("autodkmh-auto-btn");
    const intervalInput = document.getElementById("autodkmh-interval");
    if (!autoBtn || !intervalInput) return;

    if (autoTimerId !== null) {
      clearInterval(autoTimerId);
      autoTimerId = null;
      autoBtn.textContent = "🔄 Auto ĐK";
      autoBtn.classList.remove("is-running");
      updateStatusLog([`Đã dừng Auto ĐK (sau ${cycleCount} lượt chạy).`]);
      return;
    }

    const rawSeconds = parseFloat(intervalInput.value);
    const intervalSeconds = Number.isFinite(rawSeconds) && rawSeconds >= 1 ? rawSeconds : 2.5;
    intervalInput.value = String(intervalSeconds);
    localStorage.setItem(STORAGE_KEYS.INTERVAL_SEC, String(intervalSeconds));

    cycleCount = 1;
    autoBtn.textContent = "⏹ Dừng Auto";
    autoBtn.classList.add("is-running");

    executeRegistrationPass(`Auto ĐK (Lượt #${cycleCount})`);

    autoTimerId = window.setInterval(() => {
      cycleCount++;
      executeRegistrationPass(`Auto ĐK (Lượt #${cycleCount})`);
    }, intervalSeconds * 1000);
  }

  function computeElementSelector(el) {
    if (!el || el.nodeType !== 1) return "";
    if (el.id) return `#${CSS.escape(el.id)}`;
    if (el.tagName === "INPUT" && (el.type === "checkbox" || el.type === "radio")) {
      return `input[type='${el.type}']`;
    }
    const validClasses = Array.from(el.classList).filter(
      (c) => !c.startsWith("unireg-") && !c.startsWith("autodkmh-")
    );
    if (validClasses.length > 0) {
      return `${el.tagName.toLowerCase()}.${validClasses.map((c) => CSS.escape(c)).join(".")}`;
    }
    return el.tagName.toLowerCase();
  }

  function injectControlPanel() {
    if (document.getElementById("autodkmh-panel")) return;

    const savedList = localStorage.getItem(STORAGE_KEYS.COURSE_LIST) || "";
    const savedConfirm = localStorage.getItem(STORAGE_KEYS.AUTO_CONFIRM) !== "false";
    const savedInterval = localStorage.getItem(STORAGE_KEYS.INTERVAL_SEC) || "2.5";
    const savedPreset =
      localStorage.getItem(STORAGE_KEYS.PRESET_ID) || detectDefaultPresetKey();

    const presetOptionsHtml = Object.entries(PRESETS)
      .map(
        ([key, val]) =>
          `<option value="${key}" ${key === savedPreset ? "selected" : ""}>${val.name}</option>`
      )
      .join("");

    const panel = document.createElement("div");
    panel.id = "autodkmh-panel";
    panel.innerHTML = `
      <div class="autodkmh-header">
        <span>🎓 UniReg Auto Đa Trường v2.0</span>
        <button type="button" id="autodkmh-min-btn" class="autodkmh-minimize-btn" title="Thu gọn / Mở rộng">−</button>
      </div>
      <div class="autodkmh-body" id="autodkmh-body">
        <label class="autodkmh-field-label" for="autodkmh-preset-select">Hệ thống cổng trường:</label>
        <select id="autodkmh-preset-select">
          ${presetOptionsHtml}
        </select>

        <textarea
          id="autodkmh-input"
          placeholder="Nhập mã lớp học phần hoặc mã số môn học (mỗi môn 1 dòng)..."
        ></textarea>

        <div class="autodkmh-row">
          <button type="button" id="autodkmh-pick-action" class="autodkmh-btn autodkmh-btn-picker" title="Click để chọn mẫu ô tick hoặc nút đăng ký của trường">
            🎯 Chọn Ô/Nút ĐK
          </button>
          <button type="button" id="autodkmh-pick-submit" class="autodkmh-btn autodkmh-btn-picker" title="Click để chọn nút Lưu / Ghi nhận của trường">
            🎯 Chọn Nút Lưu
          </button>
        </div>

        <div class="autodkmh-row">
          <button type="button" id="autodkmh-quick-btn" class="autodkmh-btn autodkmh-btn-quick">
            ⚡ Đăng Ký Nhanh
          </button>
          <label class="autodkmh-checkbox-label">
            <input type="checkbox" id="autodkmh-confirm-chk" />
            <span>Ghi nhận</span>
          </label>
        </div>

        <div class="autodkmh-row">
          <button type="button" id="autodkmh-auto-btn" class="autodkmh-btn autodkmh-btn-auto">
            🔄 Auto ĐK
          </button>
          <span>mỗi</span>
          <input type="number" id="autodkmh-interval" min="1" step="0.5" value="2.5" />
          <span>giây</span>
        </div>

        <div class="autodkmh-result-box">
          <div class="autodkmh-result-title">Kết quả thực thi:</div>
          <div id="autodkmh-status">Sẵn sàng hỗ trợ đăng ký học phần.</div>
        </div>
      </div>
    `;

    const sidebarTarget =
      document.querySelector(".page-sidebar") ||
      document.querySelector(".sidebar") ||
      document.querySelector("#sidebar") ||
      document.querySelector(".left-menu");

    if (sidebarTarget) {
      sidebarTarget.appendChild(panel);
    } else {
      panel.style.position = "fixed";
      panel.style.left = "14px";
      panel.style.bottom = "14px";
      panel.style.width = "285px";
      panel.style.zIndex = "2147483647";
      document.body.appendChild(panel);
    }

    const inputEl = document.getElementById("autodkmh-input");
    const confirmChk = document.getElementById("autodkmh-confirm-chk");
    const intervalEl = document.getElementById("autodkmh-interval");
    const presetSelect = document.getElementById("autodkmh-preset-select");
    const bodyEl = document.getElementById("autodkmh-body");
    const minBtn = document.getElementById("autodkmh-min-btn");

    inputEl.value = savedList;
    confirmChk.checked = savedConfirm;
    intervalEl.value = savedInterval;

    minBtn.addEventListener("click", () => {
      const hidden = bodyEl.style.display === "none";
      bodyEl.style.display = hidden ? "block" : "none";
      minBtn.textContent = hidden ? "−" : "+";
    });

    presetSelect.addEventListener("change", () => {
      localStorage.setItem(STORAGE_KEYS.PRESET_ID, presetSelect.value);
      localStorage.removeItem(STORAGE_KEYS.CUSTOM_ACTION_SEL);
      localStorage.removeItem(STORAGE_KEYS.CUSTOM_SUBMIT_SEL);
      annotateCourseCheckboxes();
      updateStatusLog([`Đã chuyển sang cấu hình: ${PRESETS[presetSelect.value].name}`]);
    });

    inputEl.addEventListener("input", () => {
      localStorage.setItem(STORAGE_KEYS.COURSE_LIST, inputEl.value);
    });
    confirmChk.addEventListener("change", () => {
      localStorage.setItem(STORAGE_KEYS.AUTO_CONFIRM, String(confirmChk.checked));
    });
    intervalEl.addEventListener("change", () => {
      localStorage.setItem(STORAGE_KEYS.INTERVAL_SEC, intervalEl.value);
    });

    document.getElementById("autodkmh-quick-btn").addEventListener("click", () => {
      executeRegistrationPass("Đăng Ký Nhanh");
    });

    document.getElementById("autodkmh-auto-btn").addEventListener("click", () => {
      toggleAutoRegistration();
    });

    // Visual Element Picker
    document.getElementById("autodkmh-pick-action").addEventListener("click", () => {
      pickerMode = "action";
      updateStatusLog([
        "🎯 Visual Picker: Hãy click vào 1 Ô tick hoặc Nút đăng ký trên bảng môn học!",
      ]);
    });

    document.getElementById("autodkmh-pick-submit").addEventListener("click", () => {
      pickerMode = "submit";
      updateStatusLog([
        "🎯 Visual Picker: Hãy click vào Nút Lưu / Ghi nhận đăng ký trên trang!",
      ]);
    });

    document.addEventListener("mouseover", (e) => {
      if (!pickerMode || panel.contains(e.target)) return;
      e.target.classList.add("unireg-picker-hover");
    });

    document.addEventListener("mouseout", (e) => {
      if (!e.target || !e.target.classList) return;
      e.target.classList.remove("unireg-picker-hover");
    });

    document.addEventListener(
      "click",
      (e) => {
        if (!pickerMode || panel.contains(e.target)) return;
        e.preventDefault();
        e.stopPropagation();
        e.target.classList.remove("unireg-picker-hover");

        const selector = computeElementSelector(e.target);
        if (pickerMode === "action") {
          localStorage.setItem(STORAGE_KEYS.CUSTOM_ACTION_SEL, selector);
          updateStatusLog([`✅ Đã lưu Selector Ô/Nút chọn môn: ${selector}`]);
        } else {
          localStorage.setItem(STORAGE_KEYS.CUSTOM_SUBMIT_SEL, selector);
          updateStatusLog([`✅ Đã lưu Selector Nút Lưu/Ghi nhận: ${selector}`]);
        }
        pickerMode = null;
      },
      true
    );
  }

  function observeTableUpdates() {
    const observer = new MutationObserver(() => {
      annotateCourseCheckboxes();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  function init() {
    injectControlPanel();
    annotateCourseCheckboxes();
    observeTableUpdates();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
