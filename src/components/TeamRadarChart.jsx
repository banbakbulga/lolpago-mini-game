import { useState } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

const TeamRadarChart = ({ blueStats, redStats }) => {
  const [hoveredIndicator, setHoveredIndicator] = useState(null);

  if (!blueStats || !redStats) return null;

  const b = blueStats.radarData || blueStats;
  const r = redStats.radarData || redStats;

  // 지표 설명 데이터
  const indicatorDescriptions = {
    '초반': '초반 라인/스노우볼 지표.',
    '후반': '후반 성장 및 스케일링 지표.',
    '탱킹': '앞라인 유지력/내구도.',
    'CC': '군중 제어 능력. 변수 창출 가능성.',
    '지속딜': '지속 화력, DPS 잠재력.',
    '이니시': '강제 교전/진입, 한타 개시력.'
  };

  // 레이더 차트 데이터 포맷팅
  const data = [
    { name: '초반', A: b.early || 0, B: r.early || 0 },
    { name: '후반', A: b.late || 0, B: r.late || 0 },
    { name: '탱킹', A: b.tank || 0, B: r.tank || 0 },
    { name: 'CC', A: b.cc || 0, B: r.cc || 0 },
    { name: '지속딜', A: b.damage || 0, B: r.damage || 0 },
    { name: '이니시', A: b.init || 0, B: r.init || 0 },
  ];

  // 커스텀 tick 렌더링
  const renderCustomTick = ({ payload, x, y, cx, cy }) => {
    const name = payload.value;
    const isRight = x > cx;
    
    // 초반/CC 라벨은 살짝 위치 조정
    let adjustedX = x;
    let adjustedY = y;
    let textAnchor = isRight ? 'start' : 'end';
    
    if (name === '초반') {
      adjustedX = x + (isRight ? 1 : -1); // 오른쪽으로 이동
      adjustedY = y - 8; // 위로 이동
      textAnchor = 'middle'; // 중앙 정렬
    } else if (name === 'CC') {
      adjustedX = x + (isRight ? 1 : -1); // 오른쪽으로 이동
      adjustedY = y + 8; // 아래로 이동
      textAnchor = 'middle'; // 중앙 정렬
    }
    
    return (
      <g key={name}>
        <text
          x={adjustedX}
          y={adjustedY}
          fill="#cbd5f5"
          fontSize={12}
          fontWeight={800}
          textAnchor={textAnchor}
          dominantBaseline="central"
          onMouseEnter={() => setHoveredIndicator(name)}
          onMouseLeave={() => setHoveredIndicator(null)}
          className="cursor-help"
        >
          {name}
        </text>
      </g>
    );
  };

  return (
    <div className="w-full h-[360px] bg-gradient-to-br from-[#121216] to-[#0a0a0c] border border-white/5 rounded-3xl p-6 backdrop-blur-md relative">
      <h3 className="text-[14px] font-black text-slate-400 mb-2 uppercase tracking-widest text-center">조합 분석</h3>
      <ResponsiveContainer width="100%" height="90%">
        <RadarChart cx="50%" cy="50%" outerRadius="85%" data={data}>
          <PolarGrid stroke="#ffffff0a" radialLines={false} />
          <PolarAngleAxis 
            dataKey="name" 
            tick={renderCustomTick}
          />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
          
          {/* 블루팀 (순수 블루) */}
          <Radar
            name="블루팀"
            dataKey="A"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.35}
            strokeWidth={2}
          />
          
          {/* 레드팀 (빨강 계열) */}
          <Radar
            name="레드팀"
            dataKey="B"
            stroke="#ef4444"
            fill="#ef4444"
            fillOpacity={0.35}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
      
      {/* 툴팁 (레이더 차트 외부에 표시) */}
      {hoveredIndicator && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
          <div className="bg-black/95 backdrop-blur-md border border-white/10 rounded-lg p-3 shadow-2xl max-w-[200px]">
            <p className="text-white text-xs font-bold mb-1">{hoveredIndicator}</p>
            <p className="text-slate-400 text-[10px] leading-relaxed">
              {indicatorDescriptions[hoveredIndicator] || '설명 없음'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamRadarChart;

