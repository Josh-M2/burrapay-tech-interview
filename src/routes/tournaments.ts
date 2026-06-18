import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { pipe } from "fp-ts/lib/function";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
import { CreateTournamentRequest, TournamentResponse } from "../types/index.ts";
import { createTournament } from "../storage/index.ts";

export async function tournamentRoutes(fastify: FastifyInstance) {
  // TODO: Implement POST /tournaments endpoint using fp-ts patterns
  fastify.post<{ Body: CreateTournamentRequest }>(
    "/tournaments",
    async (request, reply) => {
      // TODO: Use createTournament() and handle Either result with pipe/E.fold
      try {
        if (typeof request.body.name !== "string")
          return reply
            .status(400)
            .send({ error: "Tournament name is required" });

        pipe(
          createTournament(request.body.name),
          E.fold(
            (error) => reply.status(400).send({ error }),
            (tournament) => {
              const createdTourna: TournamentResponse = {
                id: tournament.id,
                name: tournament.name,
                createdAt: tournament.createdAt.toISOString(),
              };
              return reply.status(201).send(createdTourna);
            },
          ),
        );
      } catch (error) {
        return reply.status(400).send({ error: "Invalid request body" });
      }

      // reply.status(501).send({ error: "Not implemented yet" });
    },
  );

  // TODO: Implement GET /tournaments endpoint
}
