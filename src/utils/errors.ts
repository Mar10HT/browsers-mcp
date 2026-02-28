export function errorResult(message: string) {
  return {
    content: [{ type: 'text' as const, text: `Error: ${message}` }],
    isError: true,
  };
}

export function handleToolError(error: unknown) {
  if (error instanceof Error) {
    return errorResult(error.message);
  }
  return errorResult(String(error));
}
