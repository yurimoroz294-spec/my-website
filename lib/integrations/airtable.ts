export interface AirtableCredentials {
  accessToken: string
  baseId: string
}

export interface AirtableRecord {
  id?: string
  fields: Record<string, unknown>
  createdTime?: string
}

export interface AirtableListResponse {
  records: AirtableRecord[]
  offset?: string
}

export class AirtableClient {
  private readonly baseUrl = 'https://api.airtable.com/v0'
  private readonly accessToken: string
  private readonly baseId: string

  constructor(creds: AirtableCredentials) {
    this.accessToken = creds.accessToken
    this.baseId = creds.baseId
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}/${this.baseId}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Airtable API ${res.status}: ${err}`)
    }

    return res.json() as Promise<T>
  }

  async testConnection(): Promise<{ ok: boolean; message?: string }> {
    try {
      // List tables in the base via metadata API
      const res = await fetch(
        `https://api.airtable.com/v0/meta/bases/${this.baseId}/tables`,
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        },
      )
      if (!res.ok) {
        const err = await res.json() as { error?: { message?: string } }
        return { ok: false, message: err?.error?.message ?? `HTTP ${res.status}` }
      }
      return { ok: true }
    } catch (e) {
      return { ok: false, message: String(e) }
    }
  }

  async listRecords(tableId: string, offset?: string): Promise<AirtableListResponse> {
    const qs = offset ? `?offset=${encodeURIComponent(offset)}` : ''
    return this.request<AirtableListResponse>('GET', `/${encodeURIComponent(tableId)}${qs}`)
  }

  async createRecord(tableId: string, fields: Record<string, unknown>): Promise<AirtableRecord> {
    return this.request<AirtableRecord>('POST', `/${encodeURIComponent(tableId)}`, {
      fields,
    })
  }

  async createRecords(tableId: string, records: Record<string, unknown>[]): Promise<{ records: AirtableRecord[] }> {
    // Airtable allows up to 10 records per request
    const chunks: Record<string, unknown>[][] = []
    for (let i = 0; i < records.length; i += 10) {
      chunks.push(records.slice(i, i + 10))
    }

    const results: AirtableRecord[] = []
    for (const chunk of chunks) {
      const res = await this.request<{ records: AirtableRecord[] }>(
        'POST',
        `/${encodeURIComponent(tableId)}`,
        { records: chunk.map(fields => ({ fields })) },
      )
      results.push(...res.records)
    }
    return { records: results }
  }

  async updateRecord(
    tableId: string,
    recordId: string,
    fields: Record<string, unknown>,
  ): Promise<AirtableRecord> {
    return this.request<AirtableRecord>(
      'PATCH',
      `/${encodeURIComponent(tableId)}/${recordId}`,
      { fields },
    )
  }

  async upsertByField(
    tableId: string,
    fields: Record<string, unknown>,
    matchField: string,
  ): Promise<{ record: AirtableRecord; created: boolean }> {
    const matchValue = fields[matchField]
    if (!matchValue) {
      const record = await this.createRecord(tableId, fields)
      return { record, created: true }
    }

    // Search existing records for a match
    const filter = encodeURIComponent(`{${matchField}} = "${matchValue}"`)
    const existing = await this.request<AirtableListResponse>(
      'GET',
      `/${encodeURIComponent(tableId)}?filterByFormula=${filter}&maxRecords=1`,
    )

    if (existing.records.length > 0) {
      const record = await this.updateRecord(tableId, existing.records[0].id!, fields)
      return { record, created: false }
    }

    const record = await this.createRecord(tableId, fields)
    return { record, created: true }
  }
}
