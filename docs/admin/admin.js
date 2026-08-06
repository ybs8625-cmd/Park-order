(() => {
  const TOKEN_KEY = "park_admin_token";
  const SESSION_KEY = "park_admin_ok";
  const GITHUB_API = "https://api.github.com";
  const DEFAULT_OWNER = "ybs8625-cmd";
  const DEFAULT_REPO = "Park-order";
  const SIZE_OPTIONS = [
    { id: "XS", label: "XS (85)" },
    { id: "S", label: "S (90)" },
    { id: "M", label: "M (95)" },
    { id: "L", label: "L (100)" },
    { id: "XL", label: "XL (105)" },
    { id: "XXL", label: "XXL (110)" },
  ];
  const DEFAULT_SIZES = SIZE_OPTIONS.filter((s) => s.id !== "XS");
  const COLOR_PRESETS = [
    { id: "black", name: "블랙" },
    { id: "white", name: "화이트" },
  ];
  const COLOR_IDS = {
    블랙: "black",
    화이트: "white",
    그레이: "gray",
    네이비: "navy",
    레드: "red",
    블루: "blue",
    그린: "green",
    베이지: "beige",
  };

  const els = {
    loginView: document.getElementById("loginView"),
    adminView: document.getElementById("adminView"),
    loginForm: document.getElementById("loginForm"),
    loginId: document.getElementById("loginId"),
    loginPw: document.getElementById("loginPw"),
    loginError: document.getElementById("loginError"),
    logoutBtn: document.getElementById("logoutBtn"),
    navBtns: [...document.querySelectorAll(".nav-btn")],
    panels: {
      orders: document.getElementById("ordersPanel"),
      products: document.getElementById("productsPanel"),
      password: document.getElementById("passwordPanel"),
    },
    dateFrom: document.getElementById("dateFrom"),
    dateTo: document.getElementById("dateTo"),
    searchOrdersBtn: document.getElementById("searchOrdersBtn"),
    downloadOrdersBtn: document.getElementById("downloadOrdersBtn"),
    ordersBody: document.getElementById("ordersBody"),
    productsBody: document.getElementById("productsBody"),
    newProductBtn: document.getElementById("newProductBtn"),
    passwordForm: document.getElementById("passwordForm"),
    pwCurrent: document.getElementById("pwCurrent"),
    pwNew: document.getElementById("pwNew"),
    pwNew2: document.getElementById("pwNew2"),
    passwordMsg: document.getElementById("passwordMsg"),
    productModal: document.getElementById("productModal"),
    modalTitle: document.getElementById("modalTitle"),
    productForm: document.getElementById("productForm"),
    modalClose: document.getElementById("modalClose"),
    modalCancel: document.getElementById("modalCancel"),
    productId: document.getElementById("productId"),
    pBrand: document.getElementById("pBrand"),
    pName: document.getElementById("pName"),
    pPrice: document.getElementById("pPrice"),
    pDesc: document.getElementById("pDesc"),
    pImageList: document.getElementById("pImageList"),
    pImageFile: document.getElementById("pImageFile"),
    colorChecks: document.getElementById("colorChecks"),
    sizeChecks: document.getElementById("sizeChecks"),
    customColorInput: document.getElementById("customColorInput"),
    addColorBtn: document.getElementById("addColorBtn"),
    stockGrid: document.getElementById("stockGrid"),
  };

  const state = {
    mode: "local",
    token: localStorage.getItem(TOKEN_KEY) || "",
    config: null,
    catalog: null,
    catalogJsonSha: null,
    catalogYamlSha: null,
    adminSha: null,
    orders: [],
    editingProduct: null,
    extraColors: [],
    editingImages: [],
  };

  function money(n) {
    return `${Number(n || 0).toLocaleString("ko-KR")}원`;
  }

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }

  function showError(el, msg) {
    if (!el) return;
    el.hidden = !msg;
    el.textContent = msg || "";
  }

  function showMsg(el, msg, ok = true) {
    if (!el) return;
    el.hidden = !msg;
    el.textContent = msg || "";
    el.style.color = ok ? "#0f766e" : "#b42318";
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;
    const src = String(text || "").replace(/^\uFEFF/, "");
    for (let i = 0; i < src.length; i += 1) {
      const ch = src[i];
      const next = src[i + 1];
      if (inQuotes) {
        if (ch === '"' && next === '"') {
          cell += '"';
          i += 1;
        } else if (ch === '"') inQuotes = false;
        else cell += ch;
      } else if (ch === '"') inQuotes = true;
      else if (ch === ",") {
        row.push(cell);
        cell = "";
      } else if (ch === "\n") {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      } else if (ch !== "\r") cell += ch;
    }
    if (cell.length || row.length) {
      row.push(cell);
      rows.push(row);
    }
    if (!rows.length) return [];
    const headers = rows[0];
    return rows
      .slice(1)
      .filter((r) => r.some((c) => String(c || "").trim()))
      .map((r) => {
        const obj = {};
        headers.forEach((h, idx) => {
          obj[h] = r[idx] ?? "";
        });
        return obj;
      });
  }

  function toCsv(rows) {
    if (!rows.length) return "\uFEFF";
    const headers = Object.keys(rows[0]);
    const esc = (v) => {
      const s = String(v ?? "");
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return `\uFEFF${[headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n")}\n`;
  }

  function showLogin() {
    els.loginView.hidden = false;
    els.adminView.hidden = true;
  }

  function showAdmin() {
    els.loginView.hidden = true;
    els.adminView.hidden = false;
  }

  function setPanel(name) {
    Object.entries(els.panels).forEach(([key, el]) => {
      el.hidden = key !== name;
    });
    els.navBtns.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.panel === name);
    });
  }

  async function detectMode() {
    if (location.hostname.includes("github.io") || location.protocol === "file:") {
      state.mode = "pages";
      state.config = window.PARK_ORDER_CONFIG || null;
      return;
    }
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      if (res.ok) {
        state.mode = "local";
        return;
      }
    } catch (_) {
      /* pages */
    }
    state.mode = "pages";
    state.config = window.PARK_ORDER_CONFIG || null;
  }

  async function api(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    if (options.json !== undefined) {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(options.json);
    }
    const res = await fetch(path, { ...options, headers });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (_) {
      data = text;
    }
    if (!res.ok) {
      const detail = data && data.detail ? data.detail : "요청 실패";
      throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
    }
    return data;
  }

  function cfgOwner() {
    return state.config?.githubOwner || state.config?.owner || DEFAULT_OWNER;
  }

  function cfgRepo() {
    return state.config?.githubRepo || state.config?.repo || DEFAULT_REPO;
  }

  function branch() {
    return state.config?.branch || "master";
  }

  function rawUrl(path) {
    return `https://raw.githubusercontent.com/${cfgOwner()}/${cfgRepo()}/${branch()}/${path}?t=${Date.now()}`;
  }

  function ghHeaders(extra = {}) {
    if (!state.config?.token) {
      throw new Error("GitHub 쓰기 토큰이 없습니다. ORDER_WRITE_TOKEN / Pages 배포를 확인하세요.");
    }
    return {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${state.config.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...extra,
    };
  }

  function decodeGithubContent(content) {
    return decodeURIComponent(escape(atob(String(content || "").replace(/\n/g, ""))));
  }

  async function ghGet(path) {
    const owner = cfgOwner();
    const repo = cfgRepo();
    const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch())}`;
    const res = await fetch(url, { headers: ghHeaders() });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `GitHub 조회 실패: ${path}`);
    }
    return res.json();
  }

  async function ghPutText(path, contentText, message, sha) {
    const owner = cfgOwner();
    const repo = cfgRepo();
    const body = {
      message,
      content: btoa(unescape(encodeURIComponent(contentText))),
      branch: branch(),
    };
    if (sha) body.sha = sha;
    const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`, {
      method: "PUT",
      headers: ghHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `GitHub 저장 실패: ${path}`);
    }
    return res.json();
  }

  async function ghPutBinary(path, bytes, message, sha) {
    const owner = cfgOwner();
    const repo = cfgRepo();
    let binary = "";
    bytes.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    const body = {
      message,
      content: btoa(binary),
      branch: branch(),
    };
    if (sha) body.sha = sha;
    const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`, {
      method: "PUT",
      headers: ghHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `이미지 업로드 실패: ${path}`);
    }
    return res.json();
  }

  function toLocalPaths(obj) {
    if (Array.isArray(obj)) return obj.map(toLocalPaths);
    if (obj && typeof obj === "object") {
      const out = {};
      Object.entries(obj).forEach(([k, v]) => {
        out[k] = toLocalPaths(v);
      });
      return out;
    }
    if (typeof obj === "string" && obj.startsWith("./")) return `/static/${obj.slice(2)}`;
    return obj;
  }

  function toDocsPaths(obj) {
    if (Array.isArray(obj)) return obj.map(toDocsPaths);
    if (obj && typeof obj === "object") {
      const out = {};
      Object.entries(obj).forEach(([k, v]) => {
        out[k] = toDocsPaths(v);
      });
      return out;
    }
    if (typeof obj === "string" && obj.startsWith("/static/")) return `./${obj.slice("/static/".length)}`;
    return obj;
  }

  async function fetchAdminCredentials() {
    const res = await fetch(rawUrl("data/admin.json"), { cache: "no-store" });
    if (!res.ok) throw new Error("관리자 정보를 불러오지 못했습니다.");
    return res.json();
  }

  async function loadAdminFile() {
    try {
      const file = await ghGet("data/admin.json");
      state.adminSha = file.sha;
      return JSON.parse(decodeGithubContent(file.content));
    } catch (_) {
      return fetchAdminCredentials();
    }
  }

  async function saveAdminFile(admin) {
    let sha = state.adminSha;
    if (!sha) {
      try {
        const file = await ghGet("data/admin.json");
        sha = file.sha;
      } catch (_) {
        sha = null;
      }
    }
    const res = await ghPutText(
      "data/admin.json",
      `${JSON.stringify(admin, null, 2)}\n`,
      "chore: update admin password",
      sha
    );
    state.adminSha = res.content.sha;
  }

  async function loadCatalogPages() {
    // 조회는 raw로, 저장용 sha만 API로 가져온다
    const res = await fetch(rawUrl("docs/data/products.json"), { cache: "no-store" });
    if (!res.ok) throw new Error("상품 목록을 불러오지 못했습니다.");
    state.catalog = await res.json();
    if (!Array.isArray(state.catalog.default_sizes)) {
      state.catalog.default_sizes = DEFAULT_SIZES.slice();
    }
    if (state.config?.token) {
      try {
        const jsonFile = await ghGet("docs/data/products.json");
        state.catalogJsonSha = jsonFile.sha;
      } catch (_) {
        state.catalogJsonSha = null;
      }
      try {
        const yamlFile = await ghGet("data/products.yaml");
        state.catalogYamlSha = yamlFile.sha;
      } catch (_) {
        state.catalogYamlSha = null;
      }
    }
    return state.catalog;
  }

  async function saveCatalogPages(message) {
    if (typeof jsyaml === "undefined") throw new Error("YAML 라이브러리를 불러오지 못했습니다.");
    const localCatalog = toLocalPaths(structuredClone(state.catalog));
    const docsCatalog = toDocsPaths(structuredClone(state.catalog));
    const yamlText = jsyaml.dump(localCatalog, { lineWidth: 120, noRefs: true });
    const jsonText = `${JSON.stringify(docsCatalog, null, 2)}\n`;
    const jsonRes = await ghPutText("docs/data/products.json", jsonText, message, state.catalogJsonSha);
    state.catalogJsonSha = jsonRes.content.sha;
    const yamlRes = await ghPutText("data/products.yaml", yamlText, message, state.catalogYamlSha);
    state.catalogYamlSha = yamlRes.content.sha;
    state.catalog = docsCatalog;
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SESSION_KEY);
    state.token = "";
  }

  async function loginLocal(username, password) {
    const data = await api("/api/admin/login", {
      method: "POST",
      json: { username, password },
    });
    state.token = data.token;
    localStorage.setItem(TOKEN_KEY, state.token);
    localStorage.setItem(SESSION_KEY, "1");
  }

  async function loginPages(username, password) {
    const admin = await fetchAdminCredentials();
    if (username !== admin.username || password !== admin.password) {
      throw new Error("아이디 또는 비밀번호가 올바르지 않습니다.");
    }
    state.token = btoa(unescape(encodeURIComponent(`${username}:${Date.now()}`)));
    localStorage.setItem(TOKEN_KEY, state.token);
    localStorage.setItem(SESSION_KEY, "1");
  }

  async function ensureSession() {
    // 새로고침 시 자동 입장 방지 — 항상 로그인 필요
    clearSession();
    showLogin();
    return false;
  }

  function productImageSrc(path) {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    if (state.mode === "local") {
      if (path.startsWith("./")) return `/static/${path.slice(2)}`;
      return path;
    }
    if (path.startsWith("/static/")) return `../${path.slice("/static/".length)}`;
    if (path.startsWith("./")) return `../${path.slice(2)}`;
    return path;
  }

  function renderOrders(rows) {
    if (!rows.length) {
      els.ordersBody.innerHTML = `<tr><td colspan="9">주문 내역이 없습니다.</td></tr>`;
      return;
    }
    els.ordersBody.innerHTML = rows
      .map(
        (r) => `
      <tr>
        <td>${r["주문시간"] || ""}</td>
        <td>${r["주문번호"] || ""}</td>
        <td>${r["이름"] || ""}</td>
        <td>${r["연락처"] || ""}</td>
        <td>${r["품목"] || ""}</td>
        <td>${r["색상"] || ""} / ${r["사이즈"] || ""}</td>
        <td>${r["수량"] || ""}</td>
        <td>${r["금액"] || ""}</td>
        <td>${r["결제합계"] || ""}</td>
      </tr>`
      )
      .join("");
  }

  function filterOrders(rows) {
    const from = els.dateFrom.value;
    const to = els.dateTo.value;
    return rows.filter((r) => {
      const day = String(r["주문시간"] || "").slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      return true;
    });
  }

  async function loadOrders() {
    if (state.mode === "local") {
      const data = await api(
        `/api/admin/orders?date_from=${encodeURIComponent(els.dateFrom.value || "")}&date_to=${encodeURIComponent(els.dateTo.value || "")}`
      );
      state.orders = data.rows || [];
      renderOrders(state.orders);
      return;
    }
    let text = "";
    try {
      const res = await fetch(rawUrl("data/orders.csv"), { cache: "no-store" });
      text = res.ok ? await res.text() : "";
    } catch (_) {
      text = "";
    }
    state.orders = filterOrders(parseCsv(text));
    renderOrders(state.orders);
  }

  function downloadOrders() {
    const csv = toCsv(state.orders);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `orders_${todayStr()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function stockSum(product) {
    return Object.values(product.stock || {}).reduce(
      (sum, sizes) => sum + Object.values(sizes || {}).reduce((a, b) => a + Number(b || 0), 0),
      0
    );
  }

  function renderProducts() {
    const products = state.catalog?.products || [];
    if (!products.length) {
      els.productsBody.innerHTML = `<tr><td colspan="8">등록된 상품이 없습니다.</td></tr>`;
      return;
    }
    els.productsBody.innerHTML = products
      .map((p) => {
        const colors = (p.colors || []).map((c) => c.name || c.id).join(", ");
        const sizes = (p.sizes || []).map((s) => s.label || s.id).join(", ");
        return `
        <tr>
          <td><img src="${productImageSrc(p.image)}" alt=""></td>
          <td>${p.brand || ""}</td>
          <td>${p.name || ""}</td>
          <td>${money(p.price)}</td>
          <td>${colors}</td>
          <td>${sizes}</td>
          <td>${stockSum(p)}</td>
          <td>
            <div class="row-actions">
              <button class="row-btn edit" data-edit="${p.id}" type="button">수정</button>
              <button class="row-btn delete" data-del="${p.id}" type="button">삭제</button>
            </div>
          </td>
        </tr>`;
      })
      .join("");
  }

  async function loadProducts() {
    if (state.mode === "local") {
      const data = await api("/api/admin/products");
      state.catalog = {
        shipping_fee: data.shipping_fee,
        default_sizes: data.default_sizes || DEFAULT_SIZES,
        products: data.products || [],
      };
    } else {
      await loadCatalogPages();
    }
    renderProducts();
  }

  function colorIdFromName(name, existing = []) {
    const found = existing.find((c) => c.name === name || c.id === name);
    if (found) return found.id;
    if (COLOR_IDS[name]) return COLOR_IDS[name];
    return name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9가-힣-]/g, "") || `color-${Date.now()}`;
  }

  function allColorOptions() {
    const map = new Map();
    COLOR_PRESETS.forEach((c) => map.set(c.id, { ...c }));
    state.extraColors.forEach((c) => map.set(c.id, { ...c }));
    return [...map.values()];
  }

  function renderColorChecks(selectedIds = ["black", "white"]) {
    const selected = new Set(selectedIds);
    els.colorChecks.innerHTML = allColorOptions()
      .map(
        (c) => `
      <label class="check-pill">
        <input type="checkbox" name="colorOpt" value="${c.id}" data-name="${c.name}" ${selected.has(c.id) ? "checked" : ""} />
        <span>${c.name}</span>
      </label>`
      )
      .join("");
  }

  function renderSizeChecks(selectedIds = ["S", "M", "L", "XL", "XXL"]) {
    const selected = new Set(selectedIds);
    els.sizeChecks.innerHTML = SIZE_OPTIONS.map(
      (s) => `
      <label class="check-pill">
        <input type="checkbox" name="sizeOpt" value="${s.id}" ${selected.has(s.id) ? "checked" : ""} />
        <span>${s.id}</span>
      </label>`
    ).join("");
  }

  function readSelectedColors(existing = []) {
    return [...els.colorChecks.querySelectorAll('input[name="colorOpt"]:checked')].map((input) => {
      const name = input.dataset.name || input.value;
      const found = existing.find((c) => c.id === input.value || c.name === name);
      if (found) return { ...found, id: found.id || input.value, name: found.name || name };
      return {
        id: input.value,
        name,
        image: "",
      };
    });
  }

  function readSelectedSizes(existing = []) {
    return [...els.sizeChecks.querySelectorAll('input[name="sizeOpt"]:checked')].map((input) => {
      const opt = SIZE_OPTIONS.find((s) => s.id === input.value);
      const found = existing.find((s) => s.id === input.value);
      if (found) return { ...found, label: found.label || opt?.label || input.value };
      return { id: input.value, label: opt?.label || input.value };
    });
  }

  function addCustomColor() {
    const name = els.customColorInput.value.trim();
    if (!name) return;
    const existing = state.editingProduct?.colors || [];
    const id = colorIdFromName(name, [...COLOR_PRESETS, ...state.extraColors, ...existing]);
    if (allColorOptions().some((c) => c.id === id || c.name === name)) {
      const box = els.colorChecks.querySelector(`input[value="${id}"]`);
      if (box) box.checked = true;
      els.customColorInput.value = "";
      refreshStockEditor();
      return;
    }
    state.extraColors.push({ id, name });
    const selected = readSelectedColors(existing).map((c) => c.id);
    selected.push(id);
    renderColorChecks(selected);
    els.customColorInput.value = "";
    refreshStockEditor();
  }

  function buildStockEditor(colors, sizes, stock) {
    els.stockGrid.innerHTML = "";
    if (!colors.length || !sizes.length) {
      els.stockGrid.innerHTML = `<p class="msg">색상과 사이즈를 선택하면 재고표가 생성됩니다.</p>`;
      return;
    }
    const head = document.createElement("div");
    head.className = "stock-row";
    head.innerHTML = `<strong></strong>${sizes.map((s) => `<span>${s.id}</span>`).join("")}`;
    els.stockGrid.appendChild(head);

    colors.forEach((color) => {
      const row = document.createElement("div");
      row.className = "stock-row";
      row.dataset.color = color.id;
      const label = document.createElement("strong");
      label.textContent = color.name || color.id;
      row.appendChild(label);
      sizes.forEach((size) => {
        const input = document.createElement("input");
        input.type = "number";
        input.min = "0";
        input.dataset.size = size.id;
        input.value = String(stock?.[color.id]?.[size.id] ?? 0);
        row.appendChild(input);
      });
      els.stockGrid.appendChild(row);
    });
  }

  function readStockFromEditor() {
    const stock = {};
    [...els.stockGrid.querySelectorAll(".stock-row[data-color]")].forEach((row) => {
      const color = row.dataset.color;
      stock[color] = {};
      [...row.querySelectorAll("input")].forEach((input) => {
        stock[color][input.dataset.size] = Number(input.value || 0);
      });
    });
    return stock;
  }

  function refreshStockEditor() {
    const existing = state.editingProduct;
    const colors = readSelectedColors(existing?.colors || []);
    const sizes = readSelectedSizes(existing?.sizes || []);
    const current = readStockFromEditor();
    const stock = Object.keys(current).length ? current : existing?.stock || {};
    buildStockEditor(colors, sizes, stock);
  }

  function normalizeImages(product) {
    if (!product) return [];
    if (Array.isArray(product.images) && product.images.length) return product.images.slice();
    return product.image ? [product.image] : [];
  }

  function renderImageList() {
    if (!state.editingImages.length) {
      els.pImageList.innerHTML = `<p class="field-hint">등록된 이미지가 없습니다.</p>`;
      return;
    }
    els.pImageList.innerHTML = state.editingImages
      .map(
        (src, idx) => `
      <div class="image-item" data-idx="${idx}">
        <img src="${productImageSrc(src)}" alt="" />
        ${idx === 0 ? `<span class="badge">대표</span>` : ""}
        <button type="button" class="remove-img" data-remove-img="${idx}" aria-label="삭제">×</button>
      </div>`
      )
      .join("");
  }

  function openProductModal(product) {
    state.editingProduct = product;
    els.productModal.hidden = false;
    els.customColorInput.value = "";
    if (product) {
      els.modalTitle.textContent = "상품 수정";
      els.productId.value = product.id;
      els.pBrand.value = product.brand || "";
      els.pName.value = product.name || "";
      els.pPrice.value = product.price || 0;
      els.pDesc.value = product.description || "";
      state.editingImages = normalizeImages(product);
      const presetIds = new Set(COLOR_PRESETS.map((c) => c.id));
      state.extraColors = (product.colors || [])
        .filter((c) => !presetIds.has(c.id))
        .map((c) => ({ id: c.id, name: c.name || c.id }));
      renderColorChecks((product.colors || []).map((c) => c.id));
      renderSizeChecks((product.sizes || DEFAULT_SIZES).map((s) => s.id));
      buildStockEditor(product.colors || [], product.sizes || DEFAULT_SIZES, product.stock || {});
    } else {
      els.modalTitle.textContent = "신규 상품 등록";
      els.productForm.reset();
      els.productId.value = "";
      els.pPrice.value = 29000;
      state.editingImages = [];
      state.extraColors = [];
      renderColorChecks(["black", "white"]);
      renderSizeChecks(["S", "M", "L", "XL", "XXL"]);
      buildStockEditor(readSelectedColors(), readSelectedSizes(), {});
    }
    renderImageList();
    els.pImageFile.value = "";
  }

  function closeProductModal() {
    els.productModal.hidden = true;
    state.editingProduct = null;
    state.editingImages = [];
  }

  async function fileToBytes(file) {
    return new Uint8Array(await file.arrayBuffer());
  }

  async function uploadImage(file) {
    if (state.mode === "local") {
      const fd = new FormData();
      fd.append("file", file);
      const headers = {};
      if (state.token) headers.Authorization = `Bearer ${state.token}`;
      const res = await fetch("/api/admin/upload", { method: "POST", headers, body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "이미지 업로드 실패");
      return state.mode === "local" ? data.local_path || data.docs_path : data.docs_path || data.local_path;
    }
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const filename = `upload-${Date.now()}-${Math.random().toString(16).slice(2, 6)}.${ext}`;
    const docsPath = `docs/images/${filename}`;
    const staticPath = `static/images/${filename}`;
    const bytes = await fileToBytes(file);
    await ghPutBinary(docsPath, bytes, `chore: upload product image ${filename}`, null);
    try {
      await ghPutBinary(staticPath, bytes, `chore: upload product image ${filename}`, null);
    } catch (_) {
      /* optional */
    }
    return `./images/${filename}`;
  }

  async function handleImageFiles(fileList) {
    const files = [...(fileList || [])];
    if (!files.length) return;
    for (const file of files) {
      const path = await uploadImage(file);
      state.editingImages.push(path);
    }
    renderImageList();
    els.pImageFile.value = "";
  }

  function buildProductPayload() {
    const existing = state.editingProduct;
    const colors = readSelectedColors(existing?.colors || []);
    const sizes = readSelectedSizes(existing?.sizes || []);
    const images = state.editingImages.slice();
    const image = images[0] || existing?.image || "";
    colors.forEach((c) => {
      if (!c.image) c.image = image;
    });
    return {
      id: els.productId.value || null,
      name: els.pName.value.trim(),
      brand: els.pBrand.value.trim(),
      price: Number(els.pPrice.value || 0),
      description: els.pDesc.value.trim(),
      image,
      images,
      colors,
      sizes,
      stock: readStockFromEditor(),
    };
  }

  async function saveProduct(event) {
    event.preventDefault();
    // pending files not yet uploaded
    if (els.pImageFile.files?.length) {
      await handleImageFiles(els.pImageFile.files);
    }
    const payload = buildProductPayload();
    if (!payload.name || !payload.brand || !payload.colors.length || !payload.sizes.length) {
      alert("필수 항목을 입력하세요.");
      return;
    }
    if (!payload.images.length) {
      alert("상품 이미지를 1장 이상 등록하세요.");
      return;
    }
    payload.colors = payload.colors.map((c) => ({ ...c, image: c.image || payload.image }));

    if (state.mode === "local") {
      if (state.editingProduct) {
        await api(`/api/admin/products/${state.editingProduct.id}`, { method: "PUT", json: payload });
      } else {
        await api("/api/admin/products", { method: "POST", json: payload });
      }
    } else {
      const list = state.catalog.products || [];
      if (state.editingProduct) {
        const idx = list.findIndex((p) => p.id === state.editingProduct.id);
        if (idx < 0) throw new Error("상품을 찾을 수 없습니다.");
        list[idx] = { ...list[idx], ...payload, id: state.editingProduct.id };
      } else {
        const id =
          payload.id ||
          `${payload.brand}-${payload.name}`
            .toLowerCase()
            .replace(/[^a-z0-9가-힣]+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "") ||
          `item-${Date.now()}`;
        if (list.some((p) => p.id === id)) throw new Error("이미 존재하는 상품 ID입니다.");
        list.push({ ...payload, id });
      }
      state.catalog.products = list;
      await saveCatalogPages(
        state.editingProduct ? `chore: update product ${state.editingProduct.id}` : "chore: add product"
      );
    }
    closeProductModal();
    await loadProducts();
  }

  async function deleteProduct(id) {
    if (!confirm(`상품을 삭제할까요?`)) return;
    if (state.mode === "local") {
      await api(`/api/admin/products/${id}`, { method: "DELETE" });
    } else {
      state.catalog.products = (state.catalog.products || []).filter((p) => p.id !== id);
      await saveCatalogPages(`chore: delete product ${id}`);
    }
    await loadProducts();
  }

  async function changePassword(event) {
    event.preventDefault();
    showMsg(els.passwordMsg, "");
    const current_password = els.pwCurrent.value;
    const new_password = els.pwNew.value;
    const confirm_password = els.pwNew2.value;
    if (new_password !== confirm_password) {
      showMsg(els.passwordMsg, "새 비밀번호 확인이 일치하지 않습니다.", false);
      return;
    }
    try {
      if (state.mode === "local") {
        await api("/api/admin/password", {
          method: "POST",
          json: { current_password, new_password },
        });
      } else {
        const admin = await fetchAdminCredentials();
        if (current_password !== admin.password) throw new Error("현재 비밀번호가 올바르지 않습니다.");
        admin.password = new_password;
        await saveAdminFile(admin);
      }
      showMsg(els.passwordMsg, "비밀번호가 변경되었습니다.", true);
      els.passwordForm.reset();
    } catch (err) {
      showMsg(els.passwordMsg, err.message || "변경 실패", false);
    }
  }

  function bindEvents() {
    els.loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      showError(els.loginError, "");
      try {
        const username = els.loginId.value.trim();
        const password = els.loginPw.value;
        if (state.mode === "local") await loginLocal(username, password);
        else await loginPages(username, password);
        showAdmin();
        setPanel("orders");
        await loadOrders();
      } catch (err) {
        showError(els.loginError, err.message || "로그인 실패");
      }
    });

    els.logoutBtn.addEventListener("click", () => {
      clearSession();
      showLogin();
    });

    els.navBtns.forEach((btn) => {
      btn.addEventListener("click", async () => {
        const panel = btn.dataset.panel;
        setPanel(panel);
        try {
          if (panel === "orders") await loadOrders();
          if (panel === "products") await loadProducts();
        } catch (err) {
          alert(err.message || "불러오기 실패");
        }
      });
    });

    els.searchOrdersBtn.addEventListener("click", () => loadOrders().catch((e) => alert(e.message)));
    els.downloadOrdersBtn.addEventListener("click", () => downloadOrders());

    els.newProductBtn.addEventListener("click", () => openProductModal(null));
    els.modalClose.addEventListener("click", closeProductModal);
    els.modalCancel.addEventListener("click", closeProductModal);
    els.productForm.addEventListener("submit", (e) => {
      saveProduct(e).catch((err) => alert(err.message || "저장 실패"));
    });

    els.colorChecks.addEventListener("change", refreshStockEditor);
    els.sizeChecks.addEventListener("change", refreshStockEditor);
    els.addColorBtn.addEventListener("click", addCustomColor);
    els.customColorInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addCustomColor();
      }
    });
    els.pImageFile.addEventListener("change", () => {
      handleImageFiles(els.pImageFile.files).catch((err) => alert(err.message || "업로드 실패"));
    });
    els.pImageList.addEventListener("click", (e) => {
      const idx = e.target.getAttribute("data-remove-img");
      if (idx == null) return;
      state.editingImages.splice(Number(idx), 1);
      renderImageList();
    });

    els.productsBody.addEventListener("click", (e) => {
      const editId = e.target.getAttribute("data-edit");
      const delId = e.target.getAttribute("data-del");
      if (editId) {
        const product = (state.catalog.products || []).find((p) => p.id === editId);
        if (product) openProductModal(product);
      }
      if (delId) deleteProduct(delId).catch((err) => alert(err.message || "삭제 실패"));
    });

    els.passwordForm.addEventListener("submit", changePassword);
  }

  async function init() {
    els.dateFrom.value = daysAgo(30);
    els.dateTo.value = todayStr();
    bindEvents();
    await detectMode();
    const ok = await ensureSession();
    if (ok) {
      setPanel("orders");
      await loadOrders();
    }
  }

  init().catch((err) => {
    console.error(err);
    showError(els.loginError, err.message || "초기화 실패");
  });
})();
