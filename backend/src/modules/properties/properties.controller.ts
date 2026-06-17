import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { randomBytes } from 'crypto';
import type { Request } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import type { AuthUser } from '../../common/context/auth-user';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { AssignPropertyDto } from './dto/assign-property.dto';
import { CreatePropertyDto } from './dto/create-property.dto';
import { ListPropertiesQueryDto } from './dto/list-properties-query.dto';
import { AddDocumentDto, AddImageDto, AddVideoDto, ReorderImagesDto } from './dto/media.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PropertiesService } from './properties.service';

function requestMeta(req: Request) {
  return {
    userAgent: req.headers['user-agent'] as string | undefined,
    ipAddress: req.ip,
  };
}

function envelope<T>(data: T) {
  return { data, meta: { request_id: randomBytes(16).toString('hex') } };
}

@ApiTags('Properties')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('api/v1/properties')
export class PropertiesController {
  constructor(private readonly properties: PropertiesService) {}

  @Get()
  @RequirePermissions('properties.read')
  @ApiOperation({ summary: 'List properties (RBAC-scoped, filtered, paginated)' })
  @ApiOkResponse({ description: 'Paginated property list' })
  async list(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: ListPropertiesQueryDto,
  ) {
    const result = await this.properties.list(tenantId, user, query);
    return {
      data: result.data,
      meta: { ...result.meta, request_id: randomBytes(16).toString('hex') },
    };
  }

  @Post()
  @RequirePermissions('properties.create')
  @ApiOperation({ summary: 'Create a property (auto slug + property_code)' })
  @ApiCreatedResponse({ description: 'Property created' })
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePropertyDto,
    @Req() req: Request,
  ) {
    return envelope(await this.properties.create(tenantId, dto, user, requestMeta(req)));
  }

  @Get('summary')
  @RequirePermissions('properties.read')
  @ApiOperation({ summary: 'Property KPI summary (RBAC-scoped, filtered, non-paginated)' })
  async summary(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: ListPropertiesQueryDto,
  ) {
    return envelope(await this.properties.summary(tenantId, user, query));
  }

  @Get(':id')
  @RequirePermissions('properties.read')
  @ApiOperation({ summary: 'Get property by id' })
  async getOne(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return envelope(await this.properties.getOne(tenantId, user, id));
  }

  @Patch(':id')
  @RequirePermissions('properties.update')
  @ApiOperation({ summary: 'Update property (status workflow + history tracking)' })
  async update(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdatePropertyDto,
    @Req() req: Request,
  ) {
    return envelope(await this.properties.update(tenantId, user, id, dto, requestMeta(req)));
  }

  @Delete(':id')
  @HttpCode(200)
  @RequirePermissions('properties.delete')
  @ApiOperation({ summary: 'Soft delete property' })
  async remove(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return envelope(await this.properties.remove(tenantId, user, id, requestMeta(req)));
  }

  // --- Assignment ------------------------------------------------------------

  @Post(':id/assign')
  @RequirePermissions('properties.assign')
  @ApiOperation({ summary: 'Assign property to employee(s) (BR-P06 primary agent)' })
  async assign(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AssignPropertyDto,
    @Req() req: Request,
  ) {
    return envelope(await this.properties.assign(tenantId, user, id, dto, requestMeta(req)));
  }

  @Get(':id/history')
  @RequirePermissions('properties.read')
  @ApiOperation({ summary: 'Get property change history (audit trail)' })
  async history(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return envelope(await this.properties.getHistory(tenantId, user, id));
  }

  // --- Images ----------------------------------------------------------------

  @Post(':id/images')
  @RequirePermissions('properties.update')
  @ApiOperation({ summary: 'Add image (upload base64 or register URL)' })
  async addImage(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AddImageDto,
    @Req() req: Request,
  ) {
    return envelope(await this.properties.addImage(tenantId, user, id, dto, requestMeta(req)));
  }

  @Delete(':id/images/:imageId')
  @HttpCode(200)
  @RequirePermissions('properties.update')
  @ApiOperation({ summary: 'Delete property image' })
  async deleteImage(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @Req() req: Request,
  ) {
    return envelope(
      await this.properties.deleteImage(tenantId, user, id, imageId, requestMeta(req)),
    );
  }

  @Patch(':id/images/reorder')
  @RequirePermissions('properties.update')
  @ApiOperation({ summary: 'Reorder property images' })
  async reorderImages(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReorderImagesDto,
  ) {
    return envelope(await this.properties.reorderImages(tenantId, user, id, dto));
  }

  @Patch(':id/images/:imageId/cover')
  @RequirePermissions('properties.update')
  @ApiOperation({ summary: 'Set image as cover' })
  async setCover(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('imageId') imageId: string,
  ) {
    return envelope(await this.properties.setCoverImage(tenantId, user, id, imageId));
  }

  // --- Videos ----------------------------------------------------------------

  @Post(':id/videos')
  @RequirePermissions('properties.update')
  @ApiOperation({ summary: 'Add property video' })
  async addVideo(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AddVideoDto,
  ) {
    return envelope(await this.properties.addVideo(tenantId, user, id, dto));
  }

  @Delete(':id/videos/:videoId')
  @HttpCode(200)
  @RequirePermissions('properties.update')
  @ApiOperation({ summary: 'Delete property video' })
  async deleteVideo(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('videoId') videoId: string,
  ) {
    return envelope(await this.properties.deleteVideo(tenantId, user, id, videoId));
  }

  // --- Documents -------------------------------------------------------------

  @Post(':id/documents')
  @RequirePermissions('properties.update')
  @ApiOperation({ summary: 'Add property document' })
  async addDocument(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AddDocumentDto,
  ) {
    return envelope(await this.properties.addDocument(tenantId, user, id, dto));
  }

  @Delete(':id/documents/:documentId')
  @HttpCode(200)
  @RequirePermissions('properties.update')
  @ApiOperation({ summary: 'Delete property document' })
  async deleteDocument(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
  ) {
    return envelope(await this.properties.deleteDocument(tenantId, user, id, documentId));
  }
}
