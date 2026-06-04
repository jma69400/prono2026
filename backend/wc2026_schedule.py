"""
Calendrier officiel FIFA World Cup 2026 — les 104 matchs

Source : FIFA inside.fifa.com (Match Schedule du 6 décembre 2025) + Yahoo Sports
Toutes les heures sont en BST sur la source, converties en UTC ici.

CONVERSION : BST → UTC = -1h (ex: 8pm BST = 19:00 UTC)
NOTE : 6pm BST en juin/juillet 2026 = 17:00 UTC = 19:00 CEST (heure de Paris)

Format de chaque match :
    (home_code, away_code, "YYYY-MM-DDTHH:MM:00Z", phase, group_letter, stadium_full_name)

Où :
- home_code, away_code : codes 3 lettres (MEX, RSA, FRA, etc.)
- date UTC en ISO 8601 (suffixe Z = UTC)
- phase : "group" | "r32" | "r16" | "qf" | "sf" | "tp" | "final"
- group_letter : "A" à "L" pour les matchs de groupes, None sinon
- stadium : nom complet du stade
"""

# === STADES (réutilisés depuis le code) ===
S = {
    'MEX_AZ': 'Estadio Azteca, Mexico City',
    'MEX_GUA': 'Estadio Akron, Guadalajara (Zapopan)',
    'MEX_MTY': 'Estadio BBVA, Monterrey',
    'CAN_TOR': 'BMO Field, Toronto',
    'CAN_VAN': 'BC Place, Vancouver',
    'USA_LA': 'SoFi Stadium, Los Angeles',
    'USA_NY': 'MetLife Stadium, New York/New Jersey',
    'USA_DAL': 'AT&T Stadium, Arlington (Dallas)',
    'USA_KC': 'Arrowhead Stadium, Kansas City',
    'USA_ATL': 'Mercedes-Benz Stadium, Atlanta',
    'USA_BOS': 'Gillette Stadium, Foxborough (Boston)',
    'USA_HOU': 'NRG Stadium, Houston',
    'USA_MIA': 'Hard Rock Stadium, Miami',
    'USA_PHI': 'Lincoln Financial Field, Philadelphia',
    'USA_SEA': 'Lumen Field, Seattle',
    'USA_SF': "Levi's Stadium, San Francisco (Santa Clara)",
}

# === LES 72 MATCHS DE PHASE DE GROUPES (en UTC) ===
# Chaque heure est calculée comme : heure_BST - 1h
# Ex: 8pm BST (20:00) → 19:00 UTC
GROUP_MATCHES = [
    # ===== Thursday, June 11 =====
    ('MEX', 'RSA', '2026-06-11T19:00:00Z', 'group', 'A', S['MEX_AZ']),  # 8pm BST

    # ===== Friday, June 12 (matchs commençant en BST entre 0h-7h = la nuit du 11 vers le 12) =====
    ('KOR', 'CZE', '2026-06-12T02:00:00Z', 'group', 'A', S['MEX_GUA']),  # 3am BST
    ('CAN', 'BIH', '2026-06-12T19:00:00Z', 'group', 'B', S['CAN_TOR']),  # 8pm BST

    # ===== Saturday, June 13 =====
    ('USA', 'PAR', '2026-06-13T01:00:00Z', 'group', 'D', S['USA_LA']),   # 2am BST
    ('QAT', 'SUI', '2026-06-13T19:00:00Z', 'group', 'B', S['USA_SF']),   # 8pm BST Santa Clara
    ('BRA', 'MAR', '2026-06-13T22:00:00Z', 'group', 'C', S['USA_NY']),   # 11pm BST

    # ===== Sunday, June 14 =====
    ('HAI', 'SCO', '2026-06-14T01:00:00Z', 'group', 'C', S['USA_BOS']),  # 2am BST
    ('AUS', 'TUR', '2026-06-14T04:00:00Z', 'group', 'D', S['CAN_VAN']),  # 5am BST
    ('GER', 'CUW', '2026-06-14T17:00:00Z', 'group', 'E', S['USA_HOU']),  # 6pm BST
    ('NED', 'JPN', '2026-06-14T20:00:00Z', 'group', 'F', S['USA_DAL']),  # 9pm BST

    # ===== Monday, June 15 =====
    ('CIV', 'ECU', '2026-06-14T23:00:00Z', 'group', 'E', S['USA_PHI']),  # 12am BST (du 15) = 23h UTC du 14
    ('SWE', 'TUN', '2026-06-15T02:00:00Z', 'group', 'F', S['MEX_GUA']),  # 3am BST
    ('ESP', 'CPV', '2026-06-15T16:00:00Z', 'group', 'H', S['USA_ATL']),  # 5pm BST
    ('BEL', 'EGY', '2026-06-15T19:00:00Z', 'group', 'G', S['USA_SEA']),  # 8pm BST
    ('KSA', 'URU', '2026-06-15T22:00:00Z', 'group', 'H', S['USA_MIA']),  # 11pm BST

    # ===== Tuesday, June 16 =====
    ('IRN', 'NZL', '2026-06-16T01:00:00Z', 'group', 'G', S['USA_LA']),   # 2am BST
    ('FRA', 'SEN', '2026-06-16T19:00:00Z', 'group', 'I', S['USA_NY']),   # 8pm BST
    ('IRQ', 'NOR', '2026-06-16T22:00:00Z', 'group', 'I', S['USA_BOS']),  # 11pm BST

    # ===== Wednesday, June 17 =====
    ('ARG', 'ALG', '2026-06-17T01:00:00Z', 'group', 'J', S['USA_KC']),   # 2am BST
    ('AUT', 'JOR', '2026-06-17T04:00:00Z', 'group', 'J', S['USA_SF']),   # 5am BST
    ('POR', 'COD', '2026-06-17T17:00:00Z', 'group', 'K', S['USA_HOU']),  # 6pm BST
    ('ENG', 'CRO', '2026-06-17T20:00:00Z', 'group', 'L', S['USA_DAL']),  # 9pm BST

    # ===== Thursday, June 18 =====
    ('GHA', 'PAN', '2026-06-17T23:00:00Z', 'group', 'L', S['CAN_TOR']),  # 12am BST → la veille en UTC
    ('UZB', 'COL', '2026-06-18T02:00:00Z', 'group', 'K', S['MEX_AZ']),   # 3am BST
    ('CZE', 'RSA', '2026-06-18T16:00:00Z', 'group', 'A', S['USA_ATL']),  # 5pm BST
    ('SUI', 'BIH', '2026-06-18T19:00:00Z', 'group', 'B', S['USA_LA']),   # 8pm BST
    ('CAN', 'QAT', '2026-06-18T22:00:00Z', 'group', 'B', S['CAN_VAN']),  # 11pm BST

    # ===== Friday, June 19 =====
    ('MEX', 'KOR', '2026-06-19T01:00:00Z', 'group', 'A', S['MEX_GUA']),  # 2am BST
    ('USA', 'AUS', '2026-06-19T19:00:00Z', 'group', 'D', S['USA_SEA']),  # 8pm BST
    ('SCO', 'MAR', '2026-06-19T22:00:00Z', 'group', 'C', S['USA_BOS']),  # 11pm BST

    # ===== Saturday, June 20 =====
    ('BRA', 'HAI', '2026-06-20T00:30:00Z', 'group', 'C', S['USA_PHI']),  # 1.30am BST
    ('TUR', 'PAR', '2026-06-20T03:00:00Z', 'group', 'D', S['USA_SF']),   # 4am BST
    ('NED', 'SWE', '2026-06-20T17:00:00Z', 'group', 'F', S['USA_HOU']),  # 6pm BST
    ('GER', 'CIV', '2026-06-20T20:00:00Z', 'group', 'E', S['CAN_TOR']),  # 9pm BST

    # ===== Sunday, June 21 =====
    ('ECU', 'CUW', '2026-06-21T00:00:00Z', 'group', 'E', S['USA_KC']),   # 1am BST
    ('TUN', 'JPN', '2026-06-21T04:00:00Z', 'group', 'F', S['MEX_GUA']),  # 5am BST - 1000ème match CDM
    ('ESP', 'KSA', '2026-06-21T16:00:00Z', 'group', 'H', S['USA_ATL']),  # 5pm BST
    ('BEL', 'IRN', '2026-06-21T19:00:00Z', 'group', 'G', S['USA_LA']),   # 8pm BST
    ('URU', 'CPV', '2026-06-21T22:00:00Z', 'group', 'H', S['USA_MIA']),  # 11pm BST

    # ===== Monday, June 22 =====
    ('NZL', 'EGY', '2026-06-22T01:00:00Z', 'group', 'G', S['CAN_VAN']),  # 2am BST
    ('ARG', 'AUT', '2026-06-22T17:00:00Z', 'group', 'J', S['USA_DAL']),  # 6pm BST
    ('FRA', 'IRQ', '2026-06-22T21:00:00Z', 'group', 'I', S['USA_PHI']),  # 10pm BST

    # ===== Tuesday, June 23 =====
    ('NOR', 'SEN', '2026-06-23T00:00:00Z', 'group', 'I', S['CAN_TOR']),  # 1am BST
    ('JOR', 'ALG', '2026-06-23T03:00:00Z', 'group', 'J', S['USA_SF']),   # 4am BST
    ('POR', 'UZB', '2026-06-23T17:00:00Z', 'group', 'K', S['USA_HOU']),  # 6pm BST
    ('ENG', 'GHA', '2026-06-23T20:00:00Z', 'group', 'L', S['USA_BOS']),  # 9pm BST

    # ===== Wednesday, June 24 =====
    ('PAN', 'CRO', '2026-06-23T23:00:00Z', 'group', 'L', S['USA_BOS']),  # 12am BST
    ('COL', 'COD', '2026-06-24T02:00:00Z', 'group', 'K', S['MEX_GUA']),  # 3am BST
    ('SUI', 'CAN', '2026-06-24T19:00:00Z', 'group', 'B', S['CAN_VAN']),  # 8pm BST
    ('BIH', 'QAT', '2026-06-24T19:00:00Z', 'group', 'B', S['USA_SEA']),  # 8pm BST simultané
    ('MAR', 'HAI', '2026-06-24T22:00:00Z', 'group', 'C', S['USA_ATL']),  # 11pm BST
    ('SCO', 'BRA', '2026-06-24T22:00:00Z', 'group', 'C', S['USA_MIA']),  # 11pm BST simultané

    # ===== Thursday, June 25 =====
    ('RSA', 'KOR', '2026-06-25T01:00:00Z', 'group', 'A', S['MEX_GUA']),  # 2am BST
    ('CZE', 'MEX', '2026-06-25T01:00:00Z', 'group', 'A', S['MEX_AZ']),   # 2am BST simultané
    ('CUW', 'CIV', '2026-06-25T20:00:00Z', 'group', 'E', S['USA_PHI']),  # 9pm BST
    ('ECU', 'GER', '2026-06-25T20:00:00Z', 'group', 'E', S['USA_NY']),   # 9pm BST simultané

    # ===== Friday, June 26 =====
    ('TUN', 'NED', '2026-06-25T23:00:00Z', 'group', 'F', S['USA_KC']),   # 12am BST
    ('JPN', 'SWE', '2026-06-25T23:00:00Z', 'group', 'F', S['USA_DAL']),  # 12am BST simultané
    ('TUR', 'USA', '2026-06-26T02:00:00Z', 'group', 'D', S['USA_LA']),   # 3am BST
    ('PAR', 'AUS', '2026-06-26T02:00:00Z', 'group', 'D', S['USA_SF']),   # 3am BST simultané
    ('NOR', 'FRA', '2026-06-26T19:00:00Z', 'group', 'I', S['USA_BOS']),  # 8pm BST
    ('SEN', 'IRQ', '2026-06-26T19:00:00Z', 'group', 'I', S['CAN_TOR']),  # 8pm BST simultané

    # ===== Saturday, June 27 =====
    ('CPV', 'KSA', '2026-06-27T00:00:00Z', 'group', 'H', S['USA_HOU']),  # 1am BST
    ('URU', 'ESP', '2026-06-27T00:00:00Z', 'group', 'H', S['MEX_GUA']),  # 1am BST simultané
    ('NZL', 'BEL', '2026-06-27T03:00:00Z', 'group', 'G', S['CAN_VAN']),  # 4am BST
    ('EGY', 'IRN', '2026-06-27T03:00:00Z', 'group', 'G', S['USA_SEA']),  # 4am BST simultané
    ('PAN', 'ENG', '2026-06-27T21:00:00Z', 'group', 'L', S['USA_NY']),   # 10pm BST
    ('CRO', 'GHA', '2026-06-27T21:00:00Z', 'group', 'L', S['USA_PHI']),  # 10pm BST simultané

    # ===== Sunday, June 28 =====
    ('COL', 'POR', '2026-06-27T23:30:00Z', 'group', 'K', S['USA_MIA']),  # 12.30am BST
    ('COD', 'UZB', '2026-06-27T23:30:00Z', 'group', 'K', S['USA_ATL']),  # 12.30am BST simultané
    ('ALG', 'AUT', '2026-06-28T02:00:00Z', 'group', 'J', S['USA_KC']),   # 3am BST
    ('JOR', 'ARG', '2026-06-28T02:00:00Z', 'group', 'J', S['USA_DAL']),  # 3am BST simultané
]


# === LES 32 MATCHS DE PHASE FINALE (avec placeholders pour les équipes) ===
# Format placeholder : "R32_N" = match N de Round of 32, etc.
# (Le frontend résout ces placeholders en équipes réelles selon les résultats)
KNOCKOUT_MATCHES = [
    # ===== Sunday, June 28 — Round of 32 (16es de finale) =====
    ('R32_73', None, '2026-06-28T19:00:00Z', 'r32', None, S['USA_LA']),   # 8pm BST

    # ===== Monday, June 29 =====
    ('R32_76', None, '2026-06-29T17:00:00Z', 'r32', None, S['USA_HOU']),  # 6pm BST
    ('R32_74', None, '2026-06-29T20:30:00Z', 'r32', None, S['USA_BOS']),  # 9.30pm BST

    # ===== Tuesday, June 30 =====
    ('R32_75', None, '2026-06-30T01:00:00Z', 'r32', None, S['MEX_GUA']),  # 2am BST
    ('R32_78', None, '2026-06-30T17:00:00Z', 'r32', None, S['USA_DAL']),  # 6pm BST
    ('R32_77', None, '2026-06-30T21:00:00Z', 'r32', None, S['USA_NY']),   # 10pm BST

    # ===== Wednesday, July 1 =====
    ('R32_79', None, '2026-07-01T01:00:00Z', 'r32', None, S['MEX_AZ']),   # 2am BST
    ('R32_80', None, '2026-07-01T16:00:00Z', 'r32', None, S['USA_ATL']),  # 5pm BST
    ('R32_82', None, '2026-07-01T20:00:00Z', 'r32', None, S['USA_SEA']),  # 9pm BST

    # ===== Thursday, July 2 =====
    ('R32_81', None, '2026-07-02T00:00:00Z', 'r32', None, S['USA_SF']),   # 1am BST
    ('R32_84', None, '2026-07-02T19:00:00Z', 'r32', None, S['USA_LA']),   # 8pm BST

    # ===== Friday, July 3 =====
    ('R32_83', None, '2026-07-02T23:00:00Z', 'r32', None, S['CAN_TOR']),  # 12am BST
    ('R32_85', None, '2026-07-03T03:00:00Z', 'r32', None, S['CAN_VAN']),  # 4am BST
    ('R32_88', None, '2026-07-03T18:00:00Z', 'r32', None, S['USA_DAL']),  # 7pm BST
    ('R32_86', None, '2026-07-03T22:00:00Z', 'r32', None, S['USA_MIA']),  # 11pm BST

    # ===== Saturday, July 4 =====
    ('R32_87', None, '2026-07-04T01:30:00Z', 'r32', None, S['USA_KC']),   # 2.30am BST
    ('R16_90', None, '2026-07-04T17:00:00Z', 'r16', None, S['USA_HOU']),  # 6pm BST
    ('R16_89', None, '2026-07-04T21:00:00Z', 'r16', None, S['USA_PHI']),  # 10pm BST

    # ===== Sunday, July 5 =====
    ('R16_91', None, '2026-07-05T20:00:00Z', 'r16', None, S['USA_NY']),   # 9pm BST

    # ===== Monday, July 6 =====
    ('R16_92', None, '2026-07-06T00:00:00Z', 'r16', None, S['MEX_AZ']),   # 1am BST
    ('R16_93', None, '2026-07-06T19:00:00Z', 'r16', None, S['USA_DAL']),  # 8pm BST

    # ===== Tuesday, July 7 =====
    ('R16_94', None, '2026-07-07T00:00:00Z', 'r16', None, S['USA_SEA']),  # 1am BST
    ('R16_95', None, '2026-07-07T16:00:00Z', 'r16', None, S['USA_ATL']),  # 5pm BST
    ('R16_96', None, '2026-07-07T20:00:00Z', 'r16', None, S['CAN_VAN']),  # 9pm BST

    # ===== Thursday, July 9 — Quarts de finale =====
    ('QF_97',  None, '2026-07-09T20:00:00Z', 'qf', None, S['USA_BOS']),   # 9pm BST

    # ===== Friday, July 10 =====
    ('QF_98',  None, '2026-07-10T19:00:00Z', 'qf', None, S['USA_LA']),    # 8pm BST

    # ===== Saturday, July 11 =====
    ('QF_99',  None, '2026-07-11T21:00:00Z', 'qf', None, S['USA_MIA']),   # 10pm BST

    # ===== Sunday, July 12 =====
    ('QF_100', None, '2026-07-12T01:00:00Z', 'qf', None, S['USA_KC']),    # 2am BST

    # ===== Tuesday, July 14 — Demi-finales =====
    ('SF_101', None, '2026-07-14T19:00:00Z', 'sf', None, S['USA_DAL']),   # 8pm BST

    # ===== Wednesday, July 15 =====
    ('SF_102', None, '2026-07-15T19:00:00Z', 'sf', None, S['USA_ATL']),   # 8pm BST

    # ===== Saturday, July 18 — Match pour la 3e place =====
    ('TP_103', None, '2026-07-18T21:00:00Z', 'tp', None, S['USA_MIA']),   # 10pm BST

    # ===== Sunday, July 19 — Finale =====
    ('FINAL_104', None, '2026-07-19T19:00:00Z', 'final', None, S['USA_NY']),  # 8pm BST
]

ALL_MATCHES = GROUP_MATCHES + KNOCKOUT_MATCHES

# Sanity check
assert len(GROUP_MATCHES) == 72, f"Expected 72 group matches, got {len(GROUP_MATCHES)}"
assert len(KNOCKOUT_MATCHES) == 32, f"Expected 32 knockout matches, got {len(KNOCKOUT_MATCHES)}"
assert len(ALL_MATCHES) == 104, f"Expected 104 total matches, got {len(ALL_MATCHES)}"
