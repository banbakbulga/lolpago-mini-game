function MatchSkeleton() {
  return (
    <div className="relative bg-white dark:bg-[#121216] border border-black/10 dark:border-white/10 rounded-3xl p-4 md:p-6 shadow-[0_10px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_30px_60px_rgba(0,0,0,0.5)] animate-pulse">
      {/* 상단 정보 스켈레톤 */}
      <div className="flex justify-between items-center mb-3">
        <div className="h-6 w-32 bg-slate-200 dark:bg-white/5 rounded-full"></div>
        <div className="h-6 w-24 bg-slate-200 dark:bg-white/5 rounded-full"></div>
      </div>

      {/* 힌트 섹션 스켈레톤 */}
      <div className="mb-6 rounded-xl bg-white dark:bg-[#16171b] border border-black/10 dark:border-transparent border-l-4 border-yellow-500/30 p-3">
        <div className="grid grid-cols-[auto_1fr] gap-4 items-center">
          <div className="w-12 h-12 bg-slate-200 dark:bg-white/5 rounded"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 bg-slate-200 dark:bg-white/5 rounded"></div>
            <div className="h-3 w-24 bg-slate-200 dark:bg-white/5 rounded"></div>
          </div>
        </div>
      </div>

      {/* 대결 섹션 스켈레톤 */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 md:gap-4 items-center mb-4">
        {/* 블루팀 스켈레톤 */}
        <div className="space-y-1.5">
          <div className="h-4 w-20 bg-slate-200 dark:bg-white/5 rounded mb-2"></div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 p-1.5 rounded-lg border border-black/5 dark:border-transparent">
              <div className="w-10 h-10 bg-slate-200 dark:bg-white/5 rounded-lg"></div>
              <div className="flex-1 space-y-1">
                <div className="h-3 w-16 bg-slate-200 dark:bg-white/5 rounded"></div>
                <div className="h-3 w-24 bg-slate-200 dark:bg-white/5 rounded"></div>
              </div>
            </div>
          ))}
        </div>

        {/* VS 중앙 */}
        <div className="flex flex-col items-center gap-1">
          <div className="h-16 w-[1px] bg-slate-200 dark:bg-white/5"></div>
          <div className="h-8 w-8 bg-slate-200 dark:bg-white/5 rounded"></div>
          <div className="h-16 w-[1px] bg-slate-200 dark:bg-white/5"></div>
        </div>

        {/* 레드팀 스켈레톤 */}
        <div className="space-y-1.5">
          <div className="h-4 w-20 bg-slate-200 dark:bg-white/5 rounded mb-2 ml-auto"></div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex flex-row-reverse items-center gap-1.5 bg-slate-100 dark:bg-white/5 p-1.5 rounded-lg border border-black/5 dark:border-transparent">
              <div className="w-10 h-10 bg-slate-200 dark:bg-white/5 rounded-lg"></div>
              <div className="flex-1 space-y-1 text-right">
                <div className="h-3 w-16 bg-slate-200 dark:bg-white/5 rounded ml-auto"></div>
                <div className="h-3 w-24 bg-slate-200 dark:bg-white/5 rounded ml-auto"></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 하단 버튼 스켈레톤 */}
      <div className="mt-4 pt-3 border-t border-black/10 dark:border-white/10">
        <div className="h-12 w-48 bg-slate-200 dark:bg-white/5 rounded-2xl mx-auto"></div>
      </div>
    </div>
  );
}

export default MatchSkeleton;



