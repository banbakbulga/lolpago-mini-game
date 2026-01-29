import { useState, useEffect } from 'react'
import { getAllChampionData, getLatestVersion, getAllItemData } from '../utils/dataDragon'
import { getMatchTimelineByMatchId, parseGoldData } from '../api/riotApi'
import GoldGraph from './GoldGraph'
import TeamRadarChart from './TeamRadarChart'
import DamageTypeAnalysis from './DamageTypeAnalysis'
import { calculateTeamStats, calculateWinProbability } from '../utils/analysis'
import confetti from 'canvas-confetti'

function MatchCard({ match, index, onAnswer, onNext }) {
  const [champData, setChampData] = useState(null);
  const [itemData, setItemData] = useState(null);
  const [version, setVersion] = useState('14.1.1');
  const [selectedTeam, setSelectedTeam] = useState(null); // 100: 블루팀, 200: 레드팀
  const [isAnswered, setIsAnswered] = useState(false); // 정답 확인 여부
  const [isCorrect, setIsCorrect] = useState(null); // null: 미확인, true: 정답, false: 오답
  const [hintPlayer, setHintPlayer] = useState(null); // 랜덤 힌트 플레이어
  const [hoveredItemId, setHoveredItemId] = useState(null); // 현재 호버 중인 아이템 ID
  const [goldData, setGoldData] = useState(null); // 골드 차이 데이터
  const [loadingGold, setLoadingGold] = useState(false); // 골드 데이터 로딩 중
  const [aiAnalysis, setAiAnalysis] = useState(''); // AI 분석 결과
  const [loadingAi, setLoadingAi] = useState(false); // AI 분석 로딩 중

  useEffect(() => {
    const loadData = async () => {
      const data = await getAllChampionData();
      const items = await getAllItemData();
      const ver = await getLatestVersion();
      setChampData(data);
      setItemData(items);
      setVersion(ver);
    };
    loadData();
  }, []);

  // 매치가 변경될 때 상태 리셋
  useEffect(() => {
    setSelectedTeam(null);
    setIsAnswered(false);
    setIsCorrect(null);
    setHintPlayer(null);
    setHoveredItemId(null);
    setGoldData(null);
    setLoadingGold(false);
    setAiAnalysis('');
    setLoadingAi(false);
  }, [match.matchId]);

  // 정답 확인 후 골드 데이터 로드
  useEffect(() => {
    if (isAnswered && !goldData && !loadingGold) {
      const loadGoldData = async () => {
        setLoadingGold(true);
        try {
          const timelineData = await getMatchTimelineByMatchId(match.matchId);
          if (timelineData) {
            // match 전체 + champData(한글 이름) 전달
            const parsed = parseGoldData(timelineData, match, champData);
            setGoldData(parsed);
          }
        } catch (error) {
          console.error('골드 데이터 로드 실패:', error);
          // 에러가 발생해도 계속 진행 (그래프 없이 표시)
        } finally {
          setLoadingGold(false);
        }
      };
      loadGoldData();
    }
  }, [isAnswered, match.matchId, goldData, loadingGold, champData]);

  // AI 분석 호출 함수
  const fetchAIAnalysis = async (blueStats, redStats, winProb) => {
    setLoadingAi(true);
    try {
      // 주요 이벤트 추출 (펜타킬, 쿼드라킬, 바론, 장로드래곤, 억제기 등)
      const importantEvents = [];
      if (goldData && goldData.length > 0) {
        goldData.forEach(frame => {
          if (frame.matchEvents && frame.matchEvents.length > 0) {
            frame.matchEvents.forEach(event => {
              // 중요한 이벤트만 필터링
              if (
                event.type === 'penta' ||
                event.type === 'kill' || // 트리플, 쿼드라킬
                (event.type === 'obj' && (event.text.includes('바론') || event.text.includes('장로') || event.text.includes('억제기'))) ||
                event.type === 'ace'
              ) {
                importantEvents.push(event);
              }
            });
          }
        });
      }

      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://118.223.39.153:8000';
      const response = await fetch(`${API_BASE_URL}/api/analyze-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prediction: winProb,
          actualWinner: match.승리팀ID,
          tier: match.tier,
          matchData: {
            goldDiff: goldData ? goldData[goldData.length - 1].diff : 0,
            baron: (match.blueObjectives?.baron || 0) + (match.redObjectives?.baron || 0),
            dragon: (match.blueObjectives?.dragon || 0) + (match.redObjectives?.dragon || 0),
            events: importantEvents.slice(0, 10) // 최대 10개 주요 이벤트만 전달
          }
        })
      });
      const data = await response.json();
      setAiAnalysis(data.analysis);
    } catch (err) {
      console.error("AI 로드 실패", err);
    } finally {
      setLoadingAi(false);
    }
  };

  // 정답 확인 후 AI 분석 호출
  useEffect(() => {
    if (isAnswered && goldData && !aiAnalysis && !loadingAi && champData) {
      const blueStats = calculateTeamStats(match.blueTeamDetails, champData);
      const redStats = calculateTeamStats(match.redTeamDetails, champData);
      const winProb = calculateWinProbability(blueStats, redStats, match.tier);
      fetchAIAnalysis(blueStats, redStats, winProb);
    }
  }, [isAnswered, goldData, aiAnalysis, loadingAi, champData, match]);

  // 랜덤 힌트 플레이어 선택
  useEffect(() => {
    if (match.blueTeamDetails && match.redTeamDetails && !hintPlayer) {
      const bluePlayers = match.blueTeamDetails.map(p => ({ ...p, team: 'blue' }));
      const redPlayers = match.redTeamDetails.map(p => ({ ...p, team: 'red' }));
      const allPlayers = [...bluePlayers, ...redPlayers];
      if (allPlayers.length > 0) {
        const randomIndex = Math.floor(Math.random() * allPlayers.length);
        setHintPlayer(allPlayers[randomIndex]);
      }
    }
  }, [match, hintPlayer]);

  // 폭죽 효과 함수
  const triggerConfetti = () => {
    var duration = 1.5 * 1000;
    var animationEnd = Date.now() + duration;
    var defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    var randomInRange = (min, max) => Math.random() * (max - min) + min;

    var interval = setInterval(function () {
      var timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      var particleCount = 50 * (timeLeft / duration);

      // 화면 양쪽에서 폭죽이 팡팡 터지는 효과
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        colors: ['#4ade80', '#ffffff'] // 초록색 + 흰색 (승리 테마)
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        colors: ['#3b82f6', '#ffffff'] // 파란색 + 흰색
      });
    }, 250);
  };

  // 승리팀 선택 핸들러
  const handleTeamSelect = (teamId) => {
    if (isAnswered) return; // 이미 답변한 경우 무시

    setSelectedTeam(teamId);
    const correct = teamId === match.승리팀ID;
    setIsCorrect(correct);
    setIsAnswered(true);

    // 정답일 경우 폭죽 발사!
    if (correct) {
      triggerConfetti();
    }

    // 부모 컴포넌트에 정답 여부 전달
    if (onAnswer) {
      onAnswer(correct);
    }
  };

  // 챔피언 아이콘 URL (얼굴만 나오는 정사각형 이미지)
  const getIconUrl = (name) => {
    if (!name || !version) return null;
    // Fiddlesticks 대소문자 처리
    const normalizedName = name === 'Fiddlesticks' || name === 'fiddlesticks' ? 'Fiddlesticks' : name;
    return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${normalizedName}.png`;
  };

  // 챔피언 이미지 로딩 실패 시 대체 이미지 시도
  const handleChampionImageError = (e, championName) => {
    const normalizedName = championName === 'Fiddlesticks' || championName === 'fiddlesticks' ? 'Fiddlesticks' : championName;
    const img = e.target;
    let attemptCount = img.dataset.attemptCount ? parseInt(img.dataset.attemptCount) : 0;

    // 대체 이미지 URL 목록
    const fallbackUrls = [
      `https://ddragon.leagueoflegends.com/cdn/16.1.1/img/champion/${normalizedName}.png`,
      `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${normalizedName}_0.jpg`,
    ];

    if (attemptCount < fallbackUrls.length) {
      img.dataset.attemptCount = (attemptCount + 1).toString();
      img.src = fallbackUrls[attemptCount];
    } else {
      // 모든 대체 이미지 실패 시 플레이스홀더
      img.src = 'https://via.placeholder.com/48?text=?';
      img.onerror = null; // 무한 루프 방지
    }
  };

  // 챔피언 데이터 찾기 (키, id, 정규화된 이름으로 매칭)
  const getChampionData = (name) => {
    if (!name || !champData) return null;

    // 정확한 키로 먼저 시도
    if (champData[name]) {
      return champData[name];
    }

    // 챔피언 이름 정규화 (대소문자 처리)
    const normalizedName = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();

    // 정규화된 이름으로 시도
    if (champData[normalizedName]) {
      return champData[normalizedName];
    }

    // 모든 키를 순회하며 id로 매칭 시도
    for (const [key, value] of Object.entries(champData)) {
      if (value.id === name || value.id === normalizedName) {
        return value;
      }
    }

    return null;
  };

  // 한글 이름 변환
  const getKoName = (name) => {
    const champ = getChampionData(name);
    return champ?.name || name;
  };

  // 챔피언 ID를 이름으로 변환
  const getChampNameById = (id) => {
    if (!champData || id === -1 || id === null) return null;
    const found = Object.values(champData).find(c => parseInt(c.key) === id);
    return found ? found.id : null;
  };

  const positions = ["탑", "정글", "미드", "원딜", "서폿"];
  const positionNames = { 'TOP': '탑', 'JUNGLE': '정글', 'MIDDLE': '미드', 'BOTTOM': '원딜', 'UTILITY': '서폿' };

  // 아이템 이미지 URL (버전 포함)
  const getItemUrl = (itemId) => {
    if (!itemId || itemId === 0 || !version) return null;
    return `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${itemId}.png`;
  };

  // 전체 팀 KDA 계산
  const calculateTeamKDA = (teamDetails) => {
    if (!teamDetails || teamDetails.length === 0) return { kills: 0, deaths: 0, assists: 0 };
    return teamDetails.reduce((acc, player) => ({
      kills: acc.kills + (player.kills || 0),
      deaths: acc.deaths + (player.deaths || 0),
      assists: acc.assists + (player.assists || 0)
    }), { kills: 0, deaths: 0, assists: 0 });
  };

  const blueTeamKDA = match.blueTeamDetails ? calculateTeamKDA(match.blueTeamDetails) : null;
  const redTeamKDA = match.redTeamDetails ? calculateTeamKDA(match.redTeamDetails) : null;

  // 팀별 오브젝트 요약 (드래곤/바론/전령/타워/억제기)
  const blueObjectives = match.blueObjectives || {};
  const redObjectives = match.redObjectives || {};

  // 챔피언 이름으로 상세 정보 찾기
  const getPlayerDetails = (championName, teamDetails) => {
    return teamDetails?.find(p => p.championName === championName);
  };

  // 카드 흔들림 효과 클래스
  const getCardShakeClass = () => {
    if (isAnswered && !isCorrect) return 'animate-shake';
    return '';
  };

  return (
    <div className={`relative bg-white text-slate-900 dark:bg-[#121216] dark:text-slate-200 border border-slate-200 dark:border-white/10 rounded-3xl p-4 md:p-6 overflow-visible transition-all duration-500 shadow-md ${isAnswered
      ? isCorrect
        ? 'shadow-[0_0_15px_rgba(34,197,94,0.15),0_0_30px_rgba(34,197,94,0.08)] border-green-500/30'
        : 'shadow-[0_0_15px_rgba(239,68,68,0.15),0_0_30px_rgba(239,68,68,0.08)] border-red-500/30'
      : 'shadow-[0_10px_30px_rgba(0,0,0,0.3)]'
      }`}>

      {/* 상단 타임라인/티어 정보 */}
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-black/40 px-3 py-1 rounded-full border border-slate-200 dark:border-white/5">
          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-500">MATCH DURATION</span>
          <span className="text-xs font-black text-slate-900 dark:text-slate-200">{match.gameDuration || '알 수 없음'}</span>
        </div>
        <div className="flex items-center gap-2 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/30">
          <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest">{match.tier || 'MASTER'}</span>
        </div>
      </div>

      {/* 힌트 섹션: 컴팩트 스타일 + 오브젝트 정보 포함 */}
      {hintPlayer && !isAnswered && (
        <div className="flex flex-col gap-3 p-2 relative z-0">
          <div className="mb-1 relative overflow-visible rounded-xl bg-white dark:bg-[#16171b] border-l-4 border-yellow-500 shadow-md animate-in fade-in slide-in-from-left-2 duration-500 z-0">
            <div className="grid grid-cols-[auto_1fr] gap-4 items-center p-3">

              {/* 1. HINT 라벨 (좌측 고정) */}
              <div className="flex flex-col items-center justify-center px-2 border-r border-slate-200 dark:border-white/5 gap-0.5 min-w-[50px]">
                <span className="text-xl drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]">💡</span>
                <span className="text-[9px] font-black text-yellow-600 dark:text-yellow-500 tracking-widest uppercase leading-none">HINT</span>
              </div>

              {/* 2. 정보 영역 - 챔피언 섹션과 동일한 너비 */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 min-w-0">

                {/* 챔피언 & 오브젝트 정보 */}
                <div className="flex items-center gap-3">
                  {/* 챔피언 프사 */}
                  <div className="relative flex-shrink-0">
                    <img
                      src={getIconUrl(hintPlayer.championName)}
                      className={`w-10 h-10 rounded-lg border border-black/10 dark:border-white/10 ${hintPlayer.team === 'blue' ? 'shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 'shadow-[0_0_10px_rgba(239,68,68,0.3)]'}`}
                      alt="Hint Champion"
                      onError={(e) => handleChampionImageError(e, hintPlayer.championName)}
                    />
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 flex items-center justify-center rounded text-[9px] font-black text-white ${hintPlayer.team === 'blue' ? 'bg-blue-600' : 'bg-red-600'}`}>
                      {hintPlayer.team === 'blue' ? 'B' : 'R'}
                    </div>
                  </div>

                  {/* 텍스트 정보 */}
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-200">{getKoName(hintPlayer.championName)}</span>
                      <span className="text-[10px] text-slate-600 dark:text-slate-500 font-medium">CS {hintPlayer.totalMinionsKilled + hintPlayer.neutralMinionsKilled}</span>
                    </div>

                    {/* KDA 정보 */}
                    {hintPlayer.kills !== undefined && hintPlayer.deaths !== undefined && hintPlayer.assists !== undefined && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-slate-600 dark:text-slate-400 font-black">
                          KDA: <span className="text-slate-900 dark:text-slate-200">{hintPlayer.kills}/{hintPlayer.deaths}/{hintPlayer.assists}</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. 아이템 슬롯 (우측 정렬) */}
                {hintPlayer.items && (
                  <div className="flex gap-1 md:justify-end relative z-0">
                    {hintPlayer.items.map((itemId, idx) => {
                      if (itemId === 0) return null;
                      const itemInfo = itemData?.[String(itemId)];
                      return (
                        <div key={idx} className="relative group z-0">
                          <img
                            src={getItemUrl(itemId)}
                            className="w-8 h-8 rounded border border-slate-200 dark:border-white/10 hover:border-yellow-500 transition-colors cursor-help bg-slate-200 dark:bg-black/40"
                            alt="item"
                          />
                          {/* 아이템 툴팁 */}
                          {itemInfo && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 max-w-[280px] p-3 bg-white dark:bg-[#0f1015]/95 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-lg text-left opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-[50] shadow-2xl">
                              {/* 아이템 이름 */}
                              <p className="text-xs font-black text-yellow-600 dark:text-yellow-400 mb-1">{itemInfo.name}</p>

                              {/* 가격 정보 */}
                              <p className="text-[10px] text-slate-600 dark:text-slate-500 font-bold mb-2">
                                가격: <span className="text-yellow-700 dark:text-yellow-200">{itemInfo.gold?.total || 0}</span>
                                {itemInfo.gold?.base > 0 && ` (조합비: ${itemInfo.gold.base})`}
                              </p>

                              {/* 아이템 설명 (HTML 태그 제거 및 스타일링) */}
                              {itemInfo.description && (
                                <div
                                  className="text-[10px] text-slate-700 dark:text-slate-300 leading-relaxed space-y-1 item-desc"
                                  dangerouslySetInnerHTML={{
                                    __html: (itemInfo.description || '')
                                      .replace(/<br>/g, '<br/>') // 줄바꿈 보존
                                      .replace(/<attention>/g, '<span class="text-slate-900 dark:text-white font-bold">') // 중요 정보 강조
                                      .replace(/<\/attention>/g, '</span>')
                                      .replace(/<stats>/g, '<span class="text-blue-800 dark:text-blue-300 block mb-1">') // 스탯 정보 파란색
                                      .replace(/<\/stats>/g, '</span>')
                                      .replace(/<passive>/g, '<span class="text-yellow-700 dark:text-yellow-200 font-bold">') // 패시브 효과 노란색
                                      .replace(/<\/passive>/g, '</span>')
                                      .replace(/<active>/g, '<span class="text-orange-700 dark:text-orange-300 font-bold">') // 액티브 효과 주황색
                                      .replace(/<\/active>/g, '</span>')
                                      .replace(/<mainText>/g, '<span class="text-slate-900 dark:text-slate-200">') // 메인 텍스트
                                      .replace(/<\/mainText>/g, '</span>')
                                      .replace(/<highlight>/g, '<span class="font-bold">') // 강조 (색상 제거)
                                      .replace(/<\/highlight>/g, '</span>')
                                      .replace(/<blue>/g, '<span class="font-bold">') // 블루팀 (색상 제거)
                                      .replace(/<\/blue>/g, '</span>')
                                      .replace(/<red>/g, '<span class="font-bold">') // 레드팀 (색상 제거)
                                      .replace(/<\/red>/g, '</span>')
                                      // 나머지 불필요한 태그 제거 (span, br은 보존)
                                      .replace(/<(?!\/?(span|br)\b)[^>]+>/gi, '')
                                  }}
                                />
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 대결 섹션 */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 md:gap-4 items-center mb-4 relative z-10">

        {/* 블루팀 리스트 */}
        <div
          onClick={() => !isAnswered && handleTeamSelect(100)}
          className={`flex-1 transition-all duration-300 rounded-xl p-2 cursor-pointer relative z-10
            ${!isAnswered ? 'hover:bg-blue-900/20' : ''}
            ${isAnswered && match.승리팀ID === 100 ? 'bg-blue-900/25 ring-1 ring-blue-500/50 animate-pulseGlow' : ''}
            ${isAnswered && selectedTeam === 100 && !isCorrect ? 'bg-red-900/20 grayscale opacity-60' : ''}
            ${selectedTeam === 100 && isAnswered && isCorrect ? 'ring-2 ring-green-500/60' : ''}
          `}
        >
          {/* 전체 팀 KDA 표시 */}
          {isAnswered && blueTeamKDA && (
            <div className="mb-2 p-1.5 bg-blue-50 dark:bg-blue-500/10 backdrop-blur-sm rounded-xl border border-blue-200 dark:border-blue-500/20 text-center">
              <p className="text-[10px] text-blue-800 dark:text-blue-400 font-bold mb-0.5 uppercase tracking-wider">Overall KDA</p>
              <p className="text-sm text-blue-800 dark:text-blue-300 font-black">
                {blueTeamKDA.kills}/{blueTeamKDA.deaths}/{blueTeamKDA.assists}
              </p>
            </div>
          )}
          {/* 블루 밴 (가로 일렬) */}
          {match.blueBans && match.blueBans.length > 0 && (
            <div className="flex justify-start gap-1 mb-1.5">
              {match.blueBans.map((id, i) => {
                const name = getChampNameById(id);
                return name ? (
                  <img
                    key={i}
                    src={getIconUrl(name)}
                    className="w-6 h-6 rounded grayscale border border-red-900/50 opacity-60"
                    alt="ban"
                    onError={(e) => handleChampionImageError(e, name)}
                  />
                ) : (
                  <div key={i} className="w-6 h-6 bg-slate-200 dark:bg-gray-800 rounded border border-slate-300 dark:border-gray-700" />
                );
              })}
            </div>
          )}
          {/* 블루팀 데미지 타입 바 (밴과 픽 사이) */}
          {champData && version && match.blueTeamDetails && (
            <div className="my-2">
              <DamageTypeAnalysis
                teamDetails={match.blueTeamDetails}
                champData={champData}
                version={version}
              />
            </div>
          )}

          {/* 블루 픽 (세로 일렬) */}
          <div className="space-y-1.5">
            {match.blueTeam?.map((name, i) => {
              const playerDetails = getPlayerDetails(name, match.blueTeamDetails);
              return (
                <div key={i} className="relative group flex items-center gap-1.5 bg-blue-50 dark:bg-blue-500/5 p-1 md:p-1.5 rounded-lg border-l-4 border-blue-200 dark:border-blue-500/50 hover:bg-blue-100 dark:hover:bg-blue-500/10 transition-colors backdrop-blur-sm z-[100] min-h-[56px]">
                  {/* 챔피언 아이콘 */}
                  <div className="relative z-[100]">
                    <img
                      src={getIconUrl(name)}
                      className="w-10 h-10 md:w-14 md:h-14 rounded-lg shadow border border-blue-500/30 flex-shrink-0 group-hover:scale-110 transition-transform duration-200"
                      alt={name}
                      onError={(e) => handleChampionImageError(e, name)}
                    />
                    {/* 호버 툴팁 */}
                    <div className="absolute bottom-full left-0 mb-2 w-48 p-3 bg-white dark:bg-black/90 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-[9999]">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-black text-slate-900 dark:text-white">{getKoName(name)}</span>
                        {(() => {
                          const champ = getChampionData(name);
                          return champ?.title && (
                            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold px-1.5 py-0.5 bg-indigo-500/10 rounded">
                              {champ.title}
                            </span>
                          );
                        })()}
                      </div>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">
                        {(() => {
                          const champ = getChampionData(name);
                          return champ?.blurb || '상세 정보가 없습니다.';
                        })()}
                      </p>
                      {/* 삼각형 화살표 */}
                      <div className="absolute top-full left-5 border-8 border-transparent border-t-white dark:border-t-black/90"></div>
                    </div>
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <p className="text-[9px] md:text-[10px] text-blue-800 dark:text-blue-400 font-bold uppercase tracking-wider">{positions[i] || ''}</p>
                      <p className="text-[11px] md:text-base font-bold text-slate-900 dark:text-slate-200 truncate leading-tight">{getKoName(name)}</p>
                    </div>

                    {/* Mobile: KDA + Items Row */}
                    {isAnswered && playerDetails && (
                      <div className="flex flex-col md:flex-row md:items-center gap-0.5 md:gap-2 mt-0.5">
                        {/* Mobile KDA */}
                        <span className="md:hidden text-[10px] text-blue-800 dark:text-blue-300 font-black whitespace-nowrap">
                          {playerDetails.kills}/{playerDetails.deaths}/{playerDetails.assists}
                        </span>

                        {/* Items */}
                        {playerDetails.items && (
                          <div className="flex gap-0.5 md:gap-1 flex-nowrap">
                            {playerDetails.items.map((itemId, idx) => (
                              <div
                                key={idx}
                                className={`w-3 h-3 md:w-6 md:h-6 rounded border ${itemId === 0 || !itemId
                                  ? 'bg-slate-200 dark:bg-gray-800 border-slate-300 dark:border-gray-700'
                                  : 'border-slate-400 dark:border-gray-600'
                                  } flex items-center justify-center`}
                              >
                                {itemId !== 0 && itemId ? (
                                  <img
                                    src={getItemUrl(itemId)}
                                    className="w-full h-full rounded"
                                    alt={`item ${itemId}`}
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      e.target.parentElement.classList.add('bg-slate-200', 'dark:bg-gray-800');
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full bg-slate-200 dark:bg-gray-800 rounded"></div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {isAnswered && playerDetails && (
                    <div className="hidden md:block text-right flex-shrink-0 mr-1 md:mr-2">
                      <p className="text-[10px] md:text-sm text-blue-800 dark:text-blue-300 font-black whitespace-nowrap">
                        {playerDetails.kills}/{playerDetails.deaths}/{playerDetails.assists}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* VS 중앙 */}
        <div className="flex flex-col items-center gap-1">
          <div className="h-16 w-[1px] bg-gradient-to-b from-transparent via-slate-400 dark:via-slate-700 to-transparent"></div>
          <span className={`text-3xl font-[1000] italic text-slate-700 dark:text-slate-800 tracking-tighter transition-all duration-500 ${isAnswered ? 'scale-0 opacity-0' : ''}`}>VS</span>
          <div className="h-16 w-[1px] bg-gradient-to-b from-transparent via-slate-400 dark:via-slate-700 to-transparent"></div>
        </div>

        {/* 레드팀 구역 */}
        <div
          onClick={() => !isAnswered && handleTeamSelect(200)}
          className={`flex-1 transition-all duration-300 rounded-xl p-2 cursor-pointer relative z-10
            ${!isAnswered ? 'hover:bg-red-900/20' : ''}
            ${isAnswered && match.승리팀ID === 200 ? 'bg-red-900/25 ring-1 ring-red-500/50 animate-pulseGlowRed' : ''}
            ${isAnswered && selectedTeam === 200 && !isCorrect ? 'bg-red-900/20 grayscale opacity-60' : ''}
            ${selectedTeam === 200 && isAnswered && isCorrect ? 'ring-2 ring-green-500/60' : ''}
          `}
        >
          {/* 전체 팀 KDA 표시 */}
          {isAnswered && redTeamKDA && (
            <div className="mb-2 p-1.5 bg-red-50 dark:bg-red-500/10 backdrop-blur-sm rounded-xl border border-red-200 dark:border-red-500/20 text-center">
              <p className="text-[10px] text-red-800 dark:text-red-400 font-bold mb-0.5 uppercase tracking-wider">Overall KDA</p>
              <p className="text-sm text-red-800 dark:text-red-300 font-black">
                {redTeamKDA.kills}/{redTeamKDA.deaths}/{redTeamKDA.assists}
              </p>
            </div>
          )}
          {/* 레드 밴 (가로 일렬) */}
          {match.redBans && match.redBans.length > 0 && (
            <div className="flex justify-end gap-1 mb-1.5">
              {match.redBans.map((id, i) => {
                const name = getChampNameById(id);
                return name ? (
                  <img
                    key={i}
                    src={getIconUrl(name)}
                    className="w-6 h-6 rounded grayscale border border-red-900/50 opacity-60"
                    alt="ban"
                    onError={(e) => handleChampionImageError(e, name)}
                  />
                ) : (
                  <div key={i} className="w-6 h-6 bg-slate-200 dark:bg-gray-800 rounded border border-slate-300 dark:border-gray-700" />
                );
              })}
            </div>
          )}
          {/* 레드팀 데미지 타입 바 (밴과 픽 사이) */}
          {champData && version && match.redTeamDetails && (
            <div className="my-2">
              <DamageTypeAnalysis
                teamDetails={match.redTeamDetails}
                champData={champData}
                version={version}
                isRed
              />
            </div>
          )}

          {/* 레드 픽 (세로 일렬) */}
          <div className="space-y-1.5">
            {match.redTeam?.map((name, i) => {
              const playerDetails = getPlayerDetails(name, match.redTeamDetails);
              return (
                <div key={i} className="relative group flex flex-row-reverse items-center gap-1.5 bg-red-50 dark:bg-red-500/5 p-1 md:p-1.5 rounded-lg border-r-4 border-red-200 dark:border-red-500/50 hover:bg-red-100 dark:hover:bg-red-500/10 transition-colors backdrop-blur-sm z-[100] min-h-[56px]">
                  {/* 챔피언 아이콘 */}
                  <div className="relative z-[100]">
                    <img
                      src={getIconUrl(name)}
                      className="w-10 h-10 md:w-14 md:h-14 rounded-lg shadow border border-red-500/30 flex-shrink-0 group-hover:scale-110 transition-transform duration-200"
                      alt={name}
                      onError={(e) => handleChampionImageError(e, name)}
                    />
                    {/* 호버 툴팁 */}
                    <div className="absolute bottom-full right-0 mb-2 w-48 p-3 bg-white dark:bg-black/90 backdrop-blur-md border border-black/10 dark:border-white/10 rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-[9999]">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-black text-slate-900 dark:text-white">{getKoName(name)}</span>
                        {(() => {
                          const champ = getChampionData(name);
                          return champ?.title && (
                            <span className="text-[10px] text-indigo-400 font-bold px-1.5 py-0.5 bg-indigo-500/10 rounded">
                              {champ.title}
                            </span>
                          );
                        })()}
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed line-clamp-2">
                        {(() => {
                          const champ = getChampionData(name);
                          return champ?.blurb || '상세 정보가 없습니다.';
                        })()}
                      </p>
                      {/* 삼각형 화살표 */}
                      <div className="absolute top-full right-5 border-8 border-transparent border-t-black/90"></div>
                    </div>
                  </div>
                  <div className="text-right flex-1 min-w-0">
                    <div className="flex flex-row-reverse items-baseline gap-1.5">
                      <p className="text-[9px] md:text-[10px] text-red-800 dark:text-red-400 font-bold uppercase tracking-wider">{positions[i] || ''}</p>
                      <p className="text-[11px] md:text-base font-bold text-slate-900 dark:text-slate-200 truncate leading-tight">{getKoName(name)}</p>
                    </div>

                    {/* Mobile: KDA + Items Row */}
                    {isAnswered && playerDetails && (
                      <div className="flex flex-col md:flex-row-reverse md:items-center gap-0.5 md:gap-2 mt-0.5 items-end md:items-center">
                        {/* Mobile KDA */}
                        <span className="md:hidden text-[10px] text-red-800 dark:text-red-300 font-black whitespace-nowrap">
                          {playerDetails.kills}/{playerDetails.deaths}/{playerDetails.assists}
                        </span>

                        {/* Items */}
                        {playerDetails.items && (
                          <div className="flex gap-0.5 md:gap-1 flex-nowrap justify-end">
                            {playerDetails.items.map((itemId, idx) => (
                              <div
                                key={idx}
                                className={`w-3 h-3 md:w-6 md:h-6 rounded border ${itemId === 0 || !itemId
                                  ? 'bg-slate-200 dark:bg-gray-800 border-slate-300 dark:border-gray-700'
                                  : 'border-slate-400 dark:border-gray-600'
                                  } flex items-center justify-center`}
                              >
                                {itemId !== 0 && itemId ? (
                                  <img
                                    src={getItemUrl(itemId)}
                                    className="w-full h-full rounded"
                                    alt={`item ${itemId}`}
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      e.target.parentElement.classList.add('bg-slate-200', 'dark:bg-gray-800');
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full bg-slate-200 dark:bg-gray-800 rounded"></div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {isAnswered && playerDetails && (
                    <div className="hidden md:block text-left flex-shrink-0 ml-1 md:ml-2">
                      <p className="text-[10px] md:text-sm text-red-800 dark:text-red-300 font-black whitespace-nowrap">
                        {playerDetails.kills}/{playerDetails.deaths}/{playerDetails.assists}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* 승리팀 선택 안내 */}
      {!isAnswered && (
        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-white/10">
          <p className="text-center text-slate-600 dark:text-slate-500 mb-2 font-semibold text-sm uppercase tracking-wider">승리 팀을 선택해주세요!</p>
        </div>
      )}

      {/* 정답/오답 결과 표시 UI (컴팩트 버전) */}
      {isAnswered && (
        <div className="mt-4 relative z-20 animate-in fade-in slide-in-from-bottom-2 duration-300 font-sans">

          <div className={`relative overflow-hidden rounded-xl border flex items-center justify-between p-3 md:p-4 backdrop-blur-md transition-all duration-300 shadow-sm
            ${isCorrect
              ? 'bg-green-50 dark:bg-green-950/40 border-green-300 dark:border-green-500/30 shadow-[0_0_10px_rgba(34,197,94,0.1)]'
              : 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.1)]'
            }`}>

            {/* 배경 조명 효과 */}
            <div className={`absolute inset-0 opacity-5 bg-gradient-to-r pointer-events-none rounded-xl
              ${isCorrect ? 'from-green-400 to-transparent' : 'from-red-400 to-transparent'}`}>
            </div>

            {/* 좌측: 결과 텍스트 & 아이콘 */}
            <div className="flex items-center gap-3 md:gap-4 relative z-10">
              {/* 아이콘 (사이즈 축소 w-16 -> w-10) */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border shadow-lg flex-shrink-0
                ${isCorrect ? 'bg-green-500/20 border-green-500/30 shadow-green-500/20' : 'bg-red-500/20 border-red-500/30 shadow-red-500/20'}`}>
                {isCorrect ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>

              {/* 텍스트 (좌측 정렬) */}
              <div className="text-left">
                <h2 className={`text-2xl md:text-2xl font-[1000] italic tracking-tighter uppercase leading-none
                  ${isCorrect
                    ? 'text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-green-700 dark:from-green-200 dark:to-green-500'
                    : 'text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-red-700 dark:from-red-200 dark:to-red-500'
                  }`}>
                  {isCorrect ? '정답!' : '오답!'}
                </h2>
                <p className={`text-[10px] font-bold uppercase tracking-widest ${isCorrect ? 'text-green-800 dark:text-green-300/60' : 'text-red-800 dark:text-red-300/60'}`}>
                  {isCorrect ? '예측에 성공하였습니다.' : '예측에 실패하였습니다.'}
                </p>
              </div>
            </div>

            {/* 우측: 다음 버튼 (배너 안으로 통합) */}
            <button
              onClick={onNext}
              className="relative z-10 group px-5 py-2 bg-indigo-600 hover:bg-indigo-500 border border-indigo-600 hover:border-indigo-700 text-white dark:bg-[#1a1c24] dark:hover:bg-[#23252e] dark:border-white/10 dark:hover:border-white/30 rounded-lg overflow-hidden transition-all duration-200 hover:shadow-lg active:scale-95 flex-shrink-0"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-white dark:text-slate-200 uppercase tracking-wide group-hover:text-white">Next</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white dark:text-slate-400 group-hover:text-white transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>

          </div>
        </div>
      )}

      {/* 심층 분석 모드 - 전력 분석 + 골드 그래프 + 팀별 오브젝트 상세 */}
      {isAnswered && (
        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-white/10 animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-4">

          {/* 전력 분석 섹션 (승리 확률 + 레이더 차트) */}
          {champData && match.blueTeamDetails && match.redTeamDetails && (
            <div className="mb-6 space-y-4">
              <div className="flex items-center gap-2 opacity-80">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-600 dark:text-purple-500" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                </svg>
                <span className="text-[14px] font-black text-purple-600 dark:text-purple-500 uppercase tracking-[0.2em]">전력 분석</span>
              </div>

              <div className="flex flex-col gap-6">
                {(() => {
                  const blueStats = calculateTeamStats(match.blueTeamDetails, champData);
                  const redStats = calculateTeamStats(match.redTeamDetails, champData);
                  const winProb = calculateWinProbability(blueStats, redStats, match.tier);
                  const blueProb = winProb?.blue ?? 50.0;
                  const redProb = winProb?.red ?? 50.0;

                  // 선택한 팀에 따라 승리 확률 결정
                  let selectedTeamProb = 50.0;
                  let isBlueTeam = false;
                  if (selectedTeam === 100) {
                    selectedTeamProb = blueProb;
                    isBlueTeam = true;
                  } else if (selectedTeam === 200) {
                    selectedTeamProb = redProb;
                    isBlueTeam = false;
                  } else {
                    selectedTeamProb = blueProb;
                    isBlueTeam = true;
                  }

                  return (
                    <>
                      {/* 상단: 승리 확률 + 레이더 차트 (한 줄) */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* 왼쪽: 승리 확률 */}
                        <div className="bg-white dark:bg-gradient-to-br dark:from-[#121216] dark:to-[#0d0d0f] border border-slate-200 dark:border-white/5 rounded-3xl p-7 md:p-8 flex flex-col items-center justify-center shadow-md relative overflow-hidden min-h-[320px]">
                          <div className="text-center mb-2">
                            <p className="text-slate-600 dark:text-slate-500 text-[15px] font-black tracking-[0.2em] mb-3 uppercase">
                              {selectedTeam ? '선택 팀 승리 확률' : 'WIN PROBABILITY'}
                            </p>
                            <h2
                              className={`text-6xl md:text-7xl font-[1000] italic tracking-tighter ${isBlueTeam ? 'text-blue-700 dark:text-blue-500' : 'text-red-700 dark:text-red-500'
                                } drop-shadow-[0_0_25px_rgba(59,130,246,0.45)]`}
                            >
                              {selectedTeamProb.toFixed(1)}%
                            </h2>
                          </div>
                          <p className="mt-4 text-[11px] text-slate-600 dark:text-slate-500 font-medium text-center leading-relaxed">
                            *해당 확률은 실제 매치 데이터와 관계 없이  <br />
                            양 팀의 챔피언 조합과 성장 기대치를 분석한 결과입니다. <br />
                            실제 매치 결과는 이 확률과 다를 수 있습니다.
                          </p>
                        </div>

                        {/* 오른쪽: 레이더 차트 */}
                        <TeamRadarChart blueStats={blueStats.radarData} redStats={redStats.radarData} />
                      </div>

                      {/* 하단: AI 분석 코멘트 박스 (전체 너비) */}
                      <div className="bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3 text-[12px] leading-relaxed shadow-sm">
                        <p className="text-sm font-black text-indigo-600 dark:text-indigo-400 mb-1">🤖 AI 전문 분석가 코멘트</p>
                        {loadingAi ? (
                          <p className="text-slate-500 dark:text-slate-400 animate-pulse">매치 데이터를 정밀 분석 중입니다...</p>
                        ) : aiAnalysis ? (
                          <div
                            className="text-slate-700 dark:text-slate-300 leading-6 ai-analysis"
                            dangerouslySetInnerHTML={{
                              __html: aiAnalysis
                                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                .replace(/<blue>(.*?)<\/blue>/g, '<strong>$1</strong>')
                                .replace(/<red>(.*?)<\/red>/g, '<strong>$1</strong>')
                                .replace(/<highlight>(.*?)<\/highlight>/g, '<strong>$1</strong>')
                            }}
                          />
                        ) : (
                          <p className="text-slate-500 dark:text-slate-400">분석 데이터를 불러오는 중...</p>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* 골드 그래프 */}
          {loadingGold ? (
            <div className="bg-white dark:bg-[#0a0a0c]/80 border border-slate-200 dark:border-white/5 rounded-2xl p-8 backdrop-blur-md text-center shadow-sm">
              <p className="text-slate-600 dark:text-slate-400 text-sm">골드 데이터 분석 중...</p>
            </div>
          ) : goldData && goldData.length > 0 ? (
            <GoldGraph data={goldData} winningTeam={match.승리팀ID} />
          ) : (
            <div className="bg-white dark:bg-[#0a0a0c]/80 border border-slate-200 dark:border-white/5 rounded-2xl p-4 backdrop-blur-md text-center shadow-sm">
              <p className="text-slate-600 dark:text-slate-500 text-sm">골드 데이터를 불러올 수 없습니다.</p>
            </div>
          )}

          {/* 팀별 오브젝트 상세 (디자인 개선: E-스포츠 분석 스타일) */}
          {(match.blueObjectives || match.redObjectives) && (
            <div className="mt-4 bg-white dark:bg-[#0a0a0c]/80 border border-slate-200 dark:border-white/5 rounded-2xl p-5 backdrop-blur-md shadow-sm">

              {/* 헤더 */}
              <div className="flex items-center gap-2 mb-4 opacity-80">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-yellow-600 dark:text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                <span className="text-[14px] font-black text-yellow-600 dark:text-yellow-500 uppercase tracking-[0.2em]">오브젝트 컨트롤</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* 블루팀 (왼쪽) */}
                <div className="relative group overflow-hidden rounded-xl bg-blue-50 dark:bg-[#1a1c24] border border-blue-100 dark:border-white/5 p-4 hover:border-blue-400 dark:hover:border-blue-500/30 transition-colors shadow-sm">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-black text-blue-800 dark:text-blue-400 uppercase tracking-wider">블루팀</span>
                  </div>

                  <div className="space-y-3">
                    {/* 몬스터 슬롯 */}
                    <div className="flex gap-2">
                      <ObjectBadge type="baron" count={match.blueObjectives?.baron} color="text-purple-400" bgColor="bg-purple-500/10" borderColor="border-purple-500/30" />
                      <ObjectBadge type="dragon" count={match.blueObjectives?.dragon} color="text-orange-400" bgColor="bg-orange-500/10" borderColor="border-orange-500/30" />
                      <ObjectBadge type="herald" count={match.blueObjectives?.riftHerald} color="text-slate-400" bgColor="bg-slate-500/10" borderColor="border-slate-500/30" />
                    </div>

                    {/* 포탑 게이지 */}
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-600 dark:text-slate-400 mb-1">
                        <span>포탑 파괴</span>
                        <span className="font-bold text-slate-900 dark:text-white">{match.blueObjectives?.tower || 0}</span>
                      </div>
                      <div className="h-1.5 w-full bg-blue-200 dark:bg-blue-900/30 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600 dark:bg-blue-500 rounded-full" style={{ width: `${Math.min(((match.blueObjectives?.tower || 0) / 11) * 100, 100)}%` }}></div>
                      </div>
                    </div>

                    {/* 억제기 게이지 */}
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-600 dark:text-slate-400 mb-1">
                        <span>억제기</span>
                        <span className="font-bold text-slate-900 dark:text-white">{match.blueObjectives?.inhibitor || 0}</span>
                      </div>
                      <div className="h-1.5 w-full bg-blue-200 dark:bg-blue-900/30 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600 dark:bg-blue-400 rounded-full" style={{ width: `${Math.min(((match.blueObjectives?.inhibitor || 0) / 3) * 100, 100)}%` }}></div>
                      </div>
                    </div>




                  </div>
                </div>

                {/* 레드팀 (오른쪽) */}
                <div className="relative group overflow-hidden rounded-xl bg-red-50 dark:bg-[#1a1c24] border border-red-100 dark:border-white/5 p-4 hover:border-red-400 dark:hover:border-red-500/30 transition-colors shadow-sm">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-black text-red-800 dark:text-red-400 uppercase tracking-wider">레드팀</span>
                  </div>

                  <div className="space-y-3">
                    {/* 몬스터 슬롯 */}
                    <div className="flex gap-2 justify-end">
                      <ObjectBadge type="baron" count={match.redObjectives?.baron} color="text-purple-400" bgColor="bg-purple-500/10" borderColor="border-purple-500/30" />
                      <ObjectBadge type="dragon" count={match.redObjectives?.dragon} color="text-orange-400" bgColor="bg-orange-500/10" borderColor="border-orange-500/30" />
                      <ObjectBadge type="herald" count={match.redObjectives?.riftHerald} color="text-slate-400" bgColor="bg-slate-500/10" borderColor="border-slate-500/30" />
                    </div>

                    {/* 포탑 게이지 */}
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-600 dark:text-slate-400 mb-1">
                        <span className="font-bold text-slate-900 dark:text-white">{match.redObjectives?.tower || 0}</span>
                        <span>포탑 파괴</span>
                      </div>
                      <div className="h-1.5 w-full bg-red-200 dark:bg-red-900/30 rounded-full overflow-hidden flex justify-end">
                        <div className="h-full bg-red-600 dark:bg-red-500 rounded-full" style={{ width: `${Math.min(((match.redObjectives?.tower || 0) / 11) * 100, 100)}%` }}></div>
                      </div>
                    </div>

                    {/* 억제기 게이지 */}
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-600 dark:text-slate-400 mb-1">
                        <span className="font-bold text-slate-900 dark:text-white">{match.redObjectives?.inhibitor || 0}</span>
                        <span>억제기</span>
                      </div>
                      <div className="h-1.5 w-full bg-red-200 dark:bg-red-900/30 rounded-full overflow-hidden flex justify-end">
                        <div className="h-full bg-red-600 dark:bg-red-400 rounded-full" style={{ width: `${Math.min(((match.redObjectives?.inhibitor || 0) / 3) * 100, 100)}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// [수정] 라이엇 실제 게임 아이콘을 본뜬 진짜 오브젝트 SVG 데이터
const OBJECT_ICONS = {
  // 진짜 바론 모양 (입 벌린 내셔 남작 형상)
  baron: (
    <svg viewBox="0 0 32 32" fill="currentColor" className="w-4 h-4">
      <path d="M16 2L11 9l-2-1 1 5-4-1 2 4-5 1 5 3-2 5 7-2 3 6 3-6 7 2-2-5 5-3-5-1 2-4-4 1 1-5-2 1z" />
    </svg>
  ),
  // 진짜 드래곤 모양 (날개와 뿔이 강조된 형상)
  dragon: (
    <svg viewBox="0 0 32 32" fill="currentColor" className="w-4 h-4">
      <path d="M16 4s-1 3-4 4c-2 1-5 0-5 0s1 3 3 5c-1 2-2 5-2 5s3-1 5-3c1 2 4 3 4 3s-1-3-1-5c2-1 4-4 4-4s-3 0-4-1c1-1 1-4 1-4z" />
      <path d="M25 12s-2 1-3 3 0 4 0 4-2-1-4-1c0 2 1 4 1 4s-3-1-5 0c1 2 2 4 2 4s2-3 5-3c1 1 2 3 2 3s0-3 1-4c2 0 4-2 4-2s-2-1-3-2c1-1 1-3 1-3z" />
    </svg>
  ),
  // 진짜 전령 모양 (눈과 단단한 껍질 형상)
  herald: (
    <svg viewBox="0 0 32 32" fill="currentColor" className="w-4 h-4">
      <path d="M16 6l-8 5 2 9 6 6 6-6 2-9-8-5zm0 4a3 3 0 110 6 3 3 0 010-6z" />
      <path d="M7 12l-3 4 3 6 4-2-4-8zm18 0l3 4-3 6-4-2 4-8z" />
    </svg>
  )
};

// 오브젝트 배지 컴포넌트 (아이콘 + 카운트, 호버 툴팁)
function ObjectBadge({ type, count, color, bgColor, borderColor }) {
  const [isHovered, setIsHovered] = useState(false);

  const labels = {
    baron: '바론 처치',
    dragon: '드래곤 처치',
    herald: '협곡의 전령 처치',
  };

  return (
    <div
      className={`relative flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-all duration-200 ${bgColor} ${borderColor} ${count > 0 ? 'opacity-100 shadow-lg' : 'opacity-20 grayscale'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span className={color}>{OBJECT_ICONS[type]}</span>
      <span className={`text-[12px] font-black ${color}`}>{count || 0}</span>

      {isHovered && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-white dark:bg-black/90 border border-slate-200 dark:border-white/10 rounded text-[10px] font-bold text-slate-900 dark:text-white whitespace-nowrap z-[100] animate-in fade-in zoom-in-95 duration-100 shadow-md">
          {labels[type]}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white dark:border-t-black/90"></div>
        </div>
      )}
    </div>
  );
}

export default MatchCard