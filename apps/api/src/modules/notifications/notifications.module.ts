import { Global, Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module.js';
import { EmailChannel, SmsChannel } from './channels.js';
import { NotificationDispatcher } from './notification.dispatcher.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

@Global()
@Module({
  imports: [DocumentsModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationDispatcher, EmailChannel, SmsChannel],
  exports: [NotificationsService],
})
export class NotificationsModule {}
