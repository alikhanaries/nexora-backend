import { Inject, Injectable } from '@nestjs/common';
import { AuthenticationError } from '../../../../shared/errors/index.js';
import { CORE_SERVICES } from '../../../../app/di/core-services.tokens.js';

export @Injectable()
class AuthService {
  constructor(@Inject(CORE_SERVICES) coreServices) {
    this.coreServices = coreServices;
  }

  async login(body) {
    return this.coreServices.identity.useCases.login.execute(body);
  }

  async refresh(body) {
    return this.coreServices.identity.useCases.refreshToken.execute(body);
  }

  async logout(body) {
    await this.coreServices.identity.useCases.logout.execute(body);
  }

  async getCurrentUser(authorizationHeader) {
    if (typeof authorizationHeader !== 'string') {
      throw new AuthenticationError();
    }
    const match = /^Bearer\s+(\S+)$/i.exec(authorizationHeader);
    if (match?.[1] === undefined) {
      throw new AuthenticationError();
    }
    return this.coreServices.identity.useCases.getCurrentUser.execute({
      accessToken: match[1],
    });
  }
}
