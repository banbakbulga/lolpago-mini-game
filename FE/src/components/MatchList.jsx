import MatchCard from './MatchCard'

function MatchList({ matches }) {
  return (
    <div className="space-y-4 md:space-y-6 w-full">
      {matches.map((match, idx) => (
        <MatchCard key={match.matchId || idx} match={match} index={idx} />
      ))}
    </div>
  );
}

export default MatchList
