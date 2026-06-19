import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { pipe } from "fp-ts/lib/function";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
import {
  CreateTournamentRequest,
  CreateTournamentRequestCodec,
  TournamentResponse,
} from "../types/index.ts";
import { createTournament, getTournaments } from "../storage/index.ts";

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

      const decodedBody = CreateTournamentRequestCodec.decode(request.body);

      if (E.isLeft(decodedBody)) {
        fastify.log.warn({
          event: "invalid_player_reqeust_body",
          body: request.body,
        });
        return reply.status(400).send("Invalid body request");
      }

      const { name } = decodedBody.right;

      fastify.log.info({
        event: "create_tournament_validation_success",
        tournamentName: name,
      });

      pipe(
        createTournament(name),
        E.fold(
          (error) => {
            fastify.log.error({
              event: "create_tournament_failed",
              tournamentName: name,
              error,
            });
            return reply.status(400).send({ error });
          },
          (tournament) => {
            fastify.log.info({
              event: "tournament_created",
              tournamentId: tournament.id,
              tournamentName: tournament.name,
            });

            const createdTourna: TournamentResponse = {
              id: tournament.id,
              name: tournament.name,
              createdAt: tournament.createdAt.toISOString(),
            };
            return reply.status(201).send(createdTourna);
          },
        ),
      );
    },
  );

  // TODO: Implement GET /tournaments endpoint
  fastify.get("/tournaments", async (request, reply) => {
    fastify.log.info({
      event: "get_tournaments_request_received",
    });

    return pipe(
      getTournaments(),
      E.fold(
        (error) => {
          fastify.log.warn({
            event: "get_tournaments_failed",
            error,
          });
          return reply.status(404).send({ error });
        },
        (tournas) => {
          fastify.log.info({
            event: "get_tournaments_success",
            count: tournas.length,
          });
          return reply.status(200).send(tournas);
        },
      ),
    );
  });
}
