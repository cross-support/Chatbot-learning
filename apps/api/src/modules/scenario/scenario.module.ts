import { Module } from '@nestjs/common';
import { ScenarioService } from './scenario.service';
import { ScenarioParserService } from './scenario-parser.service';
import { EvaParserService } from './eva-parser.service';
import { ScenarioController } from './scenario.controller';

@Module({
  providers: [ScenarioService, ScenarioParserService, EvaParserService],
  controllers: [ScenarioController],
  exports: [ScenarioService, ScenarioParserService, EvaParserService],
})
export class ScenarioModule {}
