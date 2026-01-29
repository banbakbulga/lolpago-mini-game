import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useTheme } from '../context/ThemeContext';

function GoldGraph({ data }) {
  if (!data || data.length === 0) return null;
  const { isDarkMode } = useTheme();

  // 1. 데이터 샘플링 및 이벤트 병합
  const maxPoints = 40;
  const step = Math.max(1, Math.floor(data.length / maxPoints));

  const sampledData = [];
  for (let i = 0; i < data.length; i += step) {
    const chunk = data.slice(i, i + step);
    const lastPoint = chunk[chunk.length - 1];

    if (lastPoint) {
      const mergedEvents = chunk.flatMap(item => item.matchEvents || []);
      sampledData.push({
        ...lastPoint,
        matchEvents: mergedEvents,
      });
    }
  }

  // 2. 그라데이션 오프셋 계산
  const gradientOffset = () => {
    const dataMax = Math.max(...sampledData.map((i) => i.diff));
    const dataMin = Math.min(...sampledData.map((i) => i.diff));
  
    if (dataMax <= 0) return 0;
    if (dataMin >= 0) return 1;
  
    return dataMax / (dataMax - dataMin);
  };
  
  const off = gradientOffset();

  // 3. 커스텀 툴팁
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const { time, diff, blueGold, redGold, matchEvents } = payload[0].payload;
      const isBlueLead = diff > 0;
      
      return (
        <div className="bg-white/95 text-slate-900 border border-slate-200 dark:bg-[#121216]/95 dark:text-slate-200 dark:border-white/20 backdrop-blur-xl p-4 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.25)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.6)] z-50 min-w-[220px] max-w-xs">
          {/* 상단: 시간 및 골드 차이 */}
          <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-200 dark:border-white/10">
            <span className="text-xs text-slate-700 dark:text-slate-400 font-bold uppercase tracking-wider">{time}분</span>
            <span className={`text-xs font-black ${isBlueLead ? 'text-blue-800 dark:text-blue-400' : 'text-red-800 dark:text-red-400'}`}>
              {isBlueLead ? 'BLUE' : 'RED'} +{Math.abs(diff).toLocaleString()}
            </span>
          </div>

          {/* 팀별 총 골드 */}
          <div className="space-y-1 mb-4">
            <div className="flex justify-between text-[11px]">
              <span className="text-blue-400 font-bold">블루팀</span>
              <span className="text-slate-800 dark:text-slate-200 font-mono tracking-tight">{blueGold.toLocaleString()} G</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-red-400 font-bold">레드팀</span>
              <span className="text-slate-800 dark:text-slate-200 font-mono tracking-tight">{redGold.toLocaleString()} G</span>
            </div>
          </div>

          {/* 주요 이벤트 로그 섹션 */}
          {matchEvents && matchEvents.length > 0 && (
            <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-white/10 mt-2">
              {matchEvents.map((event, idx) => (
                <div key={idx} className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                  {/* 팀 배지 */}
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border flex-shrink-0 ${
                    event.team === 'Blue' || event.team === '블루팀'
                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-400' 
                      : 'bg-red-500/10 border-red-500/30 text-red-800 dark:text-red-400'
                  }`}>
                    {event.team === 'Blue' || event.team === '블루팀' ? 'BLUE' : 'RED'}
                  </span>
                  
                  {/* 이벤트 텍스트 (타입별 색상 강조) */}
                  <span className={`text-[10px] font-bold truncate ${
                    event.type === 'penta' ? 'text-yellow-600 dark:text-yellow-400 animate-pulse' :
                    event.type === 'ace' ? 'text-orange-600 dark:text-orange-400' :
                    event.type === 'gold' ? 'text-yellow-700 dark:text-yellow-200' :
                    event.type === 'obj' ? 'text-purple-700 dark:text-purple-300' :
                    'text-slate-900 dark:text-slate-200'
                  }`}>
                    {event.text}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  // 최종 데이터 계산
  const lastData = sampledData[sampledData.length - 1];
  const maxLead = Math.max(...sampledData.map(d => Math.abs(d.diff)));
  const finalDiff = lastData?.diff || 0;
  const isBlueWin = finalDiff > 0;

  const gridStroke = isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(148, 163, 184, 0.3)';
  const refStroke = isDarkMode ? 'rgba(255, 255, 255, 0.18)' : 'rgba(71, 85, 105, 0.4)';
  const cursorStroke = isDarkMode ? 'rgba(255, 255, 255, 0.20)' : 'rgba(71, 85, 105, 0.25)';
  const axisStroke = isDarkMode ? '#64748b' : '#475569';
  const areaStroke = isDarkMode ? 'rgba(255, 255, 255, 0.30)' : 'rgba(15, 23, 42, 0.35)';

  return (
    <div className="w-full bg-white border border-slate-200 text-slate-900 dark:bg-[#0a0a0c]/80 dark:border-white/5 dark:text-slate-200 rounded-2xl p-5 backdrop-blur-md shadow-sm">
      {/* 헤더 (오브젝트 컨트롤/전력 분석 톤과 통일) */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 opacity-80">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
          </svg>
          <span className="text-[14px] font-black text-yellow-600 dark:text-yellow-500 uppercase tracking-[0.2em]">
            시간대별 골드 격차 및 주요 사건
          </span>
        </div>

        <div className="flex gap-3 text-[10px] font-bold">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-500"></span>
            <span className="text-blue-800 dark:text-blue-400">BLUE LEAD</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-600 dark:bg-red-500"></span>
            <span className="text-red-800 dark:text-red-400">RED LEAD</span>
          </div>
        </div>
      </div>

      {/* 차트 영역: 배경은 투명(컨테이너 배경이 비치도록) */}
      <div className="w-full" style={{ height: 220 }}>
        <ResponsiveContainer>
          <AreaChart
            data={sampledData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                <stop offset={off} stopColor="#3b82f6" stopOpacity={isDarkMode ? 0.5 : 0.4} />
                <stop offset={off} stopColor="#ef4444" stopOpacity={isDarkMode ? 0.5 : 0.4} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
            <ReferenceLine y={0} stroke={refStroke} strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              stroke={axisStroke}
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke={axisStroke}
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => `${(Math.abs(val) / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: cursorStroke, strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="diff"
              stroke={areaStroke}
              strokeWidth={1}
              fill="url(#splitColor)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 하단 요약 정보 */}
      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/10 grid grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] text-slate-600 dark:text-slate-500 mb-1 uppercase tracking-wider font-bold">Max Lead</p>
          <p className="text-lg font-black text-slate-900 dark:text-white">{maxLead.toLocaleString()} G</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-600 dark:text-slate-500 mb-1 uppercase tracking-wider font-bold">Final Difference</p>
          <div className="flex items-center gap-2">
            <span className={`text-lg font-black ${isBlueWin ? 'text-blue-800 dark:text-blue-400' : 'text-red-800 dark:text-red-400'}`}>
              +{Math.abs(finalDiff).toLocaleString()} G
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isBlueWin ? 'bg-blue-500/20 text-blue-800 dark:text-blue-300' : 'bg-red-500/20 text-red-800 dark:text-red-300'}`}>
              {isBlueWin ? 'BLUE WIN' : 'RED WIN'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GoldGraph;