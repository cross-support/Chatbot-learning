import { Module } from '@nestjs/common';
import { ScenarioService } from './scenario.service';
import { ScenarioParserService } from './scenario-parser.service';
import { ScenarioController } from './scenario.controller';

@Module({
  providers: [ScenarioService, ScenarioParserService],
  controllers: [ScenarioController],
  exports: [ScenarioService, ScenarioParserService],
})
export class ScenarioModule {}
