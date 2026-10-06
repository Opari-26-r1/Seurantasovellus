const API_URL = process.env.REACT_APP_API_URL || '';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function apiGet(path) {
  if (!API_URL) throw new ApiError('REACT_APP_API_URL puuttuu .env-tiedostosta');
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new ApiError(`${path} palautti ${res.status}`, res.status);
  return res.json();
}
