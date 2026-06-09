# 포토 저널 · Photo Journal

> 사진으로 하루를 저장하고, 달력으로 다시 보고, 화면 위에 띄우고, 월말엔 영상과 일기장으로 꺼내는 **개인 기억 아카이브**.

캘린더가 메인 캔버스인 시각 저널 웹앱(PWA). 빌드 도구 없이 순수 HTML/CSS/JS(ES modules)로 동작하며, 데이터는 브라우저 `localStorage`에 저장됩니다.

## 기능
- **월간 캘린더 홈** — 날짜별 대표사진이 박힌 시각적 타임라인, 스트릭, On This Day
- **하루 기록** — 대표사진 1 + 보조 3, 오늘 한 줄·짧은 회고·감정·태그·메모 (사진 자동 다운스케일)
- **하루 카드** — 포스터 / 종이 일기장 / 미니멀 3종 템플릿, PNG 내보내기
- **연간 보기** — 12개 미니 캘린더로 한 해를 한눈에
- **월간·연간 리캡** — 대표사진 슬라이드
- **검색** — 글·태그·감정
- **포스터 export** — 월간·연간 캘린더를 배경화면용 이미지로
- **리마인더 · 앱 잠금 · 백업(JSON)**
- **PWA** — 홈 화면 설치, 오프라인 동작

## 로컬 실행
```bash
python serve.py 8753
# http://127.0.0.1:8753
```
> `serve.py`는 ES 모듈 캐시 문제를 피하기 위해 no-store 헤더를 보냅니다.

## 배포 (GitHub Pages)
`main`에 푸시하면 `.github/workflows/deploy.yml`이 자동으로 GitHub Pages에 배포합니다.
저장소 **Settings → Pages → Source: GitHub Actions** 한 번만 설정하면 됩니다.
배포 주소: `https://<사용자명>.github.io/<저장소명>/`

모든 경로가 상대경로라 하위 경로(`/저장소명/`)에서도 정상 동작합니다.

## 폰에 설치
HTTPS 주소(위 Pages URL)를 폰 브라우저로 열고:
- **Android(Chrome):** 메뉴 → "앱 설치"
- **iPhone(Safari):** 공유 □↑ → "홈 화면에 추가"

## 문서
- `docs/prd.md` — 제품 정의
- `docs/data-model.md` — 데이터 모델
- `docs/screen-spec.md` — 화면 사양 & 디자인 토큰

## 라이선스 / 상태
개인 프로젝트 MVP 프로토타입. 향후 Supabase 동기화, iOS SwiftUI 네이티브 이식 예정.
