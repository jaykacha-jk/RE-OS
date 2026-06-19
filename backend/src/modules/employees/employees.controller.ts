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
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../../common/context/auth-user';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { ListEmployeesQueryDto } from './dto/list-employees-query.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeesService } from './employees.service';

@ApiTags('Employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('api/v1/employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @RequirePermissions('employees.read')
  @ApiOperation({ summary: 'List employees in current tenant' })
  @ApiOkResponse({ description: 'Paginated employee list' })
  async list(@TenantId() tenantId: string, @Query() query: ListEmployeesQueryDto) {
    const result = await this.employeesService.listEmployees(tenantId, query);
    return {
      data: result.data,
      meta: { ...result.meta, request_id: randomBytes(16).toString('hex') },
    };
  }

  @Post()
  @RequirePermissions('employees.create')
  @ApiOperation({ summary: 'Create employee and send invitation' })
  @ApiCreatedResponse({ description: 'Employee created' })
  async create(
    @TenantId() tenantId: string,
    @Body() dto: CreateEmployeeDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.employeesService.createEmployee(tenantId, dto, user, {
      userAgent: req.headers['user-agent'] as string | undefined,
      ipAddress: req.ip,
    });
    return {
      data,
      meta: { request_id: randomBytes(16).toString('hex') },
    };
  }

  @Get(':id')
  @RequirePermissions('employees.read')
  @ApiOperation({ summary: 'Get employee by id' })
  async getOne(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.employeesService.getEmployee(tenantId, id, user);
    return {
      data,
      meta: { request_id: randomBytes(16).toString('hex') },
    };
  }

  @Patch(':id')
  @RequirePermissions('employees.update')
  @ApiOperation({ summary: 'Update employee' })
  async update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.employeesService.updateEmployee(tenantId, id, dto, user, {
      userAgent: req.headers['user-agent'] as string | undefined,
      ipAddress: req.ip,
    });
    return {
      data,
      meta: { request_id: randomBytes(16).toString('hex') },
    };
  }

  @Delete(':id')
  @HttpCode(200)
  @RequirePermissions('employees.delete')
  @ApiOperation({ summary: 'Soft delete employee' })
  async remove(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.employeesService.deleteEmployee(tenantId, id, user, {
      userAgent: req.headers['user-agent'] as string | undefined,
      ipAddress: req.ip,
    });
    return {
      data,
      meta: { request_id: randomBytes(16).toString('hex') },
    };
  }
}
