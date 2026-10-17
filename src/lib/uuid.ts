const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Route params reach Postgres `uuid` columns; anything else would be a query error, not a 404. */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}
