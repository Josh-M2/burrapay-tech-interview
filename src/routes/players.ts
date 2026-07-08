import { FastifyInstance } from "fastify";
import { Effect, Schema } from "effect/index";
import { pipe } from "effect";
import {
  CreatePlayerRequest,
  CreatePlayerRequestSchema,
  PokemonApiResponse,
  PokemonApiResponseSchema,
  ValidatePokemon,
} from "../types/index.ts";
import {
  createPlayer,
  getPlayersByTourId,
  getTournament,
} from "../storage/index.ts";
import {
  CachedError,
  CacheExpiredError,
  CacheNotFoundError,
  FetchPokemonError,
  InvalidMegaPokemonError,
  InvalidPokeApiResponseError,
  InvalidRequestBodyError,
  PokeApiRateLimitExceed,
  PokemonErrorTags,
  TournamentNotFoundError,
} from "../types/error.ts";

const POKEAPI_CACHE_TTL_MS = 60 * 60 * 1000;
const POKEAPI_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const POKEAPI_RATE_LIMIT_MAX = 10;

const pokemonCache = new Map<
  string,
  { data: PokemonApiResponse; expiresAt: number }
>();

const pokeApiCallHistory: number[] = [];

const checkRateLimit = (): Effect.Effect<void, PokeApiRateLimitExceed> =>
  Effect.sync(() => {
    const now = Date.now();
    const recentCalls = pokeApiCallHistory.filter(
      (timestamp) => now - timestamp < POKEAPI_RATE_LIMIT_WINDOW_MS,
    );
    return { now, recentCalls };
  }).pipe(
    Effect.filterOrFail(
      ({ recentCalls }) => recentCalls.length < POKEAPI_RATE_LIMIT_MAX,
      () => PokeApiRateLimitExceed(),
    ),
    Effect.tap(({ now, recentCalls }) =>
      Effect.sync(() => {
        recentCalls.push(now);
        pokeApiCallHistory.length = 0;
        pokeApiCallHistory.push(...recentCalls);
      }),
    ),
    Effect.asVoid,
  );

const getCachedPokemon = (
  name: string,
): Effect.Effect<PokemonApiResponse, CachedError> =>
  Effect.sync(() => pokemonCache.get(name.toLowerCase())).pipe(
    Effect.flatMap((cached) =>
      cached ? Effect.succeed(cached) : Effect.fail(CacheNotFoundError()),
    ),
    Effect.flatMap((cached) =>
      Date.now() > cached.expiresAt
        ? Effect.sync(() => pokemonCache.delete(name.toLowerCase())).pipe(
            Effect.flatMap(() => Effect.fail(CacheExpiredError())),
          )
        : Effect.succeed(cached.data),
    ),
  );

const setCachedPokemon = (name: string, data: PokemonApiResponse) => {
  pokemonCache.set(name.toLowerCase(), {
    data,
    expiresAt: Date.now() + POKEAPI_CACHE_TTL_MS,
  });
};

const fetchAndCachePokemon = (
  name: string,
): Effect.Effect<
  PokemonApiResponse,
  PokemonErrorTags | PokeApiRateLimitExceed
> =>
  pipe(
    checkRateLimit(),
    Effect.flatMap(() => fetchPokeApi(name)),
    Effect.flatMap((response) =>
      Effect.tryPromise({
        try: () => response.json(),
        catch: () => InvalidPokeApiResponseError(),
      }),
    ),
    Effect.flatMap(decodePokemonApiResponse),
    Effect.tap((pokemon) => setCachedPokemon(name, pokemon)),
  );

// TODO for interviewee: Implement player routes using fp-ts patterns
// CRITICAL REQUIREMENT: ONLY Pokemon can be added as players - reject all non-Pokemon names!

// TODO: Implement Pokemon API validation function using TaskEither
// const validatePokemon = (name: string): TE.TaskEither<string, PokemonApiResponse> => ...

const isMegaPokemon = (
  request: ValidatePokemon,
): Effect.Effect<string, InvalidMegaPokemonError | TournamentNotFoundError> => {
  const { tournamentId, name } = request;

  return Effect.succeed(tournamentId).pipe(
    Effect.flatMap(getTournament),
    Effect.flatMap((tournament) =>
      tournament.isMega && !name.endsWith("mega")
        ? Effect.fail(InvalidMegaPokemonError())
        : Effect.succeed(request.name),
    ),
  );
};

const fetchPokeApi = (
  name: string,
): Effect.Effect<Response, PokemonErrorTags> =>
  Effect.tryPromise({
    try: async () => await fetch(`https://pokeapi.co/api/v2/pokemon/${name}`),
    catch: () => FetchPokemonError(),
  }).pipe(
    Effect.filterOrFail(
      (response) => response.ok,
      () => FetchPokemonError(),
    ),
  );

const decodePokemonApiResponse = (
  input: unknown,
): Effect.Effect<PokemonApiResponse, InvalidPokeApiResponseError> =>
  Schema.decodeUnknown(PokemonApiResponseSchema)(input).pipe(
    Effect.mapError(() => InvalidPokeApiResponseError()),
  );

export async function playerRoutes(fastify: FastifyInstance) {
  // TODO: Implement POST /tournaments/:tournamentId/players endpoint
  // REQUIREMENT: Only Pokemon names are allowed - validate using PokeAPI

  fastify.post<{
    Params: { tournamentId: string };
    Body: CreatePlayerRequest;
  }>("/tournaments/:tournamentId/players", async (request, reply) => {
    // TODO: Implement Pokemon validation and player creation logic

    return pipe(
      request.body,
      Schema.decodeUnknown(CreatePlayerRequestSchema),
      Effect.mapError(() => InvalidRequestBodyError()),

      Effect.tap(() =>
        getTournament(request.params.tournamentId).pipe(
          Effect.tapError(() =>
            Effect.sync(() =>
              fastify.log.warn({
                event: "tournament_not_found",
                tournamentId: request.params.tournamentId,
              }),
            ),
          ),
        ),
      ),

      Effect.flatMap((body) =>
        pipe(
          isMegaPokemon({
            tournamentId: request.params.tournamentId,
            name: body.name,
          }),
          Effect.map((pokemonName) => ({
            body,
            pokemonName,
          })),
        ),
      ),

      Effect.flatMap(({ body, pokemonName }) =>
        pipe(
          getCachedPokemon(pokemonName),
          Effect.catchTags({
            CacheNotFoundError: () => fetchAndCachePokemon(pokemonName),
            CacheExpiredError: () => fetchAndCachePokemon(pokemonName),
          }),
          Effect.map((pokemon) => ({
            body,
            pokemon,
          })),
        ),
      ),

      Effect.flatMap(({ body, pokemon }) =>
        createPlayer(body.name, request.params.tournamentId, pokemon),
      ),

      Effect.matchEffect({
        onFailure: (error) =>
          Effect.sync(() => {
            fastify.log.warn({
              event: "create_player_failed",
              tournamentId: request.params.tournamentId,
              error: error._tag,
            });

            switch (error._tag) {
              case "InvalidRequestBodyError":
                return reply
                  .status(400)
                  .send({ error: "Invalid body request" });
              case "TournamentNotFoundError":
                return reply.status(404).send({ error: "Tournament not found" });
              case "InvalidMegaPokemonError":
                return reply
                  .status(400)
                  .send({ error: "Pokemon must be mega for this tournament" });
              case "PokeApiRateLimitExceed":
                return reply
                  .status(429)
                  .send({ error: "Pokemon API rate limit exceeded" });
              case "FetchPokemonError":
              case "InvalidPokeApiResponseError":
                return reply
                  .status(400)
                  .send({ error: "Name is not a valid Pokemon" });
            }
          }),
        onSuccess: (player) =>
          Effect.sync(() => {
            return reply.code(201).send(player);
          }),
      }),
      Effect.runPromise,
    );

    // reply.status(501).send({ error: "Not implemented yet" });
  });

  fastify.get<{
    Params: { tournamentId: string };
  }>("/tournaments/:tournamentId/players", async (request, reply) => {
    const { tournamentId } = request.params;

    fastify.log.info({
      event: "get_players_request_with_tournamentId",
      tournamentId,
    });

    pipe(
      getPlayersByTourId(tournamentId),

      Effect.tap((players) =>
        Effect.sync(() => {
          fastify.log.info({
            event: "players_retrieved",
            tournamentId,
            playerCount: players.length,
          });
        }),
      ),

      Effect.match({
        onFailure: (error) => {
          fastify.log.error({
            event: "get_players_failed",
            tournamentId,
            error: error._tag,
          });

          switch (error._tag) {
            case "TournamentIdRequiredError":
              return reply
                .status(400)
                .send({ error: "Tournament ID is required" });

            case "TournamentNotFoundError":
              return reply.status(404).send({ error: "Tournament not found" });

            case "NoPlayersFoundError":
              return reply.status(404).send({ error: "No players found" });
          }
        },

        onSuccess: (players) => reply.status(200).send(players),
      }),
      Effect.runPromise,
    );
  });
}
