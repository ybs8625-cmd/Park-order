from __future__ import annotations

from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any
from uuid import uuid4

import yaml
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
PRODUCTS_PATH = DATA_DIR / "products.yaml"
ORDERS_PATH = DATA_DIR / "orders.yaml"
KST = timezone(timedelta(hours=9))

app = FastAPI(title="Park Order")
app.mount("/static", StaticFiles(directory=ROOT / "static"), name="static")


def load_yaml(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    return data


def save_yaml(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        yaml.safe_dump(data, f, allow_unicode=True, sort_keys=False)


class OrderRequest(BaseModel):
    product_id: str
    color: str
    size: str
    quantity: int = Field(ge=1, le=99)
    name: str = Field(min_length=1, max_length=50)
    phone: str = Field(min_length=9, max_length=20)
    address: str = Field(min_length=5, max_length=200)
    memo: str = Field(default="", max_length=500)

    @field_validator("name", "phone", "address", "memo", mode="before")
    @classmethod
    def strip_text(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value


@app.get("/")
def index() -> FileResponse:
    return FileResponse(ROOT / "templates" / "index.html")


@app.get("/api/catalog")
def catalog() -> dict[str, Any]:
    return load_yaml(PRODUCTS_PATH)


@app.post("/api/orders")
def create_order(payload: OrderRequest) -> dict[str, Any]:
    catalog_data = load_yaml(PRODUCTS_PATH)
    products = catalog_data.get("products") or []
    product = next((p for p in products if p.get("id") == payload.product_id), None)
    if not product:
        raise HTTPException(status_code=400, detail="존재하지 않는 품목입니다.")

    color_ids = {c.get("id") for c in product.get("colors") or []}
    if payload.color not in color_ids:
        raise HTTPException(status_code=400, detail="선택할 수 없는 색상입니다.")

    size_ids = {s.get("id") for s in catalog_data.get("sizes") or []}
    if payload.size not in size_ids:
        raise HTTPException(status_code=400, detail="선택할 수 없는 사이즈입니다.")

    stock = ((product.get("stock") or {}).get(payload.color) or {}).get(payload.size, 0)
    if payload.quantity > stock:
        raise HTTPException(status_code=400, detail=f"남은 수량이 부족합니다. (남은 수량: {stock})")

    # Decrease stock
    product["stock"][payload.color][payload.size] = stock - payload.quantity
    save_yaml(PRODUCTS_PATH, catalog_data)

    unit_price = int(product.get("price") or 0)
    shipping_fee = int(catalog_data.get("shipping_fee") or 3500)
    item_total = unit_price * payload.quantity
    total = item_total + shipping_fee

    color_name = next(
        (c.get("name") for c in product.get("colors") or [] if c.get("id") == payload.color),
        payload.color,
    )
    size_label = next(
        (s.get("label") for s in catalog_data.get("sizes") or [] if s.get("id") == payload.size),
        payload.size,
    )

    order = {
        "id": str(uuid4()),
        "created_at": datetime.now(KST).isoformat(timespec="seconds"),
        "product_id": payload.product_id,
        "product_name": product.get("name"),
        "color": payload.color,
        "color_name": color_name,
        "size": payload.size,
        "size_label": size_label,
        "quantity": payload.quantity,
        "unit_price": unit_price,
        "item_total": item_total,
        "shipping_fee": shipping_fee,
        "total": total,
        "customer": {
            "name": payload.name,
            "phone": payload.phone,
            "address": payload.address,
            "memo": payload.memo,
        },
        "status": "배송요청완료",
    }

    orders_data = load_yaml(ORDERS_PATH)
    orders = orders_data.get("orders") or []
    orders.append(order)
    orders_data["orders"] = orders
    save_yaml(ORDERS_PATH, orders_data)

    return {
        "ok": True,
        "message": "배송요청이 완료 되었습니다.",
        "order": order,
    }
