import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateUserParams {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  create(params: CreateUserParams) {
    return this.prisma.user.create({
      data: {
        email: params.email.toLowerCase(),
        passwordHash: params.passwordHash,
        firstName: params.firstName,
        lastName: params.lastName,
        role: 'USER',
      },
    });
  }
}
