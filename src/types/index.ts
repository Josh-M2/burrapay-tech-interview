import * as t from "io-ts";

// Tournament interface
export interface Tournament {
  id: string;
  name: string;
  createdAt: Date;
}

// Player interface (Pokemon only!)
export interface Player {
  id: string;
  name: string;
  tournamentId: string;
  pokemonData: {
    id: number;
    types: string[];
    height: number;
    weight: number;
  };
}

// Pokemon API response type (for reference)
export interface PokemonApiResponse {
  id: number;
  name: string;
  types: Array<{
    type: {
      name: string;
    };
  }>;
  height: number;
  weight: number;
}

// Request types for creating tournaments
export const CreateTournamentRequestCodec = t.type({
  name: t.string,
});

export type CreateTournamentRequest = t.TypeOf<
  typeof CreateTournamentRequestCodec
>;

// Request types for adding players
export const CreatePlayerRequestCodec = t.type({
  name: t.string,
});

export type CreatePlayerRequest = t.TypeOf<typeof CreatePlayerRequestCodec>;

// Response types
export interface TournamentResponse {
  id: string;
  name: string;
  createdAt: string;
}

export interface PlayerResponse {
  id: string;
  name: string;
  tournamentId: string;
}
