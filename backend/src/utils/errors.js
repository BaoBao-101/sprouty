export class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isAppError = true;
  }
}

export function errorHandler(error, request, reply) {
  if (error.isAppError) {
    return reply.code(error.statusCode).send({ message: error.message });
  }
  if (error.statusCode === 429) {
    return reply.code(429).send({ message: error.message || 'Quá nhiều yêu cầu. Thử lại sau.' });
  }
  if (error.validation) {
    return reply.code(400).send({ message: 'Dữ liệu không hợp lệ.', errors: error.validation });
  }
  request.log.error(error);
  reply.code(500).send({ message: 'Lỗi máy chủ nội bộ.' });
}
