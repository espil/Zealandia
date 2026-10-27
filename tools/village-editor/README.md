# 마을 맵 에디터 (Village Map Editor) v3

RPG 메이커처럼 마을을 직접 배치하는 웹 에디터입니다. 배경은 도시가 보이지 않는 지형 이미지이고, 그 위에 얹을 **타일(땅 분류)과 2D 스프라이트 배치, 스폰 구역**을 설계합니다. 결과는 JSON으로 내보내 게임에 전달합니다.

v3부터는 게임의 전 맵이 미리 제작되어 있습니다. 위쪽 바의 **맵 선택**에서 마을 7곳, 마을 사이맵 9곳, 던전 3곳을 바로 골라 열 수 있고, 맵마다 전용 지형 배경과 그 맵에 맞는 팔레트, 별도 자동 저장이 붙습니다.

## 여는 법

`file://`로 직접 열면 팔레트(`sprites.json`)를 불러오지 못합니다. 반드시 로컬 서버로 여세요.

```powershell
cd village-editor
python -m http.server 8000
```

브라우저에서 `http://localhost:8000` 접속.

## 화면 구성

- **위쪽 바**: 맵 선택, 맵 이름(id) 입력, 전체 보기 / 100% 버튼, 배경(지형) 투명도, 격자 켜기/끄기, 가져오기, 내보내기(JSON), 전부 지우기
- **왼쪽 패널**: 도구, 타일 종류, 셀 크기, 스폰 구역 종류, 스프라이트 팔레트, 사용법
- **가운데**: 지도 캔버스
- **오른쪽 패널**: 선택한 스프라이트 정보(너비 조절, 삭제), 배치 목록, 스폰 구역 목록
- **아래 상태바**: 커서의 월드 좌표(m), 줌 배율, 타일/배치/구역 개수, 현재 도구

## 좌표계

- 배경 지형 이미지는 1024×1024 px입니다. 실제 범위는 맵 종류마다 다릅니다. 마을 **600 m × 600 m**, 사이맵 **400 m × 400 m**, 던전 **300 m × 300 m**로, 에버플래닛 규모의 맵 한 장 크기입니다.
- 이미지의 **중심이 원점 (0, 0)** 입니다. x는 동쪽(+), y는 남쪽(+, 화면 아래)입니다.
- 자동 저장은 맵별로 분리됩니다. 맵을 오가도 각 맵의 작업이 섞이지 않습니다.
- 타일 셀 인덱스 `(cx, cy)`는 월드 좌표를 셀 크기로 나눈 값입니다. 예: 셀 크기 10 m에서 셀 `(3, -2)`는 x 30~40 m, y -20~-10 m 구간.

## 도구 사용법

| 도구 | 사용법 |
|---|---|
| 선택 (V) | 스프라이트 클릭 선택, 드래그로 이동, Delete 키로 삭제. 오른쪽 패널 슬라이더로 너비 조절 (비율 자동 유지) |
| 이동 (H) | 드래그로 화면 이동. 어느 도구에서든 **스페이스+드래그**, 마우스 가운데/오른쪽 드래그도 됩니다 |
| 타일 (T) | 타일 종류를 고르고 클릭/드래그로 칠합니다. 종류: **마을길, 풀길, 물, 포장길**, 지우개. 셀 크기는 5 / 10 / 20 m (바꾸면 기존 타일은 초기화 확인 후 삭제) |
| 스폰 구역 (Z) | 구역 종류(플레이어=금색, NPC=청록, 몬스터=빨강)를 고르고 드래그해 사각형을 그립니다. 오른쪽 목록에서 삭제 가능 |

- 확대/축소: 마우스 휠 (커서 위치 기준). **전체 보기**는 맵 전체, **100%**는 배경 이미지 원본 픽셀 크기입니다.
- 스프라이트 배치: 왼쪽 팔레트에서 스프라이트를 클릭 → 지도에서 클릭할 때마다 배치(바닥 중심 기준). Esc로 해제.
- 모든 변경은 **자동으로 브라우저 localStorage에 저장**됩니다. 같은 브라우저로 다시 열면 이어서 작업할 수 있습니다.

## 데이터 형식 (village-map.json)

내보내기 버튼을 누르면 `village-map.json`이 다운로드됩니다.

```json
{
  "village": "waitemata",
  "tileSizeM": 10,
  "tiles": { "3,-2": "village-road", "4,-2": "paved-road" },
  "placements": [ { "asset": "brute", "x": 120.5, "y": -80.0, "w": 2.4 } ],
  "zones": [ { "type": "monster", "x": 100.0, "y": -100.0, "w": 60.0, "h": 40.0 } ]
}
```

- `tiles`: 키는 셀 인덱스 `"cx,cy"`, 값은 타일 종류 (`village-road` / `grass-road` / `water` / `paved-road`)
- `placements`: `asset`은 팔레트 id, `x, y`는 스프라이트 **바닥 중심**의 월드 좌표(m), `w`는 너비(m). 높이는 이미지 비율로 자동 계산
- `zones`: `type`은 `player` / `npc` / `monster`, `x, y`는 사각형의 **북서쪽(최소 x, 최소 y) 모서리**, `w, h`는 크기(m)
- 가져오기: 이 형식의 JSON 파일을 불러오면 맵이 그대로 복원됩니다.

## 맵 목록 (19개)

- **마을 (600 m)**: `waitemata` (Waitematā), `nan-madol`, `haamonga`, `taputapuatea`, `ahu-tongariki`, `leluh`, `pulemelei`
- **사이맵 (400 m)**: 게임의 길 순서 그대로입니다. `field:town>nan-madol#1` (후카 폭포와 와이카토 강), `field:nan-madol>haamonga#1` (소케스 능선), `field:nan-madol>haamonga#2` (케피로히 폭포), `field:haamonga>taputapuatea#1` (타라나키 산), `field:taputapuatea>ahu-tongariki#1` (파우타우아 협곡), `field:taputapuatea>ahu-tongariki#2` (핀콜 산), `field:ahu-tongariki>leluh#1` (라노 라라쿠 채석장), `field:ahu-tongariki>leluh#2` (소포아가 폭포), `field:leluh>pulemelei#2` (라노 카우 분화구 호수)
- **던전 (300 m)**: `sunken-grotto`, `emberdeep`, `drowned-vault`

내보내기 JSON의 `village` 값에는 선택한 맵의 id가 그대로 들어갑니다. 형식은 맵 종류와 무관하게 동일합니다 (village-map.json v1).

## 파일 구성

```
village-editor/
  index.html            에디터 본체 (단일 파일, 외부 CDN 없음)
  README.md             이 문서
  assets/
    terrain.jpg         Waitematā 배경 지형 이미지 (1024×1024)
    backdrops/          나머지 18개 맵의 배경 지형 이미지
    sprites.json        팔레트 레지스트리 (177종, 항목의 maps로 표시 맵 지정)
    tiles/              땅 타일 4종 (256×256)
      village-road.png / grass-road.png / water.png / paved-road.png
    sprites/            배치용 스프라이트 (투명 PNG, 에디터용 사본 - 원본은 제작 팩에 보관)
```

## 스프라이트 추가하는 법

1. 투명 PNG를 `assets/sprites/`에 넣습니다.
2. `assets/sprites.json`의 `sprites` 배열에 `{ "id": "...", "name": "...", "image": "assets/sprites/파일명.png", "defaultW": 너비(m) }` 항목을 추가합니다. 특정 맵에서만 보이게 하려면 `"maps": ["nan-madol"]`처럼 맵 id 목록을 붙입니다. maps가 없으면 모든 맵에 나타납니다.
3. 에디터를 새로고침하면 팔레트에 나타납니다.
4. 한 번 등록된 id는 바꾸지 않습니다. 그림을 교체할 때도 같은 id로 파일만 바꿉니다 (기존 맵 파일이 id로 연결됩니다).
