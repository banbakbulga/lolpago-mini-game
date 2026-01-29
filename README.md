# 롤파고 미니게임 프로젝트

## 프로젝트 구조

이 프로젝트는 **FE(Frontend)**와 **BE(Backend)**로 완전히 분리되어 있습니다.

```
lol/
├── FE/          # React 프론트엔드
│   ├── src/     # 소스 코드
│   ├── public/  # 정적 파일
│   └── package.json
│
└── BE/          # Express 백엔드
    ├── index.js
    └── package.json
```

## 실행 방법

### 1. 백엔드 서버 실행

```bash
cd BE
npm install
npm start
```

서버는 `http://localhost:8000`에서 실행됩니다.

### 2. 프론트엔드 실행

**새 터미널에서:**

```bash
cd FE
npm install
npm run dev
```

프론트엔드는 `http://localhost:5173` (또는 Vite 기본 포트)에서 실행됩니다.

## 환경 변수 설정

### BE/.env 파일

백엔드 루트에 `.env` 파일을 생성하고 다음 내용을 추가하세요:

```
VITE_RIOT_API_KEY=your_api_key_here
```

### FE/.env 파일 (선택사항)

프로덕션 환경에서 다른 백엔드 서버를 사용하는 경우:

```
VITE_API_BASE_URL=http://your-backend-url:8000
```

## 주요 기능

- ✅ Riot API 키를 백엔드에서 안전하게 관리
- ✅ 프론트엔드와 백엔드 완전 분리
- ✅ CORS 설정 완료
- ✅ 다크/라이트 모드 지원
