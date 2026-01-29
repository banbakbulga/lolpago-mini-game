// 백엔드 서버 URL (개발 환경: localhost:8000, 프로덕션: 환경 변수 사용)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const REGION = 'kr';
const REGION_ASIA = 'asia';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 티어 및 디비전 정의
const TIERS_WITH_DIVISIONS = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND'];
const DIVISIONS = ['I', 'II', 'III', 'IV'];
const TIERS_WITHOUT_DIVISIONS = ['MASTER', 'GRANDMASTER', 'CHALLENGER'];

// 랜덤 티어 선택 함수 (완전 랜덤)
function getRandomTier() {
  // 디비전 있는 티어와 없는 티어를 합쳐서 완전 랜덤 선택
  const allTiers = [
    ...TIERS_WITH_DIVISIONS.map(tier => ({ tier, hasDivision: true })),
    ...TIERS_WITHOUT_DIVISIONS.map(tier => ({ tier, hasDivision: false }))
  ];
  
  const randomTier = allTiers[Math.floor(Math.random() * allTiers.length)];
  
  if (randomTier.hasDivision) {
    const division = DIVISIONS[Math.floor(Math.random() * DIVISIONS.length)];
    return { tier: randomTier.tier, division };
  } else {
    return { tier: randomTier.tier, division: null };
  }
}

// 1. 특정 티어/디비전의 유저 리스트 가져오기
export async function getLeagueEntries(tier, division = null, page = 1) {
  /**await delay(100);**/
  const divisionParam = division ? `/${division}` : '';
  const url = `${API_BASE_URL}/api/league-entries/${tier}${divisionParam}?page=${page}`;
  
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${tier} ${division || ''} 호출 실패: ${response.status}`);
  const data = await response.json();
  return data || [];
}

// 마스터 리그 유저 리스트 가져오기 (하위 호환성)
export async function getMasterLeague() {
  return await getLeagueEntries('MASTER', null);
}

// 2. summonerId로 PUUID 구하기
export async function getSummonerBySummonerId(summonerId) {
  const url = `${API_BASE_URL}/api/summoner/${summonerId}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`소환사 정보 호출 실패: ${response.status}`);
  return await response.json();
}

// 3. PUUID로 매치 ID 리스트 가져오기
export async function getMatchIdsByPuuid(puuid, count = 5) {
  const url = `${API_BASE_URL}/api/match-ids/${puuid}?count=${count}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`매치 ID 리스트 호출 실패: ${response.status}`);
  return await response.json();
}

// 4. 매치 상세 정보 가져오기
export async function getMatchByMatchId(matchId) {
  const url = `${API_BASE_URL}/api/match/${matchId}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`매치 데이터 호출 실패: ${response.status}`);
  return await response.json();
}

// 5. 매치 타임라인 정보 가져오기
export async function getMatchTimelineByMatchId(matchId) {
  const url = `${API_BASE_URL}/api/match/${matchId}/timeline`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`타임라인 데이터 호출 실패: ${response.status}`);
  }
  return await response.json();
}

// 6. 골드 데이터 파싱 함수 (챔피언 한글 이름 매핑 지원)
export function parseGoldData(timelineData, matchProp, champData) {
  if (!timelineData?.info?.frames) return [];

  // 챔피언 한글 이름 변환 헬퍼 (champData 기반)
  const getKoName = (englishName) => {
    if (!champData || !englishName) return englishName;
    return champData[englishName]?.name || englishName;
  };

  // 참가자 ID -> 챔피언 이름 매핑 (MatchCard의 match prop 구조 사용)
  const participantMap = {};
  if (matchProp?.blueTeamDetails) {
    matchProp.blueTeamDetails.forEach((p, i) => {
      participantMap[i + 1] = p.koName || getKoName(p.championName) || p.championName;
    });
  }
  if (matchProp?.redTeamDetails) {
    matchProp.redTeamDetails.forEach((p, i) => {
      participantMap[i + 6] = p.koName || getKoName(p.championName) || p.championName;
    });
  }

  return timelineData.info.frames.map((frame, index) => {
    // 블루/레드 팀 골드 합계
    const blueGold = frame.participantFrames 
      ? Object.values(frame.participantFrames)
          .filter(p => p.participantId <= 5)
          .reduce((sum, p) => sum + (p.totalGold || 0), 0)
      : 0;
      
    const redGold = frame.participantFrames 
      ? Object.values(frame.participantFrames)
          .filter(p => p.participantId > 5)
          .reduce((sum, p) => sum + (p.totalGold || 0), 0)
      : 0;

    const matchEvents = [];
    const getTeam = (id) => (!id ? null : id <= 5 ? 'Blue' : 'Red');
    const getChampName = (id) => participantMap[id] || '';

    if (frame.events && frame.events.length > 0) {
      frame.events.forEach(e => {
        // A. 챔피언 특수 킬 (멀티킬, 에이스)
        if (e.type === 'CHAMPION_SPECIAL_KILL') {
          const team = getTeam(e.killerId);
          const name = getChampName(e.killerId);
          if (team) {
            if (e.killType === 'KILL_MULTI' || e.multiKillLength >= 3) {
              const len = e.multiKillLength || 0;
              if (len === 3) matchEvents.push({ type: 'kill', team, text: `트리플킬! (${name})` });
              else if (len === 4) matchEvents.push({ type: 'kill', team, text: `쿼드라킬! (${name})` });
              else if (len === 5) matchEvents.push({ type: 'penta', team, text: `펜타킬!!! (${name})` });
            }
            if (e.killType === 'KILL_ACE') {
              matchEvents.push({ type: 'ace', team, text: 'ACE!' });
            }
          }
        }

        // B. 제압 골드 (챔피언 이름 포함)
        if (e.type === 'CHAMPION_KILL' && e.killerId) {
          const team = getTeam(e.killerId);
          const name = getChampName(e.killerId);
          if (team) {
            const bounty = e.shutdownValue || (e.bounty && e.bounty > 300 ? e.bounty : 0);
            if (bounty > 0) {
              matchEvents.push({ type: 'gold', team, text: `제압골드 획득 +${bounty}G (${name})` });
            }
          }
        }

        // C. 엘리트 몬스터 (바론/드래곤/전령)
        if (e.type === 'ELITE_MONSTER_KILL') {
          let team = null;
          if (e.killerTeamId) team = e.killerTeamId === 100 ? 'Blue' : 'Red';
          else if (e.killerId) team = getTeam(e.killerId);

          if (team) {
            if (e.monsterType === 'BARON_NASHOR') {
              matchEvents.push({ type: 'obj', team, text: '바론 처치' });
            } else if (e.monsterType === 'DRAGON') {
              if (e.monsterSubType === 'ELDER_DRAGON') matchEvents.push({ type: 'obj', team, text: '장로 드래곤 처치' });
              else matchEvents.push({ type: 'obj', team, text: '드래곤 처치' });
            } else if (e.monsterType === 'RIFTHERALD') {
              matchEvents.push({ type: 'obj', team, text: '전령 처치' });
            }
          }
        }

        // D. 억제기 파괴
        if (e.type === 'BUILDING_KILL' && e.buildingType === 'INHIBITOR_BUILDING') {
          const team = e.teamId === 200 ? 'Blue' : 'Red';
          let lane = '';
          if (e.laneType === 'MID_LANE') lane = '미드';
          else if (e.laneType === 'TOP_LANE') lane = '탑';
          else if (e.laneType === 'BOT_LANE') lane = '바텀';
          
          if (lane) {
            matchEvents.push({ type: 'obj', team, text: `${lane} 억제기 파괴` });
          }
        }
      });
    }

    return {
      time: Math.floor(index),
      diff: blueGold - redGold,
      blueGold,
      redGold,
      matchEvents,
    };
  });
}

// 데이터 파싱 함수
function parseMatchData(matchData) {
  if (!matchData?.info?.participants) return null;
  const { participants, teams } = matchData.info;

  // 포지션 순서 정의
  const positionOrder = { 'TOP': 0, 'JUNGLE': 1, 'MIDDLE': 2, 'BOTTOM': 3, 'UTILITY': 4 };

  // 팀별 픽 정보 정렬 (탑, 정글, 미드, 원딜, 서폿 순) + 상세 정보 포함
  const getSortedTeam = (teamId) => {
    return participants
      .filter(p => p.teamId === teamId)
      .sort((a, b) => {
        const posA = positionOrder[a.teamPosition] ?? 999;
        const posB = positionOrder[b.teamPosition] ?? 999;
        return posA - posB;
      })
      .map(p => ({
        championName: p.championName,
        teamPosition: p.teamPosition,
        kills: p.kills,
        deaths: p.deaths,
        assists: p.assists,
        totalMinionsKilled: p.totalMinionsKilled || 0,
        neutralMinionsKilled: p.neutralMinionsKilled || 0,
        items: [
          p.item0 || 0,
          p.item1 || 0,
          p.item2 || 0,
          p.item3 || 0,
          p.item4 || 0,
          p.item5 || 0
        ] // 6개 슬롯 모두 포함 (0은 빈 슬롯)
      }));
  };

  // 밴 정보 추출
  const extractBans = (teamId) => {
    const team = teams.find(t => t.teamId === teamId);
    return team?.bans?.map(b => b.championId) || [];
  };

  // 팀별 오브젝트 정보 추출
  const extractTeamObjectives = (teamId) => {
    const team = teams.find(t => t.teamId === teamId);
    if (!team?.objectives) return null;
    
    return {
      dragon: team.objectives.dragon?.kills || 0,
      baron: team.objectives.baron?.kills || 0,
      tower: team.objectives.tower?.kills || 0,
      inhibitor: team.objectives.inhibitor?.kills || 0,
      riftHerald: team.objectives.riftHerald?.kills || 0
    };
  };

  // 게임 시간 계산 (초를 분:초로 변환)
  const gameDurationSeconds = matchData.info.gameDuration || 0;
  const minutes = Math.floor(gameDurationSeconds / 60);
  const seconds = gameDurationSeconds % 60;
  const gameDuration = `${minutes}분 ${seconds}초`;

  return {
    matchId: matchData.metadata.matchId,
    blueTeam: getSortedTeam(100).map(p => p.championName),
    redTeam: getSortedTeam(200).map(p => p.championName),
    blueTeamDetails: getSortedTeam(100), // 상세 정보 포함
    redTeamDetails: getSortedTeam(200), // 상세 정보 포함
    blueBans: extractBans(100),
    redBans: extractBans(200),
    blueObjectives: extractTeamObjectives(100),
    redObjectives: extractTeamObjectives(200),
    승리팀ID: teams.find(team => team.win).teamId,
    gameDuration: gameDuration,
    gameDurationSeconds: gameDurationSeconds
  };
}

// 최종 수집 함수 (다양한 티어에서 랜덤 수집)
export async function collectMasterMatchData(matchCount = 10, matchesPerUser = 1) {
  try {
    const allMatchData = [];
    const targetCount = matchCount; // 목표 매치 수
    
    // 다양한 티어에서 랜덤하게 유저 선택하여 매치 수집
    while (allMatchData.length < targetCount) {
      // 랜덤 티어 선택
      const { tier, division } = getRandomTier();
      
      try {
        const entries = await getLeagueEntries(tier, division);
        
        // 엔트리가 없으면 다음 티어로
        if (!entries || entries.length === 0) {
          console.warn(`${tier} ${division || ''} 엔트리가 없습니다.`);
          continue;
        }

        // 랜덤하게 유저 선택
        const shuffled = entries.sort(() => 0.5 - Math.random());
        const selectedUser = shuffled[0]; // 1명씩 선택

        // puuid 확인 (엔트리에서 puuid가 없으면 summonerId로 조회 필요)
        let puuid = selectedUser.puuid;
        
        if (!puuid && selectedUser.summonerId) {
          // puuid가 없으면 summonerId로 조회
          const summonerInfo = await getSummonerBySummonerId(selectedUser.summonerId);
          puuid = summonerInfo.puuid;
        }
        
        if (!puuid) {
          console.warn(`유저의 puuid를 찾을 수 없습니다.`, selectedUser);
          continue;
        }

        const matchIds = await getMatchIdsByPuuid(puuid, matchesPerUser);

        for (const matchId of matchIds) {
          // 목표 개수에 도달하면 중단
          if (allMatchData.length >= targetCount) {
            break;
          }
          
          const matchData = await getMatchByMatchId(matchId);
          const parsed = parseMatchData(matchData);
          
          // 매치 duration 필터링 (너무 짧은 게임 제외)
          // 최소 10분(600초) 이상인 게임만 수집 (조기 항복, 다시하기, 버그 게임 등 제외)
          if (parsed && parsed.gameDurationSeconds >= 600) {
            // 티어 정보 추가
            parsed.tier = division ? `${tier} ${division}` : tier;
            allMatchData.push(parsed);
          } else if (parsed) {
            console.warn(`매치 ${matchId} 제외: 게임 시간이 너무 짧음 (${parsed.gameDurationSeconds}초)`);
          }
        }
      } catch (error) {
        console.warn(`${tier} ${division || ''} 수집 중 오류:`, error);
        // 오류가 발생해도 다음 티어로 계속 진행
        continue;
      }
    }
    
    return allMatchData.slice(0, targetCount); // 정확히 목표 개수만 반환
  } catch (error) {
    console.error("수집 실패:", error);
    throw error;
  }
}