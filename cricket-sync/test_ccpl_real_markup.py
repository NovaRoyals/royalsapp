"""7 real-markup tests from CCPL pages captured 2026-09-20."""

from ccpl_parse import (
    find_live_match,
    is_match_complete,
    parse_results,
    parse_scorecard,
)

LIVE_4806 = """
<div>
  <h5><strong>League</strong></h5>
  <h2>20</h2>
  <h5>Sep 2026</h5>
  <a href="/logo"></a><a href="/logo2"></a>
  <h4>Fall 2026 Manassas - Manassas1</h4>
  <h3>NOVA Royals Athletic Club<span class="v"> v </span> LM Tigers</h3>
  <h4>NOVA Royals Athletic Club: 55/3 (10/20 ov)</h4>
  <h5>Ball By Ball</h5>
  <a class="btn btn-sc" href="/CCPLT20/viewScorecard.do?matchId=4806&clubId=88">Scorecard</a>
</div>
"""

COMPLETED_4777_RESULTS = """
<div>
  <h5><strong>League</strong></h5>
  <h2>12</h2>
  <h5>Sep 2026</h5>
  <h4>Fall 2026 Manassas - Manassas1</h4>
  <h3>NOVA Royals Athletic Club<span class="v"> v </span> Orange Army</h3>
  <h4>NOVA Royals Athletic Club won by 20 Runs</h4>
  <h5>Ball By Ball</h5>
  <a class="btn btn-sc" href="/CCPLT20/viewScorecard.do?matchId=4777&clubId=88">Scorecard</a>
</div>
"""

SCORECARD_4777 = """
<div id="ballByBallTeam2">
  <table>
    <tr>
      <th>
        <img src="p.jpg"/>
        <a href="/CCPLT20/viewPlayer.do?playerId=1391644&clubId=88"><b>Anudeep Mallaboina</b></a>
        <a href="video" style="display:none">v</a>
        <div class="scorecard-out-text show-phone">c †<a href="/CCPLT20/viewPlayer.do?playerId=1&clubId=88">Binod B</a> b <a href="/CCPLT20/viewPlayer.do?playerId=2&clubId=88">Biplav G</a></div>
      </th>
      <th class="hidden-phone">c †<a href="/CCPLT20/viewPlayer.do?playerId=1&clubId=88">Binod B</a> b <a href="/CCPLT20/viewPlayer.do?playerId=2&clubId=88">Biplav G</a></th>
      <th><b>6</b></th>
      <th>19</th>
      <th>0</th>
      <th>0</th>
      <th>31.58</th>
    </tr>
    <tr>
      <th colspan="7" style="text-align: left;">Did not bat:
        <a href="viewPlayer.do?playerId=9&clubId=88"><b>Ashok Srinivasula</b></a>
      </th>
    </tr>
    <tr>
      <th>Bowling</th><th>O</th><th>M</th><th>Dot</th><th>R</th><th>W</th><th>Econ</th>
    </tr>
    <tr>
      <th><a href="/CCPLT20/viewPlayer.do?playerId=22&clubId=88"><b>Biplav Gautam</b></a></th>
      <th>4.0</th><th>0</th><th>12</th><th>22</th><th><b>1</b></th><th>5.50</th>
    </tr>
  </table>
</div>
"""

BANNER_WIN = """
<div>
  <h4>NOVA Royals Athletic Club won by 20 Runs</h4>
</div>
"""


def test_live_results_fixture_4806():
    rows = parse_results(LIVE_4806)
    assert len(rows) == 1
    row = rows[0]
    assert row["ccpl_match_id"] == 4806
    assert row["status"] == "live"
    assert row["played_at"] == "2026-09-20"
    assert "LM Tigers" in row["headline"]
    assert row["live_score"] and "55/3" in row["live_score"]
    assert find_live_match(LIVE_4806)["ccpl_match_id"] == 4806


def test_completed_results_shape():
    rows = parse_results(COMPLETED_4777_RESULTS)
    assert rows[0]["ccpl_match_id"] == 4777
    assert rows[0]["status"] == "completed"
    assert rows[0]["played_at"] == "2026-09-12"
    assert "won by 20" in rows[0]["result_text"].lower()


def test_scorecard_batting_name_and_player_id():
    innings = parse_scorecard(SCORECARD_4777)
    bat = innings[0]["batting"][0]
    assert bat["player_name"] == "Anudeep Mallaboina"
    assert bat["ccpl_player_id"] == 1391644
    assert bat["runs"] == 6
    assert bat["sr"] == 31.58


def test_scorecard_dismissal_keeper_catch():
    innings = parse_scorecard(SCORECARD_4777)
    dismissal = innings[0]["batting"][0]["dismissal"]
    assert "Binod B" in dismissal
    assert "Biplav G" in dismissal
    assert "†" in dismissal or "c †" in dismissal.replace(" ", "")


def test_scorecard_dnb_player_links():
    innings = parse_scorecard(SCORECARD_4777)
    names = [p["player_name"] for p in innings[0]["dnb"]]
    assert "Ashok Srinivasula" in names


def test_scorecard_bowling_wickets_bold():
    innings = parse_scorecard(SCORECARD_4777)
    bowl = innings[0]["bowling"][0]
    assert bowl["player_name"] == "Biplav Gautam"
    assert bowl["wickets"] == 1
    assert bowl["overs"] == 4.0


def test_result_banner_complete():
    assert is_match_complete(BANNER_WIN)
    assert not is_match_complete(LIVE_4806)
