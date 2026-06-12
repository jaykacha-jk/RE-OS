import { Controller, Get, Header, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { randomBytes } from 'crypto';
import type { Response } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../../common/context/auth-user';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuditService } from './audit.service';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('api/v1/audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions('audit.logs.read')
  @ApiOperation({ summary: 'List audit logs scoped to current tenant' })
  @ApiOkResponse({ description: 'Paginated audit log list' })
  async list(@CurrentUser() user: AuthUser, @Query() query: ListAuditLogsQueryDto) {
    const result = await this.auditService.list(user, query);
    return {
      data: result.data,
      meta: { ...result.meta, request_id: randomBytes(16).toString('hex') },
    };
  }

  @Get('export')
  @RequirePermissions('audit.logs.export')
  @ApiOperation({ summary: 'Export filtered audit logs as CSV (capped at 10k rows)' })
  @ApiProduces('text/csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="audit-logs.csv"')
  async export(
    @CurrentUser() user: AuthUser,
    @Query() query: ListAuditLogsQueryDto,
    @Res() res: Response,
  ) {
    const csv = await this.auditService.exportCsv(user, query);
    res.send(csv);
  }
}
