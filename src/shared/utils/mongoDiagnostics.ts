type DiagnosticError = {
  name?: unknown;
  message?: unknown;
  code?: unknown;
  syscall?: unknown;
  hostname?: unknown;
  address?: unknown;
  port?: unknown;
  reason?: unknown;
  cause?: unknown;
  errors?: unknown;
};

const redactMongoUrl = (mongoUrl: string) => {
  try {
    const parsedUrl = new URL(mongoUrl);

    if (parsedUrl.username) {
      parsedUrl.username = "****";
    }

    if (parsedUrl.password) {
      parsedUrl.password = "****";
    }

    return parsedUrl.toString();
  } catch {
    return mongoUrl.replace(/(mongodb(?:\+srv)?:\/\/)([^:@/]+):([^@/]+)@/i, "$1****:****@");
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const toDiagnosticError = (error: unknown): DiagnosticError => {
  if (error === undefined || error === null) {
    return {};
  }

  return isRecord(error) ? error : { message: String(error) };
};

const formatField = (label: string, value: unknown) => {
  return value === undefined || value === null || value === "" ? "" : `${label}=${String(value)}`;
};

const compact = (parts: string[]) => parts.filter(Boolean).join(", ");

const summarizeNestedErrors = (errors: unknown) => {
  if (!Array.isArray(errors)) {
    return "";
  }

  return errors
    .map((nestedError, index) => {
      const diagnostic = toDiagnosticError(nestedError);
      return `nested[${index}]: ${compact([
        formatField("name", diagnostic.name),
        formatField("message", diagnostic.message),
        formatField("code", diagnostic.code),
        formatField("syscall", diagnostic.syscall),
        formatField("address", diagnostic.address),
        formatField("port", diagnostic.port)
      ])}`;
    })
    .join(" | ");
};

export const formatMongoConnectionTarget = (label: string, mongoUrl: string) => {
  return `${label}=${redactMongoUrl(mongoUrl)}`;
};

export const formatMongoConnectionError = (label: string, mongoUrl: string, error: unknown) => {
  const diagnostic = toDiagnosticError(error);
  const cause = toDiagnosticError(diagnostic.cause);
  const nestedErrors = summarizeNestedErrors(cause.errors ?? diagnostic.errors);

  return compact([
    `Mongo connection failed for ${formatMongoConnectionTarget(label, mongoUrl)}`,
    formatField("name", diagnostic.name),
    formatField("message", diagnostic.message),
    formatField("code", diagnostic.code),
    formatField("syscall", diagnostic.syscall),
    formatField("hostname", diagnostic.hostname),
    formatField("address", diagnostic.address),
    formatField("port", diagnostic.port),
    formatField("cause", cause.message),
    nestedErrors
  ]);
};
