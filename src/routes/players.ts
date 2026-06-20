import fastify, {
  FastifyInstance,
  FastifyRequest,
  FastifyReply,
} from "fastify";
import { pipe } from "fp-ts/lib/function";
import { Either } from "fp-ts/lib/Either";
import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";
import * as TE from "fp-ts/lib/TaskEither";
import {
  CreatePlayerRequest,
  CreatePlayerRequestCodec,
  Player,
  PlayerResponse,
  PokemonApiResponse,
  PokemonApiResponseCodec,
} from "../types/index.ts";
import {
  createPlayer,
  getPlayersByTourId,
  getPlayersByTournament,
  getTournament,
} from "../storage/index.ts";

const POKEAPI_CACHE_TTL_MS = 60 * 60 * 1000;
const POKEAPI_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const POKEAPI_RATE_LIMIT_MAX = 10;

const pokemonCache = new Map<
  string,
  { data: PokemonApiResponse; expiresAt: number }
>();

const pokeApiCallHistory: number[] = [];

const checkRateLimit = (): Either<string, void> => {
  const now = Date.now();

  const recentCalls = pokeApiCallHistory.filter(
    (timestamp) => now - timestamp < POKEAPI_RATE_LIMIT_WINDOW_MS,
  );

  console.log({
    event: "recent_call_history",
    pokeApiCallHistory,
  });

  if (recentCalls.length >= POKEAPI_RATE_LIMIT_MAX) {
    return E.left("PokeAPI rate limit exceeded");
  }

  recentCalls.push(now);
  pokeApiCallHistory.length = 0;
  pokeApiCallHistory.push(...recentCalls);

  return E.right(undefined);
};

const getCachedPokemon = (name: string): Either<string, PokemonApiResponse> => {
  const cached = pokemonCache.get(name.toLowerCase());

  if (!cached) {
    return E.left("No Cache");
  }

  if (Date.now() > cached.expiresAt) {
    pokemonCache.delete(name.toLowerCase());
    return E.left("Cache expired");
  }

  return E.right(cached.data);
};

const setCachedPokemon = (name: string, data: PokemonApiResponse) => {
  pokemonCache.set(name.toLowerCase(), {
    data,
    expiresAt: Date.now() + POKEAPI_CACHE_TTL_MS,
  });
};

// TODO for interviewee: Implement player routes using fp-ts patterns
// CRITICAL REQUIREMENT: ONLY Pokemon can be added as players - reject all non-Pokemon names!

// TODO: Implement Pokemon API validation function using TaskEither
// const validatePokemon = (name: string): TE.TaskEither<string, PokemonApiResponse> => ...

const isValidPokemonName = (name: string): E.Either<string, string> => {
  const normalized = name.trim().toLowerCase();

  const pokemonNameRegex = /^[a-z0-9-]+$/;

  if (!pokemonNameRegex.test(normalized)) {
    return E.left("Name is not a valid Pokemon");
  }

  return E.right(normalized);
};

const validatePokemon = (
  name: string,
): TE.TaskEither<string, PokemonApiResponse> =>
  pipe(
    isValidPokemonName(name),
    TE.fromEither,
    TE.chain((normalized) =>
      pipe(
        getCachedPokemon(normalized),
        E.fold(
          () =>
            pipe(
              checkRateLimit(),
              TE.fromEither,
              TE.chain(() =>
                TE.tryCatch(
                  async () => {
                    const res = await fetch(
                      `https://pokeapi.co/api/v2/pokemon/${normalized}`,
                    );

                    if (!res.ok) {
                      throw new Error("Name is not a valid Pokemon");
                    }

                    const decodedPokemonRes = PokemonApiResponseCodec.decode(
                      await res.json(),
                    );

                    if (E.isLeft(decodedPokemonRes)) {
                      throw new Error("Invalid PokeAPI response");
                    }

                    const pokemon = decodedPokemonRes.right;

                    setCachedPokemon(name, pokemon);

                    return pokemon;
                  },
                  (error) =>
                    error instanceof Error
                      ? error.message
                      : "Failed to fetch Pokemon",
                ),
              ),
            ),
          (cachedPokemon) => TE.right(cachedPokemon),
        ),
      ),
    ),
  );

export async function playerRoutes(fastify: FastifyInstance) {
  // TODO: Implement POST /tournaments/:tournamentId/players endpoint
  // REQUIREMENT: Only Pokemon names are allowed - validate using PokeAPI

  fastify.post<{
    Params: { tournamentId: string };
    Body: CreatePlayerRequest;
  }>("/tournaments/:tournamentId/players", async (request, reply) => {
    // TODO: Implement Pokemon validation and player creation logic

    const decodedBody = CreatePlayerRequestCodec.decode(request.body);

    if (E.isLeft(decodedBody)) {
      fastify.log.warn({
        event: "invalid_player_reqeust_body",
        body: request.body,
      });

      return reply.status(400).send({ error: "Invalid body request" });
    }

    const { name } = decodedBody.right;
    const { tournamentId } = request.params;

    fastify.log.info({
      event: "create_player_request",
      tournamentId,
      playername: name,
    });

    const tournamentExists = pipe(
      getTournament(tournamentId),
      O.fold(
        () => false,
        () => true,
      ),
    );

    if (!tournamentExists) {
      fastify.log.warn({
        event: "tournament_not_found",
        tournamentId,
      });

      return reply.status(404).send({ error: "Tournament not found" });
    }

    pipe(
      await validatePokemon(request.body.name)(),
      E.chain((pokemon) => {
        fastify.log.info({
          event: "validated_pokemon",
          pokemonId: pokemon.id,
          pokemonName: pokemon.name,
          tournamentId,
        });

        return createPlayer(name, tournamentId, {
          id: pokemon.id,
          types: pokemon.types.map((t) => t.type.name),
          height: pokemon.height,
          weight: pokemon.weight,
        });
      }),
      E.fold(
        (error) => {
          fastify.log.error({
            event: "create_player_failed",
            tournamentId,
            playerName: name,
            error,
          });

          if (error === "Tournament not found")
            return reply.status(404).send({ error });
          return reply.status(400).send({ error });
        },
        (player) => {
          fastify.log.info({
            event: "created_player",
            playerId: player.id,
            playerName: player.name,
            tournamentId: player.tournamentId,
          });

          const response: PlayerResponse = player;
          console.log("responselayer:,", player);
          return reply.status(201).send(response);
        },
      ),
    );

    // reply.status(501).send({ error: "Not implemented yet" });
  });

  fastify.get<{
    Params: { tournamentId: string };
    Body: CreatePlayerRequest;
  }>("/tournaments/:tournamentId/players", async (request, reply) => {
    // TODO: Implement Pokemon validation and player creation logic
    const { tournamentId } = request.params;

    fastify.log.info({
      event: "get_players_request_with_tournamentId",
      tournamentId,
    });

    if (typeof tournamentId !== "string") {
      fastify.log.warn({
        event: "invalid_tournamentId",
        tournamentId,
      });

      return reply.status(400).send({ error: "Tournament ID is required" });
    }

    const tournamentExists = pipe(
      getTournament(tournamentId),
      O.fold(
        () => false,
        () => true,
      ),
    );

    if (!tournamentExists) {
      fastify.log.warn({
        event: "tournament_not_found",
        tournamentId,
      });
      return reply.status(404).send({ error: "Tournament not found" });
    }

    pipe(
      getPlayersByTourId(tournamentId),
      E.fold(
        (error) => {
          fastify.log.error({
            event: "get_players_failed",
            tournamentId,
            error,
          });

          if (error === "Tournament not found")
            return reply.status(404).send({ error });
          return reply.status(400).send({ error });
        },
        (players) => {
          fastify.log.info({
            event: "players_retrieved",
            tournamentId,
            playerCount: players.length,
          });
          return reply.status(200).send(players);
        },
      ),
    );

    // reply.status(501).send({ error: "Not implemented yet" });
  });
}
