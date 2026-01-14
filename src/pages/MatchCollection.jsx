import { useState, useEffect } from 'react'
import { collectMasterMatchData } from '../api/riotApi'
import MatchCard from '../components/MatchCard'
import MatchSkeleton from '../components/MatchSkeleton'

function MatchCollection() {
  const [matches, setMatches] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [loadingNext, setLoadingNext] = useState(false);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [streak, setStreak] = useState(0);
  const [error, setError] = useState(null);
  const [maxStreak, setMaxStreak] = useState(0);

  // 첫 번째 매치만 먼저 로드
  const startCollect = async () => {
    setLoading(true);
    setError(null);
    try {
      // 첫 번째 매치만 즉시 로드
      const firstMatchData = await collectMasterMatchData(1, 1);
      if (!firstMatchData || firstMatchData.length === 0) {
        setError('경기 데이터를 가져올 수 없습니다. 잠시 후 다시 시도해주세요.');
        setLoading(false);
        return;
      }
      
      // 첫 번째 매치를 상태에 설정
      setMatches(firstMatchData);
      setCurrentIndex(0);
      setTotalCorrect(0);
      setStreak(0);
      setMaxStreak(0);
      setLoading(false); // 첫 매치 로드 완료 후 화면에 표시
      
      // 백그라운드에서 나머지 9개 매치 로드 시작
      loadRemainingMatches(firstMatchData);
    } catch (err) {
      console.error(err);
      setError('데이터 수집 중 오류가 발생했습니다. API 키를 확인하거나 잠시 후 다시 시도해주세요.');
      setLoading(false);
    }
  };

  // 백그라운드에서 나머지 매치 로드
  const loadRemainingMatches = async (existingMatches = []) => {
    setBackgroundLoading(true);
    try {
      // 나머지 9개 매치 로드
      const remainingData = await collectMasterMatchData(9, 1);
      if (remainingData && remainingData.length > 0) {
        // 기존 첫 번째 매치 뒤에 나머지 매치 추가
        setMatches(prev => {
          // 중복 방지: 이미 로드된 매치가 있으면 추가하지 않음
          if (prev.length > existingMatches.length) {
            return prev;
          }
          return [...existingMatches, ...remainingData];
        });
      }
    } catch (err) {
      console.error('백그라운드 매치 로드 실패:', err);
      // 백그라운드 로딩 실패는 사용자에게 큰 영향을 주지 않으므로 조용히 처리
    } finally {
      setBackgroundLoading(false);
    }
  };

  // 백그라운드 로딩 완료 시 loadingNext 해제
  useEffect(() => {
    if (!backgroundLoading && loadingNext && matches.length > currentIndex + 1) {
      setLoadingNext(false);
      setCurrentIndex(prev => prev + 1);
    }
  }, [backgroundLoading, matches.length, currentIndex, loadingNext]);

  const handleAnswer = (isCorrect) => {
    if (isCorrect) {
      setTotalCorrect(prev => prev + 1);
      setStreak(prev => {
        const newStreak = prev + 1;
        setMaxStreak(current => Math.max(current, newStreak));
        return newStreak;
      });
    } else {
      setStreak(0);
    }
  };

  const handleNext = () => {
    const nextIndex = currentIndex + 1;
    
    // 다음 매치가 있는 경우
    if (nextIndex < matches.length) {
      setCurrentIndex(nextIndex);
    } else if (nextIndex >= matches.length && backgroundLoading) {
      // 다음 매치가 아직 로드되지 않았고 백그라운드 로딩이 진행 중인 경우
      setLoadingNext(true);
    } else if (nextIndex >= matches.length && !backgroundLoading) {
      // 모든 매치 완료
      const accuracy = Math.round((totalCorrect / matches.length) * 100);
      alert(`🏆 최종 결과\n정답: ${totalCorrect}/${matches.length}\n정확도: ${accuracy}%\n최고 콤보: ${maxStreak}`);
    }
  };

  const currentMatch = matches[currentIndex];

  return (
    <div className="w-full min-h-screen bg-[#0a0a0c] text-slate-200 font-sans selection:bg-indigo-500/30 overflow-x-hidden">
      {/* 배경 그리드 패턴 */}
      <div className="fixed inset-0 opacity-10 pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }}></div>
      
      <div className="max-w-4xl mx-auto px-4 relative z-10">
        <header className="py-6 text-center">
          <h1 className={`font-[1000] tracking-tighter mb-2 italic transition-all duration-700 ${
            matches.length > 0 || loading
              ? 'text-2xl md:text-3xl' 
              : 'text-5xl md:text-6xl'
          }`}>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-indigo-400 to-red-500">
              WHO WINS?
            </span>
          </h1>
          <p className={`text-slate-500 text-sm font-medium tracking-widest uppercase transition-all duration-700 ${
            matches.length > 0 || loading
              ? 'opacity-0 h-0 mb-0 overflow-hidden' 
              : 'opacity-100'
          }`}>
            Match Result Predictor
          </p>

          {!matches.length && !loading ? (
            <div className="py-16">
              {/* 퀴즈 설명 */}
              <div className="max-w-2xl mx-auto mb-10 space-y-6">
                {/* 이용 가이드 섹션 */}
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 md:p-8 text-center">
                  <h2 className="text-2xl md:text-3xl font-black text-slate-100 mb-6 flex items-center justify-center gap-3">

                    <span>이용 가이드</span>
                  </h2>
                  <div className="space-y-4 text-slate-300 text-sm md:text-base leading-relaxed">
                    <p className="leading-7 px-2">
                      실제 라이엇 API 데이터를 기반으로 한 고도의 심리 분석 퀴즈입니다.
                    </p>
                    
                    <p className="leading-7 px-2">
                      각 경기에서 제공되는 <span className="text-yellow-400 font-bold">힌트</span>를 분석하여 승리팀을 맞춰보세요!
                    </p>
                    <div className="mt-6 pt-6 border-t border-white/10 flex flex-col items-center">
                      <p className="text-xs text-slate-400 mb-4 font-bold uppercase tracking-wider flex items-center gap-2">
                        <span className="text-orange-400">⚔️</span>
                        <span>게임 규칙</span>
                        <span className="text-orange-400">⚔️</span>
                      </p>
                      <ul className="space-y-3 text-xs md:text-sm text-slate-400 flex flex-col items-center">
                        <li className="flex items-center gap-3 leading-6">
                          
                          <span>10개의 경기를 순차적으로 풀어보세요</span>
                        </li>
                        <li className="flex items-center gap-3 leading-6">
                          
                          <span>연속으로 정답을 맞추면 콤보가 쌓입니다</span>
                        </li>
                        <li className="flex items-center gap-3 leading-6">
                          
                          <span>정답/오답 박스를 클릭하면 다음 문제로 넘어갑니다</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* 콤보 보상 시스템 섹션 */}
                <div className="relative bg-gradient-to-br from-yellow-900/20 via-orange-900/15 to-yellow-900/20 backdrop-blur-sm border-2 border-yellow-500/40 rounded-2xl p-6 md:p-8 shadow-[0_0_40px_rgba(234,179,8,0.2)] overflow-hidden mx-auto text-center">
                  {/* 네온 효과 배경 */}
                  <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/0 via-yellow-500/10 to-yellow-500/0 opacity-50 animate-pulse"></div>
                  
                  <div className="relative z-10">
                    <h3 className="text-xl md:text-2xl font-black text-yellow-400 mb-4 flex items-center justify-center gap-2">
                      <span className="text-2xl">🎁</span>
                      <span>콤보 달성 특혜 : 스킨 선물 이벤트</span>
                      <span className="text-2xl">🎁</span>
                    </h3>
                    <div className="space-y-4 text-slate-200 text-sm md:text-base leading-relaxed">
                      <p className="leading-7 px-2">
                        연속 정답 시 콤보가 쌓이며, 특정 콤보 달성 시 <span className="text-yellow-300 font-bold">스킨 선물</span>을 드립니다.
                      </p>
                     
                    </div>
                  </div>
                </div>
              </div>
              
              {/* 에러 메시지 */}
              {error && (
                <div className="max-w-2xl mx-auto mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <p className="text-red-400 text-sm font-semibold">{error}</p>
                </div>
              )}
              
              <button 
                onClick={startCollect}
                disabled={loading}
                className="group relative inline-flex items-center justify-center px-12 py-5 font-black text-white text-lg transition-all duration-300 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 hover:from-indigo-500 hover:via-purple-500 hover:to-indigo-500 shadow-[0_0_40px_rgba(79,70,229,0.5)] hover:shadow-[0_0_60px_rgba(79,70,229,0.7)] disabled:opacity-50 transform hover:scale-105 active:scale-95"
              >
                <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-400/20 via-purple-400/20 to-indigo-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                <span className="relative z-10 flex items-center gap-2">
                  {loading ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      <span>데이터 수집 중...</span>
                    </>
                  ) : (
                    <>
                      <span>게임 시작하기</span>
                    </>
                  )}
                </span>
              </button>
            </div>
          ) : (
            matches.length > 0 && (
              <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-top-4 duration-700">
                {/* 통계 바 - 글라스모피즘 스타일 */}
                <div className="grid grid-cols-3 gap-[2px] bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-1">
                  <StatItem label="ACCURACY" value={`${Math.round((totalCorrect/(currentIndex + 1))*100)}%`} color="text-blue-400" />
                  <StatItem label="COMBO" value={streak} color="text-orange-400" highlight={streak > 0} />
                  <StatItem label="PROGRESS" value={`${currentIndex + 1}/${matches.length}`} color="text-purple-400" />
                </div>
              </div>
            )
          )}
        </header>

        {/* 로딩 상태에 따라 스켈레톤 또는 매치 카드 표시 */}
        {loading ? (
          <div className="pb-10 animate-in fade-in duration-500">
            <div className="mb-4 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></div>
                <p className="text-sm font-semibold text-indigo-300">데이터를 불러오는 중...</p>
              </div>
            </div>
            <MatchSkeleton />
          </div>
        ) : (
          currentMatch && (
            <div className="pb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
              {/* 다음 매치 로딩 중 표시 */}
              {loadingNext && (
                <div className="mb-4 text-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></div>
                    <p className="text-sm font-semibold text-indigo-300">다음 문제를 불러오는 중...</p>
                  </div>
                </div>
              )}
              
              <MatchCard 
                match={currentMatch} 
                index={currentIndex}
                onAnswer={handleAnswer}
                onNext={handleNext}
              />
            </div>
          )
        )}
      </div>

    </div>
  )
}

function StatItem({ label, value, color, highlight }) {
  return (
    <div className="bg-[#121216] rounded-xl py-3 px-4">
      <p className="text-[10px] font-black text-slate-500 mb-1">{label}</p>
      <p className={`text-xl font-black ${color} ${highlight ? 'animate-pulse' : ''}`}>{value}</p>
    </div>
  )
}

export default MatchCollection
