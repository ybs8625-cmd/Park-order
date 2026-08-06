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
  addCartBtn: document.getElementById("addCartBtn"),
  cartItems: document.getElementById("cartItems"),
  cartCount: document.getElementById("cartCount"),
  cartExpandBtn: document.getElementById("cartExpandBtn"),
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

function fillSizeSelect() {
  const product = currentProduct();
  el.sizeSelect.innerHTML = '<option value="">사이즈</option>';
  el.sizeSelect.disabled = !product || !state.color;
  if (!product || !state.color) return;

  for (const size of state.catalog.sizes || []) {
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
    el.previewImage.src = img;
    el.previewImage.alt = product ? `${product.brand} ${product.name}` : "";
  } else {
    el.previewImage.hidden = true;
  }

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
      <img src="${item.image}" alt="" />
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
  const size = (state.catalog.sizes || []).find((s) => s.id === state.size);
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
  const res = await fetch("/api/catalog");
  if (!res.ok) throw new Error("카탈로그를 불러오지 못했습니다.");
  state.catalog = await res.json();
  state.productId = "";
  state.color = "";
  state.size = "";
  state.quantity = 1;

  el.noticeShipping.textContent = state.catalog.notices?.shipping || "";
  el.noticeExchange.textContent = state.catalog.notices?.exchange || "";
  el.noticeReturn.textContent = state.catalog.notices?.return || "";
  refreshPicker();
}

el.productSelect.addEventListener("change", () => {
  state.productId = el.productSelect.value;
  state.color = "";
  state.size = "";
  state.quantity = 1;
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

function pinCartBottom() {
  if (!el.cartSide || !el.cartAnchor) return;
  if (window.matchMedia("(max-width: 900px)").matches) {
    el.cartSide.style.left = "";
    el.cartSide.style.width = "";
    el.cartSide.style.bottom = "";
    el.cartSide.style.maxHeight = "";
    return;
  }

  const anchorRect = el.cartAnchor.getBoundingClientRect();
  const notices = document.querySelector(".card.notices");
  const noticesBottom = notices
    ? notices.getBoundingClientRect().bottom
    : window.innerHeight - 20;
  const bottomGap = Math.max(12, Math.round(window.innerHeight - noticesBottom));
  const maxHeight = Math.max(240, Math.round(noticesBottom - 20));

  el.cartSide.style.left = `${Math.round(anchorRect.left)}px`;
  el.cartSide.style.width = `${Math.round(anchorRect.width)}px`;
  el.cartSide.style.bottom = `${bottomGap}px`;
  el.cartSide.style.top = "auto";
  el.cartSide.style.right = "auto";
  el.cartSide.style.maxHeight = `${maxHeight}px`;
}

el.cartExpandBtn.addEventListener("click", () => {
  const expanded = el.layout.classList.toggle("cart-expanded");
  el.cartSide.classList.toggle("is-expanded", expanded);
  el.cartExpandBtn.setAttribute("aria-pressed", expanded ? "true" : "false");
  el.cartExpandBtn.textContent = expanded ? "축소" : "확대";
  requestAnimationFrame(pinCartBottom);
});

window.addEventListener("resize", pinCartBottom);
window.addEventListener("scroll", pinCartBottom, { passive: true });

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

  try {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      const detail = Array.isArray(data.detail)
        ? data.detail.map((d) => d.msg).join(", ")
        : data.detail;
      throw new Error(detail || "주문에 실패했습니다.");
    }

    el.toastBody.textContent = `${data.order.items.length}개 품목 · 합계 ${won(data.order.total)}`;
    el.toast.hidden = false;

    document.getElementById("name").value = "";
    document.getElementById("phone").value = "";
    addrEls.zonecode.value = "";
    addrEls.base.value = "";
    addrEls.detail.value = "";
    document.getElementById("memo").value = "";
    state.cart = [];
    await loadCatalog();
  } catch (err) {
    el.formError.textContent = err.message || "주문 중 오류가 발생했습니다.";
    el.formError.hidden = false;
  } finally {
    el.submitBtn.disabled = state.cart.length === 0;
    el.submitBtn.textContent = "주문완료";
  }
});

const noticeDetails = document.getElementById("noticeDetails");
if (noticeDetails) noticeDetails.open = false;

loadCatalog()
  .then(() => requestAnimationFrame(pinCartBottom))
  .catch((err) => {
    el.formError.textContent = err.message;
    el.formError.hidden = false;
  });
