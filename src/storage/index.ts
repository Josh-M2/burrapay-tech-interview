import { Option } from "fp-ts/lib/Option";
import { Either } from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";
import * as E from "fp-ts/lib/Either";
import { Tournament, Player } from "../types/index.ts";
import { v4 as uuidv4 } from "uuid";

// Storage interfaces
export interface TournamentStorage {
  tournaments: Map<string, Tournament>;
  players: Map<string, Player>;
}

// Create initial storage
export const createStorage = (): TournamentStorage => ({
  tournaments: new Map<string, Tournament>(),
  players: new Map<string, Player>(),
});

// Storage instance
export const storage = createStorage();

// Tournament operations
export const createTournament = (
  name: string,
  isMega: boolean,
): Either<string, Tournament> => {
  const tournament: Tournament = {
    id: uuidv4(),
    name,
    isMega,
    createdAt: new Date(),
  };

  storage.tournaments.set(tournament.id, tournament);
  return E.right(tournament);
};

export const getTournament = (id: string): Option<Tournament> => {
  return O.fromNullable(storage.tournaments.get(id));
};

export const getTournaments = (): Either<string, Tournament[]> => {
  const tournament = [...storage.tournaments.values()];

  if (tournament.length === 0) {
    return E.left("No tournament found");
  }

  return E.right(tournament);
};

// Player operations
export const createPlayer = (
  name: string,
  tournamentId: string,
  pokemonData: {
    id: number;
    types: string[];
    height: number;
    weight: number;
  },
): Either<string, Player> => {
  // Check if tournament exists
  const tournament = getTournament(tournamentId);

  if (O.isNone(tournament)) {
    return E.left("Tournament not found");
  }

  const player: Player = {
    id: uuidv4(),
    name,
    tournamentId,
    pokemonData,
  };

  storage.players.set(player.id, player);
  return E.right(player);
};

export const getPlayer = (id: string): Option<Player> => {
  return O.fromNullable(storage.players.get(id));
};

export const getPlayersByTourId = (
  tournamentId: string,
): Either<string, Player[]> => {
  if (!tournamentId) {
    return E.left("TournamentId is Required");
  }

  const tournament = getTournament(tournamentId);

  console.log("tournament:", tournament);

  if (O.isNone(tournament)) {
    return E.left("Tournament not found");
  }

  const tournamentPlayers = [...storage.players.values()].filter(
    (player) => player.tournamentId === tournamentId,
  );

  if (tournamentPlayers.length === 0) E.left("No Players found");

  return E.right(tournamentPlayers);
};

export const getPlayersByTournament = (tournamentId: string): Player[] => {
  return Array.from(storage.players.values()).filter(
    (player) => player.tournamentId === tournamentId,
  );
};
