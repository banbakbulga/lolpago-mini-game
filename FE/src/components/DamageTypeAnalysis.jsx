import React from 'react';

// 팀별 물리/마법 데미지 비중 바
const DamageTypeAnalysis = ({ teamDetails = [], champData, version, isRed = false }) => {
  if (!teamDetails || !champData || !version) return null;

  // 팀의 AD/AP 총합 계산
  const totals = teamDetails.reduce(
    (acc, p) => {
      const d = champData[p.championName];
      if (d && d.info) {
        acc.ad += d.info.attack || 0;
        acc.ap += d.info.magic || 0;
      }
      return acc;
    },
    { ad: 0, ap: 0 }
  );

  const total = totals.ad + totals.ap;
  const safeTotal = total > 0 ? total : 1;
  const adPercent = Math.round((totals.ad / safeTotal) * 100) || 50;
  const apPercent = 100 - adPercent;

  return (
    <div className={`flex flex-col gap-2 ${isRed ? 'items-end' : 'items-start'}`}>
      {/* 비율 텍스트 */}
      <div className="flex justify-between text-[10px] font-black uppercase tracking-tighter w-full px-1">
        <span className="text-orange-400">물리 {adPercent}%</span>
        <span className="text-cyan-300">마법 {apPercent}%</span>
      </div>

      {/* 데미지 타입 바 */}
      <div className="w-full h-1.5 bg-slate-200 dark:bg-white/5 rounded-full overflow-hidden flex">
        <div
          style={{ width: `${adPercent}%` }}
          className="h-full bg-gradient-to-r from-orange-500 to-amber-400"
        />
        <div
          style={{ width: `${apPercent}%` }}
          className="h-full bg-gradient-to-r from-sky-400 to-cyan-300"
        />
      </div>

    </div>
  );
};

export default DamageTypeAnalysis;


