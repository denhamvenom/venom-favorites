/**
 * Per-team progress derivation: match-by-match results + playoff bracket status.
 */

import type {
  AllianceColor,
  BracketStatus,
  Favorite,
  Match,
  MatchOutcome,
  MatchResult,
  Ranking,
  TeamProgress,
} from '../types/domain';

export function deriveMatchResult(match: Match, teamNumber: number): MatchResult | null {
  if (match.redScore === undefined || match.blueScore === undefined) return null;
  const onRed = match.redAlliance.includes(teamNumber);
  const onBlue = match.blueAlliance.includes(teamNumber);
  if (!onRed && !onBlue) return null;
  const alliance: AllianceColor = onRed ? 'red' : 'blue';
  const ourScore = alliance === 'red' ? match.redScore : match.blueScore;
  const theirScore = alliance === 'red' ? match.blueScore : match.redScore;
  let outcome: MatchOutcome;
  if (ourScore > theirScore) outcome = 'W';
  else if (ourScore < theirScore) outcome = 'L';
  else outcome = 'T';
  return { match, teamNumber, alliance, outcome, ourScore, theirScore };
}

export function deriveProgress(
  favorite: Favorite,
  matches: Match[],
  ranking?: Ranking,
): TeamProgress {
  const myMatches = matches.filter(
    (m) =>
      m.field === favorite.division &&
      (m.redAlliance.includes(favorite.teamNumber) || m.blueAlliance.includes(favorite.teamNumber)),
  );
  const qualResults: MatchResult[] = [];
  const playoffResults: MatchResult[] = [];
  for (const m of myMatches) {
    const r = deriveMatchResult(m, favorite.teamNumber);
    if (!r) continue;
    if (m.level === 'qual') qualResults.push(r);
    else if (m.level === 'playoff') playoffResults.push(r);
  }
  // Earliest first
  qualResults.sort((a, b) => a.match.matchNumber - b.match.matchNumber);
  playoffResults.sort((a, b) => a.match.matchNumber - b.match.matchNumber);

  const bracketStatus = playoffResults.length > 0 ? deriveBracketStatus(playoffResults) : undefined;

  return {
    favorite,
    ranking,
    qualResults,
    playoffResults,
    bracketStatus,
  };
}

/**
 * Naive bracket status from playoff results alone:
 *   0 losses  → 'upper'
 *   1 loss    → 'lower_1L'
 *   ≥2 losses → 'eliminated'
 *
 * The spec expects a `'winner'` state for division winners; that requires
 * cross-checking against all other alliances' loss counts in the same division.
 * For now we leave that to Phase 6 (Saturday Mode) which has alliance context.
 */
export function deriveBracketStatus(playoffResults: MatchResult[]): BracketStatus {
  const losses = playoffResults.filter((r) => r.outcome === 'L').length;
  if (losses >= 2) return 'eliminated';
  if (losses === 1) return 'lower_1L';
  return 'upper';
}
