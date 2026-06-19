import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { pipe } from "fp-ts/lib/function";
import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";
import * as TE from "fp-ts/lib/TaskEither";
import {
  CreatePlayerRequest,
  PlayerResponse,
  PokemonApiResponse,
} from "../types/index.ts";
import { createPlayer, getTournament } from "../storage/index.ts";

// TODO for interviewee: Implement player routes using fp-ts patterns
// CRITICAL REQUIREMENT: ONLY Pokemon can be added as players - reject all non-Pokemon names!

// TODO: Implement Pokemon API validation function using TaskEither
// const validatePokemon = (name: string): TE.TaskEither<string, PokemonApiResponse> => ...

const validatePokemon = (
  name: string,
): TE.TaskEither<string, PokemonApiResponse> =>
  TE.tryCatch(
    async () => {
      const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${name}`);
      console.log("res: ", res);

      if (!res.ok) {
        throw new Error("Name is not a valid Pokemon");
      }

      return (await res.json()) as PokemonApiResponse;
    },
    (error) =>
      error instanceof Error ? error.message : "Failed to fetch Pokemon",
  );

export async function playerRoutes(fastify: FastifyInstance) {
  // TODO: Implement POST /tournaments/:tournamentId/players endpoint
  // REQUIREMENT: Only Pokemon names are allowed - validate using PokeAPI

  fastify.post<{
    Params: { tournamentId: string };
    Body: CreatePlayerRequest;
  }>("/tournaments/:tournamentId/players", async (request, reply) => {
    // TODO: Implement Pokemon validation and player creation logic

    const { name } = request.body;
    const { tournamentId } = request.params;

    if (!name || typeof tournamentId !== "string")
      return reply.status(400).send({ error: "Player name is required" });

    const tournamentExists = pipe(
      getTournament(tournamentId),
      O.fold(
        () => false,
        () => true,
      ),
    );

    if (!tournamentExists)
      return reply.status(404).send({ error: "Tournament not found" });

    pipe(
      await validatePokemon(request.body.name)(),
      E.chain((pokemon) =>
        createPlayer(name, tournamentId, {
          id: pokemon.id,
          types: pokemon.types.map((t) => t.type.name),
          height: pokemon.height,
          weight: pokemon.weight,
        }),
      ),
      E.fold(
        (error) => {
          if (error === "Tournament not found")
            return reply.status(404).send({ error });
          return reply.status(400).send({ error });
        },
        (player) => {
          const response: PlayerResponse = player;
          console.log("responselayer:,", player);
          return reply.status(201).send(response);
        },
      ),
    );

    // reply.status(501).send({ error: "Not implemented yet" });
  });
}
