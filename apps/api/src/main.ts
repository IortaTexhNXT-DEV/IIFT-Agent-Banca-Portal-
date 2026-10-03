import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { AppConfig } from './config/app-config.js';

const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
configureApp(app);
// SIGTERM from the container runtime runs the shutdown lifecycle: scheduled jobs finish
// their current batch before the database connection is closed.
app.enableShutdownHooks();
await app.listen(app.get(AppConfig).port);
