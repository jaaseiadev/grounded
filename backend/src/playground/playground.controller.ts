import { Body, Controller, Get, Post } from '@nestjs/common';
import { RunPlaygroundDto } from './dto/run-playground.dto';
import { PlaygroundService } from './playground.service';

@Controller('playground')
export class PlaygroundController {
  constructor(private readonly playground: PlaygroundService) {}

  @Get('presets')
  presets() {
    return this.playground.presets();
  }

  @Post('run')
  run(@Body() dto: RunPlaygroundDto) {
    return this.playground.run(dto);
  }
}
