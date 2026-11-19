// ---------------------------------------------------------------------------
// BotPlayer interface — shared contract for bots across all games.
// Bots only ever receive visible state (opponent hands hidden by caller)
// and the list of legal moves.
// ---------------------------------------------------------------------------

export interface BotPlayer<S, M> {
  /**
   * Choose a move given the player's visible state and all legal moves.
   */
  chooseMove(visibleState: S, legalMoves: M[]): M;
}
