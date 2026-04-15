/**
 * FirstDue API adapter
 *
 * Environment variables required:
 *   FIRSTDUE_API_KEY   — your FirstDue API key
 *   FIRSTDUE_BASE_URL  — base URL, e.g. https://api.firstdue.com
 *
 * The exact endpoint paths below are based on the FirstDue REST API.
 * If your department's FirstDue instance uses different paths, update
 * the constants in getChecklistCompletions() and getUserById() below.
 */

export interface FirstDueCompletion {
  userId: string;
  checklistId: string;
  completedAt: string; // ISO datetime string
  taskId?: string;
}

export interface FirstDueUser {
  id: string;
  name: string;
  email?: string;
}

function getConfig() {
  const apiKey = process.env.FIRSTDUE_API_KEY;
  const baseUrl = process.env.FIRSTDUE_BASE_URL;
  if (!apiKey) throw new Error('FIRSTDUE_API_KEY environment variable is not set');
  if (!baseUrl) throw new Error('FIRSTDUE_BASE_URL environment variable is not set');
  return { apiKey, baseUrl: baseUrl.replace(/\/$/, '') };
}

export const isFirstDueConfigured = () =>
  !!(process.env.FIRSTDUE_API_KEY && process.env.FIRSTDUE_BASE_URL);

/**
 * Fetch completed checklist submissions for a given checklist since a date.
 *
 * Adjust the endpoint path / response shape to match your FirstDue API docs.
 */
export async function getChecklistCompletions(
  checklistId: string,
  since: string // ISO date string YYYY-MM-DD
): Promise<FirstDueCompletion[]> {
  const { apiKey, baseUrl } = getConfig();

  const url = new URL(`${baseUrl}/v1/checklists/${checklistId}/completions`);
  url.searchParams.set('since', since);

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`FirstDue API error ${res.status}: ${await res.text()}`);
  }

  // Expected response shape: { data: [{ user_id, checklist_id, completed_at, task_id? }] }
  // Adjust field names here if the actual API differs.
  const json = (await res.json()) as {
    data: Array<{
      user_id: string;
      checklist_id: string;
      completed_at: string;
      task_id?: string;
    }>;
  };

  return (json.data ?? []).map(item => ({
    userId: item.user_id,
    checklistId: item.checklist_id,
    completedAt: item.completed_at,
    taskId: item.task_id,
  }));
}

/**
 * Fetch a single FirstDue user by their ID.
 */
export async function getUserById(userId: string): Promise<FirstDueUser | null> {
  const { apiKey, baseUrl } = getConfig();

  const res = await fetch(`${baseUrl}/v1/users/${userId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`FirstDue API error ${res.status}: ${await res.text()}`);

  // Expected shape: { id, name, email }
  const json = (await res.json()) as { id: string; name: string; email?: string };
  return { id: json.id, name: json.name, email: json.email };
}
