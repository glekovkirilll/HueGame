import { Injectable } from "@nestjs/common";

@Injectable()
export class I18nService {
  resolveLocale(preferredLocale?: string): string {
    return preferredLocale ?? "ru";
  }
}
