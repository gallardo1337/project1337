// Browser access goes through our authenticated API, never directly to Supabase.
class LibraryQuery {
  constructor(table) {
    this.query = { table, action: "select", columns: "*", filters: [], orders: [] };
  }
  select(columns = "*") { this.query.columns = columns; return this; }
  insert(values) { this.query.action = "insert"; this.query.values = values; return this; }
  update(values) { this.query.action = "update"; this.query.values = values; return this; }
  delete() { this.query.action = "delete"; return this; }
  eq(column, value) { this.query.filters.push({ column, op: "eq", value }); return this; }
  order(column, options = {}) {
    this.query.orders.push({ column, ascending: options.ascending !== false });
    return this;
  }
  range(from, to) { this.query.range = [from, to]; return this; }
  single() { this.query.single = true; return this; }
  async run() {
    try {
      const response = await fetch("/api/library-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify(this.query),
      });
      const payload = await response.json();
      if (!response.ok) {
        return { data: null, error: { message: payload?.error || "Daten konnten nicht geladen werden." } };
      }
      return { data: payload.data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || "Netzwerkfehler" } };
    }
  }
  then(resolve, reject) { return this.run().then(resolve, reject); }
}

export const supabase = { from: (table) => new LibraryQuery(table) };
