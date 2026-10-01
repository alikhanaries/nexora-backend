import { Inject, Injectable } from '@nestjs/common';
import { AuthenticationError } from '../../shared/errors/index.js';
import { CORE_DOMAIN } from '../domain/core-domain.tokens.js';

export @Injectable()
class AuthService {
  constructor(@Inject(CORE_DOMAIN) coreDomain) {
    this.coreDomain = coreDomain;
  }

  async login(body) {
    return this.coreDomain.identity.useCases.login.execute(body);
  }

  async refresh(body) {
    return this.coreDomain.identity.useCases.refreshToken.execute(body);
  }

  async logout(body) {
    await this.coreDomain.identity.useCases.logout.execute(body);
  }

  async getCurrentUser(authorizationHeader) {
    if (typeof authorizationHeader !== 'string') {
      throw new AuthenticationError();
    }
    const match = /^Bearer\s+(\S+)$/i.exec(authorizationHeader);
    if (match?.[1] === undefined) {
      throw new AuthenticationError();
    }
    return this.coreDomain.identity.useCases.getCurrentUser.execute({
      accessToken: match[1],
    });
  }
}
