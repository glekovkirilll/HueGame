import { Module } from "@nestjs/common";

import { PaletteService } from "./palette.service";

@Module({
  providers: [PaletteService],
  exports: [PaletteService]
})
export class PaletteModule {}
