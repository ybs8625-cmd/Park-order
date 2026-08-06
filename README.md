# Park Order

의류 주문 요청서 웹페이지입니다.  
품목 · 색상 · 사이즈 · 수량을 선택하고 배송 정보를 입력하면 주문이 `data/orders.yaml`에 저장됩니다.

## 실행

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8010
```

또는 `run.bat` 실행 후 [http://127.0.0.1:8010](http://127.0.0.1:8010) 접속.

## 구성

- `templates/index.html` — 주문 요청서 UI
- `static/` — 스타일, 스크립트, 상품 이미지
- `data/products.yaml` — 품목, 가격, 재고, 안내문
- `data/orders.yaml` — 접수된 주문 목록
- `app/main.py` — FastAPI 서버

## 상품 이미지 교체

`static/images/` 폴더의 SVG/이미지를 교체하고, `data/products.yaml`의 `image` 경로만 맞춰 주면 됩니다.
