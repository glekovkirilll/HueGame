import { Injectable } from "@nestjs/common";
import { createHash, randomUUID } from "crypto";

@Injectable()
export class AuthSessionService {
  issueSessionToken(): string {
    return randomUUID();
  }

  hashSessionToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
