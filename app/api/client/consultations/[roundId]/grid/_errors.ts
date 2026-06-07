export function gridRouteErrorStatus(error: unknown) {
  if (
    error instanceof Error &&
    /not found|no longer accessible/i.test(error.message)
  ) {
    return 404;
  }

  return 500;
}
