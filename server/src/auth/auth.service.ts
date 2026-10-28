import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { db } from '../db';
import { users } from '../db/schema';
import { sql } from 'drizzle-orm';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async register(dto: RegisterDto) {
    // Emails are case-insensitive: store them normalised so "A@x.com" and
    // "a@x.com" cannot become two accounts.
    const email = dto.email.trim().toLowerCase();
    const username = dto.username.trim();
    if (username.length < 2) {
      throw new BadRequestException('Username must be at least 2 characters');
    }

    // Check if email already exists
    const existingEmail = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`);
    if (existingEmail.length > 0) {
      throw new ConflictException('Email already registered');
    }

    // Check if username already exists
    const existingUsername = await db
      .select()
      .from(users)
      .where(sql`lower(${users.username}) = ${username.toLowerCase()}`);
    if (existingUsername.length > 0) {
      throw new ConflictException('Username already taken');
    }

    const hash = await bcrypt.hash(dto.password, 10);
    let newUser;
    try {
      newUser = await db
        .insert(users)
        .values({ email, username, passwordHash: hash })
        .returning();
    } catch {
      // Two simultaneous sign-ups can slip past the checks above; the unique
      // indexes catch them.
      throw new ConflictException('Email or username already taken');
    }

    const user = newUser[0];
    const token = this.jwtService.sign({ sub: user.id, email: user.email });
    return {
      access_token: token,
      user: { id: user.id, email: user.email, username: user.username },
    };
  }

  async login(dto: LoginDto) {
    const user = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${dto.email.trim().toLowerCase()}`);
    if (user.length === 0) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await bcrypt.compare(dto.password, user[0].passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const token = this.jwtService.sign({
      sub: user[0].id,
      email: user[0].email,
    });
    return {
      access_token: token,
      user: {
        id: user[0].id,
        email: user[0].email,
        username: user[0].username,
      },
    };
  }
}
