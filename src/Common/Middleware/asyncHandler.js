/**
 * Simple higher-order function to catch errors from async route handlers
 * and pass them to the Express next() middleware.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
