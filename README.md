# Park Order

박사장네 의류 주문 요청서 웹페이지입니다.

## 접속

- **웹 페이지:** https://ybs8625-cmd.github.io/Park-order/
- **저장소:** https://github.com/ybs8625-cmd/Park-order
- **주문 YAML:** https://github.com/ybs8625-cmd/Park-order/blob/master/data/orders.yaml

## 주문을 GitHub에 남기기

웹에서 주문이 `data/orders.yaml`에 자동 커밋되려면 저장소 Secret이 필요합니다.

1. GitHub → Settings → Developer settings → Personal access tokens  
   - Classic token 권장, 권한: `repo`
2. 저장소 `Park-order` → Settings → Secrets and variables → Actions  
   - Name: `ORDER_WRITE_TOKEN`  
   - Value: 방금 만든 토큰
3. 푸시 후 Pages가 다시 배포되면 웹 주문도 GitHub YAML에 쌓입니다.

로컬 서버도 `.env`에 같은 토큰을 넣으면 GitHub로 동기화됩니다.

## 로컬 실행 (YAML 저장)

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8010
```

또는 `run.bat` 실행 후 http://127.0.0.1:8010 접속.  
로컬에서는 주문이 `data/orders.yaml`에 저장됩니다.

## 구성

- `docs/` — GitHub Pages 배포용 정적 페이지
- `templates/index.html` — 로컬 FastAPI UI
- `static/` — 로컬 스타일/스크립트/이미지
- `data/products.yaml` — 품목, 가격, 재고, 안내문
- `data/orders.yaml` — 로컬 주문 목록
- `app/main.py` — FastAPI 서버

## 상품 이미지 교체

`static/images/` 와 `docs/images/` 이미지를 교체하고,  
`data/products.yaml` / `docs/data/products.json` 경로를 맞춰 주세요.
