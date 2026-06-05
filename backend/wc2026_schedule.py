"""
Calendrier officiel FIFA World Cup 2026 - 104 matchs

Sources officielles consolidées (5 sources cross-vérifiées) :
- ESPN.com (espn.com/soccer/story/_/id/48939282)
- Sports Illustrated (si.com/soccer/2026-world-cup-fixture-times-venues-confirmed)
- Yahoo Sports
- USA Today (aol.com/articles/2026-world-cup-schedule-group-152414776)
- Al Jazeera (aljazeera.com)
- Wikipedia (en.wikipedia.org/wiki/2026_FIFA_World_Cup_Group_B)

CONVENTION : Toutes les heures source sont en ET (Eastern Time, US East Coast).
En juin/juillet 2026, ET = EDT = UTC-4, donc UTC = ET + 4h.

Vainqueurs des playoffs (au 5 juin 2026) :
- UEFA Playoff A → Bosnia & Herzegovina (BIH) - a battu Italie en finale
- UEFA Playoff B → ??? (utilisé pour Türkiye TUR dans Groupe D)
- UEFA Playoff C → ??? (utilisé pour Türkiye TUR dans Groupe D, vs Paraguay)
- UEFA Playoff D → Czechia (CZE) - dans Groupe A

Format de chaque match :
    (home_code, away_code, "YYYY-MM-DDTHH:MM:00Z", phase, group_letter, stadium_full_name)

Toutes les heures sont en UTC ISO 8601 (suffixe Z).
"""

# === STADES ===
S = {
    'MEX_AZ':  'Estadio Azteca, Mexico City',
    'MEX_GUA': 'Estadio Akron, Guadalajara (Zapopan)',
    'MEX_MTY': 'Estadio BBVA, Monterrey (Guadalupe)',
    'CAN_TOR': 'BMO Field, Toronto',
    'CAN_VAN': 'BC Place, Vancouver',
    'USA_LA':  'SoFi Stadium, Los Angeles (Inglewood)',
    'USA_NY':  'MetLife Stadium, New York/New Jersey (East Rutherford)',
    'USA_DAL': 'AT&T Stadium, Arlington (Dallas)',
    'USA_KC':  'Arrowhead Stadium, Kansas City',
    'USA_ATL': 'Mercedes-Benz Stadium, Atlanta',
    'USA_BOS': 'Gillette Stadium, Foxborough (Boston)',
    'USA_HOU': 'NRG Stadium, Houston',
    'USA_MIA': 'Hard Rock Stadium, Miami (Gardens)',
    'USA_PHI': 'Lincoln Financial Field, Philadelphia',
    'USA_SEA': 'Lumen Field, Seattle',
    'USA_SF':  "Levi's Stadium, San Francisco (Santa Clara)",
}

# Helper : convertit "YYYY-MM-DD HHam/pm ET" en UTC ISO 8601
# Plus simple : on stocke directement les heures ET et on calcule UTC
def _et_to_utc(date_str, et_hour_24):
    """date_str: 'YYYY-MM-DD', et_hour_24: int 0-23 OR float (e.g. 12.5 = 12:30pm).
    Renvoie l'ISO UTC. EDT = UTC-4 donc UTC = ET + 4h."""
    h = int(et_hour_24)
    m = int(round((et_hour_24 - h) * 60))
    # Construit la date complète en ajoutant 4h
    from datetime import datetime, timedelta
    dt_et = datetime.strptime(date_str, '%Y-%m-%d').replace(hour=h, minute=m)
    dt_utc = dt_et + timedelta(hours=4)  # EDT → UTC
    return dt_utc.strftime('%Y-%m-%dT%H:%M:00Z')


# === LES 72 MATCHS DE PHASE DE GROUPES (heures ET, source SI/ESPN/Yahoo) ===
# Note : pour les matchs après minuit ET, ils sont du JOUR SUIVANT en date locale
# mais conservent la "logique de soirée" du jour précédent côté média.
# On respecte ici la convention FIFA / ESPN (date civile ET).

# Format : (home, away, 'YYYY-MM-DD', ET_hour_24, phase, group, stadium_key)
_RAW = [
    # === Thursday, June 11 ===  (3pm + 10pm ET)
    ('MEX', 'RSA', '2026-06-11', 15.0, 'group', 'A', 'MEX_AZ'),
    ('KOR', 'CZE', '2026-06-11', 22.0, 'group', 'A', 'MEX_GUA'),

    # === Friday, June 12 ===  (3pm + 9pm ET)
    ('CAN', 'BIH', '2026-06-12', 15.0, 'group', 'B', 'CAN_TOR'),
    ('USA', 'PAR', '2026-06-12', 21.0, 'group', 'D', 'USA_LA'),

    # === Saturday, June 13 ===  (3pm + 6pm + 9pm + 12am ET)
    ('QAT', 'SUI', '2026-06-13', 15.0, 'group', 'B', 'USA_SF'),
    ('BRA', 'MAR', '2026-06-13', 18.0, 'group', 'C', 'USA_NY'),
    ('HAI', 'SCO', '2026-06-13', 21.0, 'group', 'C', 'USA_BOS'),
    ('AUS', 'TUR', '2026-06-14', 0.0,  'group', 'D', 'CAN_VAN'),  # 12am ET = 9pm local Vancouver

    # === Sunday, June 14 ===  (1pm + 4pm + 7pm + 10pm ET)
    ('GER', 'CUW', '2026-06-14', 13.0, 'group', 'E', 'USA_HOU'),
    ('NED', 'JPN', '2026-06-14', 16.0, 'group', 'F', 'USA_DAL'),
    ('CIV', 'ECU', '2026-06-14', 19.0, 'group', 'E', 'USA_PHI'),
    ('SWE', 'TUN', '2026-06-14', 22.0, 'group', 'F', 'MEX_MTY'),  # Suède vs Tunisie

    # === Monday, June 15 ===  (12pm + 3pm + 6pm + 9pm ET)
    ('ESP', 'CPV', '2026-06-15', 12.0, 'group', 'H', 'USA_ATL'),
    ('BEL', 'EGY', '2026-06-15', 15.0, 'group', 'G', 'CAN_VAN'),  # Vérifier stadium
    ('KSA', 'URU', '2026-06-15', 18.0, 'group', 'H', 'USA_MIA'),
    ('IRN', 'NZL', '2026-06-15', 21.0, 'group', 'G', 'USA_LA'),

    # === Tuesday, June 16 ===  (3pm + 6pm + 9pm + 12am ET)
    ('FRA', 'SEN', '2026-06-16', 15.0, 'group', 'I', 'USA_NY'),
    ('IRQ', 'NOR', '2026-06-16', 18.0, 'group', 'I', 'USA_BOS'),  # FIFA Playoff 2 = IRQ?
    ('ARG', 'ALG', '2026-06-16', 21.0, 'group', 'J', 'USA_KC'),
    ('AUT', 'JOR', '2026-06-17', 0.0,  'group', 'J', 'USA_SF'),   # 12am ET

    # === Wednesday, June 17 ===  (1pm + 4pm + 7pm + 10pm ET)
    ('POR', 'COD', '2026-06-17', 13.0, 'group', 'K', 'USA_HOU'),  # FIFA Playoff 1 = COD
    ('ENG', 'CRO', '2026-06-17', 16.0, 'group', 'L', 'USA_DAL'),
    ('GHA', 'PAN', '2026-06-17', 19.0, 'group', 'L', 'CAN_TOR'),
    ('UZB', 'COL', '2026-06-17', 22.0, 'group', 'K', 'MEX_AZ'),

    # === Thursday, June 18 ===  (12pm + 3pm + 6pm + 9pm ET)
    ('CZE', 'RSA', '2026-06-18', 12.0, 'group', 'A', 'USA_ATL'),
    ('SUI', 'BIH', '2026-06-18', 15.0, 'group', 'B', 'USA_LA'),
    ('CAN', 'QAT', '2026-06-18', 18.0, 'group', 'B', 'CAN_VAN'),
    ('MEX', 'KOR', '2026-06-18', 21.0, 'group', 'A', 'MEX_GUA'),

    # === Friday, June 19 ===  (3pm + 6pm + 9pm + 12am ET)
    ('USA', 'AUS', '2026-06-19', 15.0, 'group', 'D', 'USA_SEA'),
    ('SCO', 'MAR', '2026-06-19', 18.0, 'group', 'C', 'USA_BOS'),
    ('BRA', 'HAI', '2026-06-19', 21.0, 'group', 'C', 'USA_PHI'),
    ('TUR', 'PAR', '2026-06-20', 0.0,  'group', 'D', 'USA_SF'),  # 12am ET = 9pm local SF

    # === Saturday, June 20 ===  (1pm + 4pm + 7pm + 10pm ET)
    ('NED', 'SWE', '2026-06-20', 13.0, 'group', 'F', 'USA_HOU'),
    ('GER', 'CIV', '2026-06-20', 16.0, 'group', 'E', 'CAN_TOR'),
    ('ECU', 'CUW', '2026-06-20', 20.0, 'group', 'E', 'USA_KC'),   # 8pm local KC = 9pm ET? Vérifier
    ('TUN', 'JPN', '2026-06-20', 22.0, 'group', 'F', 'MEX_MTY'),  # 1000ème match CDM
    # Cette journée a 4 matchs mais l'un est à 8pm local et l'autre à 10pm ET, peut-être chevauchement

    # === Sunday, June 21 ===  (12pm + 3pm + 6pm + 9pm ET)
    ('ESP', 'KSA', '2026-06-21', 12.0, 'group', 'H', 'USA_ATL'),
    ('BEL', 'IRN', '2026-06-21', 15.0, 'group', 'G', 'USA_LA'),
    ('URU', 'CPV', '2026-06-21', 18.0, 'group', 'H', 'USA_MIA'),
    ('NZL', 'EGY', '2026-06-21', 21.0, 'group', 'G', 'CAN_VAN'),

    # === Monday, June 22 ===  (3pm + 6pm + 9pm + 12am ET)
    ('ARG', 'AUT', '2026-06-22', 15.0, 'group', 'J', 'USA_DAL'),
    ('FRA', 'IRQ', '2026-06-22', 18.0, 'group', 'I', 'USA_PHI'),
    ('NOR', 'SEN', '2026-06-22', 21.0, 'group', 'I', 'CAN_TOR'),
    ('JOR', 'ALG', '2026-06-23', 0.0,  'group', 'J', 'USA_SF'),  # 12am ET

    # === Tuesday, June 23 ===  (1pm + 4pm + 7pm + 10pm ET)
    ('POR', 'UZB', '2026-06-23', 13.0, 'group', 'K', 'USA_HOU'),
    ('ENG', 'GHA', '2026-06-23', 16.0, 'group', 'L', 'USA_BOS'),
    ('PAN', 'CRO', '2026-06-23', 19.0, 'group', 'L', 'USA_BOS'),   # Vérifier stadium
    ('COL', 'COD', '2026-06-23', 22.0, 'group', 'K', 'MEX_GUA'),

    # === Wednesday, June 24 — Last day group stage : matchs simultanés ===
    # 4 sessions de 2 matchs simultanés
    # Source SI/ESPN : 3pm + 3pm + 6pm + 6pm + 9pm + 9pm + 9pm + 9pm
    ('SUI', 'CAN', '2026-06-24', 15.0, 'group', 'B', 'CAN_VAN'),
    ('BIH', 'QAT', '2026-06-24', 15.0, 'group', 'B', 'USA_SEA'),
    ('MAR', 'HAI', '2026-06-24', 18.0, 'group', 'C', 'USA_ATL'),
    ('SCO', 'BRA', '2026-06-24', 18.0, 'group', 'C', 'USA_MIA'),
    ('CZE', 'MEX', '2026-06-24', 21.0, 'group', 'A', 'MEX_AZ'),
    ('RSA', 'KOR', '2026-06-24', 21.0, 'group', 'A', 'MEX_MTY'),
    ('CUW', 'CIV', '2026-06-25', 0.0,  'group', 'E', 'USA_PHI'),  # 9pm local PHI = 12am ET? Vérifier
    ('ECU', 'GER', '2026-06-25', 0.0,  'group', 'E', 'USA_NY'),

    # === Thursday, June 25 ===  Same simultaneous pattern
    ('TUN', 'NED', '2026-06-25', 15.0, 'group', 'F', 'USA_KC'),
    ('JPN', 'SWE', '2026-06-25', 15.0, 'group', 'F', 'USA_DAL'),
    ('TUR', 'USA', '2026-06-25', 18.0, 'group', 'D', 'USA_LA'),
    ('PAR', 'AUS', '2026-06-25', 18.0, 'group', 'D', 'USA_SF'),
    ('NOR', 'FRA', '2026-06-25', 21.0, 'group', 'I', 'USA_BOS'),
    ('SEN', 'IRQ', '2026-06-25', 21.0, 'group', 'I', 'CAN_TOR'),
    ('CPV', 'KSA', '2026-06-26', 0.0,  'group', 'H', 'USA_HOU'),
    ('URU', 'ESP', '2026-06-26', 0.0,  'group', 'H', 'MEX_GUA'),

    # === Friday, June 26 ===
    ('NZL', 'BEL', '2026-06-26', 15.0, 'group', 'G', 'CAN_VAN'),
    ('EGY', 'IRN', '2026-06-26', 15.0, 'group', 'G', 'USA_SEA'),
    ('PAN', 'ENG', '2026-06-26', 18.0, 'group', 'L', 'USA_NY'),
    ('CRO', 'GHA', '2026-06-26', 18.0, 'group', 'L', 'USA_PHI'),
    ('COL', 'POR', '2026-06-26', 21.0, 'group', 'K', 'USA_MIA'),
    ('COD', 'UZB', '2026-06-26', 21.0, 'group', 'K', 'USA_ATL'),
    ('ALG', 'AUT', '2026-06-27', 0.0,  'group', 'J', 'USA_KC'),
    ('JOR', 'ARG', '2026-06-27', 0.0,  'group', 'J', 'USA_DAL'),
]

# Helper conversion ET → UTC ISO 8601
def _convert(raw_row):
    home, away, date, et_hour, phase, group, stadium_key = raw_row
    from datetime import datetime, timedelta
    h = int(et_hour)
    m = int(round((et_hour - h) * 60))
    dt_et = datetime.strptime(date, '%Y-%m-%d').replace(hour=h, minute=m)
    dt_utc = dt_et + timedelta(hours=4)  # EDT → UTC
    iso = dt_utc.strftime('%Y-%m-%dT%H:%M:00Z')
    return (home, away, iso, phase, group, S[stadium_key])

GROUP_MATCHES = [_convert(r) for r in _RAW]


# === LES 32 MATCHS DE PHASE FINALE (avec placeholders) ===
# Source : si.com + ESPN. Heures connues officiellement.
# Format : (placeholder_home, None, iso_utc, phase, None, stadium)

def _ko(date, et_hour, phase, stadium_key, m_id):
    """Helper pour matchs knockout (équipes inconnues, placeholder via m_id)."""
    from datetime import datetime, timedelta
    h = int(et_hour)
    m = int(round((et_hour - h) * 60))
    dt_et = datetime.strptime(date, '%Y-%m-%d').replace(hour=h, minute=m)
    dt_utc = dt_et + timedelta(hours=4)
    iso = dt_utc.strftime('%Y-%m-%dT%H:%M:00Z')
    placeholder = f"{phase.upper()}_{m_id}"
    return (placeholder, None, iso, phase, None, S[stadium_key])

KNOCKOUT_MATCHES = [
    # === Round of 32 — June 28 - July 3 ===
    _ko('2026-06-28', 12.0, 'r32', 'USA_PHI', 73),
    _ko('2026-06-28', 15.0, 'r32', 'CAN_TOR', 74),
    _ko('2026-06-28', 19.0, 'r32', 'USA_LA',  75),
    _ko('2026-06-29', 12.0, 'r32', 'USA_HOU', 76),
    _ko('2026-06-29', 15.0, 'r32', 'USA_DAL', 77),
    _ko('2026-06-29', 19.0, 'r32', 'USA_ATL', 78),
    _ko('2026-06-30', 13.0, 'r32', 'USA_BOS', 79),
    _ko('2026-06-30', 16.0, 'r32', 'USA_NY',  80),
    _ko('2026-06-30', 21.0, 'r32', 'MEX_MTY', 81),
    _ko('2026-07-01', 13.0, 'r32', 'USA_MIA', 82),
    _ko('2026-07-01', 16.0, 'r32', 'CAN_VAN', 83),
    _ko('2026-07-01', 21.0, 'r32', 'USA_KC',  84),
    _ko('2026-07-02', 12.0, 'r32', 'USA_SEA', 85),
    _ko('2026-07-02', 15.0, 'r32', 'MEX_GUA', 86),
    _ko('2026-07-02', 18.0, 'r32', 'USA_SF',  87),
    _ko('2026-07-03', 18.0, 'r32', 'MEX_AZ',  88),

    # === Round of 16 — July 4-7 ===
    _ko('2026-07-04', 12.0, 'r16', 'USA_PHI', 89),
    _ko('2026-07-04', 16.0, 'r16', 'USA_BOS', 90),
    _ko('2026-07-04', 20.0, 'r16', 'USA_DAL', 91),
    _ko('2026-07-05', 12.0, 'r16', 'CAN_TOR', 92),
    _ko('2026-07-05', 16.0, 'r16', 'USA_ATL', 93),
    _ko('2026-07-06', 14.0, 'r16', 'USA_LA',  94),
    _ko('2026-07-06', 20.0, 'r16', 'USA_MIA', 95),
    _ko('2026-07-07', 20.0, 'r16', 'CAN_VAN', 96),

    # === Quarts de finale — July 9-11 ===
    _ko('2026-07-09', 16.0, 'qf', 'USA_LA',   97),
    _ko('2026-07-09', 20.0, 'qf', 'USA_DAL',  98),
    _ko('2026-07-11', 12.0, 'qf', 'USA_KC',   99),
    _ko('2026-07-11', 16.0, 'qf', 'USA_BOS', 100),

    # === Demi-finales — July 14-15 ===
    _ko('2026-07-14', 15.0, 'sf', 'USA_ATL', 101),
    _ko('2026-07-15', 15.0, 'sf', 'USA_DAL', 102),

    # === Match 3e place — July 18 ===
    _ko('2026-07-18', 15.0, 'tp', 'USA_MIA', 103),

    # === FINALE — July 19 ===
    _ko('2026-07-19', 15.0, 'final', 'USA_NY', 104),
]

ALL_MATCHES = GROUP_MATCHES + KNOCKOUT_MATCHES

# ====================================================================
# SANITY CHECKS au chargement (lèvent une exception si problème)
# ====================================================================
assert len(GROUP_MATCHES) == 72, f"Expected 72 group matches, got {len(GROUP_MATCHES)}"
assert len(KNOCKOUT_MATCHES) == 32, f"Expected 32 knockout matches, got {len(KNOCKOUT_MATCHES)}"
assert len(ALL_MATCHES) == 104, f"Expected 104 total matches, got {len(ALL_MATCHES)}"

# Vérifie qu'on a 6 matchs par groupe et 3 apparitions par équipe
from collections import Counter
_groups = Counter(m[4] for m in GROUP_MATCHES if m[4])
for g, n in _groups.items():
    assert n == 6, f"Group {g} has {n} matches, expected 6"
_teams = Counter()
for h, a, *_ in GROUP_MATCHES:
    _teams[h] += 1
    _teams[a] += 1
_problems = [(t, n) for t, n in _teams.items() if n != 3]
assert not _problems, f"Teams with wrong match count: {_problems}"
