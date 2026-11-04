// ==UserScript==
// @name         Auto DKMH VNU v1.3 (Userscript)
// @namespace    https://duclvz.github.io/AutoDKMH
// @version      1.3.0
// @description  Hỗ trợ chọn nhanh và tự động đăng ký môn học theo danh sách mã học phần trên cổng ĐKMH VNU.
// @match        http://dangkyhoc.vnu.edu.vn/*
// @match        https://dangkyhoc.vnu.edu.vn/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const css = `
    #autodkmh-panel {
      background: #f5f5f5;
      border-top: 1px solid #ddd;
      border-bottom: 1px solid #ddd;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      font-size: 13px;
      color: #333;
      box-sizing: border-box;
      width: 100%;
    }
    #autodkmh-panel * { box-sizing: border-box; }
    .autodkmh-header {
      background-color: #5cb85c;
      color: #ffffff;
      font-weight: 700;
      font-size: 14px;
      text-align: center;
      padding: 10px 8px;
    }
    .autodkmh-body { padding: 10px; }
    #autodkmh-input {
      width: 100%;
      min-height: 92px;
      padding: 6px 8px;
      border: 1px solid #ccc;
      border-radius: 2px;
      font-size: 12.5px;
      line-height: 1.45;
      resize: vertical;
      background-color: #fff;
      color: #222;
    }
    .autodkmh-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
      flex-wrap: wrap;
    }
    .autodkmh-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      border: none;
      border-radius: 3px;
      padding: 7px 12px;
      font-size: 13px;
      font-weight: 600;
      color: #fff;
      cursor: pointer;
    }
    .autodkmh-btn-quick { background-color: #5cb85c; }
    .autodkmh-btn-auto { background-color: #428bca; }
    .autodkmh-btn-auto.is-running { background-color: #d9534f; }
    .autodkmh-checkbox-label {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
      cursor: pointer;
      user-select: none;
    }
    #autodkmh-interval {
      width: 48px;
      padding: 4px 6px;
      border: 1px solid #ccc;
      border-radius: 2px;
      text-align: center;
      font-size: 13px;
    }
    .autodkmh-result-box {
      margin-top: 10px;
      padding: 6px 0;
      border-top: 1px dashed #ccc;
    }
    .autodkmh-result-title { font-weight: 700; margin-bottom: 4px; }
    #autodkmh-status {
      font-size: 12px;
      line-height: 1.45;
      color: #2b542c;
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 2px;
      padding: 6px 8px;
      max-height: 130px;
      overflow-y: auto;
      white-space: pre-line;
    }
    .autodkmh-notes {
      margin-top: 8px;
      font-size: 12px;
      color: #666;
      line-height: 1.45;
    }
    .autodkmh-notes p { margin: 0 0 6px 0; }
    .autodkmh-rowindex-badge {
      display: block;
      margin-top: 2px;
      font-size: 11px;
      font-weight: 600;
      color: #222;
      text-align: center;
    }
  `;

  const styleEl = document.createElement("style");
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  const STORAGE_KEYS = {
    COURSE_LIST: "autodkmh_course_list",
    AUTO_CONFIRM: "autodkmh_auto_confirm",
    INTERVAL_SEC: "autodkmh_interval_sec",
  };

  let autoTimerId = null;
  let cycleCount = 0;

  function normalizeCode(str) {
    return String(str || "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  }

  function parseTargetQueries(rawText) {
    return String(rawText || "")
      .split(/\r?\n/)
      .map((line) => normalizeCode(line))
      .filter((line) => line.length > 0);
  }

  function getCourseRows() {
    const tableSelectors = [
      "#divDanhSachMonHoc table tbody tr",
      "table.table-course-list tbody tr",
      "table tbody tr",
    ];
    for (const selector of tableSelectors) {
      const rows = Array.from(document.querySelectorAll(selector)).filter(
        (tr) => tr.querySelector('input[type="checkbox"]')
      );
      if (rows.length > 0) return rows;
    }
    return [];
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

  function extractRowMetadata(tr, fallbackIndex) {
    const checkbox = tr.querySelector('input[type="checkbox"]');
    const rowIndex = normalizeCode(
      (checkbox && checkbox.getAttribute("data-rowindex")) ||
        tr.getAttribute("data-rowindex") ||
        String(fallbackIndex)
    );
    const cells = Array.from(tr.querySelectorAll("td")).map((td) =>
      normalizeCode(td.textContent)
    );
    return {
      checkbox,
      rowIndex,
      cells,
      courseName: cells[1] || "Môn học",
      classCode: cells[4] || "",
    };
  }

  function findConfirmButton() {
    const explicitSelectors = [
      "button.btn-confirm-registration",
      ".button-confirm",
      "#btnGhiNhan",
      'input[type="button"][value*="Ghi nhận" i]',
      'input[type="submit"][value*="Ghi nhận" i]',
    ];
    for (const sel of explicitSelectors) {
      const el = document.querySelector(sel);
      if (el && !el.disabled) return el;
    }
    const candidates = Array.from(
      document.querySelectorAll("button, a.btn, input[type='button']")
    );
    return (
      candidates.find((el) => {
        if (el.closest("#autodkmh-panel")) return false;
        const text = normalizeCode(el.textContent || el.value || "");
        return text.includes("GHI NHẬN") || text.includes("XÁC NHẬN");
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
      updateStatusLog(["Vui lòng nhập ít nhất 1 mã lớp môn học hoặc mã số môn học!"]);
      return;
    }

    const rows = getCourseRows();
    if (rows.length === 0) {
      updateStatusLog(["Không tìm thấy bảng danh sách môn học trên trang hiện tại."]);
      return;
    }

    const rowMetaList = rows.map((tr, i) => extractRowMetadata(tr, i + 1));
    const logs = [`Nguồn: ${sourceLabel}`];
    let matchedCount = 0;

    queries.forEach((query) => {
      const matchedRow = rowMetaList.find(
        (meta) =>
          meta.rowIndex === query ||
          meta.classCode === query ||
          meta.cells.some((cellText) => cellText === query)
      );

      if (!matchedRow || !matchedRow.checkbox) {
        logs.push(`- [${query}]: Không tìm thấy trong danh sách.`);
        return;
      }

      matchedCount++;
      const cb = matchedRow.checkbox;
      const displayLabel = matchedRow.classCode
        ? `${matchedRow.classCode} (#${matchedRow.rowIndex})`
        : `#${matchedRow.rowIndex}`;

      if (cb.disabled) {
        logs.push(`- ${displayLabel}: Ô chọn đang bị khóa (disabled).`);
        return;
      }

      if (!cb.checked) {
        cb.click();
        if (!cb.checked) {
          cb.checked = true;
          cb.dispatchEvent(new Event("change", { bubbles: true }));
        }
        logs.push(`+ ${displayLabel}: Đã tick chọn (${matchedRow.courseName}).`);
      } else {
        logs.push(`= ${displayLabel}: Đã được tick sẵn.`);
      }
    });

    if (confirmCheckbox && confirmCheckbox.checked && matchedCount > 0) {
      const confirmBtn = findConfirmButton();
      if (confirmBtn) {
        confirmBtn.click();
        logs.push("=> Đã kích hoạt nút Ghi nhận!");
      } else {
        logs.push("=> Không tìm thấy nút Ghi nhận khả dụng trên trang.");
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
      autoBtn.textContent = "Auto ĐK";
      autoBtn.classList.remove("is-running");
      updateStatusLog([`Đã dừng Auto ĐK (sau ${cycleCount} lượt chạy).`]);
      return;
    }

    const rawSeconds = parseFloat(intervalInput.value);
    const intervalSeconds = Number.isFinite(rawSeconds) && rawSeconds >= 1 ? rawSeconds : 3;
    intervalInput.value = String(intervalSeconds);
    localStorage.setItem(STORAGE_KEYS.INTERVAL_SEC, String(intervalSeconds));

    cycleCount = 1;
    autoBtn.textContent = "Dừng Auto";
    autoBtn.classList.add("is-running");
    executeRegistrationPass(`Auto ĐK (Lượt #${cycleCount})`);

    autoTimerId = window.setInterval(() => {
      cycleCount++;
      executeRegistrationPass(`Auto ĐK (Lượt #${cycleCount})`);
    }, intervalSeconds * 1000);
  }

  function injectControlPanel() {
    if (document.getElementById("autodkmh-panel")) return;

    const savedList = localStorage.getItem(STORAGE_KEYS.COURSE_LIST) || "";
    const savedConfirm = localStorage.getItem(STORAGE_KEYS.AUTO_CONFIRM) !== "false";
    const savedInterval = localStorage.getItem(STORAGE_KEYS.INTERVAL_SEC) || "3";

    const panel = document.createElement("div");
    panel.id = "autodkmh-panel";
    panel.innerHTML = `
      <div class="autodkmh-header">Tool Auto DKMH VNU v1.3</div>
      <div class="autodkmh-body">
        <textarea
          id="autodkmh-input"
          placeholder="Nhập mã lớp môn học/mã số môn học vào đây, mỗi môn một dòng! Sau đó bấm Đăng ký nhanh và chờ ghi nhận thành công! Good Luck :D"
        ></textarea>
        <div class="autodkmh-row">
          <button type="button" id="autodkmh-quick-btn" class="autodkmh-btn autodkmh-btn-quick">
            <span>&#128190;</span> Đăng Ký Nhanh
          </button>
          <label class="autodkmh-checkbox-label">
            <input type="checkbox" id="autodkmh-confirm-chk" />
            <span>Ghi nhận</span>
          </label>
        </div>
        <div class="autodkmh-row">
          <button type="button" id="autodkmh-auto-btn" class="autodkmh-btn autodkmh-btn-auto">
            Auto ĐK
          </button>
          <span>sau mỗi</span>
          <input type="number" id="autodkmh-interval" min="1" step="0.5" value="3" />
          <span>giây</span>
        </div>
        <div class="autodkmh-result-box">
          <div class="autodkmh-result-title">Kết quả:</div>
          <div id="autodkmh-status">Sẵn sàng hỗ trợ đăng ký môn học.</div>
        </div>
        <div class="autodkmh-notes">
          <p>* Có thể dùng mã môn học hoặc mã số môn học (mã số cạnh ô tick chọn môn học).</p>
          <p>* Nút Đăng Ký Nhanh tự động chọn tất cả các môn và tự động Ghi Nhận nếu đã tick.</p>
          <p>* Nút Auto ĐK dùng để tự động đăng ký liên tục sau mỗi x giây, dùng cho việc trao đổi môn, canh slot trống.</p>
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
      panel.style.left = "12px";
      panel.style.bottom = "12px";
      panel.style.width = "260px";
      panel.style.zIndex = "99999";
      document.body.appendChild(panel);
    }

    const inputEl = document.getElementById("autodkmh-input");
    const confirmChk = document.getElementById("autodkmh-confirm-chk");
    const intervalEl = document.getElementById("autodkmh-interval");

    inputEl.value = savedList;
    confirmChk.checked = savedConfirm;
    intervalEl.value = savedInterval;

    inputEl.addEventListener("input", () =>
      localStorage.setItem(STORAGE_KEYS.COURSE_LIST, inputEl.value)
    );
    confirmChk.addEventListener("change", () =>
      localStorage.setItem(STORAGE_KEYS.AUTO_CONFIRM, String(confirmChk.checked))
    );
    intervalEl.addEventListener("change", () =>
      localStorage.setItem(STORAGE_KEYS.INTERVAL_SEC, intervalEl.value)
    );

    document
      .getElementById("autodkmh-quick-btn")
      .addEventListener("click", () => executeRegistrationPass("Đăng Ký Nhanh"));
    document
      .getElementById("autodkmh-auto-btn")
      .addEventListener("click", toggleAutoRegistration);
  }

  injectControlPanel();
  annotateCourseCheckboxes();
  new MutationObserver(annotateCourseCheckboxes).observe(document.body, {
    childList: true,
    subtree: true,
  });
})();
