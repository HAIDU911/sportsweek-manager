namespace SportsWeekManager.Domain;

public record Pairing(int RoundNo, int Slot, int? Home, int? Away, bool Bye);
public record ScheduleAssignment(int FixtureId, DateTime StartsAt, string Venue);
public record RegenerationSnapshot(int TournamentVersion, int WithdrawnTeamId, string WithdrawnTeamName, List<int> PreservedWinnerIds, List<string> PreservedWinnerNames, List<int> NeverPlayedIds, List<string> NeverPlayedNames, List<int> ExcludedTeamIds, List<string> ExcludedTeamNames, int CompletedFixtureCount, List<Pairing> ProposedPairings);

public static class TournamentEngine
{
    public static int NextPowerOfTwo(int n) => n <= 1 ? 1 : (int)Math.Pow(2, Math.Ceiling(Math.Log2(n)));
    public static List<Pairing> GenerateBracket(IReadOnlyList<int> teamIds)
    {
        if (teamIds.Count is < 2 or > 64) throw new ArgumentException("Team count must be between 2 and 64.");
        var size=NextPowerOfTwo(teamIds.Count); var seeds=teamIds.Select(x=>(int?)x).Concat(Enumerable.Repeat<int?>(null,size-teamIds.Count)).ToList(); var result=new List<Pairing>();
        for(var slot=0;slot<size/2;slot++){var home=seeds[slot];var away=seeds[size-slot-1];result.Add(new(1,slot+1,home,away,home is null||away is null));}
        for(var round=2;round<=Math.Log2(size);round++) for(var slot=1;slot<=size/(int)Math.Pow(2,round);slot++) result.Add(new(round,slot,null,null,false));
        return result;
    }
    public static List<ScheduleAssignment> BuildSchedule(IEnumerable<(int Id,int Duration)> fixtures, DateTime windowStart, DateTime windowEnd, IReadOnlyList<DateOnly> dates, IReadOnlyList<string> venues, int duration)
    {
        var slots=new List<(DateTime Time,string Venue)>();
        foreach(var date in dates){var cursor=date.ToDateTime(TimeOnly.FromDateTime(windowStart));var end=date.ToDateTime(TimeOnly.FromDateTime(windowEnd));while(cursor.AddMinutes(duration)<=end){foreach(var venue in venues)slots.Add((cursor,venue));cursor=cursor.AddMinutes(duration);}}
        var list=fixtures.ToList(); if(slots.Count<list.Count) throw new ArgumentException("Available dates, times, and venues cannot fit all fixtures.");
        return list.Select((f,i)=>new ScheduleAssignment(f.Id,slots[i].Time,slots[i].Venue)).ToList();
    }
    public static int? Winner(int? home,int? away,int homeScore,int awayScore,string status){if(status is "DoubleForfeit" or "Abandoned")return null;if(homeScore==awayScore)throw new ArgumentException("A knockout match needs a decisive score or an explicit outcome.");return homeScore>awayScore?home:away;}
}
