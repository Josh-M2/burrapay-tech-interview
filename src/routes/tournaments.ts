import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  CreateTournamentRequest,
  CreateTournamentRequestSchem,
  TournamentResponse,
} from "../types/index.ts";
import { createTournament, getTournaments } from "../storage/index.ts";
import { Effect, Schema } from "effect/index";
import { pipe } from "effect";
import {
  InvalidRequestBodyError,
  TournamentNotFoundError,
} from "../types/error.ts";

export async function tournamentRoutes(fastify: FastifyInstance) {
  // TODO: Implement POST /tournaments endpoint using fp-ts patterns
  fastify.post<{ Body: CreateTournamentRequest }>(
    "/tournaments",
    async (request, reply) => {
      // TODO: Use createTournament() and handle Either result with pipe/E.fold

      fastify.log.info({
        event: "create_tournament_request",
        body: request.body,
      });

      return pipe(
        request.body,
        Schema.decodeUnknown(CreateTournamentRequestSchem),
        Effect.mapError(() => InvalidRequestBodyError()),
        Effect.flatMap(createTournament),
        Effect.matchEffect({
          onFailure: (error) => {
            if (error._tag === "InvalidRequestBodyError") {
              return Effect.sync(() => {
                reply.status(400).send("Invalid body request");
              });
            }
            return Effect.sync(() => {
              reply.status(400).send({ error });
            });
          },
          onSuccess: (tournament) =>
            Effect.sync(() => {
              const createdTourna: TournamentResponse = {
                ...tournament,
                createdAt: tournament.createdAt.toISOString(),
              };
              reply.status(201).send(createdTourna);
            }),
        }),
        Effect.runPromise,
      );
    },
  );

  // TODO: Implement GET /tournaments endpoint
  fastify.get("/tournaments", async (request, reply) => {
    fastify.log.info({
      event: "get_tournaments_request_received",
    });

    return getTournaments().pipe(
      Effect.mapError(() => TournamentNotFoundError()),
      Effect.matchEffect({
        onFailure: (error) => {
          if (error._tag === "TournamentNotFoundError")
            return Effect.sync(() => {
              fastify.log.warn({
                event: "no_tournaments_found",
                error,
              });

              reply.status(200).send("No Tournaments Found");
            });

          return Effect.sync(() => {
            fastify.log.warn({
              event: "get_tournaments_failed",
              error,
            });

            reply.status(404).send({ error });
          });
        },
        onSuccess: (tournaments) =>
          Effect.sync(() => {
            fastify.log.info({
              event: "get_tournaments_success",
              count: tournaments.length,
            });

            reply.status(200).send(tournaments);
          }),
      }),
      Effect.runPromise,
    );
  });
}
