import * as t from "io-ts";

// Tournament interface
export interface Tournament {
  id: string;
  name: string;
  isMega: boolean;
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

export const PokemonApiResponseCodec = t.type({
  id: t.number,
  name: t.string,
  types: t.array(t.type({ type: t.type({ name: t.string }) })),
  height: t.number,
  weight: t.number,
});

export type PokemonApiResponse = t.TypeOf<typeof PokemonApiResponseCodec>;

// Request types for creating tournaments
export const CreateTournamentRequestCodec = t.type({
  name: t.string,
  isMega: t.boolean,
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
  isMega: boolean;
  createdAt: string;
}

export interface PlayerResponse {
  id: string;
  name: string;
  tournamentId: string;
}
