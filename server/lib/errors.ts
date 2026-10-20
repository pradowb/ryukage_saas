/** Erro de domínio com código HTTP; tudo o resto é tratado como 500 sem expor detalhes. */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const naoEncontrado = (msg: string) => new AppError(404, msg);
export const conflito = (msg: string) => new AppError(409, msg);
export const proibido = (msg = "Sem permissão para esta ação.") => new AppError(403, msg);
export const naoAutenticado = (msg = "Sessão inválida ou expirada.") => new AppError(401, msg);
