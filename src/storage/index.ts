import {
  Tournament,
  Player,
  CreateTournamentRequest,
  PokemonApiResponse,
} from "../types/index.ts";
import { v4 as uuidv4 } from "uuid";
import { Effect, pipe } from "effect/index";
import {
  GetPlayersError,
  NoPlayersFoundError,
  TournamentIdRequiredError,
  TournamentNotFoundError,
} from "../types/error.ts";

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
  request: CreateTournamentRequest,
): Effect.Effect<Tournament> => {
  return Effect.sync(() => {
    const { name, isMega } = request;

    const tournament: Tournament = {
      id: uuidv4(),
      name,
      isMega,
      createdAt: new Date(),
    };

    storage.tournaments.set(tournament.id, tournament);
    return tournament;
  });
};

export const getTournament = (
  id: string,
): Effect.Effect<Tournament, TournamentNotFoundError> =>
  Effect.sync(() => storage.tournaments.get(id)).pipe(
    Effect.flatMap((tournament) =>
      tournament
        ? Effect.succeed(tournament)
        : Effect.fail(TournamentNotFoundError()),
    ),
  );

export const getTournaments = (): Effect.Effect<
  Tournament[],
  TournamentNotFoundError
> => {
  return Effect.sync(() => [...storage.tournaments.values()]).pipe(
    Effect.filterOrFail(
      (tournaments) => tournaments.length > 0,
      () => TournamentNotFoundError(),
    ),
  );
};
// Player operations
export const createPlayer = (
  name: string,
  tournamentId: string,
  pokemon: PokemonApiResponse,
): Effect.Effect<Player, TournamentNotFoundError> =>
  pipe(
    getTournament(tournamentId),
    Effect.flatMap(() =>
      Effect.sync(() => {
        const player: Player = {
          id: uuidv4(),
          name,
          tournamentId,
          pokemonData: {
            id: pokemon.id,
            types: pokemon.types.map((t) => t.type.name),
            height: pokemon.height,
            weight: pokemon.weight,
          },
        };

        storage.players.set(player.id, player);

        return player;
      }),
    ),
  );

export const getPlayersByTourId = (
  tournamentId: string,
): Effect.Effect<Player[], GetPlayersError> => {
  if (!tournamentId) {
    return Effect.fail(TournamentIdRequiredError());
  }

  return pipe(
    getTournament(tournamentId),
    Effect.flatMap(() =>
      Effect.sync(() =>
        [...storage.players.values()].filter(
          (player) => player.tournamentId === tournamentId,
        ),
      ),
    ),
    Effect.flatMap((players) =>
      players.length > 0
        ? Effect.succeed(players)
        : Effect.fail(NoPlayersFoundError()),
    ),
  );
};
