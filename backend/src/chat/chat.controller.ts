import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ChatService } from './chat.service';
import { ChatDto } from './dto/chat.dto';

@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post()
  async stream(
    @Body() dto: ChatDto,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    response.status(200);
    response.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders();
    const abortController = new AbortController();
    request.on('close', () => abortController.abort());

    try {
      for await (const event of this.chat.stream(dto, abortController.signal)) {
        response.write(`${JSON.stringify(event)}\n`);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to generate an answer.';
      response.write(`${JSON.stringify({ type: 'error', message })}\n`);
    } finally {
      response.end();
    }
  }
}
