export function sendSuccess(
  res,
  data = null,
  message = "OK",
  meta = {},
  status = 200,
) {
  return res.status(status).json({
    ok: true,
    message,
    data,
    meta,
    error: null,
  });
}

export function sendError(
  res,
  message = "Request failed",
  code = "REQUEST_FAILED",
  details = null,
  status = 400,
  meta = {},
) {
  return res.status(status).json({
    ok: false,
    message,
    data: null,
    meta,
    error: {
      code,
      details,
    },
  });
}
