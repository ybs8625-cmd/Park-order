const state = {
  catalog: null,
  productId: null,
  color: null,
  size: null,
  quantity: 1,
};

const el = {
  productGrid: document.getElementById("productGrid"),
  colorRow: document.getElementById("colorRow"),
  sizeRow: document.getElementById("sizeRow"),
  stockLine: document.getElementById("stockLine"),
  quantity: document.getElementById("quantity"),
  qtyMinus: document.getElementById("qtyMinus"),
  qtyPlus: document.getElementById("qtyPlus"),
  previewImage: document.getElementById("previewImage"),
  previewBrand: document.getElementById("previewBrand"),
  previewName: document.getElementById("previewName"),
  previewMeta: document.getElementById("previewMeta"),
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
  return product.stock?.[state.color]?.[state.size] ?? 0;
}

function currentColorImage() {
  const product = currentProduct();
  if (!product) return "/static/images/nike.svg";
  const color = (product.colors || []).find((c) => c.id === state.color);
  return color?.image || product.image;
}

function renderProducts() {
  el.productGrid.innerHTML = "";
  for (const product of state.catalog.products) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `product${product.id === state.productId ? " active" : ""}`;
    btn.innerHTML = `
      <img src="${product.image}" alt="${product.name}" />
      <p class="pname">${product.name}</p>
      <p class="pdesc">${product.description}</p>
      <p class="pprice">${won(product.price)}</p>
    `;
    btn.addEventListener("click", () => {
      state.productId = product.id;
      state.color = product.colors?.[0]?.id || null;
      state.size = state.catalog.sizes?.[0]?.id || null;
      state.quantity = 1;
      refreshOptions();
    });
    el.productGrid.appendChild(btn);
  }
}

function renderColors() {
  const product = currentProduct();
  el.colorRow.innerHTML = "";
  if (!product) return;
  for (const color of product.colors || []) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `chip${color.id === state.color ? " active" : ""}`;
    btn.textContent = color.name;
    btn.addEventListener("click", () => {
      state.color = color.id;
      state.quantity = 1;
      refreshOptions();
    });
    el.colorRow.appendChild(btn);
  }
}

function renderSizes() {
  el.sizeRow.innerHTML = "";
  for (const size of state.catalog.sizes || []) {
    const product = currentProduct();
    const stock = product?.stock?.[state.color]?.[size.id] ?? 0;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `chip${size.id === state.size ? " active" : ""}`;
    btn.textContent = size.label;
    btn.disabled = !product || stock <= 0;
    btn.addEventListener("click", () => {
      state.size = size.id;
      state.quantity = 1;
      refreshOptions();
    });
    el.sizeRow.appendChild(btn);
  }
}

function updateStockAndQty() {
  const stock = currentStock();
  el.stockLine.classList.remove("low", "empty");
  if (!state.productId || !state.color || !state.size) {
    el.stockLine.textContent = "남은 수량: -";
  } else if (stock <= 0) {
    el.stockLine.textContent = "남은 수량: 품절";
    el.stockLine.classList.add("empty");
  } else if (stock <= 3) {
    el.stockLine.textContent = `남은 수량: ${stock}개 (마감 임박)`;
    el.stockLine.classList.add("low");
  } else {
    el.stockLine.textContent = `남은 수량: ${stock}개`;
  }

  if (state.quantity > stock) state.quantity = Math.max(stock, 1);
  if (stock <= 0) state.quantity = 1;
  el.quantity.value = String(state.quantity);
  el.qtyMinus.disabled = state.quantity <= 1;
  el.qtyPlus.disabled = state.quantity >= stock || stock <= 0;
}

function updatePreviewAndSummary() {
  const product = currentProduct();
  const shipping = state.catalog.shipping_fee || 3500;
  el.shippingFee.textContent = won(shipping);

  if (!product) {
    el.previewBrand.textContent = "-";
    el.previewName.textContent = "품목을 선택해 주세요";
    el.previewMeta.textContent = "";
    el.previewImage.src = "/static/images/nike.svg";
    el.itemTotal.textContent = won(0);
    el.grandTotal.textContent = won(shipping);
    return;
  }

  const color = (product.colors || []).find((c) => c.id === state.color);
  const size = (state.catalog.sizes || []).find((s) => s.id === state.size);
  el.previewImage.src = currentColorImage();
  el.previewBrand.textContent = product.brand;
  el.previewName.textContent = product.name;
  el.previewMeta.textContent = `${color?.name || "-"} · ${size?.label || "-"} · ${state.quantity}개`;

  const itemTotal = product.price * state.quantity;
  el.itemTotal.textContent = won(itemTotal);
  el.grandTotal.textContent = won(itemTotal + shipping);
}

function refreshOptions() {
  renderProducts();
  renderColors();
  renderSizes();
  updateStockAndQty();
  updatePreviewAndSummary();
}

async function loadCatalog() {
  const res = await fetch("/api/catalog");
  if (!res.ok) throw new Error("카탈로그를 불러오지 못했습니다.");
  state.catalog = await res.json();
  state.productId = state.catalog.products?.[0]?.id || null;
  state.color = state.catalog.products?.[0]?.colors?.[0]?.id || null;
  state.size = state.catalog.sizes?.[0]?.id || null;

  el.noticeShipping.textContent = state.catalog.notices?.shipping || "";
  el.noticeExchange.textContent = state.catalog.notices?.exchange || "";
  el.noticeReturn.textContent = state.catalog.notices?.return || "";
  refreshOptions();
}

el.qtyMinus.addEventListener("click", () => {
  if (state.quantity > 1) {
    state.quantity -= 1;
    updateStockAndQty();
    updatePreviewAndSummary();
  }
});

el.qtyPlus.addEventListener("click", () => {
  const stock = currentStock();
  if (state.quantity < stock) {
    state.quantity += 1;
    updateStockAndQty();
    updatePreviewAndSummary();
  }
});

el.toastClose.addEventListener("click", () => {
  el.toast.hidden = true;
});

el.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  el.formError.hidden = true;

  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const address = document.getElementById("address").value.trim();
  const memo = document.getElementById("memo").value.trim();

  if (!state.productId || !state.color || !state.size) {
    el.formError.textContent = "품목, 색상, 사이즈를 선택해 주세요.";
    el.formError.hidden = false;
    return;
  }
  if (!name || !phone || !address) {
    el.formError.textContent = "이름, 연락처, 주소를 모두 입력해 주세요.";
    el.formError.hidden = false;
    return;
  }
  if (currentStock() < state.quantity) {
    el.formError.textContent = "남은 수량이 부족합니다. 옵션을 다시 확인해 주세요.";
    el.formError.hidden = false;
    return;
  }

  el.submitBtn.disabled = true;
  el.submitBtn.textContent = "접수 중…";

  try {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: state.productId,
        color: state.color,
        size: state.size,
        quantity: state.quantity,
        name,
        phone,
        address,
        memo,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "주문에 실패했습니다.");

    el.toastBody.textContent = `${data.order.product_name} / ${data.order.color_name} / ${data.order.size_label} · ${data.order.quantity}개 · 합계 ${won(data.order.total)}`;
    el.toast.hidden = false;

    document.getElementById("name").value = "";
    document.getElementById("phone").value = "";
    document.getElementById("address").value = "";
    document.getElementById("memo").value = "";
    state.quantity = 1;
    await loadCatalog();
  } catch (err) {
    el.formError.textContent = err.message || "주문 중 오류가 발생했습니다.";
    el.formError.hidden = false;
  } finally {
    el.submitBtn.disabled = false;
    el.submitBtn.textContent = "주문완료";
  }
});

loadCatalog().catch((err) => {
  el.formError.textContent = err.message;
  el.formError.hidden = false;
});
