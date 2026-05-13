export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type InvoiceStatus =
  | 'pending'
  | 'processing'
  | 'extracted'
  | 'ares_checked'
  | 'crm_sent'
  | 'error'
  | 'ignored'

export type CrmType = 'pohoda' | 'fakturoid' | 'idoklad' | 'money_s3' | 'raynet'
export type EmailProvider = 'gmail' | 'imap' | 'outlook' | 'seznam'
export type Plan = 'starter' | 'pro' | 'enterprise'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          company_name: string | null
          ico: string | null
          dic: string | null
          plan: Plan
          invoices_this_month: number
          invoices_limit: number
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      email_connections: {
        Row: {
          id: string
          user_id: string
          provider: EmailProvider
          email_address: string
          access_token: string | null
          refresh_token: string | null
          token_expiry: string | null
          imap_host: string | null
          imap_port: number | null
          imap_username: string | null
          imap_password: string | null
          imap_use_ssl: boolean
          is_active: boolean
          is_verified: boolean
          last_checked_at: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['email_connections']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['email_connections']['Insert']>
      }
      crm_connections: {
        Row: {
          id: string
          user_id: string
          crm_type: CrmType
          display_name: string | null
          api_key: string | null
          api_url: string | null
          api_secret: string | null
          pohoda_version: string | null
          pohoda_xml_import_path: string | null
          pohoda_ico: string | null
          fakturoid_slug: string | null
          idoklad_client_id: string | null
          money_export_format: string | null
          is_active: boolean
          is_verified: boolean
          last_used_at: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['crm_connections']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['crm_connections']['Insert']>
      }
      invoices: {
        Row: {
          id: string
          user_id: string
          email_connection_id: string | null
          crm_connection_id: string | null
          email_message_id: string | null
          email_subject: string | null
          email_from: string | null
          email_received_at: string | null
          attachment_filename: string | null
          attachment_type: string | null
          supplier_name: string | null
          supplier_ico: string | null
          supplier_dic: string | null
          supplier_address: string | null
          supplier_city: string | null
          supplier_zip: string | null
          invoice_number: string | null
          invoice_date: string | null
          duzp: string | null
          due_date: string | null
          currency: string
          amount_without_vat: number | null
          vat_amount: number | null
          amount_total: number | null
          dph_lines: Json | null
          variable_symbol: string | null
          constant_symbol: string | null
          specific_symbol: string | null
          bank_account_cz: string | null
          iban: string | null
          swift: string | null
          payment_method: string | null
          ares_verified: boolean
          ares_company_name: string | null
          ares_address: string | null
          ares_dic: string | null
          ares_data: Json | null
          raw_extraction: Json | null
          extraction_model: string | null
          extraction_tokens: number | null
          crm_record_id: string | null
          crm_synced_at: string | null
          status: InvoiceStatus
          error_message: string | null
          retry_count: number
          processed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<
          Database['public']['Tables']['invoices']['Row'],
          'id' | 'created_at' | 'updated_at'
        >
        Update: Partial<Database['public']['Tables']['invoices']['Insert']>
      }
      processing_logs: {
        Row: {
          id: string
          user_id: string
          invoice_id: string | null
          action: string
          status: string
          message: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['processing_logs']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['processing_logs']['Insert']>
      }
    }
  }
}

// Convenient row types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type EmailConnection = Database['public']['Tables']['email_connections']['Row']
export type CrmConnection = Database['public']['Tables']['crm_connections']['Row']
export type Invoice = Database['public']['Tables']['invoices']['Row']
export type ProcessingLog = Database['public']['Tables']['processing_logs']['Row']

// Czech invoice extraction result (returned by GPT)
export interface ExtractedInvoice {
  supplier_name: string | null
  supplier_ico: string | null       // 8 digits
  supplier_dic: string | null       // CZ + digits
  supplier_address: string | null
  supplier_city: string | null
  supplier_zip: string | null
  invoice_number: string | null
  invoice_date: string | null       // ISO date
  duzp: string | null               // Datum uskutečnění zdanitelného plnění
  due_date: string | null
  currency: string                  // default CZK
  amount_without_vat: number | null
  vat_amount: number | null
  amount_total: number | null
  dph_lines: DphLine[]
  variable_symbol: string | null
  constant_symbol: string | null
  specific_symbol: string | null
  bank_account_cz: string | null    // format: 123456789/0800
  iban: string | null
  swift: string | null
  payment_method: string | null
}

export interface DphLine {
  rate: number          // 21 | 12 | 0
  base: number          // základ DPH
  vat_amount: number    // výše DPH
}
