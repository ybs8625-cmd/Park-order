"""Generate product placeholder SVGs and rebuild clean product image fields."""
from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
STATIC = ROOT / "static" / "images"
DOCS = ROOT / "docs" / "images"
YAML_PATH = ROOT / "data" / "products.yaml"
JSON_PATH = ROOT / "docs" / "data" / "products.json"

BRAND_COLORS = {
    "NIKE": ("#1f2933", "#0f766e"),
    "ADIDAS": ("#1e3a5f", "#c2410c"),
}

KIND_LABEL = {
    "tee": "TEE",
    "hoodie": "HOODIE",
    "polo": "POLO",
    "shorts": "SHORTS",
    "pants": "PANTS",
}


def kind_of(product_id: str) -> str:
    for key in KIND_LABEL:
        if key in product_id:
            return key
    return "tee"


def svg_for(brand: str, kind: str, variant: str) -> str:
    c1, c2 = BRAND_COLORS.get(brand, ("#334155", "#0f766e"))
    if variant == "dark":
        c1, c2 = "#111827", c1
    elif variant == "light":
        c1, c2 = "#e8eef0", "#94a3b8"
    text_fill = "#0f1c24" if variant == "light" else "#ffffff"
    accent = "#0f766e" if brand == "NIKE" else "#ea580c"
    if variant == "light":
        accent = c2
    label = KIND_LABEL.get(kind, "ITEM")
    # Simple clothing silhouette hints by kind
    if kind == "hoodie":
        shape = '<path d="M220 210c40-70 160-70 200 0l30 40v170H190V250z" fill="rgba(255,255,255,0.18)"/>'
    elif kind == "polo":
        shape = '<path d="M250 200h140l40 40v180H210V240z" fill="rgba(255,255,255,0.18)"/><path d="M290 200l30 35 30-35" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="10"/>'
    elif kind == "shorts":
        shape = '<path d="M210 250h220v80l-50 90h-50l-10-70-10 70h-50l-50-90z" fill="rgba(255,255,255,0.18)"/>'
    elif kind == "pants":
        shape = '<path d="M240 180h160l20 320h-70l-30-200-30 200h-70z" fill="rgba(255,255,255,0.18)"/>'
    else:
        shape = '<path d="M230 200h180l35 40v200H195V240z" fill="rgba(255,255,255,0.18)"/>'

    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640" role="img" aria-label="{brand} {label}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="{c1}"/>
      <stop offset="100%" stop-color="{c2}"/>
    </linearGradient>
  </defs>
  <rect width="640" height="640" rx="48" fill="url(#g)"/>
  {shape}
  <circle cx="520" cy="120" r="48" fill="{accent}" opacity="0.9"/>
  <text x="48" y="88" fill="{text_fill}" font-family="Arial, sans-serif" font-size="34" font-weight="700" letter-spacing="3">{brand}</text>
  <text x="48" y="560" fill="{text_fill}" font-family="Arial, sans-serif" font-size="42" font-weight="700">{label}</text>
  <text x="48" y="598" fill="{text_fill}" font-family="Arial, sans-serif" font-size="20" opacity="0.8">{variant.upper()}</text>
</svg>
'''


def write_svg(name: str, content: str) -> None:
    STATIC.mkdir(parents=True, exist_ok=True)
    DOCS.mkdir(parents=True, exist_ok=True)
    (STATIC / name).write_text(content, encoding="utf-8")
    (DOCS / name).write_text(content, encoding="utf-8")


def to_docs_paths(obj):
    if isinstance(obj, dict):
        return {k: to_docs_paths(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [to_docs_paths(x) for x in obj]
    if isinstance(obj, str) and obj.startswith("/static/"):
        return "./" + obj[len("/static/") :]
    return obj


def main() -> None:
    data = yaml.safe_load(YAML_PATH.read_text(encoding="utf-8"))
    products = data.get("products") or []

    # Remove broken upload files if present locally
    for folder in (STATIC, DOCS):
        for p in folder.glob("upload-*"):
            p.unlink(missing_ok=True)

    for product in products:
        pid = product["id"]
        brand = product.get("brand") or "NIKE"
        kind = kind_of(pid)
        names = [f"{pid}.svg", f"{pid}-alt.svg", f"{pid}-detail.svg"]
        variants = ["main", "dark", "light"]
        for name, variant in zip(names, variants):
            write_svg(name, svg_for(brand, kind, variant))

        local_paths = [f"/static/images/{n}" for n in names]
        product["image"] = local_paths[0]
        product["images"] = local_paths

        # Keep only black/white colors with matching dark/light thumbs
        colors = []
        for c in product.get("colors") or []:
            if c.get("id") not in {"black", "white"}:
                continue
            colors.append(
                {
                    "id": c["id"],
                    "name": c.get("name") or ("블랙" if c["id"] == "black" else "화이트"),
                    "image": local_paths[1] if c["id"] == "black" else local_paths[2],
                }
            )
        if not colors:
            colors = [
                {"id": "black", "name": "블랙", "image": local_paths[1]},
                {"id": "white", "name": "화이트", "image": local_paths[2]},
            ]
        product["colors"] = colors

        # Keep stock only for remaining colors
        old_stock = product.get("stock") or {}
        size_ids = [s["id"] for s in (product.get("sizes") or [])] or ["S", "M", "L", "XL", "XXL"]
        new_stock = {}
        for cid in ("black", "white"):
            src = old_stock.get(cid) or {}
            new_stock[cid] = {sid: int(src.get(sid, 5)) for sid in size_ids}
        product["stock"] = new_stock

    YAML_PATH.write_text(
        yaml.safe_dump(data, allow_unicode=True, sort_keys=False, default_flow_style=False, width=120),
        encoding="utf-8",
    )
    JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    JSON_PATH.write_text(
        json.dumps(to_docs_paths(deepcopy(data)), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"updated {len(products)} products")
    for p in products:
        print(p["id"], "->", len(p["images"]), "images")


if __name__ == "__main__":
    main()
