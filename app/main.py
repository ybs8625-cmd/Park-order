from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

from app.admin_api import router as admin_router
from app.catalog_io import ORDERS_CSV, load_catalog, save_catalog
from app.csv_orders import append_order_csv

ROOT = Path(__file__).resolve().parent.parent
KST = timezone(timedelta(hours=9))


def load_dotenv() -> None:
    env_path = ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_dotenv()

app = FastAPI(title="Park Order")
app.include_router(admin_router)
app.mount("/static", StaticFiles(directory=ROOT / "static"), name="static")
app.mount("/admin", StaticFiles(directory=ROOT / "docs" / "admin", html=True), name="admin")


def push_order_to_github(order: dict[str, Any]) -> None:
    token = os.getenv("ORDER_WRITE_TOKEN", "").strip()
    owner = os.getenv("GITHUB_OWNER", "ybs8625-cmd").strip()
    repo = os.getenv("GITHUB_REPO", "Park-order").strip()
    if not token:
        return
    payload = json.dumps({"event_type": "park-order-submit", "client_payload": {"order": order}}).encode("utf-8")
    req = urllib.request.Request(
        f"https://api.github.com/repos/{owner}/{repo}/dispatches",
        data=payload,
        method="POST",
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "park-order",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            resp.read()
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise HTTPException(status_code=502, detail=f"GitHub 주문 저장 실패: {exc.code} {detail}") from exc


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


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"ok": "true", "service": "park-order"}


@app.get("/api/catalog")
def catalog() -> dict[str, Any]:
    return load_catalog()


@app.post("/api/orders")
def create_order(payload: OrderRequest) -> dict[str, Any]:
    catalog_data = load_catalog()
    products = catalog_data.get("products") or []
    shipping_fee = int(catalog_data.get("shipping_fee") or 3500)

    aggregated: dict[tuple[str, str, str], int] = {}
    for item in payload.items:
        key = (item.product_id, item.color, item.size)
        aggregated[key] = aggregated.get(key, 0) + item.quantity

    order_lines: list[dict[str, Any]] = []
    item_total = 0
    now = datetime.now(KST)
    order_id = now.strftime("%Y%m%d-%H%M%S") + "-" + str(uuid4())[:8]

    for (product_id, color, size), quantity in aggregated.items():
        product = next((p for p in products if p.get("id") == product_id), None)
        if not product:
            raise HTTPException(status_code=400, detail=f"존재하지 않는 품목입니다: {product_id}")

        color_ids = {c.get("id") for c in product.get("colors") or []}
        if color not in color_ids:
            raise HTTPException(status_code=400, detail=f"선택할 수 없는 색상입니다: {product.get('name')}")

        size_ids = {s.get("id") for s in (product.get("sizes") or catalog_data.get("default_sizes") or [])}
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
            (
                s.get("label")
                for s in (product.get("sizes") or catalog_data.get("default_sizes") or [])
                if s.get("id") == size
            ),
            size,
        )

        order_lines.append(
            {
                "품목": f"{product.get('brand')} · {product.get('name')}",
                "색상": color_name,
                "사이즈": size_label,
                "수량": quantity,
                "단가": unit_price,
                "금액": line_total,
            }
        )

    save_catalog(catalog_data)

    order = {
        "주문번호": order_id,
        "주문시간": now.strftime("%Y-%m-%d %H:%M:%S"),
        "상태": "주문완료",
        "주문자": {
            "이름": payload.name,
            "연락처": payload.phone,
            "주소": payload.address,
            "메모": payload.memo or "-",
        },
        "주문내용": order_lines,
        "상품합계": item_total,
        "배송비": shipping_fee,
        "결제합계": item_total + shipping_fee,
    }

    append_order_csv(ORDERS_CSV, order)
    push_order_to_github(order)

    return {
        "ok": True,
        "message": "주문이 정상적으로 완료 되었습니다.\n판매자가 연락 드리겠습니다.",
        "order": order,
    }
