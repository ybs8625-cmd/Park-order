const state = {
  catalog: null,
  productId: "",
  color: "",
  size: "",
  quantity: 1,
  cart: [],
};

const el = {
  productSelect: document.getElementById("productSelect"),
  colorSelect: document.getElementById("colorSelect"),
  sizeSelect: document.getElementById("sizeSelect"),
  stockLine: document.getElementById("stockLine"),
  quantity: document.getElementById("quantity"),
  qtyMinus: document.getElementById("qtyMinus"),
  qtyPlus: document.getElementById("qtyPlus"),
  previewImage: document.getElementById("previewImage"),
  pickPrice: document.getElementById("pickPrice"),
  productGallery: document.getElementById("productGallery"),
  galleryTrack: document.getElementById("galleryTrack"),
  photoLightbox: document.getElementById("photoLightbox"),
  photoLightboxImage: document.getElementById("photoLightboxImage"),
  photoLightboxClose: document.getElementById("photoLightboxClose"),
  addCartBtn: document.getElementById("addCartBtn"),
  cartItems: document.getElementById("cartItems"),
  cartCount: document.getElementById("cartCount"),
  layout: document.getElementById("layout"),
  cartAnchor: document.getElementById("cartAnchor"),
  cartSide: document.getElementById("cartSide"),
  cartPanel: document.getElementById("cartPanel"),
  itemTotal: document.getElementById("itemTotal"),
  shippingFee: document.getElementById("shippingFee"),
  grandTotal: document.getElementById("grandTotal"),
  noticeShipping: document.getElementById("noticeShipping"),
  noticeExchange: document.getElementById("noticeExchange"),
  noticeReturn: document.getElementById("noticeReturn"),
  form: document.getElementById("orderForm"),
  formError: document.getElementById("formError"),
  submitBtn: document.getElementById("submitBtn"),
  toast: document.getElementById("toast"),
  toastBody: document.getElementById("toastBody"),
  toastClose: document.getElementById("toastClose"),
};

const won = (n) => `${Number(n).toLocaleString("ko-KR")}원`;
const IS_PAGES = !window.location.hostname.includes("127.0.0.1") && !window.location.hostname.includes("localhost");
const CATALOG_URLS = IS_PAGES
  ? ["./data/products.json"]
  : ["/api/catalog", "./data/products.json"];
const GH_RAW = "https://raw.githubusercontent.com/ybs8625-cmd/Park-order/master/docs";

function resolveImage(src) {
  if (!src) return "";
  if (src.startsWith("http") || src.startsWith("blob:") || src.startsWith("data:")) return src;
  if (!IS_PAGES) {
    if (src.startsWith("./")) return `/static/${src.slice(2)}`;
    return src;
  }
  // Pages: 배포 지연 대비 raw GitHub로 표시
  if (src.startsWith("./")) return `${GH_RAW}/${src.slice(2)}`;
  if (src.startsWith("/static/")) return `${GH_RAW}/${src.slice("/static/".length)}`;
  if (src.startsWith("images/")) return `${GH_RAW}/${src}`;
  return src;
}

function currentProduct() {
  return (state.catalog?.products || []).find((p) => p.id === state.productId) || null;
}

function currentStock() {
  const product = currentProduct();
  if (!product || !state.color || !state.size) return 0;
  const base = product.stock?.[state.color]?.[state.size] ?? 0;
  const reserved = state.cart
    .filter((c) => c.productId === state.productId && c.color === state.color && c.size === state.size)
    .reduce((sum, c) => sum + c.quantity, 0);
  return Math.max(base - reserved, 0);
}

function currentColorImage() {
  const product = currentProduct();
  if (!product) return "";
  const color = (product.colors || []).find((c) => c.id === state.color);
  return color?.image || product.image || "";
}

function productGalleryImages(product) {
  if (!product) return [];
  if (Array.isArray(product.images) && product.images.length) {
    return product.images.filter(Boolean);
  }
  return product.image ? [product.image] : [];
}

function markImageMissing(imgEl) {
  if (!imgEl || imgEl.dataset.missingHandled === "1") return;
  imgEl.dataset.missingHandled = "1";
  const holder = document.createElement("div");
  holder.className = "img-missing";
  holder.textContent = "이미지 없음";
  imgEl.replaceWith(holder);
}

function bindImageFallback(root = document) {
  root.querySelectorAll("img[data-img-fallback]").forEach((img) => {
    img.addEventListener("error", () => markImageMissing(img), { once: true });
  });
}

function closeLightbox() {
  if (!el.photoLightbox) return;
  el.photoLightbox.hidden = true;
  if (el.photoLightboxImage) el.photoLightboxImage.removeAttribute("src");
}

function openLightbox(src) {
  if (!el.photoLightbox || !el.photoLightboxImage || !src) return;
  if (src.startsWith("missing:")) return;
  el.photoLightboxImage.src = src;
  el.photoLightbox.hidden = false;
}

function closeGallery() {
  if (!el.productGallery) return;
  el.productGallery.hidden = true;
  if (el.galleryTrack) el.galleryTrack.innerHTML = "";
  closeLightbox();
}

function renderGallery(product) {
  const images = productGalleryImages(product);
  if (!el.galleryTrack || !el.productGallery) return;
  if (!images.length) {
    closeGallery();
    return;
  }
  el.galleryTrack.innerHTML = images
    .map((src) => {
      const url = resolveImage(src);
      return `<img src="${url}" alt="" loading="lazy" data-full="${url}" data-img-fallback="1" />`;
    })
    .join("");
  el.productGallery.hidden = false;
  bindImageFallback(el.galleryTrack);
}

function fillProductSelect() {
  const current = state.productId;
  el.productSelect.innerHTML = '<option value="">품목을 선택하세요</option>';
  for (const product of state.catalog.products || []) {
    const opt = document.createElement("option");
    opt.value = product.id;
    opt.textContent = `${product.brand} · ${product.name} (${won(product.price)})`;
    el.productSelect.appendChild(opt);
  }
  el.productSelect.value = current || "";
}

function fillColorSelect() {
  const product = currentProduct();
    el.colorSelect.innerHTML = '<option value="">색상</option>';
  el.colorSelect.disabled = !product;
  if (!product) return;
  for (const color of product.colors || []) {
    const opt = document.createElement("option");
    opt.value = color.id;
    opt.textContent = color.name;
    el.colorSelect.appendChild(opt);
  }
  if (![...el.colorSelect.options].some((o) => o.value === state.color)) {
    state.color = product.colors?.[0]?.id || "";
  }
  el.colorSelect.value = state.color;
}

function productSizes(product) {
  return product?.sizes || state.catalog?.default_sizes || state.catalog?.sizes || [];
}

function fillSizeSelect() {
  const product = currentProduct();
  el.sizeSelect.innerHTML = '<option value="">사이즈</option>';
  el.sizeSelect.disabled = !product || !state.color;
  if (!product || !state.color) return;

  for (const size of productSizes(product)) {
    const stock = product.stock?.[state.color]?.[size.id] ?? 0;
    const reserved = state.cart
      .filter((c) => c.productId === product.id && c.color === state.color && c.size === size.id)
      .reduce((sum, c) => sum + c.quantity, 0);
    const left = Math.max(stock - reserved, 0);
    const opt = document.createElement("option");
    opt.value = size.id;
    opt.textContent = left > 0 ? `${size.label} · 잔여 ${left}` : `${size.label} · 품절`;
    opt.disabled = left <= 0;
    el.sizeSelect.appendChild(opt);
  }

  if (![...el.sizeSelect.options].some((o) => o.value === state.size && !o.disabled)) {
    const first = [...el.sizeSelect.options].find((o) => o.value && !o.disabled);
    state.size = first?.value || "";
  }
  el.sizeSelect.value = state.size;
}

function updatePicker() {
  const product = currentProduct();
  const stock = currentStock();
  const img = currentColorImage();

  el.stockLine.classList.remove("low", "empty");
  if (!product || !state.color || !state.size) {
    el.stockLine.textContent = "남은 수량: -";
    el.pickPrice.textContent = product ? won(product.price) : "-";
  } else if (stock <= 0) {
    el.stockLine.textContent = "남은 수량: 품절";
    el.stockLine.classList.add("empty");
    el.pickPrice.textContent = won(product.price);
  } else if (stock <= 3) {
    el.stockLine.textContent = `남은 수량: ${stock}개 (마감 임박)`;
    el.stockLine.classList.add("low");
    el.pickPrice.textContent = won(product.price);
  } else {
    el.stockLine.textContent = `남은 수량: ${stock}개`;
    el.pickPrice.textContent = won(product.price);
  }

  if (img) {
    el.previewImage.hidden = false;
    el.previewImage.dataset.missingHandled = "";
    el.previewImage.setAttribute("data-img-fallback", "1");
    el.previewImage.src = resolveImage(img);
    el.previewImage.alt = product ? `${product.brand} ${product.name}` : "";
    el.previewImage.onerror = () => {
      el.previewImage.hidden = true;
      let miss = document.getElementById("previewMissing");
      if (!miss) {
        miss = document.createElement("div");
        miss.id = "previewMissing";
        miss.className = "img-missing tiny";
        miss.textContent = "이미지 없음";
        el.previewImage.parentElement?.appendChild(miss);
      }
      miss.hidden = false;
    };
    const miss = document.getElementById("previewMissing");
    if (miss) miss.hidden = true;
  } else {
    el.previewImage.hidden = true;
    const miss = document.getElementById("previewMissing");
    if (miss) {
      miss.hidden = false;
      miss.textContent = "이미지 없음";
    }
  }

  renderGallery(product);

  if (state.quantity > stock) state.quantity = Math.max(stock, 1);
  if (stock <= 0) state.quantity = 1;
  el.quantity.value = String(state.quantity);
  el.qtyMinus.disabled = state.quantity <= 1;
  el.qtyPlus.disabled = state.quantity >= stock || stock <= 0;
  el.addCartBtn.disabled = !product || !state.color || !state.size || stock <= 0;
}

function cartItemTotal() {
  return state.cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
}

function renderCart() {
  const shipping = state.catalog?.shipping_fee || 3500;
  const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  el.cartCount.textContent = String(count);
  el.shippingFee.textContent = won(shipping);

  if (!state.cart.length) {
    el.cartItems.innerHTML = '<p class="cart-empty">담긴 상품이 없습니다.</p>';
    el.itemTotal.textContent = won(0);
    el.grandTotal.textContent = won(shipping);
    el.submitBtn.disabled = true;
    return;
  }

  el.cartItems.innerHTML = "";
  state.cart.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "cart-row";
    row.innerHTML = `
      <img src="${resolveImage(item.image)}" alt="" data-img-fallback="1" onerror="this.onerror=null;this.replaceWith(Object.assign(document.createElement('div'),{className:'img-missing tiny',textContent:'이미지 없음'}))" />
      <div>
        <p class="title">${item.brand} · ${item.name}</p>
        <p class="meta">${item.colorName} · ${item.sizeLabel} · ${item.quantity}개</p>
      </div>
      <div class="right">
        <p class="price">${won(item.unitPrice * item.quantity)}</p>
        <button type="button" class="remove" data-index="${index}">삭제</button>
      </div>
    `;
    el.cartItems.appendChild(row);
  });

  const itemTotal = cartItemTotal();
  el.itemTotal.textContent = won(itemTotal);
  el.grandTotal.textContent = won(itemTotal + shipping);
  el.submitBtn.disabled = false;
}

function refreshPicker() {
  fillProductSelect();
  fillColorSelect();
  fillSizeSelect();
  updatePicker();
  renderCart();
}

function addToCart() {
  const product = currentProduct();
  const stock = currentStock();
  if (!product || !state.color || !state.size || stock < state.quantity) {
    el.formError.textContent = "선택 옵션과 남은 수량을 확인해 주세요.";
    el.formError.hidden = false;
    return;
  }

  const color = (product.colors || []).find((c) => c.id === state.color);
  const size = productSizes(product).find((s) => s.id === state.size);
  const keySame = state.cart.find(
    (c) => c.productId === product.id && c.color === state.color && c.size === state.size
  );

  if (keySame) {
    if (keySame.quantity + state.quantity > stock + keySame.quantity) {
      el.formError.textContent = "남은 수량을 초과할 수 없습니다.";
      el.formError.hidden = false;
      return;
    }
    keySame.quantity += state.quantity;
  } else {
    state.cart.push({
      productId: product.id,
      brand: product.brand,
      name: product.name,
      color: state.color,
      colorName: color?.name || state.color,
      size: state.size,
      sizeLabel: size?.label || state.size,
      quantity: state.quantity,
      unitPrice: product.price,
      image: color?.image || product.image,
    });
  }

  el.formError.hidden = true;
  state.quantity = 1;
  refreshPicker();
}

async function loadCatalog() {
  let catalog = null;
  let lastError = null;
  for (const url of CATALOG_URLS) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      catalog = await res.json();
      break;
    } catch (err) {
      lastError = err;
    }
  }
  if (!catalog) throw new Error(lastError?.message || "카탈로그를 불러오지 못했습니다.");

  state.catalog = catalog;
  state.productId = "";
  state.color = "";
  state.size = "";
  state.quantity = 1;

  el.noticeShipping.textContent = state.catalog.notices?.shipping || "";
  el.noticeExchange.textContent = state.catalog.notices?.exchange || "";
  el.noticeReturn.textContent = state.catalog.notices?.return || "";
  refreshPicker();
}

function formatOrderTime(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function orderToCsv(order) {
  const headers = [
    "주문번호", "주문시간", "상태", "이름", "연락처", "주소", "메모",
    "품목", "색상", "사이즈", "수량", "단가", "금액", "상품합계", "배송비", "결제합계",
  ];
  const rows = [headers.join(",")];
  const customer = order["주문자"] || {};
  for (const item of order["주문내용"] || []) {
    rows.push([
      order["주문번호"], order["주문시간"], order["상태"],
      customer["이름"], customer["연락처"], customer["주소"], customer["메모"],
      item["품목"], item["색상"], item["사이즈"], item["수량"], item["단가"], item["금액"],
      order["상품합계"], order["배송비"], order["결제합계"],
    ].map(csvEscape).join(","));
  }
  return "\uFEFF" + rows.join("\n") + "\n";
}

function downloadCsv(order) {
  const blob = new Blob([orderToCsv(order)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `주문_${order["주문번호"]}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function githubConfig() {
  return window.PARK_ORDER_CONFIG || {};
}

async function submitOrderToGitHub(order) {
  const cfg = githubConfig();
  if (!cfg.token || !cfg.githubOwner || !cfg.githubRepo) {
    return { ok: false, reason: "missing-token" };
  }
  const res = await fetch(`https://api.github.com/repos/${cfg.githubOwner}/${cfg.githubRepo}/dispatches`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      event_type: "park-order-submit",
      client_payload: { order },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub 주문 저장 실패 (${res.status}) ${text}`);
  }
  return { ok: true };
}

function buildLocalOrder(payload) {
  const shipping = state.catalog.shipping_fee || 3500;
  const items = [];
  let itemTotal = 0;
  const now = new Date();
  const orderId = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}-${crypto.randomUUID().slice(0, 8)}`;

  for (const line of payload.items) {
    const product = (state.catalog.products || []).find((p) => p.id === line.product_id);
    if (!product) throw new Error("존재하지 않는 품목입니다.");
    const stock = product.stock?.[line.color]?.[line.size] ?? 0;
    if (line.quantity > stock) {
      throw new Error(`${product.name} 남은 수량이 부족합니다. (남은 수량: ${stock})`);
    }
    product.stock[line.color][line.size] = stock - line.quantity;
    const colorName = (product.colors || []).find((c) => c.id === line.color)?.name || line.color;
    const sizeLabel = productSizes(product).find((s) => s.id === line.size)?.label || line.size;
    const lineTotal = product.price * line.quantity;
    itemTotal += lineTotal;
    items.push({
      품목: `${product.brand} · ${product.name}`,
      색상: colorName,
      사이즈: sizeLabel,
      수량: line.quantity,
      단가: product.price,
      금액: lineTotal,
    });
  }

  const order = {
    주문번호: orderId,
    주문시간: formatOrderTime(now),
    상태: "주문완료",
    주문자: {
      이름: payload.name,
      연락처: payload.phone,
      주소: payload.address,
      메모: payload.memo || "-",
    },
    주문내용: items,
    상품합계: itemTotal,
    배송비: shipping,
    결제합계: itemTotal + shipping,
  };

  const key = "park-order-orders";
  const saved = JSON.parse(localStorage.getItem(key) || '{"orders":[]}');
  saved.orders.push(order);
  localStorage.setItem(key, JSON.stringify(saved));
  return {
    ok: true,
    message: "주문이 정상적으로 완료 되었습니다.\n판매자가 연락 드리겠습니다.",
    order,
  };
}

async function resetPage() {
  el.form.reset();
  addrEls.zonecode.value = "";
  addrEls.base.value = "";
  addrEls.detail.value = "";
  state.cart = [];
  state.productId = "";
  state.color = "";
  state.size = "";
  state.quantity = 1;
  el.formError.hidden = true;
  el.layout?.classList.remove("cart-expanded");
  await loadCatalog();
  requestAnimationFrame(pinCart);
}

el.galleryTrack?.addEventListener("click", (event) => {
  if (event.target.closest(".img-missing")) return;
  const img = event.target.closest("img[data-full]");
  if (!img) return;
  openLightbox(img.dataset.full);
});

el.photoLightboxClose?.addEventListener("click", (event) => {
  event.stopPropagation();
  closeLightbox();
});

el.photoLightbox?.addEventListener("click", (event) => {
  // 배경 또는 큰 사진 다시 클릭 시 닫기
  if (event.target === el.photoLightbox || event.target === el.photoLightboxImage) {
    closeLightbox();
  }
});

el.productSelect.addEventListener("change", () => {
  state.productId = el.productSelect.value;
  state.color = "";
  state.size = "";
  state.quantity = 1;
  closeGallery();
  fillColorSelect();
  fillSizeSelect();
  updatePicker();
});

el.colorSelect.addEventListener("change", () => {
  state.color = el.colorSelect.value;
  state.size = "";
  state.quantity = 1;
  fillSizeSelect();
  updatePicker();
});

el.sizeSelect.addEventListener("change", () => {
  state.size = el.sizeSelect.value;
  state.quantity = 1;
  updatePicker();
});

el.qtyMinus.addEventListener("click", () => {
  if (state.quantity > 1) {
    state.quantity -= 1;
    updatePicker();
  }
});

el.qtyPlus.addEventListener("click", () => {
  if (state.quantity < currentStock()) {
    state.quantity += 1;
    updatePicker();
  }
});

el.addCartBtn.addEventListener("click", addToCart);

el.cartItems.addEventListener("click", (event) => {
  const btn = event.target.closest(".remove");
  if (!btn) return;
  const index = Number(btn.dataset.index);
  state.cart.splice(index, 1);
  refreshPicker();
});

function pinCart() {
  if (!el.cartSide || !el.cartAnchor) return;
  el.layout?.classList.remove("cart-expanded");

  if (window.matchMedia("(max-width: 900px)").matches) {
    el.cartSide.style.left = "";
    el.cartSide.style.width = "";
    el.cartSide.style.top = "";
    el.cartSide.style.bottom = "";
    el.cartSide.style.height = "";
    el.cartSide.style.maxHeight = "";
    return;
  }

  const anchorRect = el.cartAnchor.getBoundingClientRect();
  const shipping = document.getElementById("shippingCard");
  const shipRect = shipping?.getBoundingClientRect();
  const width = Math.round(anchorRect.width);
  const left = Math.round(anchorRect.left);

  el.cartSide.style.left = `${left}px`;
  el.cartSide.style.width = `${width}px`;
  el.cartSide.style.right = "auto";
  el.cartSide.style.bottom = "auto";

  if (shipRect && shipRect.height > 0) {
    el.cartSide.style.top = `${Math.round(shipRect.top)}px`;
    el.cartSide.style.height = `${Math.round(shipRect.height)}px`;
    el.cartSide.style.maxHeight = `${Math.round(shipRect.height)}px`;
  } else {
    el.cartSide.style.top = "";
    el.cartSide.style.height = "";
    el.cartSide.style.maxHeight = "70vh";
    el.cartSide.style.bottom = "20px";
  }
}

document.getElementById("noticeDetails")?.addEventListener("toggle", () => {
  requestAnimationFrame(pinCart);
});

window.addEventListener("resize", pinCart);
window.addEventListener("scroll", pinCart, { passive: true });

el.toastClose.addEventListener("click", () => {
  el.toast.hidden = true;
});

const addrEls = {
  zonecode: document.getElementById("zonecode"),
  base: document.getElementById("addressBase"),
  detail: document.getElementById("addressDetail"),
  layer: document.getElementById("postcodeLayer"),
  embed: document.getElementById("postcodeEmbed"),
  searchBtn: document.getElementById("addrSearchBtn"),
  closeBtn: document.getElementById("postcodeCloseBtn"),
};

function closePostcodeLayer() {
  addrEls.layer.hidden = true;
  addrEls.embed.innerHTML = "";
}

function openPostcodeSearch() {
  if (typeof daum === "undefined" || !daum.Postcode) {
    el.formError.textContent = "주소검색 서비스를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
    el.formError.hidden = false;
    return;
  }

  addrEls.layer.hidden = false;
  addrEls.embed.innerHTML = "";

  new daum.Postcode({
    oncomplete(data) {
      const road = data.roadAddress || "";
      const jibun = data.jibunAddress || "";
      const selected = data.userSelectedType === "J" ? jibun : road || jibun;
      const extra = [];
      if (data.bname && /[동|로|가]$/g.test(data.bname)) extra.push(data.bname);
      if (data.buildingName && data.apartment === "Y") extra.push(data.buildingName);
      const extraText = extra.length ? ` (${extra.join(", ")})` : "";

      addrEls.zonecode.value = data.zonecode || "";
      addrEls.base.value = `${selected}${extraText}`;
      addrEls.detail.focus();
      closePostcodeLayer();
    },
    onclose(state) {
      if (state === "FORCE_CLOSE") closePostcodeLayer();
    },
    width: "100%",
    height: "100%",
  }).embed(addrEls.embed);
}

function fullAddress() {
  const zip = addrEls.zonecode.value.trim();
  const base = addrEls.base.value.trim();
  const detail = addrEls.detail.value.trim();
  if (!base) return "";
  return [zip && `[${zip}]`, base, detail].filter(Boolean).join(" ");
}

addrEls.searchBtn.addEventListener("click", openPostcodeSearch);
addrEls.base.addEventListener("click", openPostcodeSearch);
addrEls.zonecode.addEventListener("click", openPostcodeSearch);
addrEls.closeBtn.addEventListener("click", closePostcodeLayer);

el.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  el.formError.hidden = true;

  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const address = fullAddress();
  const memo = document.getElementById("memo").value.trim();

  if (!state.cart.length) {
    el.formError.textContent = "장바구니에 상품을 담아 주세요.";
    el.formError.hidden = false;
    return;
  }
  if (!name || !phone || !addrEls.base.value.trim()) {
    el.formError.textContent = "이름, 연락처, 주소를 모두 입력해 주세요.";
    el.formError.hidden = false;
    return;
  }
  if (!addrEls.detail.value.trim()) {
    el.formError.textContent = "상세주소를 입력해 주세요.";
    el.formError.hidden = false;
    addrEls.detail.focus();
    return;
  }

  el.submitBtn.disabled = true;
  el.submitBtn.textContent = "접수 중…";

  const payload = {
    items: state.cart.map((item) => ({
      product_id: item.productId,
      color: item.color,
      size: item.size,
      quantity: item.quantity,
    })),
    name,
    phone,
    address,
    memo,
  };

  try {
    let data = null;
    if (!IS_PAGES) {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      data = await res.json();
      if (!res.ok) {
        const detail = Array.isArray(data.detail)
          ? data.detail.map((d) => d.msg).join(", ")
          : data.detail;
        throw new Error(detail || "주문에 실패했습니다.");
      }
    } else {
      data = buildLocalOrder(payload);
    }

    // 웹/로컬 모두 GitHub에 YAML로 남기기 시도
    try {
      const gh = await submitOrderToGitHub(data.order);
      if (IS_PAGES && !gh.ok) {
        downloadCsv(data.order);
      }
    } catch (ghErr) {
      if (IS_PAGES) {
        downloadCsv(data.order);
        console.warn(ghErr);
      } else {
        console.warn(ghErr);
      }
    }

    el.toastBody.textContent = "판매자가 연락 드리겠습니다.";
    el.toast.hidden = false;
    await resetPage();
  } catch (err) {
    el.formError.textContent = err.message || "주문 중 오류가 발생했습니다.";
    el.formError.hidden = false;
  } finally {
    el.submitBtn.disabled = state.cart.length === 0;
    el.submitBtn.textContent = "주문완료";
  }
});

const noticeDetails = document.getElementById("noticeDetails");
if (noticeDetails) {
  noticeDetails.setAttribute("open", "");
  noticeDetails.open = true;
}
el.layout?.classList.remove("cart-expanded");

loadCatalog()
  .then(() => {
    if (noticeDetails) noticeDetails.open = true;
    requestAnimationFrame(pinCart);
  })
  .catch((err) => {
    el.formError.textContent = err.message;
    el.formError.hidden = false;
  });
