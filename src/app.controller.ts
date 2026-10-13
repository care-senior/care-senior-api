import { Controller, Get, Redirect } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator.js';
import { DOCS_PATH } from './configure-app.js';

@ApiExcludeController()
@Controller()
export class AppController {
  @Public()
  @Get()
  @Redirect(`/${DOCS_PATH}`)
  redirectToDocs(): void {}
}
