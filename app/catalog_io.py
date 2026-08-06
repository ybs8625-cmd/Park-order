from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
PRODUCTS_YAML = DATA_DIR / "products.yaml"
PRODUCTS_JSON = ROOT / "docs" / "data" / "products.json"
ADMIN_PATH = DATA_DIR / "admin.json"
ORDERS_CSV = DATA_DIR / "orders.csv"
STATIC_IMAGES = ROOT / "static" / "images"
DOCS_IMAGES = ROOT / "docs" / "images"

DEFAULT_SIZES = [
    {"id": "S", "label": "S (90)"},
    {"id": "M", "label": "M (95)"},
    {"id": "L", "label": "L (100)"},
    {"id": "XL", "label": "XL (105)"},
    {"id": "XXL", "label": "XXL (110)"},
]


def load_yaml(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def save_yaml(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        yaml.safe_dump(data, f, allow_unicode=True, sort_keys=False, default_flow_style=False, width=120)


def to_docs_paths(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: to_docs_paths(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [to_docs_paths(x) for x in obj]
    if isinstance(obj, str) and obj.startswith("/static/"):
        return "./" + obj[len("/static/") :]
    return obj


def to_local_paths(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: to_local_paths(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [to_local_paths(x) for x in obj]
    if isinstance(obj, str) and obj.startswith("./"):
        return "/static/" + obj[2:]
    return obj


def load_catalog() -> dict[str, Any]:
    data = load_yaml(PRODUCTS_YAML)
    if not data.get("default_sizes"):
        data["default_sizes"] = deepcopy(data.get("sizes") or DEFAULT_SIZES)
    for product in data.get("products") or []:
        if not product.get("sizes"):
            product["sizes"] = deepcopy(data["default_sizes"])
    return data


def save_catalog(data: dict[str, Any]) -> None:
    save_yaml(PRODUCTS_YAML, data)
    PRODUCTS_JSON.parent.mkdir(parents=True, exist_ok=True)
    PRODUCTS_JSON.write_text(
        json.dumps(to_docs_paths(deepcopy(data)), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def load_admin() -> dict[str, str]:
    if not ADMIN_PATH.exists():
        ADMIN_PATH.write_text(
            json.dumps({"username": "admin", "password": "1234"}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    return json.loads(ADMIN_PATH.read_text(encoding="utf-8"))


def save_admin(data: dict[str, str]) -> None:
    ADMIN_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
