import winston from 'winston';

const isProd = process.env.NODE_ENV === 'production';

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/** Readable one-line logs in development (JSON stays for production / log aggregation). */
const devFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf((info) => {
    const ts = String(info.timestamp ?? '');
    const level = String(info.level ?? '');
    const msg =
      typeof info.message === 'string'
        ? info.message
        : info.message != null
          ? JSON.stringify(info.message)
          : '';
    const { timestamp, level: _l, message: _m, stack, ...rest } = info;
    const metaKeys = Object.keys(rest).filter((k) => !k.startsWith('Symbol'));
    const meta =
      metaKeys.length > 0
        ? ` ${JSON.stringify(Object.fromEntries(metaKeys.map((k) => [k, rest[k as keyof typeof rest]])))}`
        : '';
    const stackOut = stack ? `\n${stack}` : '';
    return `${ts} ${level} ${msg}${meta}${stackOut}`;
  })
);

export const logger = winston.createLogger({
  level: isProd ? 'info' : 'debug',
  format: isProd ? jsonFormat : devFormat,
  transports: [new winston.transports.Console({ stderrLevels: ['error'] })],
});
