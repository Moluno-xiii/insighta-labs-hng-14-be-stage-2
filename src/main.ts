import { NestFactory } from '@nestjs/core';
import {
  BadRequestException,
  UnprocessableEntityException,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { AppModule } from './app/app.module';
import { GlobalExceptionFilter } from './globalExceptionFilter';

function firstConstraint(errors: ValidationError[]): {
  name: string;
  message: string;
} | null {
  for (const err of errors) {
    if (err.constraints) {
      const [name, message] = Object.entries(err.constraints)[0];
      return { name, message };
    }
    if (err.children && err.children.length > 0) {
      const nested = firstConstraint(err.children);
      if (nested) return nested;
    }
  }
  return null;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      stopAtFirstError: true,
      transform: true,
      exceptionFactory: (errors) => {
        const first = firstConstraint(errors);
        if (!first) return new BadRequestException('Invalid query parameters');
        if (first.name === 'isNotEmpty') {
          return new BadRequestException(first.message);
        }
        return new UnprocessableEntityException('Invalid query parameters');
      },
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.enableCors({
    origin: '*',
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
