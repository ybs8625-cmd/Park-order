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


class CartItem(BaseModel):
    product_id: str
    color: str
    size: str
    quantity: int = Field(ge=1, le=99)


class OrderRequest(BaseModel):
    items: list[CartItem] = Field(min_length=1)
    name: str = Field(min_length=1, max_length=50)
    phone: str = Field(min_length=9, max_length=20)
    address: str = Field(min_length=5, max_length=300)
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
    size_ids = {s.get("id") for s in catalog_data.get("sizes") or []}
    shipping_fee = int(catalog_data.get("shipping_fee") or 3500)

    # Aggregate same SKU quantities first
    aggregated: dict[tuple[str, str, str], int] = {}
    for item in payload.items:
        key = (item.product_id, item.color, item.size)
        aggregated[key] = aggregated.get(key, 0) + item.quantity

    order_items: list[dict[str, Any]] = []
    item_total = 0

    for (product_id, color, size), quantity in aggregated.items():
        product = next((p for p in products if p.get("id") == product_id), None)
        if not product:
            raise HTTPException(status_code=400, detail=f"존재하지 않는 품목입니다: {product_id}")

        color_ids = {c.get("id") for c in product.get("colors") or []}
        if color not in color_ids:
            raise HTTPException(status_code=400, detail=f"선택할 수 없는 색상입니다: {product.get('name')}")
        if size not in size_ids:
            raise HTTPException(status_code=400, detail=f"선택할 수 없는 사이즈입니다: {size}")

        stock = ((product.get("stock") or {}).get(color) or {}).get(size, 0)
        if quantity > stock:
            raise HTTPException(
                status_code=400,
                detail=f"{product.get('name')} 남은 수량이 부족합니다. (남은 수량: {stock})",
            )

        product["stock"][color][size] = stock - quantity

        unit_price = int(product.get("price") or 0)
        line_total = unit_price * quantity
        item_total += line_total

        color_name = next(
            (c.get("name") for c in product.get("colors") or [] if c.get("id") == color),
            color,
        )
        size_label = next(
            (s.get("label") for s in catalog_data.get("sizes") or [] if s.get("id") == size),
            size,
        )

        order_items.append(
            {
                "product_id": product_id,
                "product_name": product.get("name"),
                "brand": product.get("brand"),
                "color": color,
                "color_name": color_name,
                "size": size,
                "size_label": size_label,
                "quantity": quantity,
                "unit_price": unit_price,
                "line_total": line_total,
            }
        )

    save_yaml(PRODUCTS_PATH, catalog_data)

    order = {
        "id": str(uuid4()),
        "created_at": datetime.now(KST).isoformat(timespec="seconds"),
        "items": order_items,
        "item_total": item_total,
        "shipping_fee": shipping_fee,
        "total": item_total + shipping_fee,
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
