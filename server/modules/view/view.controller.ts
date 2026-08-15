import { Controller, Get, Req, Res, Next } from '@nestjs/common';
import { existsSync } from 'fs';
import { join, extname } from 'path';
import type { Request, Response, NextFunction } from 'express';

const clientDistPath = join(process.cwd(), 'dist', 'client');
const isProd = process.env.NODE_ENV === 'production';

type PlatformData = {
  appId?: string;
  basename?: string;
  [key: string]: unknown;
};

function setNoCacheHeaders(res: Response): void {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

function renderIndex(req: Request, res: Response): void {
  const platformData = (
    req as Request & { __platform_data__?: PlatformData }
  ).__platform_data__ ?? {};
  const basename =
    platformData.appId && platformData.basename
      ? platformData.basename
      : process.env.CLIENT_BASE_PATH || '/';

  setNoCacheHeaders(res);
  res.render('index', {
    __platform__: JSON.stringify(platformData),
    basename,
  });
}

@Controller()
export class ViewController {

  @Get('*')
  serve(
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ): void {
    const url = req.path || '/';
    if (url.startsWith('/api') || url.startsWith('/socket.io')) {
      next();
      return;
    }

    if (isProd && existsSync(clientDistPath)) {
      const indexPath = join(clientDistPath, 'index.html');
      const shouldRenderIndex =
        url === '/' ||
        url === '' ||
        url === '/index.html' ||
        !extname(url);

      if (shouldRenderIndex && existsSync(indexPath)) {
        renderIndex(req, res);
        return;
      }

      if (extname(url)) {
        const filePath = join(clientDistPath, url.replace(/^\/+/, ''));
        if (existsSync(filePath)) {
          const isHashedAsset = url.startsWith('/assets/');
          res.sendFile(filePath, {
            immutable: isHashedAsset,
            maxAge: isHashedAsset ? '1y' : 0,
          });
          return;
        }

        res.status(404).type('text/plain').send('Not Found');
        return;
      }
    }

    renderIndex(req, res);
  }
}
