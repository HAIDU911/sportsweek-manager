namespace SportsWeekManager.Domain;

public static class GameCatalog
{
    public static readonly Dictionary<string, object> Defaults = new()
    {
        ["Futsal"] = new { format="2 halves x 15 min", durationMinutes=40, playersPerSide=5, outcomes=new[]{"Win","Draw","Penalties","Walkover","Abandoned"} },
        ["Cricket"] = new { formats=new Dictionary<string,int>{{"5 Overs",45},{"10 Overs",90},{"20 Overs",180}}, outcomes=new[]{"Win","Tie","Rain","All Out","Super Over"} },
        ["Basketball"] = new { format="4 quarters x 10 min", durationMinutes=60, outcomes=new[]{"Win","Draw","Overtime","Fouls","Disqualification"} },
        ["Badminton"] = new { format="Best of 3 games, 21 points", durationMinutes=45, outcomes=new[]{"2-0 Win","2-1 Win","Retirement","Walkover"} },
        ["Table Tennis"] = new { format="Best of 5 games, 11 points", durationMinutes=25, outcomes=new[]{"3-0 Win","3-2 Win","Deuce","Retirement"} },
        ["Tug of War"] = new { format="Best of 3 pulls", durationMinutes=20, outcomes=new[]{"2-0 Win","2-1 Win","Draw","Disqualification"} },
        ["Chess"] = new { formats=new Dictionary<string,int>{{"Rapid",40},{"Blitz",20}}, outcomes=new[]{"Checkmate","Draw","Resignation","Timeout"} }
    };
}
