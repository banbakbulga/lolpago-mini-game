import express from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

// 제미나이 AI 설정
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const aiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const app = express();

// 모든 도메인에서 접속 가능하도록 CORS 설정 (프론트엔드 연결 필수)
app.use(cors());
app.use(express.json());

const RIOT_API_KEY = process.env.RIOT_API_KEY; 
const REGION = 'kr';
const REGION_ASIA = 'asia';


// 1. 티어/디비전 데이터 (IRON ~ DIAMOND)
app.get('/api/league-entries/:tier/:division', async (req, res) => {
  try {
    const { tier, division } = req.params;
    const page = req.query.page || 1;
    const url = `https://${REGION}.api.riotgames.com/lol/league/v4/entries/RANKED_SOLO_5x5/${tier}/${division}?page=${page}`;
    const response = await axios.get(url, { headers: { "X-Riot-Token": RIOT_API_KEY } });
    res.json(response.data || []);
  } catch (error) {
    console.error("Riot API Error:", error.message);
    res.status(error.response?.status || 500).json({ error: "리그 데이터를 가져오지 못했습니다." });
  }
});

// 2. 상위 티어 데이터 (MASTER, GRANDMASTER, CHALLENGER)
app.get('/api/league-entries/:tier', async (req, res) => {
  try {
    const { tier } = req.params;
    const url = `https://${REGION}.api.riotgames.com/lol/league/v4/${tier.toLowerCase()}leagues/by-queue/RANKED_SOLO_5x5`;
    const response = await axios.get(url, { headers: { "X-Riot-Token": RIOT_API_KEY } });
    res.json(response.data.entries || []);
  } catch (error) {
    console.error("Riot API Error:", error.message);
    res.status(error.response?.status || 500).json({ error: "리그 데이터를 가져오지 못했습니다." });
  }
});

// 3. summonerId로 PUUID 조회
app.get('/api/summoner/:summonerId', async (req, res) => {
  try {
    const { summonerId } = req.params;
    const response = await axios.get(
      `https://${REGION}.api.riotgames.com/lol/summoner/v4/summoners/${summonerId}`,
      { headers: { "X-Riot-Token": RIOT_API_KEY } }
    );
    res.json(response.data);
  } catch (error) {
    console.error("Riot API Error:", error.message);
    res.status(error.response?.status || 500).json({ error: "소환사 정보를 가져오지 못했습니다." });
  }
});

// 4. 매치 ID 리스트 조회
app.get('/api/match-ids/:puuid', async (req, res) => {
  try {
    const { puuid } = req.params;
    const count = req.query.count || 5;
    const response = await axios.get(
      `https://${REGION_ASIA}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=${count}`,
      { headers: { "X-Riot-Token": RIOT_API_KEY } }
    );
    res.json(response.data);
  } catch (error) {
    console.error("Riot API Error:", error.message);
    res.status(error.response?.status || 500).json({ error: "매치 ID 리스트를 가져오지 못했습니다." });
  }
});

// 5. 매치 상세 정보 조회
app.get('/api/match/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    const response = await axios.get(
      `https://${REGION_ASIA}.api.riotgames.com/lol/match/v5/matches/${matchId}`,
      { headers: { "X-Riot-Token": RIOT_API_KEY } }
    );
    res.json(response.data);
  } catch (error) {
    console.error("Riot API Error:", error.message);
    res.status(error.response?.status || 500).json({ error: "매치 데이터를 가져오지 못했습니다." });
  }
});

// 6. 매치 타임라인 정보 조회
app.get('/api/match/:matchId/timeline', async (req, res) => {
  try {
    const { matchId } = req.params;
    const response = await axios.get(
      `https://${REGION_ASIA}.api.riotgames.com/lol/match/v5/matches/${matchId}/timeline`,
      { headers: { "X-Riot-Token": RIOT_API_KEY } }
    );
    res.json(response.data);
  } catch (error) {
    console.error("Riot API Error:", error.message);
    res.status(error.response?.status || 500).json({ error: "타임라인 데이터를 가져오지 못했습니다." });
  }
});

// 7. 챔피언 데이터 가공 (필요한 정보만 추출)
app.get('/api/champions', async (req, res) => {
  try {
    const versionRes = await axios.get('https://ddragon.leagueoflegends.com/api/versions.json');
    const latestVersion = versionRes.data[0];
    const champRes = await axios.get(`https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/ko_KR/champion.json`);
    
    const allChamps = champRes.data.data;
    const miniChamps = Object.values(allChamps).map(champ => ({
      id: champ.id,
      name: champ.name,
      image: `https://ddragon.leagueoflegends.com/cdn/${latestVersion}/img/champion/${champ.image.full}`
    }));

    res.json(miniChamps);
  } catch (error) {
    console.error("Champion API Error:", error.message);
    res.status(500).json({ error: "챔피언 정보를 가져오지 못했습니다." });
  }
});

// 8. AI 매치 분석 엔드포인트 (고도화 버전)
app.post('/api/analyze-match', async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "API 키 설정 필요" });
    }

    const { prediction, actualWinner, matchData, tier } = req.body;

    if (!prediction || !matchData || !tier) {
      return res.status(400).json({ error: "필수 데이터 누락" });
    }

    // 1. 데이터 가공
    const blueProb = Math.round(prediction.blue);
    const redProb = Math.round(prediction.red);
    const predictedWinner = blueProb > redProb ? '블루팀' : '레드팀';
    const actualWinnerName = actualWinner === 100 ? '블루팀' : '레드팀';
    const isUpset = predictedWinner !== actualWinnerName;

    // 2. 사건 데이터 정리 (챔피언 이름 포함 시 더 효과적)
    const eventsText = (matchData.events || [])
      .slice(0, 5)
      .map(e => e.text)
      .filter(Boolean)
      .join(' -> ');

    // 3. 해설가 페르소나 주입 프롬프트
    const prompt = `
    당신은 수많은 국제 대회를 분석해온 전설적인 리그오브레전드 경기 해설자입니다.
    아래 경기 데이터를 기반으로, 시청자가 마치 실시간 중계를 보고 있는 것처럼 박진감 넘치는 **경기 관전평**을 작성하세요.
    
    [경기 데이터]
    - 티어: ${tier}
    - 사전 승부 예측: ${predictedWinner} 우세 (예상 승률 ${Math.max(blueProb, redProb)}%)
    - 실제 경기 결과: ${actualWinnerName} 승리
    - 핵심 오브젝트 현황: 바론 ${matchData.baron}회, 드래곤 ${matchData.dragon}회 확보
    - 주요 하이라이트 상황: ${eventsText || '라인전에서의 팽팽한 주도권 싸움과 한타 대치'}
    
    [작성 목표]
    - 단순 요약이 아닌 **해설자의 관점에서 경기 흐름·판단·전환점**을 설명
    - 오브젝트 컨트롤과 한타 설계, 챔피언 활약이 승패에 미친 영향을 강조
    - 감정이 실린 문장으로 텐션 높은 관전 경험 제공
    
    [서술 가이드]
    1. 반드시 첫 문장에서 경기의 전체 흐름을 규정할 것  
    → ${
      isUpset
        ? `${predictedWinner}의 무난한 승리가 예상됐지만, ${actualWinnerName}이 이를 뒤엎는 반전을 만들어냈습니다.`
        : `${predictedWinner}이 초반부터 흐름을 장악하며 예측을 증명한 경기였습니다.`
    }
    
    2. 전문 용어 적극 사용 (스노우볼, 이니시에이팅, 짤라먹기, 오브젝트 설계, 드래곤 스택, 시야 장악 등)
    
    3. 바론·드래곤은 **경기 전환점**, 챔피언 활약은 **결정타**처럼 묘사
    
    [형식 제한 — 매우 중요]
    - 전체 분량은 **최대 5줄**
    - **엔터(줄바꿈)는 최대 1회까지만 허용**  
      → 문단을 나눌 경우에도 **단 한 번만 줄바꿈 가능**  
      → **엔터 두 번 이상(빈 줄 생성) 절대 금지**
    - HTML 형식으로만 작성
    - 강조 단어는 반드시 <strong>태그</strong> 사용
    - 번호 매기기, 목록 형태 금지
    - 골드 격차, 수치 기반 자원 비교 언급 금지
    - 블루팀은 파란색 글자, 레드팀은 빨간색 글자로 표시해줘.
    
    [톤 & 스타일]
    - 냉정한 분석 + 열정적인 중계가 결합된 해설자 톤
    - 실제 e스포츠 중계석에서 읽어도 어색하지 않은 문장
    - 과도한 비유는 피하되 박진감은 유지
    
    [출력 예시 스타일]
    <strong>블루팀</strong>이 <strong>바론</strong> 타이밍에 과감하게 템포를 끌어올렸고, 한 번 열린 <strong>이니시에이팅</strong>에서 완벽한 <strong>스노우볼</strong>을 굴렸습니다.
    이후 <strong>드래곤 스택</strong>을 차곡차곡 쌓으며 후반 설계를 완성했고, 결국 한타 집중력에서 차이를 만들며 경기를 마무리했습니다.
    `;

    const result = await aiModel.generateContent(prompt);
    const response = await result.response;
    let text = response.text();
    
    // 마크다운 형식(**텍스트**)이 있으면 HTML로 변환
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    console.log("✅ 고도화된 AI 분석 성공");
    res.json({ analysis: text });
  } catch (error) {
    console.error("❌ AI 분석 에러:", error.message);
    res.status(500).json({ error: "분석 생성 실패", details: error.message });
  }
});

// --- 서버 실행 설정 ---
const PORT = 8000;

// 서버 시작
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 API 서버 가동 시작!`);
  console.log(`📡 포트 번호: ${PORT}`);
  console.log(`🌐 로컬 접속: http://localhost:${PORT}`);
  console.log(`⏸️  서버를 종료하려면 Ctrl+C를 누르세요.`);
});

// 에러 핸들링
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ 포트 ${PORT}가 이미 사용 중입니다.`);
  } else {
    console.error('❌ 서버 시작 실패:', error);
  }
  process.exit(1);
});

// 서버 종료 시 처리
process.on('SIGINT', () => {
  console.log('\n⏹️  서버를 종료합니다...');
  server.close(() => {
    console.log('✅ 서버가 정상적으로 종료되었습니다.');
    process.exit(0);
  });
});


export default app;