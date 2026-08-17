type LogArgs = [message?: unknown, ...details: unknown[]];

function write(method: 'debug' | 'info' | 'warn' | 'error', args: LogArgs) {
  if (!import.meta.env.DEV && (method === 'debug' || method === 'info')) return;
  console[method](...args);
}

export const logger = {
  debug: (...args: LogArgs) => write('debug', args),
  info: (...args: LogArgs) => write('info', args),
  warn: (...args: LogArgs) => write('warn', args),
  error: (...args: LogArgs) => write('error', args),
};

export default logger;
