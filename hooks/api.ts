export async function readErrorMessage(response: Response) {
  const text = await response.text();
  return text || `Request failed with status ${response.status}`;
}

export async function fetchJson<T>(
  input: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(input, init);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return response.json() as Promise<T>;
}

