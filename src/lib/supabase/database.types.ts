export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      caregivers: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      email_sends: {
        Row: {
          caregiver_id: string
          export_id: string | null
          id: string
          sent_at: string
          to_address: string
        }
        Insert: {
          caregiver_id?: string
          export_id?: string | null
          id?: string
          sent_at?: string
          to_address: string
        }
        Update: {
          caregiver_id?: string
          export_id?: string | null
          id?: string
          sent_at?: string
          to_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_sends_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "caregivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sends_export_id_fkey"
            columns: ["export_id"]
            isOneToOne: false
            referencedRelation: "exports"
            referencedColumns: ["id"]
          },
        ]
      }
      exports: {
        Row: {
          created_at: string
          findings_snapshot: Json
          id: string
          patient_id: string
        }
        Insert: {
          created_at?: string
          findings_snapshot: Json
          id?: string
          patient_id: string
        }
        Update: {
          created_at?: string
          findings_snapshot?: Json
          id?: string
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exports_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      formulations: {
        Row: {
          active_ingredients: Json
          brand_name: string
          created_at: string
          directions_text: string | null
          dosage_form: string
          dosage_table_html: string | null
          generic_name: string
          id: string
          is_fictional: boolean
          label_effective_date: string | null
          label_sections: Json
          labeler_name: string | null
          max_24h_text: string | null
          ndc_packages: string[]
          openfda_set_id: string | null
          reviewed_at: string | null
          slug: string
          source: string
          source_links: Json
          warnings_quotes: string[]
        }
        Insert: {
          active_ingredients?: Json
          brand_name: string
          created_at?: string
          directions_text?: string | null
          dosage_form: string
          dosage_table_html?: string | null
          generic_name: string
          id?: string
          is_fictional?: boolean
          label_effective_date?: string | null
          label_sections?: Json
          labeler_name?: string | null
          max_24h_text?: string | null
          ndc_packages?: string[]
          openfda_set_id?: string | null
          reviewed_at?: string | null
          slug: string
          source: string
          source_links?: Json
          warnings_quotes?: string[]
        }
        Update: {
          active_ingredients?: Json
          brand_name?: string
          created_at?: string
          directions_text?: string | null
          dosage_form?: string
          dosage_table_html?: string | null
          generic_name?: string
          id?: string
          is_fictional?: boolean
          label_effective_date?: string | null
          label_sections?: Json
          labeler_name?: string | null
          max_24h_text?: string | null
          ndc_packages?: string[]
          openfda_set_id?: string | null
          reviewed_at?: string | null
          slug?: string
          source?: string
          source_links?: Json
          warnings_quotes?: string[]
        }
        Relationships: []
      }
      history: {
        Row: {
          action: string
          actor: string | null
          after: Json | null
          at: string
          before: Json | null
          entity: string
          entity_id: string
          id: number
          patient_id: string
        }
        Insert: {
          action: string
          actor?: string | null
          after?: Json | null
          at?: string
          before?: Json | null
          entity: string
          entity_id: string
          id?: never
          patient_id: string
        }
        Update: {
          action?: string
          actor?: string | null
          after?: Json | null
          at?: string
          before?: Json | null
          entity?: string
          entity_id?: string
          id?: never
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "history_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_entries: {
        Row: {
          confirmed_at: string | null
          created_at: string
          fields: Json
          formulation_id: string | null
          id: string
          input_method: string
          patient_id: string
          source_document_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          fields?: Json
          formulation_id?: string | null
          id?: string
          input_method: string
          patient_id: string
          source_document_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          fields?: Json
          formulation_id?: string | null
          id?: string
          input_method?: string
          patient_id?: string
          source_document_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_entries_formulation_id_fkey"
            columns: ["formulation_id"]
            isOneToOne: false
            referencedRelation: "formulations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_entries_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_entries_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "source_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          caregiver_id: string
          created_at: string
          display_name: string
          id: string
          is_demo: boolean
          notes: string | null
          relationship: string | null
          updated_at: string
        }
        Insert: {
          caregiver_id?: string
          created_at?: string
          display_name: string
          id?: string
          is_demo?: boolean
          notes?: string | null
          relationship?: string | null
          updated_at?: string
        }
        Update: {
          caregiver_id?: string
          created_at?: string
          display_name?: string
          id?: string
          is_demo?: boolean
          notes?: string | null
          relationship?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "caregivers"
            referencedColumns: ["id"]
          },
        ]
      }
      source_documents: {
        Row: {
          created_at: string
          document_date: string | null
          facility: string | null
          id: string
          kind: string
          patient_id: string
          pharmacy: string | null
          photo_path: string | null
          prescriber: string | null
          transcript_text: string | null
        }
        Insert: {
          created_at?: string
          document_date?: string | null
          facility?: string | null
          id?: string
          kind: string
          patient_id: string
          pharmacy?: string | null
          photo_path?: string | null
          prescriber?: string | null
          transcript_text?: string | null
        }
        Update: {
          created_at?: string
          document_date?: string | null
          facility?: string | null
          id?: string
          kind?: string
          patient_id?: string
          pharmacy?: string | null
          photo_path?: string | null
          prescriber?: string | null
          transcript_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "source_documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      formulation_search_text: {
        Args: { brand_name: string; dosage_form: string; generic_name: string }
        Returns: string
      }
      search_formulations: {
        Args: { max_results?: number; query: string }
        Returns: {
          active_ingredients: Json
          brand_name: string
          created_at: string
          directions_text: string | null
          dosage_form: string
          dosage_table_html: string | null
          generic_name: string
          id: string
          is_fictional: boolean
          label_effective_date: string | null
          label_sections: Json
          labeler_name: string | null
          max_24h_text: string | null
          ndc_packages: string[]
          openfda_set_id: string | null
          reviewed_at: string | null
          slug: string
          source: string
          source_links: Json
          warnings_quotes: string[]
        }[]
        SetofOptions: {
          from: "*"
          to: "formulations"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
