interface InvalidRequestBodyError {
  readonly _tag: "InvalidRequestBodyError";
}

export const InvalidRequestBodyError = (): InvalidRequestBodyError => ({
  _tag: "InvalidRequestBodyError",
});

export interface TournamentNotFoundError {
  readonly _tag: "TournamentNotFoundError";
}

export const TournamentNotFoundError = (): TournamentNotFoundError => ({
  _tag: "TournamentNotFoundError",
});

export interface InvalidMegaPokemonError {
  readonly _tag: "InvalidMegaPokemonError";
}

export const InvalidMegaPokemonError = (): InvalidMegaPokemonError => ({
  _tag: "InvalidMegaPokemonError",
});

export interface CacheNotFoundError {
  readonly _tag: "CacheNotFoundError";
}

export const CacheNotFoundError = (): CacheNotFoundError => ({
  _tag: "CacheNotFoundError",
});

export interface CacheExpiredError {
  readonly _tag: "CacheExpiredError";
}

export const CacheExpiredError = (): CacheExpiredError => ({
  _tag: "CacheExpiredError",
});

export type CachedError = CacheExpiredError | CacheNotFoundError;

export interface PokeApiRateLimitExceed {
  readonly _tag: "PokeApiRateLimitExceed";
}

export const PokeApiRateLimitExceed = (): PokeApiRateLimitExceed => ({
  _tag: "PokeApiRateLimitExceed",
});

export interface FetchPokemonError {
  readonly _tag: "FetchPokemonError";
}

export const FetchPokemonError = (): FetchPokemonError => ({
  _tag: "FetchPokemonError",
});

export interface InvalidPokeApiResponseError {
  readonly _tag: "InvalidPokeApiResponseError";
}

export const InvalidPokeApiResponseError = (): InvalidPokeApiResponseError => ({
  _tag: "InvalidPokeApiResponseError",
});

export type PokemonErrorTags = FetchPokemonError | InvalidPokeApiResponseError;

export interface TournamentIdRequiredError {
  readonly _tag: "TournamentIdRequiredError";
}

export const TournamentIdRequiredError = (): TournamentIdRequiredError => ({
  _tag: "TournamentIdRequiredError",
});

export interface NoPlayersFoundError {
  readonly _tag: "NoPlayersFoundError";
}

export const NoPlayersFoundError = (): NoPlayersFoundError => ({
  _tag: "NoPlayersFoundError",
});

export type GetPlayersError =
  | TournamentIdRequiredError
  | NoPlayersFoundError
  | TournamentNotFoundError;
