import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import type { Response } from 'express';
import { PageQueryDto, pageArgs, toPage } from '../../common/http/pagination.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { CurrentUser, ForAudience, RequirePermissions } from '../../common/security/decorators.js';
import { Permission } from '../../common/security/permissions.js';
import type { SessionUser } from '../../common/security/session-user.js';
import { DocumentOwnerType, DocumentStatus } from '../../generated/prisma/enums.js';
import { DocumentsService, toView } from './documents.service.js';
import type { UploadedFile as UploadedFileData } from './file-inspector.js';

const OWNER_TYPES = Object.values(DocumentOwnerType);

class UploadDocumentDto {
  @ApiProperty({ enum: OWNER_TYPES }) @IsIn(OWNER_TYPES) ownerType: DocumentOwnerType;
  @ApiProperty() @IsUUID() ownerId: string;
  @ApiProperty() @IsString() @Matches(/^[A-Z0-9_]{2,50}$/) docType: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601({ strict: true }) expiryDate?: string;
}

class OwnerQueryDto {
  @ApiProperty({ enum: OWNER_TYPES }) @IsIn(OWNER_TYPES) ownerType: DocumentOwnerType;
  @ApiProperty() @IsUUID() ownerId: string;
}

class ReviewDocumentDto {
  @ApiProperty({ enum: ['VERIFIED', 'REJECTED'] }) @IsIn(['VERIFIED', 'REJECTED']) decision:
    'VERIFIED' | 'REJECTED';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) remarks?: string;
}

class DocumentQueueQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: Object.values(DocumentStatus) })
  @IsOptional()
  @IsIn(Object.values(DocumentStatus))
  status?: DocumentStatus;
  @ApiPropertyOptional({ enum: OWNER_TYPES })
  @IsOptional()
  @IsIn(OWNER_TYPES)
  ownerType?: DocumentOwnerType;
}

/** Upload, list and download — shared by the portal and back-office (access checked per owner). */
@ApiTags('Common: Documents')
@Controller('common/documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024, files: 1 } }))
  upload(
    @CurrentUser() user: SessionUser,
    @Body() body: UploadDocumentDto,
    @UploadedFile() file?: UploadedFileData,
  ) {
    return this.documents.upload(user, body, file);
  }

  @Get()
  list(@CurrentUser() user: SessionUser, @Query() query: OwnerQueryDto) {
    return this.documents.listForOwner(user, query.ownerType, query.ownerId);
  }

  @Get(':id/content')
  async download(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const { document, content } = await this.documents.download(user, id);
    response.setHeader('Cache-Control', 'no-store');
    return new StreamableFile(content, {
      type: document.mimeType,
      disposition: `attachment; filename="${document.fileName}"`,
      length: content.length,
    });
  }
}

/** BO-11/12: document verification queue. */
@ApiTags('Back-office: Documents')
@ForAudience('BACKOFFICE')
@RequirePermissions(Permission.BoDocumentsVerify)
@Controller('backoffice/documents')
export class DocumentReviewController {
  constructor(
    private readonly documents: DocumentsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async queue(@Query() query: DocumentQueueQueryDto) {
    const where = {
      status: query.status ?? 'UPLOADED',
      ownerType: query.ownerType,
      systemGenerated: false,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.document.findMany({ where, orderBy: { createdAt: 'asc' }, ...pageArgs(query) }),
      this.prisma.document.count({ where }),
    ]);
    return toPage(items.map(toView), total, query);
  }

  @Post(':id/review')
  review(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReviewDocumentDto,
  ) {
    return this.documents.review(user, id, body.decision, body.remarks);
  }
}
