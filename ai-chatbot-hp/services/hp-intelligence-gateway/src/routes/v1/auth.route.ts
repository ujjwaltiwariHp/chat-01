import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authService } from '../../services/auth.service.js';
import { config } from '../../config.js';
import { ApiResponse, HttpStatusCode } from '@hp-intelligence/core';

const RequestSchema = z.object({
  email: z.email(),
});

const VerifySchema = z.object({
  token: z.string(),
});

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/magic-link', async (request: FastifyRequest, reply: FastifyReply) => {
    const result = RequestSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(HttpStatusCode.BAD_REQUEST).send(
        new ApiResponse(HttpStatusCode.BAD_REQUEST, null, 'Invalid email format')
      );
    }

    try {
      await authService.requestMagicLink(result.data.email);
      return reply.status(HttpStatusCode.OK).send(
        new ApiResponse(HttpStatusCode.OK, null, 'Magic link sent. Please check your email.')
      );
    } catch (err: any) {
      const status = err.statusCode || HttpStatusCode.INTERNAL_SERVER_ERROR;
      return reply.status(status).send(
        new ApiResponse(status, null, err.message)
      );
    }
  });

  fastify.get('/verify', async (request: FastifyRequest, reply: FastifyReply) => {
    const result = VerifySchema.safeParse(request.query);
    if (!result.success) {
      return reply.status(HttpStatusCode.BAD_REQUEST).send('Invalid or missing token');
    }

    try {
      const { token } = await authService.verifyMagicLink(result.data.token);

      // Set JWT Cookie
      const isSecure = config.NODE_ENV === 'production';
      reply.setCookie('hp_jwt', token, {
        path: '/',
        httpOnly: true,
        secure: isSecure,
        sameSite: isSecure ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60, // 7 days
      });

      // Redirect to Dashboard
      return reply.redirect(config.DASHBOARD_URL);
    } catch (err: any) {
      // In case of error, redirect to a login error page or similar
      const errorMsg = encodeURIComponent(err.message);
      return reply.redirect(`${config.DASHBOARD_URL}/login?error=${errorMsg}`);
    }
  });

  fastify.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    reply.clearCookie('hp_jwt', { path: '/' });
    return reply.status(HttpStatusCode.OK).send(
      new ApiResponse(HttpStatusCode.OK, null, 'Logged out successfully')
    );
  });
}
