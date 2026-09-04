/**
 * Frontend dashboard.
 *
 * PENTING:
 * Isi GAS_API_URL dengan URL Web App Google Apps Script.
 *
 * Contoh:
 * const GAS_API_URL = "https://script.google.com/macros/s/XXXXX/exec";
 */

const GAS_API_URL = "PASTE_URL_WEB_APP_APPS_SCRIPT_DI_SINI";

// Jika menggunakan Vercel Serverless Proxy:
// const API_URL = "/api/peminjaman";
const API_URL = "/api/peminjaman";

let allBookings = [];
let filteredBookings = [];
let selectedMonth = "";

const MONTHS_ID = [
  "Januari","Februari","Maret","April","Mei","Juni",
  "Juli","Agustus","September","Oktober","November","Desember"
];

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  setupEvents();
  loadData();
});

function setupEvents() {
  document.getElementById("monthFilter").addEventListener("change", e => {
    selectedMonth = e.target.value;
    render();
  });

  document.getElementById("refreshBtn").addEventListener("click", loadData);
  document.getElementById("themeBtn").addEventListener("click", toggleTheme);
  document.getElementById("closeModal").addEventListener("click", closeModal);

  document.getElementById("detailModal").addEventListener("click", e => {
    if (e.target.id === "detailModal") closeModal();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeModal();
  });
}

/* THEME */

function initTheme() {
  const saved = localStorage.getItem("peminjaman-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  setTheme(saved || (prefersDark ? "dark" : "light"));
}

function toggleTheme() {
  const dark = document.documentElement.classList.contains("dark");
  setTheme(dark ? "light" : "dark");
}

function setTheme(theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem("peminjaman-theme", theme);

  const icon = document.getElementById("themeIcon");
  const btn = document.getElementById("themeBtn");

  if (icon) icon.textContent = theme === "dark" ? "light_mode" : "dark_mode";
  if (btn) btn.title = theme === "dark" ? "Mode terang" : "Mode gelap";
}

/* API */

async function loadData() {
  setLoading(true);

  if (!API_URL || API_URL.includes("PASTE_URL")) {
    setLoading(false);
    showToast("Isi GAS_API_URL di script.js terlebih dahulu.");
    return;
  }

  try {
    const url = API_URL.includes("?")
      ? `${API_URL}&action=json`
      : `${API_URL}?action=json`;

    const response = await fetch(url, {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || "API gagal");
    }

    allBookings = Array.isArray(result.data) ? result.data : [];
    buildMonthFilter();
    render();
  } catch (error) {
    console.error(error);
    showToast("Gagal mengambil data dari Google Sheets.");
  } finally {
    setLoading(false);
  }
}

/* FILTER & LIST */

function buildMonthFilter() {
  const select = document.getElementById("monthFilter");
  const monthMap = new Map();

  allBookings.forEach(item => {
    const dates = [
      parseSheetDate(item.tanggalMulai),
      parseSheetDate(item.tanggalBerakhir)
    ].filter(Boolean);

    dates.forEach(date => {
      const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`;
      if (!monthMap.has(key)) {
        monthMap.set(key, {
          key,
          year: date.getFullYear(),
          month: date.getMonth()
        });
      }
    });
  });

  if (!monthMap.size) {
    const now = new Date();
    const key = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
    monthMap.set(key, {
      key,
      year: now.getFullYear(),
      month: now.getMonth()
    });
  }

  const options = [...monthMap.values()]
    .sort((a,b) => a.key.localeCompare(b.key));

  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;

  selectedMonth = options.some(x => x.key === currentKey)
    ? currentKey
    : options[options.length - 1].key;

  select.innerHTML = options.map(item =>
    `<option value="${escapeHtml(item.key)}">${escapeHtml(MONTHS_ID[item.month] + " " + item.year)}</option>`
  ).join("");

  select.value = selectedMonth;
}

function render() {
  filteredBookings = allBookings
    .filter(item => bookingBelongsToMonth(item, selectedMonth))
    .sort(compareDateDesc);

  updateStats(filteredBookings);
  renderList(filteredBookings);
}

function updateStats(data) {
  document.getElementById("totalPeminjaman").textContent = data.length;

  const saranaSet = new Set();
  const instansiSet = new Set();

  data.forEach(item => {
    splitLines(item.sarana).forEach(s => {
      const normalized = normalize(s.replace(/^[-•]\s*/, ""));
      if (normalized) saranaSet.add(normalized);
    });

    if (item.instansi?.trim()) {
      instansiSet.add(normalize(item.instansi));
    }
  });

  document.getElementById("totalSarana").textContent = saranaSet.size;
  document.getElementById("totalInstansi").textContent = instansiSet.size;
  document.getElementById("resultCount").textContent = `${data.length} peminjaman`;
}

function renderList(data) {
  const list = document.getElementById("bookingList");
  const empty = document.getElementById("emptyState");

  if (!data.length) {
    list.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }

  empty.classList.add("hidden");

  list.innerHTML = data.map((item,index) => `
    <div class="booking-row" data-index="${index}" tabindex="0" role="button">
      <div class="row-no">${index + 1}</div>
      <div class="row-date">${escapeHtml(formatDateRange(item.tanggalMulai,item.tanggalBerakhir))}</div>
      <div class="row-title">${escapeHtml(item.namaKegiatan || "-")}</div>
      <div class="row-instansi">${escapeHtml(item.instansi || "-")}</div>
      <div class="row-place">${escapeHtml(item.tempat || "-")}</div>
      <div class="row-arrow">
        <span class="material-symbols-rounded">chevron_right</span>
      </div>
    </div>
  `).join("");

  list.querySelectorAll(".booking-row").forEach(row => {
    const open = () => openDetail(data[Number(row.dataset.index)]);
    row.addEventListener("click", open);
    row.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
  });
}

/* DETAIL */

function openDetail(item) {
  document.getElementById("detailDate").textContent =
    formatLongDate(item.tanggalMulai);

  document.getElementById("detailTitle").textContent =
    item.namaKegiatan || "-";

  document.getElementById("detailInstansi").textContent =
    item.instansi || "-";

  document.getElementById("detailTanggal").textContent =
    formatDateRangeLong(item.tanggalMulai,item.tanggalBerakhir);

  document.getElementById("detailJam").textContent = item.jam || "-";
  document.getElementById("detailTempat").textContent = item.tempat || "-";

  renderContacts(item.contactPerson);
  document.getElementById("detailSarana").textContent = formatSarana(item.sarana);
  document.getElementById("detailKeterangan").textContent = item.keterangan || "-";

  const documentRow = document.getElementById("documentRow");
  const documentBtn = document.getElementById("detailDocument");
  const docUrl = extractFirstUrl(item.dokumen);

  if (docUrl) {
    documentRow.classList.remove("hidden");
    documentBtn.href = docUrl;
  } else {
    documentRow.classList.add("hidden");
    documentBtn.removeAttribute("href");
  }

  document.getElementById("detailModal").classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeModal() {
  document.getElementById("detailModal").classList.add("hidden");
  document.body.classList.remove("modal-open");
}

/* WHATSAPP */

function renderContacts(value) {
  const container = document.getElementById("detailContact");
  container.innerHTML = "";

  if (!value || !String(value).trim()) {
    container.textContent = "-";
    return;
  }

  const contacts = extractPhoneContacts(String(value));

  if (!contacts.length) {
    container.textContent = value;
    return;
  }

  contacts.forEach(contact => {
    const a = document.createElement("a");
    a.className = "contact-link";
    a.href = `https://wa.me/${contact.phone}`;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.innerHTML = `<span class="material-symbols-rounded">chat</span>${escapeHtml(contact.label)}`;
    container.appendChild(a);
  });
}

/**
 * Mendukung:
 * 081234567890
 * 081-234-567-890
 * 6281234567890
 * Budi 081234567890
 * Budi : 081-234-567890
 * Budi / Andi 081..., 082...
 *
 * Nomor Indonesia diubah menjadi format internasional 62.
 */
function extractPhoneContacts(text) {
  const regex = /(?:\+?62|0)(?:[\s.-]*\d){8,13}/g;
  const matches = text.match(regex) || [];

  const unique = [];
  const seen = new Set();

  matches.forEach(raw => {
    let digits = raw.replace(/\D/g,"");

    if (digits.startsWith("62")) {
      // sudah internasional
    } else if (digits.startsWith("0")) {
      digits = "62" + digits.slice(1);
    } else {
      return;
    }

    // Nomor Indonesia umumnya diawali 628.
    if (!digits.startsWith("628")) return;
    if (digits.length < 10 || digits.length > 15) return;

    if (!seen.has(digits)) {
      seen.add(digits);
      unique.push({
        phone: digits,
        label: findContactLabel(text, raw)
      });
    }
  });

  return unique;
}

function findContactLabel(fullText, rawNumber) {
  const index = fullText.indexOf(rawNumber);
  if (index < 0) return formatPhoneDisplay(rawNumber);

  const before = fullText.slice(Math.max(0,index-45), index).trim();

  // Ambil nama di depan nomor jika pola "Nama :" / "Nama -".
  const cleaned = before
    .replace(/[|,;/]+$/,"")
    .replace(/[:\-–—]+\s*$/,"")
    .trim();

  if (cleaned) {
    const chunks = cleaned.split(/[|,;/]+/).map(x => x.trim()).filter(Boolean);
    const candidate = chunks[chunks.length - 1];

    if (candidate && !/^\d+$/.test(candidate)) {
      return candidate;
    }
  }

  return formatPhoneDisplay(rawNumber);
}

function formatPhoneDisplay(raw) {
  return String(raw).replace(/\s+/g," ").trim();
}

/* DATE */

function bookingBelongsToMonth(item, monthKey) {
  if (!monthKey) return true;

  const start = parseSheetDate(item.tanggalMulai);
  const end = parseSheetDate(item.tanggalBerakhir) || start;

  if (!start && !end) return false;

  const [year,month] = monthKey.split("-").map(Number);
  const monthStart = new Date(year,month-1,1);
  const monthEnd = new Date(year,month,0,23,59,59,999);

  return start <= monthEnd && end >= monthStart;
}

function compareDateDesc(a,b) {
  const da = parseSheetDate(a.tanggalMulai);
  const db = parseSheetDate(b.tanggalMulai);

  if (!da && !db) return 0;
  if (!da) return 1;
  if (!db) return -1;

  return db - da;
}

function parseSheetDate(value) {
  if (!value) return null;

  const text = String(value).trim();
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);

  if (!match) return null;

  const date = new Date(
    Number(match[3]),
    Number(match[2])-1,
    Number(match[1])
  );

  return isNaN(date.getTime()) ? null : date;
}

function formatLongDate(value) {
  const date = parseSheetDate(value);
  if (!date) return value || "-";

  return new Intl.DateTimeFormat("id-ID", {
    weekday:"long",
    day:"2-digit",
    month:"long",
    year:"numeric"
  }).format(date);
}

function formatDateRange(startValue,endValue) {
  const start = parseSheetDate(startValue);
  const end = parseSheetDate(endValue);

  if (!start && !end) return "-";
  if (!end || sameDay(start,end)) return formatShortDate(start);

  return `${formatShortDate(start)} - ${formatShortDate(end)}`;
}

function formatDateRangeLong(startValue,endValue) {
  const start = parseSheetDate(startValue);
  const end = parseSheetDate(endValue);

  if (!start && !end) return "-";
  if (!end || sameDay(start,end)) return formatLongDate(startValue);

  return `${formatLongDate(startValue)} s.d. ${formatLongDate(endValue)}`;
}

function formatShortDate(date) {
  if (!date) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day:"2-digit",
    month:"short",
    year:"numeric"
  }).format(date);
}

function sameDay(a,b) {
  return a && b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

/* TEXT */

function formatSarana(value) {
  const items = splitLines(value);
  if (!items.length) return "-";

  return items.map(item =>
    `- ${item.replace(/^[-•]\s*/,"").trim()}`
  ).join("\n");
}

function splitLines(value) {
  if (!value) return [];
  return String(value)
    .split(/\r?\n|•/)
    .map(x => x.trim())
    .filter(Boolean);
}

function extractFirstUrl(value) {
  if (!value) return "";
  const match = String(value).match(/https?:\/\/[^\s]+/i);
  return match ? match[0].replace(/[),.;]+$/,"") : "";
}

function normalize(value) {
  return String(value).trim().toLowerCase().replace(/\s+/g," ");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

/* UI */

function setLoading(isLoading) {
  document.getElementById("loadingState").classList.toggle("hidden",!isLoading);
  document.getElementById("refreshBtn").classList.toggle("loading",isLoading);

  if (isLoading) {
    document.getElementById("bookingList").innerHTML = "";
    document.getElementById("emptyState").classList.add("hidden");
  }
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  },2800);
}
