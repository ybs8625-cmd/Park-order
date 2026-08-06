from __future__ import annotations

import csv
from pathlib import Path
from typing import Any

CSV_HEADERS = [
    "주문번호",
    "주문시간",
    "상태",
    "이름",
    "연락처",
    "주소",
    "메모",
    "품목",
    "색상",
    "사이즈",
    "수량",
    "단가",
    "금액",
    "상품합계",
    "배송비",
    "결제합계",
]


def order_to_rows(order: dict[str, Any]) -> list[dict[str, Any]]:
    customer = order.get("주문자") or {}
    lines = order.get("주문내용") or []
    rows: list[dict[str, Any]] = []
    for line in lines:
        rows.append(
            {
                "주문번호": order.get("주문번호", ""),
                "주문시간": order.get("주문시간", ""),
                "상태": order.get("상태", ""),
                "이름": customer.get("이름", ""),
                "연락처": customer.get("연락처", ""),
                "주소": customer.get("주소", ""),
                "메모": customer.get("메모", ""),
                "품목": line.get("품목", ""),
                "색상": line.get("색상", ""),
                "사이즈": line.get("사이즈", ""),
                "수량": line.get("수량", ""),
                "단가": line.get("단가", ""),
                "금액": line.get("금액", ""),
                "상품합계": order.get("상품합계", ""),
                "배송비": order.get("배송비", ""),
                "결제합계": order.get("결제합계", ""),
            }
        )
    return rows


def append_order_csv(path: Path, order: dict[str, Any]) -> int:
    """Append order line-items to CSV. Returns number of rows written."""
    path.parent.mkdir(parents=True, exist_ok=True)
    rows = order_to_rows(order)
    if not rows:
        return 0

    order_id = str(order.get("주문번호") or "")
    existing_ids: set[str] = set()
    file_exists = path.exists() and path.stat().st_size > 0
    if file_exists:
        with path.open("r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                oid = (row.get("주문번호") or "").strip()
                if oid:
                    existing_ids.add(oid)
        if order_id and order_id in existing_ids:
            return 0

    with path.open("a", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_HEADERS)
        if not file_exists:
            writer.writeheader()
        writer.writerows(rows)
    return len(rows)
