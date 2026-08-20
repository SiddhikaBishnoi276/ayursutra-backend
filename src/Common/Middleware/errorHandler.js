/**
 * Centralized Error Handling Middleware for AyurSutra Backend
 */
const errorHandler = (err, req, res, next) => {
  console.error('[Error Details]:', {
    message: err.message,
    code: err.code,
    detail: err.detail,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });

  // Handle specific PostgreSQL error codes
  if (err.code === '22P02') {
    return res.status(400).json({
      success: false,
      message: 'Invalid input format or ID syntax.',
      error: err.message,
    });
  }

  if (err.code === '23503') {
    return res.status(400).json({
      success: false,
      message: 'Referenced entity does not exist (foreign key violation).',
      detail: err.detail,
    });
  }

  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      message: 'Resource already exists (unique constraint violation).',
      detail: err.detail,
    });
  }

  if (err.code === '23514') {
    return res.status(400).json({
      success: false,
      message: 'Input violates database check constraint.',
      detail: err.detail,
    });
  }

  const statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
