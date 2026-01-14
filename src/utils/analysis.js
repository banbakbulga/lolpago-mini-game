import championScores from '../data/champions_score.json';

// 티어 파싱 및 카테고리화
export function parseTierCategory(tierString) {
  if (!tierString) return 'MID'; // 기본값
  
  const tierUpper = tierString.toUpperCase();
  
  // LOW: IRON, BRONZE, SILVER, GOLD
  if (tierUpper.includes('IRON') || tierUpper.includes('BRONZE') || 
      tierUpper.includes('SILVER') || tierUpper.includes('GOLD')) {
    return 'LOW';
  }
  
  // MID: PLATINUM, EMERALD
  if (tierUpper.includes('PLATINUM') || tierUpper.includes('EMERALD')) {
    return 'MID';
  }
  
  // HIGH: DIAMOND, MASTER, GRANDMASTER, CHALLENGER
  if (tierUpper.includes('DIAMOND') || tierUpper.includes('MASTER') || 
      tierUpper.includes('GRANDMASTER') || tierUpper.includes('CHALLENGER')) {
    return 'HIGH';
  }
  
  return 'MID'; // 기본값
}

// 티어별 기본 가중치 테이블
const TIER_WEIGHTS = {
  LOW: {
    early: 0.15,
    late: 0.22,
    init: 0.16,
    tank: 0.18,
    cc: 0.17,
    damage: 0.12,
  },
  MID: {
    early: 0.22,
    late: 0.16,
    init: 0.20,
    tank: 0.14,
    cc: 0.16,
    damage: 0.12,
  },
  HIGH: {
    early: 0.28,
    late: 0.10,
    init: 0.24,
    tank: 0.12,
    cc: 0.16,
    damage: 0.10,
  },
};

// HIGH 티어 전용 왕귀 환경 시너지 보정
function applyScalingEnvironmentBonus(radarData, baseWeights, hasScalingChamp) {
  if (!hasScalingChamp) return baseWeights;
  // 서포팅 지수 계산: (tank + cc + early) / 3
  const supportingIndex = (radarData.tank + radarData.cc + radarData.early) / 3;
  
  // 조건: 서포팅 지수 >= 70 && 평균 late >= 75
  if (supportingIndex >= 70 && radarData.late >= 75) {
    // late 가중치 상향 (0.10 -> 0.18), early 가중치 하향 (0.28 -> 0.20)
    return {
      ...baseWeights,
      late: 0.18,
      early: 0.20,
    };
  }
  
  return baseWeights;
}

// AD/AP 밸런스 멀티플라이어 계산
const getBalanceMultiplier = (adRatio) => {
  // adRatio: 0~1
  const adPercent = adRatio * 100;
  const apPercent = 100 - adPercent;
  const major = Math.max(adPercent, apPercent); // 큰 비율

  if (major >= 90) return 0.85;
  if (major >= 80) return 0.92;
  if (major >= 70) return 0.97;
  // 이상적 55~65% 구간
  return 1.0;
};

// 팀별 지표 계산
// - radarData: 레이더 차트용 6개 지표 (early, late, tank, damage, cc, init)
// - hiddenData: 보조 지표 (damageBalance, adRatio)
export function calculateTeamStats(teamDetails, champData) {
  if (!teamDetails || !teamDetails.length || !champData) {
    return {
      radarData: {
        early: 0,
        late: 0,
        tank: 0,
        damage: 0,
        cc: 0,
        init: 0,
      },
      hiddenData: {
        damageBalance: 0,
        adRatio: 0.5,
      },
    };
  }

  let count = 0;
  const sums = {
    early: 0,
    late: 0,
    tank: 0,
    damage: 0,
    cc: 0,
    init: 0,
  };

  let adSum = 0;
  let apSum = 0;
  let hasScalingChamp = false;

  teamDetails.forEach((player) => {
    if (!player?.championName) return;
    const score = championScores[player.championName];
    const d = champData[player.championName];

    if (score) {
      sums.early += score.early || 0;
      sums.late += score.late || 0;
      sums.tank += score.tank || 0;
      sums.damage += score.damage || 0;
      sums.cc += score.cc || 0;
      sums.init += score.init || 0;
      count += 1;

      // 왕귀 챔피언 판정: early ≤ 49 && late ≥ 95
      if (!hasScalingChamp && (score.early || 0) <= 49 && (score.late || 0) >= 95) {
        hasScalingChamp = true;
      }
    }

    if (d && d.info) {
      adSum += d.info.attack || 0;
      apSum += d.info.magic || 0;
    }
  });

  const safeCount = count > 0 ? count : 1;

  const radarData = {
    early: Math.min(100, Math.max(0, sums.early / safeCount)),
    late: Math.min(100, Math.max(0, sums.late / safeCount)),
    tank: Math.min(100, Math.max(0, sums.tank / safeCount)),
    damage: Math.min(100, Math.max(0, sums.damage / safeCount)),
    cc: Math.min(100, Math.max(0, sums.cc / safeCount)),
    init: Math.min(100, Math.max(0, sums.init / safeCount)),
  };

  const totalSum = adSum + apSum;
  let adRatio = 0.5;
  let damageBalance = 50;
  if (totalSum > 0) {
    adRatio = adSum / totalSum;
    damageBalance = 100 - Math.abs(0.5 - adRatio) * 200;
    damageBalance = Math.max(0, Math.min(100, damageBalance));
  }

  return {
    radarData,
    hiddenData: {
      damageBalance,
      adRatio,
      hasScalingChamp,
    },
  };
}

// 승리 확률 계산 (티어별 맞춤형 멀티플라이어 기반)
export function calculateWinProbability(blueStats, redStats, tier = null) {
  if (!blueStats || !redStats) return { blue: 50.0, red: 50.0, comment: '' };

  // 티어 카테고리 파싱
  const tierCategory = parseTierCategory(tier);
  
  // 티어별 기본 가중치 가져오기
  const baseWeights = { ...TIER_WEIGHTS[tierCategory] };
  
  // 공통 점수 계산 헬퍼
  const calcScore = (stat, weights) => {
    const r = stat?.radarData || {};
    const h = stat?.hiddenData || {};
    const adRatio = h.adRatio ?? 0.5;
    const balanceMultiplier = getBalanceMultiplier(adRatio);

    const lateAdjusted = (r.late || 0) * balanceMultiplier;

    const score =
      (r.early || 0) * weights.early +
      lateAdjusted * weights.late +
      (r.init || 0) * weights.init +
      (r.cc || 0) * weights.cc +
      (r.tank || 0) * weights.tank +
      (r.damage || 0) * weights.damage;

    return { score, balanceMultiplier };
  };

  let blueWeights = baseWeights;
  let redWeights = baseWeights;
  let blueScalingBonus = false;
  let redScalingBonus = false;

  // HIGH 티어에서 왕귀 환경 시너지 보정 적용
  if (tierCategory === 'HIGH') {
    const blueRadar = blueStats?.radarData || {};
    const redRadar = redStats?.radarData || {};
    const blueHidden = blueStats?.hiddenData || {};
    const redHidden = redStats?.hiddenData || {};

    blueWeights = applyScalingEnvironmentBonus(blueRadar, baseWeights, !!blueHidden.hasScalingChamp);
    redWeights = applyScalingEnvironmentBonus(redRadar, baseWeights, !!redHidden.hasScalingChamp);

    blueScalingBonus = blueWeights.late !== baseWeights.late;
    redScalingBonus = redWeights.late !== baseWeights.late;
  }

  const blueRes = calcScore(blueStats, blueWeights);
  const redRes = calcScore(redStats, redWeights);
  const blueScore = blueRes.score;
  const redScore = redRes.score;
  const total = blueScore + redScore;

  if (total === 0) return { blue: 50.0, red: 50.0, comment: '' };

  const blueProb = (blueScore / total) * 100;
  const redProb = 100 - blueProb;

  const blueProbFixed = Number(blueProb.toFixed(1));
  const redProbFixed = Number(redProb.toFixed(1));

  const comment = generateAnalysisComment(blueStats, redStats, {
    tierCategory,
    blueProb: blueProbFixed,
    redProb: redProbFixed,
    blueBalanceMult: blueRes.balanceMultiplier,
    redBalanceMult: redRes.balanceMultiplier,
    blueScalingBonus,
    redScalingBonus,
  });

  return {
    blue: blueProbFixed,
    red: redProbFixed,
    comment,
  };
}

// 티어별 메타 멘트 풀
const TIER_META_COMMENTS = {
  HIGH: [
    '고티어 매치인 만큼 초반 설계와 오브젝트 주도권 확보가 특히 중요합니다.',
    '수준 높은 교전이 예상되는 만큼 정글러의 초반 동선과 시야 장악이 승부처가 될 것입니다.',
    '작은 실수가 곧바로 패배로 직결되는 구간입니다. 세밀한 운영과 인원 분배가 핵심입니다.',
    '적극적인 합류를 통한 인원수 우위 점유가 승패를 가를 핵심 포인트입니다.',
  ],
  LOW: [
    '실수가 잦은 구간 특성상 후반 한타 집중력이 승패를 가를 가능성이 큽니다.',
    '초반에 다소 불리하더라도 제압 골드나 한타 한 번으로 역전이 자주 일어나는 구간입니다.',
    '개개인의 피지컬 못지않게 팀원 간의 멘탈 관리와 후반 뒷심이 승리로 이끌 것입니다.',
    '복잡한 운영보다는 잘 큰 딜러를 중심으로 뭉치는 한타 집중력이 빛을 발할 것입니다.',
  ],
  MID: [
    '라인전 주도권과 한타 밸런스 모두가 중요한 구간입니다.',
    '중반 용/전령 교전에서의 승리가 게임 전체의 템포를 결정짓는 핵심이 될 것입니다.',
    '기본적인 라인전을 이기면서도 팀원 간의 빠른 백업 속도가 승률을 결정지을 것입니다.',
  ],
};

// 분석 코멘트 생성
export function generateAnalysisComment(blueStats, redStats, meta) {
  const radarBlue = blueStats?.radarData || {};
  const radarRed = redStats?.radarData || {};

  // 승리 확률이 높은 팀 기준으로 분석
  const leadingIsBlue = (meta.blueProb ?? 50) >= (meta.redProb ?? 50);
  const leadingTeam = leadingIsBlue ? '블루팀' : '레드팀';
  const leadingRadar = leadingIsBlue ? radarBlue : radarRed;
  const opponentRadar = leadingIsBlue ? radarRed : radarBlue;

  // 상대 대비 지표 차이 계산 (leading - opponent)
  const diffMetrics = [
    { key: 'early', diff: (leadingRadar.early || 0) - (opponentRadar.early || 0) },
    { key: 'late', diff: (leadingRadar.late || 0) - (opponentRadar.late || 0) },
    { key: 'tank', diff: (leadingRadar.tank || 0) - (opponentRadar.tank || 0) },
    { key: 'cc', diff: (leadingRadar.cc || 0) - (opponentRadar.cc || 0) },
    { key: 'damage', diff: (leadingRadar.damage || 0) - (opponentRadar.damage || 0) },
    { key: 'init', diff: (leadingRadar.init || 0) - (opponentRadar.init || 0) },
  ];

  // 상대보다 높은 지표만 대상으로, 차이가 큰 순으로 상위 2개 선택
  const positiveDiffs = diffMetrics.filter(m => m.diff > 0);
  positiveDiffs.sort((a, b) => b.diff - a.diff);
  const topTwo = (positiveDiffs.length ? positiveDiffs : diffMetrics)
    .slice(0, 2)
    .map(m => m.key);

  let comment = '';

  // 1. 핵심 지표 분석 (상대 대비 상위 2개 강점)
  const metricSentences = {
    early: `${leadingTeam}이 상대보다 강력한 초반 라인 주도권을 바탕으로 스노우볼을 굴리기에 유리합니다.`,
    late: `${leadingTeam}의 후반 스케일링이 상대 팀을 압도하며, 시간이 흐를수록 승리 가능성이 높아집니다.`,
    tank: `${leadingTeam}이 상대보다 훨씬 단단한 앞라인을 보유하여 한타 유지력에서 확실한 우위에 있습니다.`,
    cc: `${leadingTeam}의 군중 제어 능력이 상대보다 뛰어나 난전 속에서 변수를 창출하기에 최적입니다.`,
    damage: `${leadingTeam}의 압도적인 지속 화력이 상대 팀의 방어력을 뚫어내기에 충분해 보입니다.`,
    init: `${leadingTeam}의 날카로운 강제 교전 능력이 상대의 허를 찌를 핵심 변수가 될 것입니다.`,
  };

  topTwo.forEach((key) => {
    if (metricSentences[key]) {
      comment += `${metricSentences[key]} `;
    }
  });

  // 2. 티어별 메타 멘트 (랜덤 선택)
  const tierCategory = meta.tierCategory || 'MID';
  const tierComments = TIER_META_COMMENTS[tierCategory] || TIER_META_COMMENTS.MID;
  if (tierComments && tierComments.length > 0) {
    const randomIndex = Math.floor(Math.random() * tierComments.length);
    comment += `${tierComments[randomIndex]} `;
  }

  // 3. AD/AP 불균형 패널티 언급
  const bluePenalized = meta.blueBalanceMult && meta.blueBalanceMult < 1.0;
  const redPenalized = meta.redBalanceMult && meta.redBalanceMult < 1.0;

  if (bluePenalized && !redPenalized) {
    comment += '⚠️ 블루팀은 AD/AP 조합이 한쪽으로 치우쳐 있어, 후반 상대 방어 아이템 대응에 취약할 수 있습니다. ';
  } else if (redPenalized && !bluePenalized) {
    comment += '⚠️ 레드팀은 AD/AP 조합이 한쪽으로 치우쳐 있어, 후반 상대 방어 아이템 대응에 취약할 수 있습니다. ';
  } else if (bluePenalized && redPenalized) {
    comment += '⚠️ 양 팀 모두 AD/AP 조합이 한쪽으로 치우쳐 있어, 후반 아이템 선택에 따라 변수가 커질 수 있습니다. ';
  }

  // 4. 왕귀 시너지 보너스 언급 (HIGH 티어 전용)
  if (meta.tierCategory === 'HIGH') {
    if (meta.blueScalingBonus && !meta.redScalingBonus) {
      comment += '\n\n✨ 시너지: 블루팀은 든든한 서포팅 라인을 바탕으로 한 왕귀 조합이 강하게 평가됩니다.';
    } else if (meta.redScalingBonus && !meta.blueScalingBonus) {
      comment += '\n\n✨ 시너지: 레드팀은 든든한 서포팅 라인을 바탕으로 한 왕귀 조합이 강하게 평가됩니다.';
    } else if (meta.blueScalingBonus && meta.redScalingBonus) {
      comment += '\n\n✨ 양 팀 모두 서포팅 지수와 성장성이 높아, 후반 왕귀 구도가 흥미롭게 맞붙는 조합입니다.';
    }
  }

  return comment.trim();
}

