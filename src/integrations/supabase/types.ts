export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      classification_status: {
        Row: {
          category: string | null;
          classified_at: string | null;
          classifier: string | null;
          confidence: number | null;
          created_at: string;
          id: string;
          message_log_id: string;
          metadata: Json;
          review_notes: string | null;
          status: string;
          subcategory: string | null;
          updated_at: string;
        };
        Insert: {
          category?: string | null;
          classified_at?: string | null;
          classifier?: string | null;
          confidence?: number | null;
          created_at?: string;
          id?: string;
          message_log_id: string;
          metadata?: Json;
          review_notes?: string | null;
          status?: string;
          subcategory?: string | null;
          updated_at?: string;
        };
        Update: {
          category?: string | null;
          classified_at?: string | null;
          classifier?: string | null;
          confidence?: number | null;
          created_at?: string;
          id?: string;
          message_log_id?: string;
          metadata?: Json;
          review_notes?: string | null;
          status?: string;
          subcategory?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "classification_status_message_log_id_fkey";
            columns: ["message_log_id"];
            isOneToOne: true;
            referencedRelation: "message_logs";
            referencedColumns: ["id"];
          },
        ];
      };
      message_logs: {
        Row: {
          content: string;
          created_at: string;
          external_id: string | null;
          id: string;
          metadata: Json;
          origin: string;
          processed_at: string | null;
          received_at: string;
          request_id: string | null;
          response_text: string | null;
          role: string;
          session_id: string | null;
          source: string;
          updated_at: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          external_id?: string | null;
          id?: string;
          metadata?: Json;
          origin: string;
          processed_at?: string | null;
          received_at?: string;
          request_id?: string | null;
          response_text?: string | null;
          role?: string;
          session_id?: string | null;
          source?: string;
          updated_at?: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          external_id?: string | null;
          id?: string;
          metadata?: Json;
          origin?: string;
          processed_at?: string | null;
          received_at?: string;
          request_id?: string | null;
          response_text?: string | null;
          role?: string;
          session_id?: string | null;
          source?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          created_at: string;
          id: string;
          order_id: string;
          price: number;
          product_id: string;
          product_name: string;
          quantity: number;
          size: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          order_id: string;
          price: number;
          product_id: string;
          product_name: string;
          quantity: number;
          size: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          order_id?: string;
          price?: number;
          product_id?: string;
          product_name?: string;
          quantity?: number;
          size?: number;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          created_at: string;
          id: string;
          shipping_address: Json | null;
          status: string;
          total: number;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          shipping_address?: Json | null;
          status?: string;
          total: number;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          shipping_address?: Json | null;
          status?: string;
          total?: number;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          updated_at: string;
          username: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id: string;
          updated_at?: string;
          username: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          updated_at?: string;
          username?: string;
        };
        Relationships: [];
      };
      store_reviews: {
        Row: {
          author_name: string;
          body: string;
          created_at: string;
          id: string;
          is_featured: boolean;
          rating: number;
          title: string;
          updated_at: string;
        };
        Insert: {
          author_name: string;
          body: string;
          created_at?: string;
          id?: string;
          is_featured?: boolean;
          rating?: number;
          title: string;
          updated_at?: string;
        };
        Update: {
          author_name?: string;
          body?: string;
          created_at?: string;
          id?: string;
          is_featured?: boolean;
          rating?: number;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          brand: string;
          category: string;
          created_at: string;
          description: string | null;
          id: string;
          image: string;
          is_new: boolean;
          name: string;
          original_price: number | null;
          price: number;
          rating: number;
          reviews: number;
          sizes: number[] | null;
          stock: number | null;
          updated_at: string;
        };
        Insert: {
          brand: string;
          category: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          image: string;
          is_new?: boolean;
          name: string;
          original_price?: number | null;
          price: number;
          rating?: number;
          reviews?: number;
          sizes?: number[] | null;
          stock?: number | null;
          updated_at?: string;
        };
        Update: {
          brand?: string;
          category?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          image?: string;
          is_new?: boolean;
          name?: string;
          original_price?: number | null;
          price?: number;
          rating?: number;
          reviews?: number;
          sizes?: number[] | null;
          stock?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_preferences: {
        Row: {
          created_at: string;
          id: string;
          metadata: Json;
          preference_key: string;
          preference_value: Json;
          source: string;
          subject_id: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          metadata?: Json;
          preference_key: string;
          preference_value?: Json;
          source?: string;
          subject_id?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          metadata?: Json;
          preference_key?: string;
          preference_value?: Json;
          source?: string;
          subject_id?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          role: "admin" | "customer";
          user_id: string;
        };
        Insert: {
          created_at?: string;
          role?: "admin" | "customer";
          user_id: string;
        };
        Update: {
          created_at?: string;
          role?: "admin" | "customer";
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: string;
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "customer";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
