# 데이터 모델

원본 엔트리와 **파생 결과물(generated outputs)** 을 분리한다. 하루 엔트리는 원본 데이터고, 하루 카드 이미지·월간 리캡은 파생물이므로 재생성·캐시가 쉬워야 한다.

웹 프로토타입은 `localStorage` 단일 키(`pj.v1`)에 아래 구조를 JSON으로 저장한다. 네이티브 이식 시 Supabase Postgres 테이블로 1:1 매핑된다.

## 엔티티

### journal
| 필드 | 타입 | 설명 |
|---|---|---|
| id | string | 저널 id (MVP는 단일 기본 저널 `default`) |
| title | string | 저널 이름 |
| createdAt | ISO | 생성 시각 |

### dayEntry  (Supabase: `day_entries`)
| 필드 | 타입 | 설명 |
|---|---|---|
| date | string(YYYY-MM-DD) | **PK**, 하루 1엔트리 |
| journalId | string | 소속 저널 |
| oneLine | string | 오늘 한 줄 |
| reflection | string | 짧은 회고 |
| emotion | string\|null | 감정 키 (joy/calm/neutral/sad/tired/love…) |
| tags | string[] | 태그 |
| memo | string | 선택 메모 |
| repAssetId | string\|null | 대표사진 asset id |
| assetIds | string[] | 대표 포함 전체 사진(최대 4) |
| createdAt / updatedAt | ISO | |

### asset  (Supabase: `entry_assets` + Storage)
| 필드 | 타입 | 설명 |
|---|---|---|
| id | string | asset id |
| date | string | 소속 엔트리 |
| dataUrl | string | 다운스케일된 이미지(JPEG, 최대 1280px) — 네이티브에선 Storage URL |
| w / h | number | 원본 해상도 |
| createdAt | ISO | |

### generatedOutput  (Supabase: `generated_outputs`)
하루 카드/리캡은 **요청 시 캔버스로 즉석 생성**(파생물)하므로 프로토타입에선 영속 저장하지 않는다. 마지막 선택 템플릿만 엔트리에 `cardTemplate`로 캐시.

## 무결성 규칙
- `date`는 엔트리의 PK. 같은 날 재작성은 upsert.
- `repAssetId`는 반드시 `assetIds`에 포함. 대표 삭제 시 첫 번째 사진으로 승계.
- 엔트리 삭제 시 소속 asset 동반 삭제.

## 저장 용량 전략
브라우저 localStorage(~5MB) 한계 → 사진 import 시 클라이언트에서 **최대 1280px·JPEG q0.8로 다운스케일** 후 dataURL 저장. 셀 썸네일은 별도 저장하지 않고 대표 dataURL을 CSS로 축소 표시.
