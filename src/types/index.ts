import { Schema } from "effect/index";

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

export interface ValidatePokemon {
  name: Player["id"];
  tournamentId: Player["tournamentId"];
}

export const PokemonApiResponseSchema = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  types: Schema.Array(
    Schema.Struct({ type: Schema.Struct({ name: Schema.String }) }),
  ),
  height: Schema.Number,
  weight: Schema.Number,
});

export type PokemonApiResponse = Schema.Schema.Type<
  typeof PokemonApiResponseSchema
>;

// Request types for creating tournaments
export const CreateTournamentRequestSchem = Schema.Struct({
  name: Schema.String,
  isMega: Schema.Boolean,
});

export type CreateTournamentRequest = Schema.Schema.Type<
  typeof CreateTournamentRequestSchem
>;

// Request types for adding players
export const CreatePlayerRequestSchema = Schema.Struct({
  name: Schema.String,
});

export type CreatePlayerRequest = Schema.Schema.Type<
  typeof CreatePlayerRequestSchema
>;

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
