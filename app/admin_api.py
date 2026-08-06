from __future__ import annotations

import base64
import csv
import io
import json
import os
import re
import secrets
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, File, Header, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.catalog_io import (
    DOCS_IMAGES,
    ORDERS_CSV,
    STATIC_IMAGES,
    load_admin,
    load_catalog,
    save_admin,
    save_catalog,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])
SESSIONS: dict[str, float] = {}


class LoginBody(BaseModel):
    username: str
    password: str


class PasswordBody(BaseModel):
    current_password: str
    new_password: str = Field(min_length=4, max_length=50)


class ProductBody(BaseModel):
    id: str | None = None
    name: str
    brand: str
    price: int
    description: str = ""
    image: str = ""
    images: list[str] = Field(default_factory=list)
    colors: list[dict[str, Any]] = Field(default_factory=list)
    sizes: list[dict[str, Any]] = Field(default_factory=list)
    stock: dict[str, dict[str, int]] = Field(default_factory=dict)


def require_auth(authorization: str | None) -> None:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    token = authorization.removeprefix("Bearer ").strip()
    if token not in SESSIONS:
        raise HTTPException(status_code=401, detail="세션이 만료되었습니다. 다시 로그인해 주세요.")


def slugify(text: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9가-힣]+", "-", text.strip().lower())
    value = re.sub(r"-+", "-", value).strip("-")
    return value or f"item-{uuid4().hex[:8]}"


def github_put_file(path: str, content: str, message: str) -> None:
    token = os.getenv("ORDER_WRITE_TOKEN", "").strip()
    owner = os.getenv("GITHUB_OWNER", "ybs8625-cmd").strip()
    repo = os.getenv("GITHUB_REPO", "Park-order").strip()
    if not token:
        return

    api = f"https://api.github.com/repos/{owner}/{repo}/contents/{path}"
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "park-order-admin",
    }
    sha = None
    try:
        req = urllib.request.Request(api, headers=headers)
        with urllib.request.urlopen(req, timeout=20) as resp:
            meta = json.loads(resp.read().decode("utf-8"))
            sha = meta.get("sha")
    except urllib.error.HTTPError as exc:
        if exc.code != 404:
            raise

    body: dict[str, Any] = {
        "message": message,
        "content": base64.b64encode(content.encode("utf-8")).decode("ascii"),
        "branch": "master",
    }
    if sha:
        body["sha"] = sha
    req = urllib.request.Request(
        api,
        data=json.dumps(body).encode("utf-8"),
        method="PUT",
        headers={**headers, "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        resp.read()


def sync_catalog_to_github() -> None:
    from app.catalog_io import PRODUCTS_JSON, PRODUCTS_YAML

    if PRODUCTS_YAML.exists():
        github_put_file("data/products.yaml", PRODUCTS_YAML.read_text(encoding="utf-8"), "Update products.yaml from admin")
    if PRODUCTS_JSON.exists():
        github_put_file(
            "docs/data/products.json",
            PRODUCTS_JSON.read_text(encoding="utf-8"),
            "Update products.json from admin",
        )


def sync_admin_to_github() -> None:
    from app.catalog_io import ADMIN_PATH

    if ADMIN_PATH.exists():
        github_put_file("data/admin.json", ADMIN_PATH.read_text(encoding="utf-8"), "Update admin credentials")


@router.post("/login")
def login(body: LoginBody) -> dict[str, Any]:
    admin = load_admin()
    if body.username != admin.get("username") or body.password != admin.get("password"):
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다.")
    token = secrets.token_urlsafe(24)
    SESSIONS[token] = datetime.now().timestamp()
    return {"ok": True, "token": token, "username": admin.get("username")}


@router.get("/me")
def me(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    require_auth(authorization)
    admin = load_admin()
    return {"ok": True, "username": admin.get("username")}


@router.post("/password")
def change_password(body: PasswordBody, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    require_auth(authorization)
    admin = load_admin()
    if body.current_password != admin.get("password"):
        raise HTTPException(status_code=400, detail="현재 비밀번호가 올바르지 않습니다.")
    admin["password"] = body.new_password
    save_admin(admin)
    try:
        sync_admin_to_github()
    except Exception:
        pass
    return {"ok": True, "message": "비밀번호가 변경되었습니다."}


@router.get("/orders")
def list_orders(
    date_from: str = "",
    date_to: str = "",
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    require_auth(authorization)
    rows = _read_orders(date_from, date_to)
    return {"ok": True, "rows": rows}


@router.get("/orders/download")
def download_orders(
    date_from: str = "",
    date_to: str = "",
    authorization: str | None = Header(default=None),
) -> StreamingResponse:
    require_auth(authorization)
    rows = _read_orders(date_from, date_to)
    buf = io.StringIO()
    if rows:
        writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    else:
        buf.write("주문번호,주문시간,상태,이름,연락처,주소,메모,품목,색상,사이즈,수량,단가,금액,상품합계,배송비,결제합계\n")
    data = ("\ufeff" + buf.getvalue()).encode("utf-8")
    filename = f"orders_{date_from or 'all'}_{date_to or 'all'}.csv"
    return StreamingResponse(
        io.BytesIO(data),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _read_orders(date_from: str, date_to: str) -> list[dict[str, str]]:
    if not ORDERS_CSV.exists():
        return []
    rows: list[dict[str, str]] = []
    with ORDERS_CSV.open("r", encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            order_time = (row.get("주문시간") or "")[:10]
            if date_from and order_time and order_time < date_from:
                continue
            if date_to and order_time and order_time > date_to:
                continue
            rows.append(row)
    return rows


@router.get("/products")
def list_products(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    require_auth(authorization)
    catalog = load_catalog()
    return {
        "ok": True,
        "shipping_fee": catalog.get("shipping_fee", 3500),
        "default_sizes": catalog.get("default_sizes") or catalog.get("sizes") or [],
        "products": catalog.get("products") or [],
    }


@router.post("/products")
def create_product(body: ProductBody, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    require_auth(authorization)
    catalog = load_catalog()
    products = catalog.get("products") or []
    product_id = body.id or slugify(f"{body.brand}-{body.name}")
    if any(p.get("id") == product_id for p in products):
        product_id = f"{product_id}-{uuid4().hex[:4]}"
    product = {
        "id": product_id,
        "name": body.name,
        "brand": body.brand,
        "price": int(body.price),
        "description": body.description,
        "image": body.image or "/static/images/nike.svg",
        "images": body.images or ([body.image] if body.image else ["/static/images/nike.svg"]),
        "colors": body.colors or [{"id": "black", "name": "블랙", "image": "/static/images/nike-black.svg"}],
        "sizes": body.sizes or catalog.get("default_sizes") or [],
        "stock": body.stock or {},
    }
    products.append(product)
    catalog["products"] = products
    save_catalog(catalog)
    try:
        sync_catalog_to_github()
    except Exception:
        pass
    return {"ok": True, "product": product}


@router.put("/products/{product_id}")
def update_product(
    product_id: str,
    body: ProductBody,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    require_auth(authorization)
    catalog = load_catalog()
    products = catalog.get("products") or []
    idx = next((i for i, p in enumerate(products) if p.get("id") == product_id), -1)
    if idx < 0:
        raise HTTPException(status_code=404, detail="상품을 찾을 수 없습니다.")
    products[idx] = {
        **products[idx],
        "name": body.name,
        "brand": body.brand,
        "price": int(body.price),
        "description": body.description,
        "image": body.image or products[idx].get("image"),
        "images": body.images if body.images is not None else products[idx].get("images") or [],
        "colors": body.colors,
        "sizes": body.sizes,
        "stock": body.stock,
    }
    catalog["products"] = products
    save_catalog(catalog)
    try:
        sync_catalog_to_github()
    except Exception:
        pass
    return {"ok": True, "product": products[idx]}


@router.delete("/products/{product_id}")
def delete_product(product_id: str, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    require_auth(authorization)
    catalog = load_catalog()
    products = catalog.get("products") or []
    next_products = [p for p in products if p.get("id") != product_id]
    if len(next_products) == len(products):
        raise HTTPException(status_code=404, detail="상품을 찾을 수 없습니다.")
    catalog["products"] = next_products
    save_catalog(catalog)
    try:
        sync_catalog_to_github()
    except Exception:
        pass
    return {"ok": True}


@router.post("/upload")
async def upload_image(
    file: UploadFile = File(...),
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    require_auth(authorization)
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="빈 파일입니다.")
    if len(raw) > 3 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="이미지는 3MB 이하만 가능합니다.")

    original = file.filename or "image.png"
    ext = Path(original).suffix.lower() or ".png"
    if ext not in {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"}:
        raise HTTPException(status_code=400, detail="지원하지 않는 이미지 형식입니다.")

    name = f"upload-{uuid4().hex[:10]}{ext}"
    STATIC_IMAGES.mkdir(parents=True, exist_ok=True)
    DOCS_IMAGES.mkdir(parents=True, exist_ok=True)
    (STATIC_IMAGES / name).write_bytes(raw)
    (DOCS_IMAGES / name).write_bytes(raw)

    # GitHub에도 이미지 업로드
    token = os.getenv("ORDER_WRITE_TOKEN", "").strip()
    if token:
        b64 = base64.b64encode(raw).decode("ascii")
        for path in (f"static/images/{name}", f"docs/images/{name}"):
            try:
                _github_put_binary(path, b64, f"Upload product image {name}")
            except Exception:
                pass

    return {
        "ok": True,
        "local_path": f"/static/images/{name}",
        "docs_path": f"./images/{name}",
        "filename": name,
    }


def _github_put_binary(path: str, content_b64: str, message: str) -> None:
    token = os.getenv("ORDER_WRITE_TOKEN", "").strip()
    owner = os.getenv("GITHUB_OWNER", "ybs8625-cmd").strip()
    repo = os.getenv("GITHUB_REPO", "Park-order").strip()
    api = f"https://api.github.com/repos/{owner}/{repo}/contents/{path}"
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "park-order-admin",
        "Content-Type": "application/json",
    }
    sha = None
    try:
        req = urllib.request.Request(api, headers=headers)
        with urllib.request.urlopen(req, timeout=20) as resp:
            sha = json.loads(resp.read().decode("utf-8")).get("sha")
    except urllib.error.HTTPError as exc:
        if exc.code != 404:
            raise
    body: dict[str, Any] = {"message": message, "content": content_b64, "branch": "master"}
    if sha:
        body["sha"] = sha
    req = urllib.request.Request(api, data=json.dumps(body).encode("utf-8"), method="PUT", headers=headers)
    with urllib.request.urlopen(req, timeout=30) as resp:
        resp.read()
