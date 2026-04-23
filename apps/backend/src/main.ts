import "reflect-metadata";

import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: true
  });
  const port = Number(process.env.PORT ?? 3001);
  const host = process.env.HOST ?? "0.0.0.0";

  await app.listen(port, host);
  Logger.log(`HueGame backend is listening on ${host}:${port}.`, "Bootstrap");
}

bootstrap().catch((error: unknown) => {
  Logger.error("HueGame backend failed to start.", error instanceof Error ? error.stack : undefined, "Bootstrap");
  process.exit(1);
});
