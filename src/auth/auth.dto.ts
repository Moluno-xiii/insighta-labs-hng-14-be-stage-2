import { IsNotEmpty, IsString } from 'class-validator';

class CallbackQueryDTO {
  @IsNotEmpty({ message: 'Missing or empty code parameter' })
  @IsString({ message: 'Invalid query parameters' })
  code!: string;

  @IsNotEmpty({ message: 'Missing or empty state parameter' })
  @IsString({ message: 'Invalid query parameters' })
  state!: string;
}

export { CallbackQueryDTO };
