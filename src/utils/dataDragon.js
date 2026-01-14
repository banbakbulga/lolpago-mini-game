// Data Dragon API 유틸리티

let championDataCache = null;
let latestVersion = null;

/**
 * 최신 Data Dragon 버전 가져오기
 */
export async function getLatestVersion() {
  if (latestVersion) return latestVersion;
  
  try {
    const response = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
    const versions = await response.json();
    latestVersion = versions[0]; // 최신 버전
    return latestVersion;
  } catch (error) {
    console.error('버전 가져오기 실패:', error);
    return '14.1.1'; // 기본 버전
  }
}

/**
 * 챔피언 데이터 가져오기 (캐싱)
 */
export async function getChampionData() {
  if (championDataCache) return championDataCache;
  
  try {
    const version = await getLatestVersion();
    const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/ko_KR/champion.json`);
    const data = await response.json();
    championDataCache = data.data;
    return championDataCache;
  } catch (error) {
    console.error('챔피언 데이터 가져오기 실패:', error);
    return {};
  }
}

/**
 * getAllChampionData - riotApi에서 사용할 수 있도록 export
 */
export async function getAllChampionData() {
  return await getChampionData();
}

/**
 * 챔피언 ID를 챔피언 이름으로 변환
 */
export async function getChampionNameById(championId) {
  const championData = await getChampionData();
  
  // championData에서 championId와 일치하는 챔피언 찾기
  for (const [key, value] of Object.entries(championData)) {
    if (value.key === String(championId)) {
      return key; // 챔피언 이름 (예: "Aatrox")
    }
  }
  
  return null;
}

/**
 * 챔피언 ID 배열을 챔피언 이름 배열로 변환
 */
export async function getChampionNamesByIds(championIds) {
  const names = await Promise.all(
    championIds.map(id => getChampionNameById(id))
  );
  return names.filter(name => name !== null);
}

/**
 * 챔피언 일러스트 URL 가져오기
 * @param {string} championName - 챔피언 이름 (예: "Aatrox")
 * @param {number} skinIndex - 스킨 인덱스 (기본값: 0)
 */
export async function getChampionSplashUrl(championName, skinIndex = 0) {
  if (!championName) return null;
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${championName}_${skinIndex}.jpg`;
}

/**
 * 챔피언 아이콘 URL 가져오기
 * @param {string} championName - 챔피언 이름
 */
export async function getChampionIconUrl(championName) {
  if (!championName) return null;
  const version = await getLatestVersion();
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${championName}.png`;
}

/**
 * 챔피언 ID로 일러스트 URL 가져오기
 */
export async function getChampionSplashUrlById(championId) {
  const championName = await getChampionNameById(championId);
  if (!championName) return null;
  return getChampionSplashUrl(championName);
}

/**
 * 챔피언 ID로 아이콘 URL 가져오기
 */
export async function getChampionIconUrlById(championId) {
  const championName = await getChampionNameById(championId);
  if (!championName) return null;
  return getChampionIconUrl(championName);
}

// 아이템 데이터 캐시
let itemDataCache = null;

/**
 * 아이템 데이터 가져오기 (캐싱)
 */
export async function getItemData() {
  if (itemDataCache) return itemDataCache;
  
  try {
    const version = await getLatestVersion();
    const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/ko_KR/item.json`);
    const data = await response.json();
    itemDataCache = data.data;
    return itemDataCache;
  } catch (error) {
    console.error('아이템 데이터 가져오기 실패:', error);
    return {};
  }
}

/**
 * getAllItemData - MatchCard에서 사용할 수 있도록 export
 */
export async function getAllItemData() {
  return await getItemData();
}

/**
 * 아이템 이미지 URL 가져오기
 */
export function getItemUrl(itemId) {
  if (!itemId || itemId === 0) return null;
  // version은 동적으로 가져와야 하지만, 간단하게 하기 위해 함수로 처리
  return `https://ddragon.leagueoflegends.com/cdn/img/item/${itemId}.png`;
}
