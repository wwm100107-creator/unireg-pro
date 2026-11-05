/**
 * UniReg Pro v2.1 — Real DOM & SPA Execution Engine for Multi-University Course Registration
 * Chạy trực tiếp trên cổng đăng ký học phần thật của các trường ĐH/CĐ:
 * - Quét xuyên qua cả trang chính và các thẻ <iframe> (phổ biến ở Edusoft, UIS, ASP.NET)
 * - Hỗ trợ điền ô Tìm kiếm / Lọc môn tương thích React, Angular, Vue (Native Input Setter)
 * - Tự động xác nhận hộp thoại Popup / Modal (Đồng ý / Xác nhận) sau khi bấm Lưu
 * - Hỗ trợ Visual Element Picker 3 bước: Chọn Ô tìm kiếm -> Chọn Ô/Nút ĐK -> Chọn Nút Lưu
 */
(function () {
  "use strict";

  if (window !== window.top) return;

  const PRESETS = {
    smart: {
      name: "🌐 Tự động nhận diện (Mọi trường)",
      rowSelector: "table tbody tr, .grid-row, .course-row, [role='row']",
      actionSelector:
        "input[type='checkbox'], input[type='radio'], button.btn-reg, .btn-select-course",
      searchSelector: "",
      submitSelector:
        "#btnGhiNhan, #btnLuu, #btnDangKy, button.btn-confirm-registration, .button-confirm",
    },
    vnu: {
      name: "🏛️ ĐHQG Hà Nội (VNU Portal)",
      rowSelector:
        "#divDanhSachMonHoc table tbody tr, table.table-course-list tbody tr, table tbody tr",
      actionSelector: "input[type='checkbox']",
      searchSelector: "",
      submitSelector:
        "#btnGhiNhan, button.btn-confirm-registration, .button-confirm",
    },
    edusoft: {
      name: "📘 Edusoft.Net / AQTech (HUTECH, PTIT, SGU, TDTU...)",
      rowSelector:
        "#divTDK table tbody tr, .grid-roll table tbody tr, table tbody tr",
      actionSelector: "input[type='checkbox']",
      searchSelector: "",
      submitSelector:
        "#btnLuu, input[value*='Lưu'], button[id*='btnLuu'], button.btn-primary",
    },
    psc_uis: {
      name: "📙 PSC UIS / MyUIS (UEH, UTE, HUIT, ĐH Luật...)",
      rowSelector:
        "table.grid tbody tr, .k-grid-content tbody tr, table tbody tr",
      actionSelector: "input[type='checkbox'], input[type='radio'], a.btn-chon",
      searchSelector: "",
      submitSelector:
        "#btnDangKy, button[id*='Save'], input[value*='Đăng ký']",
    },
    hust_sis: {
      name: "📕 ĐH Bách Khoa (HUST CTT / SIS)",
      rowSelector: "table.dxgvTable tbody tr, table tbody tr",
      actionSelector: "input[type='checkbox'], .dxbButton",
      searchSelector: "input[id*='txtMaLop'], input.class-code-input",
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
    CUSTOM_SEARCH_SEL: `unireg_ext_search_${hostKey}`,
    CUSTOM_ACTION_SEL: `unireg_ext_action_${hostKey}`,
    CUSTOM_SUBMIT_SEL: `unireg_ext_submit_${hostKey}`,
  };

  let autoTimerId = null;
  let cycleCount = 0;
  let isPassRunning = false;
  let pickerMode = null; // "search" | "action" | "submit" | null

  function normalizeCode(str) {
    return String(str || "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Lấy danh sách tất cả Document khả dụng (bao gồm cả các <iframe> cùng tên miền trên cổng trường)
   */
  function getTargetDocuments() {
    const docs = [document];
    const iframes = Array.from(document.querySelectorAll("iframe, frame"));
    iframes.forEach((frame) => {
      try {
        if (frame.contentDocument) {
          docs.push(frame.contentDocument);
        }
      } catch {
        // Bỏ qua iframe khác tên miền (cross-origin)
      }
    });
    return docs;
  }

  function querySelectorAllAcrossDocs(selector) {
    if (!selector) return [];
    const results = [];
    getTargetDocuments().forEach((doc) => {
      try {
        results.push(...Array.from(doc.querySelectorAll(selector)));
      } catch {
        // Ignore invalid selector
      }
    });
    return results;
  }

  function querySelectorAcrossDocs(selector) {
    if (!selector) return null;
    for (const doc of getTargetDocuments()) {
      try {
        const el = doc.querySelector(selector);
        if (el) return el;
      } catch {
        // Ignore
      }
    }
    return null;
  }

  /**
   * Điền giá trị vào ô <input> tương thích với các cổng trường viết bằng React, Angular, Vue
   */
  function setNativeInputValue(inputEl, value) {
    const proto = window.HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (nativeSetter) {
      nativeSetter.call(inputEl, value);
    } else {
      inputEl.value = value;
    }
    inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    inputEl.dispatchEvent(new Event("change", { bubbles: true }));
    inputEl.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
      })
    );
    inputEl.dispatchEvent(
      new KeyboardEvent("keyup", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
      })
    );
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
    if (querySelectorAcrossDocs("#divTDK") || querySelectorAcrossDocs("#btnLuu"))
      return "edusoft";
    if (querySelectorAcrossDocs("#divDanhSachMonHoc")) return "vnu";
    return "smart";
  }

  function getActiveSelectors() {
    const presetSelect = document.getElementById("autodkmh-preset-select");
    const presetKey = (presetSelect && presetSelect.value) || "smart";
    const base = PRESETS[presetKey] || PRESETS.smart;

    const customSearch = localStorage.getItem(STORAGE_KEYS.CUSTOM_SEARCH_SEL);
    const customAction = localStorage.getItem(STORAGE_KEYS.CUSTOM_ACTION_SEL);
    const customSubmit = localStorage.getItem(STORAGE_KEYS.CUSTOM_SUBMIT_SEL);

    return {
      rowSelector: base.rowSelector,
      searchSelector: customSearch !== null ? customSearch : base.searchSelector,
      actionSelector: customAction || base.actionSelector,
      submitSelector: customSubmit || base.submitSelector,
    };
  }

  function getCourseRows() {
    const { rowSelector } = getActiveSelectors();
    const candidates = querySelectorAllAcrossDocs(rowSelector).filter(
      (tr) => !tr.closest("#autodkmh-panel")
    );
    const withActions = candidates.filter((tr) =>
      tr.querySelector("input[type='checkbox'], input[type='radio'], button, a")
    );
    return withActions.length > 0 ? withActions : candidates;
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
      const explicit = querySelectorAcrossDocs(submitSelector);
      if (explicit && !explicit.disabled) return explicit;
    }

    const candidates = querySelectorAllAcrossDocs(
      "button, a.btn, input[type='button'], input[type='submit']"
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

  /**
   * Tự động bấm nút xác nhận trong hộp thoại Popup / Modal nếu cổng trường hỏi lại ("Đồng ý", "OK", "Xác nhận")
   */
  function tryClickModalConfirmation() {
    const modalSelectors = [
      ".swal2-confirm",
      ".bootbox-accept",
      ".modal.show .btn-primary",
      ".modal.in .btn-primary",
      ".ui-dialog-buttonset button:first-child",
      ".k-dialog-buttongroup .k-button-solid-primary",
    ];
    for (const sel of modalSelectors) {
      const btn = querySelectorAcrossDocs(sel);
      if (btn && !btn.disabled && btn.offsetParent !== null) {
        btn.click();
        return true;
      }
    }
    return false;
  }

  function updateStatusLog(lines) {
    const statusEl = document.getElementById("autodkmh-status");
    if (!statusEl) return;
    const timestamp = new Date().toLocaleTimeString("vi-VN");
    statusEl.textContent = [`[${timestamp}]`, ...lines].join("\n");
  }

  async function executeRegistrationPass(sourceLabel) {
    if (isPassRunning) return;
    isPassRunning = true;

    try {
      annotateCourseCheckboxes();

      const inputEl = document.getElementById("autodkmh-input");
      const confirmCheckbox = document.getElementById("autodkmh-confirm-chk");
      const queries = parseTargetQueries(inputEl ? inputEl.value : "");

      if (queries.length === 0) {
        updateStatusLog(["⚠️ Vui lòng nhập ít nhất 1 mã lớp hoặc mã số môn học!"]);
        return;
      }

      const { searchSelector, actionSelector, submitSelector } = getActiveSelectors();
      const searchInput = searchSelector ? querySelectorAcrossDocs(searchSelector) : null;

      const logs = [`Nguồn: ${sourceLabel}`];
      let matchedCount = 0;

      for (const query of queries) {
        // Nếu trường có ô tìm kiếm / lọc môn học -> tự động điền mã môn và chờ bảng lọc xong
        if (searchInput) {
          setNativeInputValue(searchInput, query);
          await sleep(320);
        }

        const rows = getCourseRows();
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
          logs.push(`- [${query}]: Không tìm thấy trên bảng hiện tại.`);
          continue;
        }

        const actEl =
          matchedRow.querySelector(actionSelector) ||
          matchedRow.querySelector(
            "input[type='checkbox'], input[type='radio'], button, a.btn"
          );

        if (!actEl || actEl.disabled) {
          logs.push(`- [${query}]: Ô/nút chọn đang bị khóa (disabled).`);
          continue;
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
          logs.push(`+ [${query}]: Đã kích hoạt nút đăng ký trên dòng!`);
        }
      }

      if (confirmCheckbox && confirmCheckbox.checked && matchedCount > 0) {
        const confirmBtn = findConfirmButton(submitSelector);
        if (confirmBtn) {
          confirmBtn.click();
          logs.push("=> Đã bấm nút Lưu / Ghi nhận!");
          await sleep(250);
          if (tryClickModalConfirmation()) {
            logs.push("=> Đã tự động xác nhận hộp thoại Popup!");
          }
        } else {
          logs.push("=> Không tìm thấy nút Lưu/Ghi nhận khả dụng.");
        }
      }

      updateStatusLog(logs);
    } finally {
      isPassRunning = false;
    }
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
    const intervalSeconds =
      Number.isFinite(rawSeconds) && rawSeconds >= 1 ? rawSeconds : 2.5;
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
      return `${el.tagName.toLowerCase()}.${validClasses
        .map((c) => CSS.escape(c))
        .join(".")}`;
    }
    if (el.name) return `${el.tagName.toLowerCase()}[name='${CSS.escape(el.name)}']`;
    return el.tagName.toLowerCase();
  }

  function attachPickerListenersToDoc(doc, panel) {
    if (doc._uniregPickerAttached) return;
    doc._uniregPickerAttached = true;

    doc.addEventListener("mouseover", (e) => {
      if (!pickerMode || (panel && panel.contains(e.target))) return;
      if (e.target && e.target.classList) {
        e.target.classList.add("unireg-picker-hover");
      }
    });

    doc.addEventListener("mouseout", (e) => {
      if (e.target && e.target.classList) {
        e.target.classList.remove("unireg-picker-hover");
      }
    });

    doc.addEventListener(
      "click",
      (e) => {
        if (!pickerMode || (panel && panel.contains(e.target))) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.target && e.target.classList) {
          e.target.classList.remove("unireg-picker-hover");
        }

        const selector = computeElementSelector(e.target);
        if (pickerMode === "search") {
          localStorage.setItem(STORAGE_KEYS.CUSTOM_SEARCH_SEL, selector);
          updateStatusLog([`✅ Đã lưu Ô Tìm kiếm/Lọc môn: ${selector}`]);
        } else if (pickerMode === "action") {
          localStorage.setItem(STORAGE_KEYS.CUSTOM_ACTION_SEL, selector);
          updateStatusLog([`✅ Đã lưu Ô/Nút chọn môn: ${selector}`]);
        } else {
          localStorage.setItem(STORAGE_KEYS.CUSTOM_SUBMIT_SEL, selector);
          updateStatusLog([`✅ Đã lưu Nút Lưu/Ghi nhận: ${selector}`]);
        }
        pickerMode = null;
      },
      true
    );
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
          `<option value="${key}" ${key === savedPreset ? "selected" : ""}>${
            val.name
          }</option>`
      )
      .join("");

    const panel = document.createElement("div");
    panel.id = "autodkmh-panel";
    panel.innerHTML = `
      <div class="autodkmh-header">
        <span>🎓 UniReg Auto Đa Trường v2.1</span>
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
          <button type="button" id="autodkmh-pick-search" class="autodkmh-btn autodkmh-btn-picker" title="Nếu trường bắt gõ mã môn vào ô tìm kiếm mới hiện lớp, bấm nút này rồi click vào ô tìm kiếm">
            🎯 Ô Tìm
          </button>
          <button type="button" id="autodkmh-pick-action" class="autodkmh-btn autodkmh-btn-picker" title="Click để chọn mẫu ô tick hoặc nút đăng ký của trường">
            🎯 Ô/Nút ĐK
          </button>
          <button type="button" id="autodkmh-pick-submit" class="autodkmh-btn autodkmh-btn-picker" title="Click để chọn nút Lưu / Ghi nhận của trường">
            🎯 Nút Lưu
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
          <div id="autodkmh-status">Sẵn sàng hỗ trợ đăng ký học phần thật.</div>
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
      panel.style.width = "295px";
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
      localStorage.removeItem(STORAGE_KEYS.CUSTOM_SEARCH_SEL);
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

    document.getElementById("autodkmh-pick-search").addEventListener("click", () => {
      pickerMode = "search";
      getTargetDocuments().forEach((d) => attachPickerListenersToDoc(d, panel));
      updateStatusLog([
        "🎯 Visual Picker: Hãy click vào Ô Tìm kiếm / Nhập mã môn trên trang trường!",
      ]);
    });

    document.getElementById("autodkmh-pick-action").addEventListener("click", () => {
      pickerMode = "action";
      getTargetDocuments().forEach((d) => attachPickerListenersToDoc(d, panel));
      updateStatusLog([
        "🎯 Visual Picker: Hãy click vào 1 Ô tick hoặc Nút đăng ký trên bảng môn học!",
      ]);
    });

    document.getElementById("autodkmh-pick-submit").addEventListener("click", () => {
      pickerMode = "submit";
      getTargetDocuments().forEach((d) => attachPickerListenersToDoc(d, panel));
      updateStatusLog([
        "🎯 Visual Picker: Hãy click vào Nút Lưu / Ghi nhận đăng ký trên trang!",
      ]);
    });

    getTargetDocuments().forEach((d) => attachPickerListenersToDoc(d, panel));
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
