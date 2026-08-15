import { Controller, Get, Req, Res, Next, Render } from '@nestjs/common';
import { existsSync } from 'fs';
import { join, extname } from 'path';
import type { Request, Response, NextFunction } from 'express';

const clientDistPath = join(process.cwd(), 'dist', 'client');
const isProd = process.env.NODE_ENV === 'production';

function setNoCacheHeaders(res: Response): void {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

@Controller()
export class ViewController {

  @Get('*')
  @Render('index')
  async serve(
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ): Promise<{ __platform__: string } | void> {
    setNoCacheHeaders(res);

    const url = req.path || '/';
    if (url.startsWith('/api') || url.startsWith('/socket.io')) {
      next();
      return;
    }

    if (isProd && existsSync(clientDistPath)) {
      if (url === '/' || url === '') {
        const indexPath = join(clientDistPath, 'index.html');
        if (existsSync(indexPath)) {
          res.sendFile(indexPath);
          return;
        }
      }

      const filePath = join(clientDistPath, url);
      if (extname(url) && existsSync(filePath)) {
        const maxAge = url.startsWith('/assets/') ? '1y' : 0;
        res.sendFile(filePath, { maxAge });
        return;
      }

      if (!extname(url)) {
        const indexPath = join(clientDistPath, 'index.html');
        if (existsSync(indexPath)) {
          res.sendFile(indexPath);
          return;
        }
      }
    }

    const platformData = (req as any).__platform_data__ ?? {};
    return {
      __platform__: JSON.stringify(platformData),
    };
  }
}
