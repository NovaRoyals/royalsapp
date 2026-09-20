"""DOM-survey fixtures from FXA live pages captured 2026-09-20."""

from fxa_parse import parse_standings, parse_team_record, parse_team_schedule, parse_related_teams

TEAM_HTML = """
<table id="teamRecord" class="Game">
  <thead><tr><th>W</th><th>L</th><th>T</th></tr></thead>
  <tbody><tr><td>0</td><td>1</td><td>0</td></tr></tbody>
</table>
<table id="teamScheduleTable">
  <tbody>
    <tr class="gameDateRow even"><td colspan="6" class="gameDate"><h4>Thursday, September 17</h4></td></tr>
    <tr class="even" id="game_4048754_105789">
      <td class="gameTime">8:10 PM</td>
      <td class="gameLocation"><div class="label"><a href="/location/7629">Arrowhead Park Turf</a></div>Field 1A</td>
      <td class="opponent"><div class="homeOrVisitor">Home</div><a href="/team/1060161/Tiki-Taka-FC-">Tiki Taka FC ⚽️</a></td>
      <td class="result">Loss<br>0&nbsp;-&nbsp;5</td>
      <td class="detailLink" id="game_2026-09-17_8-10 PM_7629_1"><a href="#" class="openGameDetail">Viewing Details</a></td>
    </tr>
    <tr class="gameDateRow odd"><td colspan="6" class="gameDate"><h4>Thursday, September 24</h4></td></tr>
    <tr class="odd" id="game_4048771_105789">
      <td class="gameTime">9:00 PM</td>
      <td class="gameLocation"><div class="label"><a href="/location/7608">Greenbriar Park</a></div>Field 5A</td>
      <td class="opponent"><div class="homeOrVisitor">Visitor</div><a href="/team/1053316/Putt-Pirates-FC">Putt Pirates FC</a></td>
      <td class="result"></td>
      <td class="detailLink" id="game_2026-09-24_9-00 PM_7608_1"><a href="#" class="openGameDetail">Viewing Details</a></td>
    </tr>
  </tbody>
</table>
<table id="relatedTeamsTable">
  <tr>
    <td><a href="/team/1033671/Nova-Royal-AC---White">Nova Royal AC - White</a>
    <div class="leagueName">Thursday Men's 8v8 (35+) Soccer | Summer '26</div></td>
  </tr>
</table>
"""

STANDINGS_HTML = """
<h2 class="divisionName">Competitive Standings</h2>
<table class="divisionStandings">
  <tbody>
    <tr class="even first">
      <td class="teamRank">1</td>
      <td class="teamName"><a class="teamPageLink" href="/team/1060161/Tiki-Taka-FC-">Tiki Taka FC ⚽️</a></td>
      <td class="wld">1</td><td class="wld">0</td><td class="wld draw">0</td>
      <td>5</td><td class="lastColumn">3</td>
    </tr>
    <tr class="odd">
      <td class="teamRank">10</td>
      <td class="teamName"><a class="teamPageLink" href="/team/1059849/NOVA-ROYALS-AC">NOVA ROYALS AC</a></td>
      <td class="wld">0</td><td class="wld">1</td><td class="wld draw">0</td>
      <td>-5</td><td class="lastColumn">0</td>
    </tr>
  </tbody>
</table>
"""


def test_team_record():
    assert parse_team_record(TEAM_HTML) == {"wins": 0, "losses": 1, "draws": 0}


def test_schedule_completed_and_upcoming():
    rows = parse_team_schedule(
        TEAM_HTML,
        league_id=105789,
        team_id=1059849,
        canonical="NOVA ROYALS AC 35+",
        league_name="Thursday Men's 8v8 (35+) Soccer | Fall '26",
    )
    assert len(rows) == 2
    first, second = rows
    assert first["opponent_name"] == "Tiki Taka FC ⚽️"
    assert first["home_away"] == "H"
    assert first["status"] == "completed"
    assert first["royals_score"] == 0
    assert first["opponent_score"] == 5
    assert first["venue"] == "Arrowhead Park Turf"
    assert first["field"] == "Field 1A"
    assert first["gamerecap_url"].endswith("/gamerecap/105789/d_2026-09-17_20-10-00_7629_1")
    assert second["opponent_name"] == "Putt Pirates FC"
    assert second["home_away"] == "V"
    assert second["status"] == "scheduled"
    assert second["gamerecap_url"] is None
    assert "21:00:00" in second["played_at"]


def test_standings_competitive():
    rows = parse_standings(STANDINGS_HTML, 105789)
    assert rows[0]["rank"] == 1
    assert rows[0]["team_name"] == "Tiki Taka FC ⚽️"
    nova = rows[-1]
    assert nova["team_id"] == 1059849
    assert nova["rank"] == 10
    assert nova["point_diff"] == -5
    assert nova["division"] == "Competitive"


def test_related_teams():
    related = parse_related_teams(TEAM_HTML)
    assert related[0]["href"].endswith("/team/1033671/Nova-Royal-AC---White")
