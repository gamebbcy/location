import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { ConnectionService } from './connection.service';
import { LocationService } from './location.service';
import { MessageService } from './message.service';
import { RateLimitService } from './rate-limit.service';

@Module({
  providers: [
    RealtimeGateway,
    ConnectionService,
    LocationService,
    MessageService,
    RateLimitService,
  ],
})
export class RealtimeModule {}
