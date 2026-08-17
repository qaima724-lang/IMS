// eslint-disable-next-line no-unused-vars
module.exports = function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return res.status(400).json({ error: `${field} already exists.` });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: Object.values(err.errors).map((e) => e.message).join(', ') });
  }

  const status = err.status || 500;
  const message = status === 500 ? 'Something went wrong. Please try again.' : err.message;
  res.status(status).json({ error: message, code: err.code });
};
